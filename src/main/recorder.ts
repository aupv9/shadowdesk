/**
 * Phase 12.B.2 — Visual selector recorder.
 *
 * Attaches a small in-page recorder to the active page of a running profile.
 * The recorder listens for click / input / change / submit events, generates
 * a robust CSS selector for the target, and forwards a serialized event back
 * to the main process via `page.exposeFunction`.
 *
 * Recorded events are buffered in main and converted to `AutomationStep[]`
 * on demand. The renderer polls `recorder:state` to render live progress and
 * calls `recorder:stop` to finalize the recording.
 *
 * Design notes:
 * - The recorder script runs only inside the page when recording is active —
 *   it is not part of the standard fingerprint injection pipeline.
 * - Event coalescing: a click immediately followed by typing into the same
 *   element is collapsed into a single `type` step (no separate click).
 * - Per-keystroke `input` events are coalesced into one `type` step on either
 *   blur or the next interaction with a different selector.
 * - Selector strategy: prefer `#id`, then `[data-testid]`, then `[name]`, then
 *   a 1-deep ancestor + tag chain. Avoids brittle nth-child as the *first*
 *   choice but falls back to it as a last resort.
 */

import type { Page } from 'puppeteer-core'
import { BrowserManager } from './browser-manager'
import type { AutomationStep } from '../shared/types'
import { v4 as uuidv4 } from 'uuid'

export type RecordedEventType = 'click' | 'input' | 'change' | 'submit' | 'navigate'

export interface RecordedEvent {
  type: RecordedEventType
  selector: string
  /** For inputs, the final value typed. For selects, the chosen value. */
  value?: string
  /** For navigations, the URL that the page is now on. */
  url?: string
  /** Element tag name lowercase (`input`, `button`, …). */
  tag?: string
  /** Best-effort human label for the step (`Click "Sign in"`). */
  label?: string
  timestamp: number
}

interface RecorderSession {
  profileId: string
  page: Page
  events: RecordedEvent[]
  startedAt: number
  /** Last URL we observed — used to dedupe rapid framenav events. */
  lastUrl: string
}

export class Recorder {
  private static instance: Recorder
  private sessions = new Map<string, RecorderSession>()
  /** Page instances we've already wired up so we don't double-bind. */
  private boundPages = new WeakSet<Page>()

  static getInstance(): Recorder {
    if (!Recorder.instance) Recorder.instance = new Recorder()
    return Recorder.instance
  }

  isRecording(profileId: string): boolean {
    return this.sessions.has(profileId)
  }

  /** Start (or resume) recording for the given profile. */
  async start(profileId: string): Promise<void> {
    if (this.sessions.has(profileId)) return // already recording

    const bm = BrowserManager.getInstance()
    const page = await bm.getActivePage(profileId)
    if (!page) throw new Error('Profile is not running — launch it first')

    const session: RecorderSession = {
      profileId,
      page,
      events: [],
      startedAt: Date.now(),
      lastUrl: page.url()
    }
    this.sessions.set(profileId, session)

    // Initial navigate event so playback starts on the right page
    if (session.lastUrl && session.lastUrl !== 'about:blank') {
      session.events.push({
        type: 'navigate',
        selector: '',
        url: session.lastUrl,
        timestamp: Date.now(),
        label: `Open ${session.lastUrl}`
      })
    }

    await this.bindPage(session, page)

    // Bind any future pages opened in the same browser
    const browser = page.browser()
    browser.on('targetcreated', async (target) => {
      if (!this.sessions.has(profileId)) return
      if (target.type() !== 'page') return
      const newPage = await target.page()
      if (newPage) {
        const liveSession = this.sessions.get(profileId)
        if (liveSession) await this.bindPage(liveSession, newPage)
      }
    })
  }

  /** Stop recording and return the captured events + generated steps. */
  stop(profileId: string): { events: RecordedEvent[]; steps: AutomationStep[] } {
    const session = this.sessions.get(profileId)
    if (!session) return { events: [], steps: [] }
    this.sessions.delete(profileId)
    const events = session.events
    const steps = this.eventsToSteps(events)
    return { events, steps }
  }

