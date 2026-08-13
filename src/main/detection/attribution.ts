/**
 * Attributing a bad canary verdict to the fingerprint or to the IP.
 *
 * A verdict is a property of a (profile × proxy) pair, not of the profile. A
 * datacenter IP gets challenged carrying a flawless fingerprint, and a sloppy
 * fingerprint sails through on a clean residential IP. Reporting only "this
 * profile was challenged" sends users off tuning fingerprints to fix an IP
 * problem — the single most expensive wrong turn this feature can cause.
 *
 * The inference is cheap once verdicts are stored per pair:
 *
 *   - the same proxy passing for other profiles  ⇒ the proxy is fine, suspect
 *     the fingerprint
 *   - the same profile passing on other proxies  ⇒ the fingerprint is fine,
 *     suspect the IP
 *
 * Pure functions over stored history, so the whole decision table unit-tests.
 */
import type { CanaryVerdict } from './canary'

export interface CanaryRecord {
  profileId: string
  proxyId: string | null
  verdict: CanaryVerdict
  testedAt: string
}

export type Suspect = 'fingerprint' | 'ip' | 'both' | 'inconclusive'

export interface Attribution {
  suspect: Suspect
  /** One sentence, written to be shown to the user as-is. */
  summary: string
}

/** Verdicts that mean a WAF acted. `unreachable` is not evidence either way. */
function isBad(v: CanaryVerdict): boolean {
  return v === 'js-challenge' || v === 'captcha' || v === 'blocked'
}

function isGood(v: CanaryVerdict): boolean {
  return v === 'passed'
}

/**
 * Works out which variable a failing verdict implicates.
 *
 * `history` should exclude the run being attributed; passing it in makes no
 * difference to the outcome but muddies the counts.
 */
export function attributeVerdict(
  current: { profileId: string; proxyId: string | null; verdict: CanaryVerdict },
  history: CanaryRecord[]
): Attribution {
  if (!isBad(current.verdict)) {
    return { suspect: 'inconclusive', summary: 'No mitigation to attribute' }
  }

  // Did this same IP work for anyone else?
  const sameProxy = current.proxyId
    ? history.filter((h) => h.proxyId === current.proxyId && h.profileId !== current.profileId)
    : []
  const proxyWorksElsewhere = sameProxy.some((h) => isGood(h.verdict))

  // Did this same profile work through a different IP?
  const sameProfile = history.filter(
    (h) => h.profileId === current.profileId && h.proxyId !== current.proxyId
  )
  const profileWorksElsewhere = sameProfile.some((h) => isGood(h.verdict))

  if (proxyWorksElsewhere && profileWorksElsewhere) {
    // Each half is individually fine, so it is the pairing — most often a
    // mismatch between the fingerprint's locale and where the IP geolocates.
    return {
      suspect: 'both',
      summary:
        'This proxy passes for other profiles and this profile passes on other proxies — ' +
        'the combination is what fails, so check locale/timezone against the exit country'
    }
  }

  if (proxyWorksElsewhere) {
    return {
      suspect: 'fingerprint',
      summary: `This proxy passes for ${sameProxy.filter((h) => isGood(h.verdict)).length} other profile(s) — the fingerprint is the differing variable`
    }
  }

  if (profileWorksElsewhere) {
    return {
      suspect: 'ip',
      summary: `This profile passes on ${sameProfile.filter((h) => isGood(h.verdict)).length} other proxy(s) — the IP is the differing variable`
    }
  }

  // Nothing to compare against. Say so rather than guessing — a confident wrong
  // attribution is worse than none.
  const hint = current.proxyId
    ? 'Re-run this profile on a different proxy to tell the two apart'
    : 'Profile ran direct; assign a proxy and re-run to tell the two apart'
  return { suspect: 'inconclusive', summary: `No passing comparison recorded yet. ${hint}` }
}
