import React from 'react'
import {
  Globe, MousePointer, MousePointerClick, Type, Clock, Search, Navigation, Camera,
  FileText, ArrowDownToLine, List, Keyboard, Code, GitBranch, Repeat, Hand,
  PenTool, Send, Upload, Download, ShieldCheck, KeyRound, Lock, Workflow,
  Layers, CornerDownRight, ShieldOff, Cookie, CheckCircle, Plus, ArrowLeftRight,
  X, LayoutList, Shuffle, ScanText, Database, GripVertical, Frame, Sliders,
  FocusIcon, Brackets, IterationCcw, Network, SkipForward, Trash2
} from 'lucide-react'
import type { AutomationActionType } from '../../types'

export interface ActionMetadata {
  icon: React.ElementType
  label: string
  color: string
  description?: string
  whenToUse?: string
  example?: string
  commonMistakes?: string[]
  difficulty?: 'Beginner' | 'Easy' | 'Medium' | 'Advanced'
}

export const ACTION_META: Record<AutomationActionType, ActionMetadata> = {
  // Navigation
  navigate: {
    icon: Globe,
    label: 'Navigate',
    color: 'text-blue-400',
    description: 'Navigate to a URL and wait for page load',
    whenToUse: 'To load a webpage before interacting with it',
    example: 'url: "https://example.com"\nwaitUntil: "networkidle2"',
    difficulty: 'Beginner',
    commonMistakes: [
      'Forgetting to include https:// in the URL',
      'Using wrong waitUntil option (networkidle2 is safest for most sites)'
    ]
  },
  click: {
    icon: MousePointer,
    label: 'Click',
    color: 'text-green-400',
    description: 'Click an element by CSS selector',
    whenToUse: 'To click buttons, links, checkboxes, or any interactive element',
    example: 'selector: "button.submit"\ntimeout: 30000',
    difficulty: 'Beginner',
    commonMistakes: [
      'Selector not specific enough (matches multiple elements)',
      'Element not visible or clickable (need scrollIntoView first)'
    ]
  },
  doubleClick: {
    icon: MousePointerClick,
    label: 'Double Click',
    color: 'text-green-300',
    description: 'Double-click an element',
    whenToUse: 'To select text, open files, or activate double-click handlers',
    difficulty: 'Easy'
  },
  type: {
    icon: Type,
    label: 'Type Text',
    color: 'text-purple-400',
    description: 'Type text into an input field',
    whenToUse: 'To fill in text inputs, search boxes, or text areas',
    example: 'selector: "input[name=username]"\ntext: "myusername"\ndelay: 50',
    difficulty: 'Beginner',
    commonMistakes: [
      'Forgetting to click the input first',
      'Delay too low (50ms is realistic, 0 is too fast)',
      'Not clearing existing text with Ctrl+A first'
    ]
  },
  hover: {
    icon: Hand,
    label: 'Hover',
    color: 'text-sky-400',
    description: 'Hover over an element',
    whenToUse: 'To trigger hover menus, tooltips, or reveal hidden elements',
    difficulty: 'Easy'
  },
  rightClick: {
    icon: MousePointerClick,
    label: 'Right Click',
    color: 'text-rose-400',
    description: 'Right-click an element to show context menu',
    whenToUse: 'To trigger context menus or right-click handlers',
    difficulty: 'Easy'
  },

  // Waiting & Visibility
  wait: {
    icon: Clock,
    label: 'Wait',
    color: 'text-yellow-400',
    description: 'Wait for a specified duration in milliseconds',
    whenToUse: 'To pause and let dynamic content load or animations finish',
    example: 'ms: 2000',
    difficulty: 'Beginner',
    commonMistakes: [
      'Using wait instead of waitForSelector (unreliable)',
      'Waiting too long (>5000ms suggests better selector needed)'
    ]
  },
  waitForSelector: {
    icon: Search,
    label: 'Wait for Element',
    color: 'text-orange-400',
    description: 'Wait for an element to appear and become visible',
    whenToUse: 'To wait for elements loaded by JavaScript (more reliable than wait)',
    example: 'selector: ".popup"\nvisible: true\ntimeout: 30000',
    difficulty: 'Beginner',
    commonMistakes: [
      'Selector targets wrong element (use Inspector to verify)',
      'Timeout too short for slow pages',
      'Element exists but is hidden (set visible: false if needed)'
    ]
  },
  waitForNavigation: {
    icon: Navigation,
    label: 'Wait for Navigation',
    color: 'text-blue-300',
    description: 'Wait for the page to navigate and fully load',
    whenToUse: 'After clicking a link that will navigate to a new page',
    difficulty: 'Easy'
  },
  waitForDownload: {
    icon: Download,
    label: 'Wait for Download',
    color: 'text-amber-300',
    description: 'Wait for a file download to complete',
    whenToUse: 'To wait for downloads and capture the file path',
    difficulty: 'Medium'
  },
  waitForRequest: {
    icon: Network,
    label: 'Wait for Request',
    color: 'text-orange-300',
    description: 'Wait for a specific HTTP request',
    whenToUse: 'To wait for API calls or network requests before continuing',
    difficulty: 'Advanced'
  },
  waitForResponse: {
    icon: Network,
    label: 'Wait for Response',
    color: 'text-orange-400',
    description: 'Wait for a specific HTTP response',
    whenToUse: 'To wait for API responses and capture the data',
    difficulty: 'Advanced'
  },

  // Data Extraction
  screenshot: {
    icon: Camera,
    label: 'Screenshot',
    color: 'text-pink-400',
    description: 'Capture a screenshot of the page',
    whenToUse: 'To verify page state, create visual logs, or debug issues',
    difficulty: 'Easy'
  },
  extractText: {
    icon: FileText,
    label: 'Extract Text',
    color: 'text-cyan-400',
    description: 'Extract text content from an element',
    whenToUse: 'To get titles, prices, usernames, or any visible text',
    example: 'selector: ".product-title"\nsaveAs: "productTitle"',
    difficulty: 'Beginner',
    commonMistakes: [
      'Selector targets container with multiple items (need more specific)',
      'Text includes whitespace (use .trim() in later steps if needed)',
      'Element not found or hidden'
    ]
  },
  extractJson: {
    icon: Brackets,
    label: 'Extract JSON',
    color: 'text-cyan-300',
    description: 'Extract and parse JSON from page or element',
    whenToUse: 'To extract JSON data embedded in HTML or from API responses',
    difficulty: 'Medium'
  },
  evaluate: {
    icon: Code,
    label: 'Run Script',
    color: 'text-red-400',
    description: 'Run custom JavaScript and save the result',
    whenToUse: 'For complex extraction, calculations, or custom logic',
    example: 'script: "document.querySelectorAll(\'.item\').length"',
    difficulty: 'Advanced',
    commonMistakes: [
      'Forgetting to return the value',
      'Using browser APIs that require async/await',
      'Not handling null/undefined returns'
    ]
  },
  getCookies: {
    icon: Cookie,
    label: 'Get Cookies',
    color: 'text-amber-200',
    description: 'Get all cookies from the current page',
    whenToUse: 'To extract authentication tokens or session data',
    difficulty: 'Medium'
  },

  // Form Interactions
  select: {
    icon: List,
    label: 'Select Option',
    color: 'text-teal-400',
    description: 'Select an option from a dropdown or select element',
    whenToUse: 'To choose options from dropdowns, select lists, or combo boxes',
    example: 'selector: "select[name=country]"\nvalue: "US"',
    difficulty: 'Easy',
    commonMistakes: [
      'Using the display text instead of the value attribute',
      'Not waiting for the dropdown to load first'
    ]
  },
  setAttribute: {
    icon: PenTool,
    label: 'Set Attribute',
    color: 'text-lime-400',
    description: 'Set an HTML attribute on an element',
    whenToUse: 'To modify element properties (value, disabled, etc.)',
    difficulty: 'Medium'
  },
  setRangeInput: {
    icon: Sliders,
    label: 'Set Range Input',
    color: 'text-teal-400',
    description: 'Set value on a range/slider input',
    whenToUse: 'To adjust sliders, price ranges, or range inputs',
    difficulty: 'Medium'
  },
  clickByText: {
    icon: ScanText,
    label: 'Click by Text',
    color: 'text-teal-300',
    description: 'Click an element by its visible text content',
    whenToUse: 'To click buttons when you only know the text, not the selector',
    example: 'text: "Log In"\nexact: true',
    difficulty: 'Easy',
    commonMistakes: [
      'Text case mismatch (case sensitive by default)',
      'Multiple elements have same text (use exact: false to match substring)'
    ]
  },
  scrollIntoView: {
    icon: FocusIcon,
    label: 'Scroll Into View',
    color: 'text-sky-300',
    description: 'Scroll an element into the viewport',
    whenToUse: 'To ensure an element is visible before clicking/interacting',
    difficulty: 'Easy'
  },

  // Scroll & Movement
  scroll: {
    icon: ArrowDownToLine,
    label: 'Scroll',
    color: 'text-indigo-400',
    description: 'Scroll the page with human-like behavior',
    whenToUse: 'To scroll down/up for lazy-loading content or pagination',
    example: 'y: 500',
    difficulty: 'Easy',
    commonMistakes: [
      'Scrolling too fast (should use moderate speeds)',
      'Not waiting for content to load after scrolling'
    ]
  },
  dragAndDrop: {
    icon: GripVertical,
    label: 'Drag & Drop',
    color: 'text-violet-400',
    description: 'Drag an element from source to target',
    whenToUse: 'To interact with drag-and-drop interfaces',
    difficulty: 'Advanced'
  },

  // Network & Data
  httpRequest: {
    icon: Send,
    label: 'HTTP Request',
    color: 'text-fuchsia-400',
    description: 'Make an HTTP request (GET/POST/PUT/DELETE)',
    whenToUse: 'To call APIs, submit forms, or interact with backend',
    example: 'url: "https://api.example.com/data"\nmethod: "POST"\nheaders: {"Content-Type": "application/json"}',
    difficulty: 'Advanced',
    commonMistakes: [
      'Forgetting to include authentication headers',
      'Not setting correct Content-Type header',
      'Wrong HTTP method (POST vs PUT vs PATCH)'
    ]
  },
  interceptRequest: {
    icon: ShieldCheck,
    label: 'Intercept Request',
    color: 'text-rose-300',
    description: 'Intercept and modify outgoing HTTP requests',
    whenToUse: 'To block requests, mock API responses, or modify headers',
    difficulty: 'Advanced'
  },
  clearIntercepts: {
    icon: ShieldOff,
    label: 'Clear Intercepts',
    color: 'text-rose-200',
    description: 'Clear all request intercepts',
    whenToUse: 'To stop intercepting requests and restore normal behavior',
    difficulty: 'Advanced'
  },
  upload: {
    icon: Upload,
    label: 'Upload File',
    color: 'text-sky-300',
    description: 'Upload a file to a file input',
    whenToUse: 'To upload files to websites or applications',
    example: 'selector: "input[type=file]"\nfilePath: "/path/to/file.txt"',
    difficulty: 'Medium',
    commonMistakes: [
      'File path is relative instead of absolute',
      'File does not exist (check path)',
      'Input not found or not a file input'
    ]
  },
  download: {
    icon: Download,
    label: 'Download File',
    color: 'text-emerald-300',
    description: 'Download a file from a URL',
    whenToUse: 'To download files and save them locally',
    difficulty: 'Easy'
  },
  readFile: {
    icon: FileText,
    label: 'Read File',
    color: 'text-sky-400',
    description: 'Read file content from disk (CSV, JSON, TXT)',
    whenToUse: 'To load data files for data-driven automation',
    example: 'filePath: "/path/to/data.csv"\nencoding: "utf-8"',
    difficulty: 'Medium'
  },
  writeFile: {
    icon: FileText,
    label: 'Write File',
    color: 'text-sky-500',
    description: 'Write content to a file on disk',
    whenToUse: 'To save extracted data or generate reports',
    difficulty: 'Medium'
  },
  paginate: {
    icon: SkipForward,
    label: 'Paginate',
    color: 'text-pink-300',
    description: 'Automatically iterate through paginated results',
    whenToUse: 'To scrape multi-page results or process paginated data',
    difficulty: 'Advanced'
  },

  // Storage
  setCookies: {
    icon: Cookie,
    label: 'Set Cookies',
    color: 'text-amber-300',
    description: 'Set cookies on the page',
    whenToUse: 'To inject authentication cookies or session data',
    difficulty: 'Medium'
  },
  deleteCookies: {
    icon: Cookie,
    label: 'Delete Cookies',
    color: 'text-amber-400',
    description: 'Delete specific or all cookies',
    whenToUse: 'To clear session data or logout',
    difficulty: 'Easy'
  },
  getStorage: {
    icon: Database,
    label: 'Get Storage',
    color: 'text-cyan-400',
    description: 'Get localStorage or sessionStorage values',
    whenToUse: 'To extract stored data (preferences, tokens, etc.)',
    difficulty: 'Medium'
  },
  setStorage: {
    icon: Database,
    label: 'Set Storage',
    color: 'text-cyan-500',
    description: 'Set localStorage or sessionStorage values',
    whenToUse: 'To inject data before loading a page',
    difficulty: 'Medium'
  },
  clearStorage: {
    icon: Trash2,
    label: 'Clear Storage',
    color: 'text-red-400',
    description: 'Clear localStorage or sessionStorage',
    whenToUse: 'To reset stored data or clear cache',
    difficulty: 'Easy'
  },
  queryIndexedDB: {
    icon: Database,
    label: 'Query IndexedDB',
    color: 'text-indigo-400',
    description: 'Query IndexedDB databases and stores',
    whenToUse: 'To access offline-first app data',
    difficulty: 'Advanced'
  },

  // Security & Authentication
  solveCaptcha: {
    icon: ShieldCheck,
    label: 'Solve Captcha',
    color: 'text-yellow-300',
    description: 'Solve CAPTCHA (reCAPTCHA v2/v3, hCaptcha)',
    whenToUse: 'To bypass CAPTCHA protection',
    difficulty: 'Advanced'
  },
  injectCaptchaToken: {
    icon: KeyRound,
    label: 'Inject Captcha Token',
    color: 'text-amber-300',
    description: 'Inject a solved CAPTCHA token into the page',
    whenToUse: 'To use a token from solveCaptcha step',
    difficulty: 'Advanced'
  },
  useCredential: {
    icon: Lock,
    label: 'Use Credential',
    color: 'text-emerald-400',
    description: 'Fetch credentials from encrypted vault and substitute',
    whenToUse: 'To use stored usernames/passwords securely',
    difficulty: 'Medium'
  },

  // Tab & Window Management
  openTab: {
    icon: Plus,
    label: 'Open Tab',
    color: 'text-blue-300',
    description: 'Open a new browser tab',
    whenToUse: 'To open multiple tabs and work in parallel',
    difficulty: 'Medium'
  },
  switchTab: {
    icon: ArrowLeftRight,
    label: 'Switch Tab',
    color: 'text-blue-400',
    description: 'Switch to a specific tab',
    whenToUse: 'To navigate between open tabs',
    difficulty: 'Easy'
  },
  closeTab: {
    icon: X,
    label: 'Close Tab',
    color: 'text-blue-200',
    description: 'Close a specific tab',
    whenToUse: 'To close tabs and clean up',
    difficulty: 'Easy'
  },
  getTabs: {
    icon: LayoutList,
    label: 'Get Tabs',
    color: 'text-sky-300',
    description: 'Get a list of all open tabs',
    whenToUse: 'To find tabs and store tab info for later use',
    difficulty: 'Medium'
  },

  // Control Flow
  conditional: {
    icon: GitBranch,
    label: 'Conditional',
    color: 'text-emerald-400',
    description: 'If/else branching based on element or condition',
    whenToUse: 'To handle different page states or make decisions',
    example: 'conditionType: "selector-exists"\nselector: ".error-message"',
    difficulty: 'Medium',
    commonMistakes: [
      'Condition selector matches unexpected elements',
      'Expected value case sensitivity',
      'Not handling all possible branches'
    ]
  },
  loop: {
    icon: Repeat,
    label: 'Loop',
    color: 'text-violet-400',
    description: 'Loop through steps a fixed number of times',
    whenToUse: 'To repeat the same actions N times',
    example: 'times: 5',
    difficulty: 'Easy',
    commonMistakes: [
      'Loop too large (>100 iterations suggests pagination)',
      'Forgetting to update selectors between iterations'
    ]
  },
  whileLoop: {
    icon: IterationCcw,
    label: 'While Loop',
    color: 'text-purple-300',
    description: 'Loop while a condition is true',
    whenToUse: 'To loop until a condition becomes false',
    difficulty: 'Medium'
  },
  forEachRow: {
    icon: Repeat,
    label: 'For Each Row',
    color: 'text-emerald-400',
    description: 'Loop through rows in a CSV or data file',
    whenToUse: 'For data-driven automation with external data',
    example: 'filePath: "data.csv"\nprefix: "row"',
    difficulty: 'Advanced',
    commonMistakes: [
      'CSV file path is relative instead of absolute',
      'Variable names mismatch between loop prefix and step parameters'
    ]
  },
  forEachElement: {
    icon: Repeat,
    label: 'For Each Element',
    color: 'text-emerald-300',
    description: 'Loop through matching elements on the page',
    whenToUse: 'To process multiple elements (search results, items, etc.)',
    difficulty: 'Medium'
  },
  tryCatch: {
    icon: ShieldCheck,
    label: 'Try / Catch',
    color: 'text-pink-400',
    description: 'Try-catch-finally error handling',
    whenToUse: 'To handle errors gracefully and recover',
    difficulty: 'Advanced'
  },
  jumpToStep: {
    icon: CornerDownRight,
    label: 'Jump to Step',
    color: 'text-amber-300',
    description: 'Jump to a named step with optional condition',
    whenToUse: 'To skip steps or create complex workflows',
    difficulty: 'Advanced'
  },

  // Workflow
  callWorkflow: {
    icon: Workflow,
    label: 'Call Workflow',
    color: 'text-indigo-300',
    description: 'Call another workflow and pass variables',
    whenToUse: 'To reuse workflows and modularize automation',
    difficulty: 'Advanced'
  },
  parallelSteps: {
    icon: Layers,
    label: 'Parallel Steps',
    color: 'text-violet-300',
    description: 'Execute multiple steps in parallel',
    whenToUse: 'To speed up automation by running steps simultaneously',
    difficulty: 'Advanced'
  },
  switchProxy: {
    icon: Shuffle,
    label: 'Switch Proxy',
    color: 'text-orange-300',
    description: 'Switch proxy mid-workflow',
    whenToUse: 'To rotate proxies or change IP during automation',
    difficulty: 'Advanced'
  },

  // Testing
  assert: {
    icon: CheckCircle,
    label: 'Assert',
    color: 'text-green-300',
    description: 'Validate workflow expectations (multi-type assertions)',
    whenToUse: 'To verify workflow success and catch issues early',
    example: 'assertType: "text-contains"\nselector: ".success-message"\nexpected: "Success"',
    difficulty: 'Medium',
    commonMistakes: [
      'Wrong assertion type (element-exists vs text-contains)',
      'Not handling assertion failures gracefully',
      'Too strict expectations (exact text match fails on whitespace)'
    ]
  },

  // Advanced DOM
  switchFrame: {
    icon: Frame,
    label: 'Switch Frame',
    color: 'text-indigo-300',
    description: 'Switch to an iframe and execute steps inside',
    whenToUse: 'To interact with content inside iframes',
    difficulty: 'Advanced'
  },
  keyPress: {
    icon: Keyboard,
    label: 'Key Press',
    color: 'text-amber-400',
    description: 'Press individual keys (Enter, Tab, Escape, etc.)',
    whenToUse: 'To press specific keys (Enter to submit, Tab to focus)',
    example: 'key: "Enter"',
    difficulty: 'Easy'
  },
  keyCombo: {
    icon: Keyboard,
    label: 'Key Combo',
    color: 'text-amber-500',
    description: 'Press key combinations (Ctrl+C, Shift+Tab, etc.)',
    whenToUse: 'To use keyboard shortcuts (copy, paste, select all)',
    example: 'keys: "Control+a"',
    difficulty: 'Easy'
  },
  selectContextMenu: {
    icon: List,
    label: 'Context Menu',
    color: 'text-rose-300',
    description: 'Select an item from a context menu',
    whenToUse: 'To click items in right-click menus',
    difficulty: 'Medium'
  }
}

