import type { LocaleConfig } from '../../../shared/types'

/**
 * Phase 8 — Intl API locale normalization.
 *
 * Normalises the output of Intl.DateTimeFormat, Intl.NumberFormat, and
 * Intl.Collator so they consistently report the spoofed locale rather than
 * leaking the host OS locale.  Also patches Intl.supportedValuesOf to return
 * a stable subset, preventing enumeration-based fingerprinting.
 */
export function buildIntlScript(locale: LocaleConfig): string {
  const lang   = JSON.stringify(locale.language)
  const langs  = JSON.stringify(locale.languages)
  const tz     = JSON.stringify(locale.timezone)

  return `
(function() {
  'use strict';

  var _lang  = ${lang};
  var _langs = ${langs};
  var _tz    = ${tz};

  // ── Intl.DateTimeFormat ────────────────────────────────────────────────────

  var _origDTF = Intl.DateTimeFormat;
  function PatchedDateTimeFormat(locales, options) {
    // Always resolve to our spoofed locale
    var resolvedLocale = locales || _lang;
    if (!options) options = {};
    if (!options.timeZone) options.timeZone = _tz;
    var instance = new _origDTF(resolvedLocale, options);

    // Override resolvedOptions to report our locale/timezone
    var origResolved = instance.resolvedOptions.bind(instance);
    instance.resolvedOptions = function() {
      var opts = origResolved();
      opts.locale   = _lang;
      opts.timeZone = _tz;
      return opts;
    };
    return instance;
  }
  PatchedDateTimeFormat.prototype       = _origDTF.prototype;
  PatchedDateTimeFormat.supportedLocalesOf = _origDTF.supportedLocalesOf.bind(_origDTF);
  Object.defineProperty(PatchedDateTimeFormat, 'toString', {
    value: function() { return 'function DateTimeFormat() { [native code] }'; },
    configurable: true
  });

  try { Intl.DateTimeFormat = PatchedDateTimeFormat; } catch(e) {}

  // ── Intl.NumberFormat ──────────────────────────────────────────────────────

  var _origNF = Intl.NumberFormat;
  function PatchedNumberFormat(locales, options) {
    var resolvedLocale = locales || _lang;
    var instance = new _origNF(resolvedLocale, options);
    var origResolved = instance.resolvedOptions.bind(instance);
    instance.resolvedOptions = function() {
      var opts = origResolved();
      opts.locale = _lang;
      return opts;
    };
    return instance;
  }
  PatchedNumberFormat.prototype          = _origNF.prototype;
  PatchedNumberFormat.supportedLocalesOf = _origNF.supportedLocalesOf.bind(_origNF);
  Object.defineProperty(PatchedNumberFormat, 'toString', {
    value: function() { return 'function NumberFormat() { [native code] }'; },
    configurable: true
  });

  try { Intl.NumberFormat = PatchedNumberFormat; } catch(e) {}

  // ── Intl.Collator ─────────────────────────────────────────────────────────

  var _origColl = Intl.Collator;
  function PatchedCollator(locales, options) {
    var resolvedLocale = locales || _lang;
    var instance = new _origColl(resolvedLocale, options);
    var origResolved = instance.resolvedOptions.bind(instance);
    instance.resolvedOptions = function() {
      var opts = origResolved();
      opts.locale = _lang;
      return opts;
    };
    return instance;
  }
  PatchedCollator.prototype          = _origColl.prototype;
  PatchedCollator.supportedLocalesOf = _origColl.supportedLocalesOf.bind(_origColl);
  Object.defineProperty(PatchedCollator, 'toString', {
    value: function() { return 'function Collator() { [native code] }'; },
    configurable: true
  });

  try { Intl.Collator = PatchedCollator; } catch(e) {}

  // ── Intl.supportedValuesOf ─────────────────────────────────────────────────
  // Returns a deterministic stable subset — prevents fingerprint via value count

  var STABLE_CALENDARS    = ['gregory', 'iso8601', 'japanese', 'chinese', 'buddhist'];
  var STABLE_NUMBERING    = ['arab', 'deva', 'hanidec', 'latn', 'tibt'];
  var STABLE_TIME_ZONES   = [_tz, 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
  var STABLE_CURRENCIES   = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'VND', 'THB', 'IDR'];
  var STABLE_UNITS        = ['meter', 'kilogram', 'second', 'liter', 'degree'];

  var STABLE_VALUES = {
    calendar:  STABLE_CALENDARS,
    collation: ['standard', 'compat', 'pinyin', 'stroke', 'phonebk'],
    currency:  STABLE_CURRENCIES,
    numberingSystem: STABLE_NUMBERING,
    timeZone:  STABLE_TIME_ZONES,
    unit:      STABLE_UNITS
  };

  if (typeof Intl.supportedValuesOf === 'function') {
    var _origSVO = Intl.supportedValuesOf.bind(Intl);
    Object.defineProperty(Intl, 'supportedValuesOf', {
      value: function supportedValuesOf(key) {
        if (STABLE_VALUES[key]) return STABLE_VALUES[key].slice();
        return _origSVO(key);
      },
      writable: true,
      configurable: true
    });
  }
})();
`
}