  /** Snapshot of the current recording (for live UI updates). */
  state(profileId: string): {
    recording: boolean
    events: RecordedEvent[]
    steps: AutomationStep[]
  } {
    const session = this.sessions.get(profileId)
    if (!session) return { recording: false, events: [], steps: [] }
    return {
      recording: true,
      events: session.events.slice(),
      steps: this.eventsToSteps(session.events)
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Wire the recorder bridge into a page. Idempotent per page. */
  private async bindPage(session: RecorderSession, page: Page): Promise<void> {
    if (this.boundPages.has(page)) return
    this.boundPages.add(page)

    // Bridge: page → main
    try {
      await page.exposeFunction('__ghostRecord', (raw: any) => {
        if (!this.sessions.has(session.profileId)) return
        const ev: RecordedEvent = {
          type: raw.type,
          selector: String(raw.selector ?? ''),
          value: raw.value !== undefined ? String(raw.value) : undefined,
          tag: raw.tag,
          label: raw.label,
          url: raw.url,
          timestamp: Date.now()
        }
        this.coalesceAndPush(session, ev)
      })
    } catch (err) {
      // Function may already exist if page was bound by an earlier session
    }

    // Track navigations — emit a navigate event when the URL actually changes
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return
      const url = frame.url()
      if (!url || url === 'about:blank') return
      const liveSession = this.sessions.get(session.profileId)
      if (!liveSession) return
      if (url === liveSession.lastUrl) return
      liveSession.lastUrl = url
      liveSession.events.push({
        type: 'navigate',
        selector: '',
        url,
        timestamp: Date.now(),
        label: `Open ${url}`
      })
    })

    // Inject the in-page listener — both for the current document and any
    // future document loaded in this page.
    await page.evaluateOnNewDocument(RECORDER_BOOTSTRAP)
    try {
      await page.evaluate(RECORDER_BOOTSTRAP)
    } catch {
      // Page may be navigating — the on-new-document hook will retry next load.
    }
  }

  /** Merge consecutive `input` events on the same selector into one. */
  private coalesceAndPush(session: RecorderSession, ev: RecordedEvent): void {
    const last = session.events[session.events.length - 1]
    if (
      last &&
      ev.type === 'input' &&
      last.type === 'input' &&
      last.selector === ev.selector
    ) {
      last.value = ev.value
      last.timestamp = ev.timestamp
      return
    }
    // A click immediately followed by typing into the same selector is just typing.
    if (
      last &&
      ev.type === 'input' &&
      last.type === 'click' &&
      last.selector === ev.selector
    ) {
      session.events.pop()
    }
    session.events.push(ev)
  }

  /** Convert the recorded event stream into AutomationStep[]. */
  private eventsToSteps(events: RecordedEvent[]): AutomationStep[] {
    const steps: AutomationStep[] = []
    for (const ev of events) {
      switch (ev.type) {
        case 'navigate':
          steps.push({
            id: uuidv4(),
            action: 'navigate',
            label: ev.label || `Navigate to ${ev.url}`,
            params: { url: ev.url ?? '' }
          })
          break
        case 'click':
          steps.push({
            id: uuidv4(),
            action: 'click',
            label: ev.label || `Click ${ev.selector}`,
            params: { selector: ev.selector }
          })
          break
        case 'input':
          steps.push({
            id: uuidv4(),
            action: 'type',
            label: ev.label || `Type into ${ev.selector}`,
            params: { selector: ev.selector, text: ev.value ?? '' }
          })
          break
        case 'change':
          // Only emitted for <select> — use the `select` action.
          if (ev.tag === 'select') {
            steps.push({
              id: uuidv4(),
              action: 'select',
              label: ev.label || `Select ${ev.value}`,
              params: { selector: ev.selector, value: ev.value ?? '' }
            })
          } else {
            steps.push({
              id: uuidv4(),
              action: 'type',
              label: ev.label || `Set ${ev.selector}`,
              params: { selector: ev.selector, text: ev.value ?? '' }
            })
          }
          break
        case 'submit':
          steps.push({
            id: uuidv4(),
            action: 'click',
            label: ev.label || `Submit ${ev.selector}`,
            params: { selector: ev.selector }
          })
          break
      }
    }
    return steps
  }
}

