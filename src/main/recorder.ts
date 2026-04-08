/**
 * Phase 12.B.2 — Visual selector recorder.
 * Phase 17     — Enhanced recorder with timingMs, domSnapshot, network capture,
 *                scroll events, and DB persistence of RecordingSession.
 *
 * Attaches a small in-page recorder to the active page of a running profile.
 * The recorder listens for click / input / change / submit / scroll events,
 * generates a robust CSS selector for the target, and forwards a serialized
 * event back to the main process via `page.exposeFunction`.
 *
 * Recorded events are buffered in main and converted to `AutomationStep[]`
 * on demand. The renderer polls `recorder:state` to render live progress and
 * calls `recorder:stop` to finalize the recording.
 */

import type { Page } from 'puppeteer-core'
import { v4 as uuidv4 } from 'uuid'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import type { AutomationStep, RecordedEvent, RecordedScreenshot } from '../shared/types'

export type { RecordedEvent }

interface RecorderSession {
  /** DB session id (Phase 17) */
  sessionId: string
  profileId: string
  page: Page
  events: RecordedEvent[]
  /** Tier 3: screenshots keyed by event timestamp */
  screenshots: RecordedScreenshot[]
  captureScreenshots: boolean
  /** Phase 17: capture network requests per event */
  captureNetwork: boolean
  startedAt: number
  lastUrl: string
  /** Phase 17: track how many events have been flushed to DB */
  lastFlushedIndex: number
  /** Phase 17: network requests fired since last event (cleared on each event) */
  pendingNetworkRequests: string[]
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

