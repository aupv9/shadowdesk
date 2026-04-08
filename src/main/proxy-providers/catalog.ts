import type { ProxyProviderCatalogEntry, ProxyProviderType } from '../../shared/types'

/**
 * Phase 20 — Proxy Provider Marketplace
 * (User-facing label: "Phase 17 — Proxy API Integration")
 *
 * Static catalog of supported residential proxy providers. Adding a new
 * provider here is the first step before wiring an adapter under
 * `src/main/proxy-providers/adapters/`.
 *
 * Pricing / endpoint hostnames are based on the providers' public docs.
 */
export const PROXY_PROVIDER_CATALOG: Record<ProxyProviderType, ProxyProviderCatalogEntry> = {
  smartproxy: {
    type: 'smartproxy',
    name: 'Smartproxy',
    website: 'https://smartproxy.com',
    description:
      '55M+ residential IPs across 195+ locations. Pay-as-you-go plans, '
      + 'sticky sessions up to 30 minutes, easy username:password auth.',
    pools: ['residential', 'datacenter', 'mobile', 'isp'],
    docsUrl: 'https://help.smartproxy.com/docs',
    defaultEndpoint: 'gate.smartproxy.com',
    defaultPort: 7000,
    hasUsageApi: true,
    supportsSeaRegions: true,
  },
  brightdata: {
    type: 'brightdata',
    name: 'Bright Data',
    website: 'https://brightdata.com',
    description:
      '72M+ residential IPs in 195 countries. Zone-based credentials, '
      + 'fine-grained geo targeting, ASN selection, dedicated IP support.',
    pools: ['residential', 'datacenter', 'mobile', 'isp'],
    docsUrl: 'https://docs.brightdata.com',
    defaultEndpoint: 'brd.superproxy.io',
    defaultPort: 22225,
    hasUsageApi: true,
    supportsSeaRegions: true,
  },
  oxylabs: {
    type: 'oxylabs',
    name: 'Oxylabs',
    website: 'https://oxylabs.io',
    description:
      '100M+ residential IPs, sub-user management, real-time geo targeting, '
      + 'sticky sessions up to 30 minutes, ISP-level selection.',
    pools: ['residential', 'datacenter', 'mobile', 'isp'],
    docsUrl: 'https://developers.oxylabs.io',
    defaultEndpoint: 'pr.oxylabs.io',
    defaultPort: 7777,
    hasUsageApi: true,
    supportsSeaRegions: true,
  },
  custom: {
    type: 'custom',
    name: 'Custom Gateway',
    website: '',
    description:
      'Generic gateway adapter — point this at any provider that exposes '
      + 'username:password auth on a fixed endpoint:port.',
    pools: ['residential', 'datacenter'],
    docsUrl: '',
    defaultEndpoint: 'gateway.example.com',
    defaultPort: 8000,
    hasUsageApi: false,
    supportsSeaRegions: false,
  },
}

export function getCatalogEntry(type: ProxyProviderType): ProxyProviderCatalogEntry {
  return PROXY_PROVIDER_CATALOG[type]
}

export function listCatalog(): ProxyProviderCatalogEntry[] {
  return Object.values(PROXY_PROVIDER_CATALOG)
}