export const ACTION_CATEGORIES: Record<string, AutomationActionType[]> = {
  '🔗 Navigation': [
    'navigate',
    'click',
    'doubleClick',
    'type',
    'hover',
    'rightClick',
    'keyPress',
    'keyCombo'
  ],
  '⏱️ Waiting & Visibility': [
    'wait',
    'waitForSelector',
    'waitForNavigation',
    'waitForDownload',
    'waitForRequest',
    'waitForResponse'
  ],
  '📸 Data Extraction': [
    'screenshot',
    'extractText',
    'extractJson',
    'evaluate',
    'getCookies'
  ],
  '🎯 Form Interactions': [
    'select',
    'setAttribute',
    'setRangeInput',
    'clickByText',
    'scrollIntoView'
  ],
  '🎨 Scroll & Movement': [
    'scroll',
    'dragAndDrop'
  ],
  '📡 Network & Data': [
    'httpRequest',
    'interceptRequest',
    'clearIntercepts',
    'upload',
    'download',
    'readFile',
    'writeFile',
    'paginate'
  ],
  '🍪 Storage': [
    'setCookies',
    'deleteCookies',
    'getStorage',
    'setStorage',
    'clearStorage',
    'queryIndexedDB'
  ],
  '🔐 Security': [
    'solveCaptcha',
    'injectCaptchaToken',
    'useCredential'
  ],
  '📑 Tabs & Windows': [
    'openTab',
    'switchTab',
    'closeTab',
    'getTabs'
  ],
  '🔄 Control Flow': [
    'conditional',
    'loop',
    'whileLoop',
    'forEachRow',
    'forEachElement',
    'tryCatch',
    'jumpToStep'
  ],
  '🎬 Workflow': [
    'callWorkflow',
    'parallelSteps',
    'switchProxy'
  ],
  '✅ Testing': [
    'assert'
  ],
  '🖼️ Advanced DOM': [
    'switchFrame',
    'selectContextMenu'
  ]
}