  /**
   * Start (or resume) recording for the given profile.
   * Phase 17: persists a RecordingSession row to DB immediately on start.
   */
  async start(
    profileId: string,
    captureScreenshots = false,
    captureNetwork = false
  ): Promise<string> {
    if (this.sessions.has(profileId)) {
      return this.sessions.get(profileId)!.sessionId
    }

    const bm = BrowserManager.getInstance()
    const page = await bm.getActivePage(profileId)
    if (!page) throw new Error('Profile is not running — launch it first')

    const sessionId = uuidv4()
    const startUrl = page.url()

    const session: RecorderSession = {
      sessionId,
      profileId,
      page,
      events: [],
      screenshots: [],
      captureScreenshots,
      captureNetwork,
      startedAt: Date.now(),
      lastUrl: startUrl,
      lastFlushedIndex: 0,
      pendingNetworkRequests: []
    }
    this.sessions.set(profileId, session)

    // Phase 17: persist session to DB
    const db = Database.getInstance()
    db.createRecordingSession({
      id: sessionId,
      profileId,
      startedAt: new Date().toISOString(),
      startUrl: startUrl !== 'about:blank' ? startUrl : undefined,
      captureScreenshots,
      captureNetwork
    })

    // Initial navigate event so playback starts on the right page
    if (startUrl && startUrl !== 'about:blank') {
      session.events.push({
        type: 'navigate',
        selector: '',
        url: startUrl,
        timestamp: Date.now(),
        timingMs: 0,
        label: `Open ${startUrl}`
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

    return sessionId
  }

  /**
   * Stop recording and return the captured events + generated steps.
   * Phase 17: updates session status to 'stopped' in DB.
   */
  async stop(profileId: string): Promise<{
    sessionId: string
    events: RecordedEvent[]
    steps: AutomationStep[]
    screenshots: RecordedScreenshot[]
    selectorIssues: { selector: string; found: boolean }[]
  }> {
    const session = this.sessions.get(profileId)
    if (!session) return { sessionId: '', events: [], steps: [], screenshots: [], selectorIssues: [] }
    this.sessions.delete(profileId)

    const events = session.events
    const steps = this.eventsToSteps(events)
    const screenshots = session.screenshots
    const selectorIssues = await this.validateSelectors(session.page, steps)

    // Phase 17: persist final events and mark stopped
    const db = Database.getInstance()
    let pageTitle: string | undefined
    try { pageTitle = await session.page.title() } catch { /* ignore */ }
    db.updateRecordingSession(session.sessionId, {
      events,
      stoppedAt: new Date().toISOString(),
      pageTitle,
      status: 'stopped'
    })

    return { sessionId: session.sessionId, events, steps, screenshots, selectorIssues }
  }

  /** Snapshot of the current recording (for live UI updates). */
  state(profileId: string): {
    recording: boolean
    sessionId: string | null
    events: RecordedEvent[]
    steps: AutomationStep[]
    screenshots: RecordedScreenshot[]
  } {
    const session = this.sessions.get(profileId)
    if (!session) return { recording: false, sessionId: null, events: [], steps: [], screenshots: [] }
    return {
      recording: true,
      sessionId: session.sessionId,
      events: session.events.slice(),
      steps: this.eventsToSteps(session.events),
      screenshots: session.screenshots.slice()
    }
  }

  // ── Tier 3: Selector validation ─────────────────────────────────────────

  private async validateSelectors(
    page: Page,
    steps: AutomationStep[]
  ): Promise<{ selector: string; found: boolean }[]> {
    const selectorActions = new Set([
      'click', 'doubleClick', 'rightClick', 'hover', 'type', 'waitForSelector',
      'extractText', 'select', 'setAttribute', 'upload'
    ])
    const issues: { selector: string; found: boolean }[] = []
    for (const step of steps) {
      if (!selectorActions.has(step.action) || !step.params?.selector) continue
      try {
        const el = await page.$(step.params.selector)
        issues.push({ selector: step.params.selector, found: el !== null })
      } catch {
        issues.push({ selector: step.params.selector, found: false })
      }
    }
    return issues
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Wire the recorder bridge into a page. Idempotent per page. */
  private async bindPage(session: RecorderSession, page: Page): Promise<void> {
    if (this.boundPages.has(page)) return
    this.boundPages.add(page)

    // Phase 17: network request capture
    if (session.captureNetwork) {
      page.on('request', (req) => {
        const liveSession = this.sessions.get(session.profileId)
        if (!liveSession) return
        liveSession.pendingNetworkRequests.push(req.url())
      })
    }

    // Bridge: page → main
    try {
      await page.exposeFunction('__ghostRecord', (raw: any) => {
        if (!this.sessions.has(session.profileId)) return
        const liveSession = this.sessions.get(session.profileId)!
        const prev = liveSession.events[liveSession.events.length - 1]
        const now = Date.now()
        const timingMs = prev ? now - prev.timestamp : 0

        // Collect and clear pending network requests
        const networkRequests = liveSession.captureNetwork
          ? liveSession.pendingNetworkRequests.splice(0)
          : undefined

        const ev: RecordedEvent = {
          type: raw.type,
          selector: String(raw.selector ?? ''),
          value: raw.value !== undefined ? String(raw.value) : undefined,
          tag: raw.tag,
          label: raw.label,
          url: raw.url,
          timestamp: now,
          timingMs,
          domSnapshot: raw.domSnapshot,
          networkRequests: networkRequests && networkRequests.length > 0 ? networkRequests : undefined
        }
        this.coalesceAndPush(liveSession, ev)
      })
    } catch {
      // Function may already exist if page was bound by an earlier session
    }

    // Track navigations
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return
      const url = frame.url()
      if (!url || url === 'about:blank') return
      const liveSession = this.sessions.get(session.profileId)
      if (!liveSession) return
      if (url === liveSession.lastUrl) return
      liveSession.lastUrl = url
      const prev = liveSession.events[liveSession.events.length - 1]
      const now = Date.now()
      liveSession.events.push({
        type: 'navigate',
        selector: '',
        url,
        timestamp: now,
        timingMs: prev ? now - prev.timestamp : 0,
        label: `Open ${url}`
      })
    })

    // Inject the in-page listener
    await page.evaluateOnNewDocument(RECORDER_BOOTSTRAP)
    try {
      await page.evaluate(RECORDER_BOOTSTRAP)
    } catch {
      // Page may be navigating
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
      last.timingMs = (last.timingMs ?? 0) + (ev.timingMs ?? 0)
      if (ev.networkRequests?.length) {
        last.networkRequests = [...(last.networkRequests ?? []), ...ev.networkRequests]
      }
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

    // Screenshot after each event (Tier 3 + Phase 17)
    if (session.captureScreenshots) {
      const ts = ev.timestamp
      session.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 })
        .then((buf) => {
          const dataUrl = `data:image/jpeg;base64,${buf as string}`
          session.screenshots.push({ eventTimestamp: ts, dataUrl })
          if (session.screenshots.length > 50) session.screenshots.shift()
        })
        .catch(() => { /* non-fatal */ })
    }

    // Phase 17: flush to DB every 5 events
    const unflushed = session.events.length - session.lastFlushedIndex
    if (unflushed >= 5) {
      session.lastFlushedIndex = session.events.length
      try {
        const db = Database.getInstance()
        db.updateRecordingSession(session.sessionId, { events: session.events.slice() })
      } catch { /* non-fatal */ }
    }
  }

  /** Convert the recorded event stream into AutomationStep[]. */
  eventsToSteps(events: RecordedEvent[]): AutomationStep[] {
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
        case 'scroll':
          steps.push({
            id: uuidv4(),
            action: 'scroll',
            label: ev.label || 'Scroll page',
            params: { y: ev.value ? parseInt(ev.value, 10) : 300 }
          })
          break
        case 'keypress':
          steps.push({
            id: uuidv4(),
            action: 'keyPress',
            label: ev.label || `Press ${ev.value}`,
            params: { key: ev.value ?? 'Enter' }
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
 * Phase 17: captures DOM snapshots, scroll events.
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

  /** Phase 17: capture 3-level ancestor HTML for DOM snapshot (max 2KB). */
  function domSnapshotFor(el) {
    try {
      var node = el;
      var depth = 0;
      while (node && node.parentElement && depth < 3) {
        node = node.parentElement;
        depth++;
      }
      if (!node) return undefined;
      var html = node.outerHTML || '';
      return html.length > 2048 ? html.slice(0, 2048) + '...' : html;
    } catch (e) {
      return undefined;
    }
  }

  function send(payload) {
    try { window.__ghostRecord(payload); } catch (e) { /* noop */ }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
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
      label: 'Click "' + labelFor(el).slice(0, 30) + '"',
      domSnapshot: domSnapshotFor(el)
    });
  }, true);

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable)) return;
    if (el.type === 'password') {
      send({
        type: 'input',
        selector: selectorFor(el),
        value: '',
        tag: el.tagName.toLowerCase(),
        label: 'Type password into ' + (el.name || labelFor(el)),
        domSnapshot: domSnapshotFor(el)
      });
      return;
    }
    send({
      type: 'input',
      selector: selectorFor(el),
      value: el.value !== undefined ? el.value : (el.textContent || ''),
      tag: el.tagName.toLowerCase(),
      label: 'Type into ' + labelFor(el),
      domSnapshot: domSnapshotFor(el)
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
      label: 'Select ' + (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value),
      domSnapshot: domSnapshotFor(el)
    });
  }, true);

  document.addEventListener('submit', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'FORM') return;
    send({
      type: 'submit',
      selector: selectorFor(el),
      tag: 'form',
      label: 'Submit form',
      domSnapshot: domSnapshotFor(el)
    });
  }, true);

  // Phase 17: scroll event capture (throttled)
  var lastScrollSent = 0;
  document.addEventListener('scroll', function () {
    var now = Date.now();
    if (now - lastScrollSent < 1000) return; // max 1 scroll event per second
    lastScrollSent = now;
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    send({
      type: 'scroll',
      selector: '',
      value: String(Math.round(scrollY)),
      tag: 'document',
      label: 'Scroll to ' + Math.round(scrollY) + 'px'
    });
  }, { passive: true });
})();`
