const en = {
  // App
  'app.name': 'Ghost Browser',
  'app.tagline': 'Anti-Detect Browser Platform',

  // Sidebar
  'nav.profiles': 'Profiles',
  'nav.proxies': 'Proxies',
  'nav.automation': 'Automation',
  'nav.detection': 'Detection Test',
  'nav.fingerprint': 'Fingerprint',
  'nav.settings': 'Settings',
  'nav.account': 'Account',
  'nav.team': 'Team',

  // Profiles
  'profiles.title': 'Profile Manager',
  'profiles.create': 'Create Profile',
  'profiles.edit': 'Edit Profile',
  'profiles.delete': 'Delete Profile',
  'profiles.launch': 'Launch',
  'profiles.close': 'Close',
  'profiles.clone': 'Clone',
  'profiles.search': 'Search profiles...',
  'profiles.empty': 'No profiles yet. Create one to get started.',
  'profiles.health': 'Health Score',
  'profiles.lastUsed': 'Last used',
  'profiles.neverUsed': 'Never used',
  'profiles.group': 'Group',
  'profiles.noGroup': 'No group',

  // Proxies
  'proxies.title': 'Proxy Manager',
  'proxies.add': 'Add Proxy',
  'proxies.test': 'Test',
  'proxies.healthy': 'Healthy',
  'proxies.unhealthy': 'Unhealthy',
  'proxies.latency': 'Latency',

  // Automation
  'automation.title': 'Automation Builder',
  'automation.create': 'Create Workflow',
  'automation.run': 'Run',
  'automation.dryRun': 'Dry Run',
  'automation.stop': 'Stop',
  'automation.steps': 'Steps',
  'automation.variables': 'Variables',

  // Detection
  'detection.title': 'Detection Dashboard',
  'detection.run': 'Run Test',
  'detection.score': 'Score',
  'detection.passed': 'Passed',
  'detection.failed': 'Failed',
  'detection.vectors': 'Vectors',

  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.ai': 'AI Assistant',
  'settings.apiKey': 'API Key',

  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.close': 'Close',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.confirm': 'Confirm',
  'common.search': 'Search',
  'common.noResults': 'No results found',
  'common.actions': 'Actions',
  'common.status': 'Status',
  'common.name': 'Name',
  'common.type': 'Type',
  'common.date': 'Date',

  // Health Score
  'health.low': 'Low Risk',
  'health.medium': 'Medium Risk',
  'health.high': 'High Risk',
  'health.critical': 'Critical Risk',
  'health.detection': 'Detection',
  'health.behavior': 'Behavior',
  'health.freshness': 'Freshness',
} as const

export default en
export type TranslationKey = keyof typeof en