/**
 * In-page bootstrap script. Runs inside Chromium and forwards interesting
 * events back to main via the exposed `__ghostRecord` function.
 */
const RECORDER_BOOTSTRAP = `(() => {
  if (window.__ghostRecorderInstalled) return;
  window.__ghostRecorderInstalled = true;

  /** Generate a robust CSS selector for an element. */
  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[a-zA-Z_][\\w-]*$/.test(el.id)) return '#' + el.id;
    var testId = el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-test'));
    if (testId) return '[data-testid="' + cssEscape(testId) + '"]';
    var name = el.getAttribute && el.getAttribute('name');
    if (name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
      return el.tagName.toLowerCase() + '[name="' + cssEscape(name) + '"]';
    }
    var aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) return el.tagName.toLowerCase() + '[aria-label="' + cssEscape(aria) + '"]';

    // Fall back to a 2-level chain with nth-of-type at the leaf
    var path = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 3) {
      var seg = node.tagName.toLowerCase();
      if (node.classList && node.classList.length > 0) {
        var cls = Array.prototype.slice.call(node.classList).filter(function (c) {
          return /^[a-zA-Z_][\\w-]*$/.test(c) && c.length < 30;
        }).slice(0, 2);
        if (cls.length > 0) seg += '.' + cls.join('.');
      }
      // Disambiguate with nth-of-type if there are siblings of the same tag
      var parent = node.parentElement;
      if (parent) {
        var sib = parent.children;
        var same = 0, idx = 0;
        for (var i = 0; i < sib.length; i++) {
          if (sib[i].tagName === node.tagName) {
            same++;
            if (sib[i] === node) idx = same;
          }
        }
        if (same > 1) seg += ':nth-of-type(' + idx + ')';
      }
      path.unshift(seg);
      if (node.id) { path[0] = '#' + node.id; break; }
      node = node.parentElement;
      depth++;
    }
    return path.join(' > ');
  }

  function cssEscape(s) {
    return String(s).replace(/(["\\\\])/g, '\\\\$1');
  }

  function labelFor(el) {
    if (!el) return '';
    var text = (el.innerText || el.textContent || '').trim();
    if (text && text.length < 40) return text;
    var aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) return aria;
    var ph = el.getAttribute && el.getAttribute('placeholder');
    if (ph) return ph;
    var name = el.getAttribute && el.getAttribute('name');
    if (name) return name;
    return el.tagName.toLowerCase();
  }

  function send(payload) {
    try { window.__ghostRecord(payload); } catch (e) { /* noop */ }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    // Walk up to the nearest interactive element so we record the button, not its inner span.
    var cur = t;
    while (cur && cur !== document.body) {
      var tag = cur.tagName;
      if (tag === 'BUTTON' || tag === 'A' || (cur.getAttribute && cur.getAttribute('role') === 'button')) break;
      cur = cur.parentElement;
    }
    var el = cur && cur !== document.body ? cur : t;
    var sel = selectorFor(el);
    if (!sel) return;
    send({
      type: 'click',
      selector: sel,
      tag: el.tagName.toLowerCase(),
      label: 'Click "' + labelFor(el).slice(0, 30) + '"'
    });
  }, true);

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable)) return;
    if (el.type === 'password') {
      // Record the field but mask the value — user can edit before saving.
      send({
        type: 'input',
        selector: selectorFor(el),
        value: '',
        tag: el.tagName.toLowerCase(),
        label: 'Type password into ' + (el.name || labelFor(el))
      });
      return;
    }
    send({
      type: 'input',
      selector: selectorFor(el),
      value: el.value !== undefined ? el.value : (el.textContent || ''),
      tag: el.tagName.toLowerCase(),
      label: 'Type into ' + labelFor(el)
    });
  }, true);

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'SELECT') return;
    send({
      type: 'change',
      selector: selectorFor(el),
      value: el.value,
      tag: 'select',
      label: 'Select ' + (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value)
    });
  }, true);

  document.addEventListener('submit', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'FORM') return;
    send({
      type: 'submit',
      selector: selectorFor(el),
      tag: 'form',
      label: 'Submit form'
    });
  }, true);
})();`
