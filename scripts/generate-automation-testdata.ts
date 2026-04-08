/**
 * Automation Test Data Generator
 *
 * Creates sample workflows with various automation actions for testing:
 * - Navigation workflows
 * - Form filling with validation
 * - Conditional logic (if/else)
 * - Loops and repeating actions
 * - Data extraction workflows
 * - Multi-step workflows with error handling
 */

import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

interface WorkflowAction {
  id: string
  type: 'navigate' | 'click' | 'fill' | 'wait' | 'extract' | 'condition' | 'loop' | 'screenshot' | 'scroll' | 'keyboard' | 'http' | 'log' | 'delay' | 'assert' | 'api_call' | 'js_execute' | 'close_tab'
  name: string
  description?: string
  params?: Record<string, any>
  selector?: string
  timeout?: number
  retries?: number
  skipOnError?: boolean
}

interface Workflow {
  id: string
  name: string
  description: string
  profileIds: string[]
  steps: WorkflowAction[]
  schedule?: {
    enabled: boolean
    cron?: string
    interval?: number
  }
  variables?: Record<string, any>
  created_at: string
  updated_at: string
}

// Load profile IDs from previously generated test data
function loadProfileIds(): string[] {
  try {
    const profilesPath = path.join(process.cwd(), 'testdata', 'multilogin-profiles.json')
    if (fs.existsSync(profilesPath)) {
      const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'))
      return profiles.map((p: any) => p.id).slice(0, 3) // Use first 3 profiles
    }
  } catch (error) {
    console.warn('Could not load profiles, using placeholders')
  }
  return [uuidv4(), uuidv4(), uuidv4()]
}

const workflows: Workflow[] = [
  {
    id: uuidv4(),
    name: 'Simple Page Navigation',
    description: 'Navigate to a website and take screenshot',
    profileIds: [loadProfileIds()[0]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Navigate to Example',
        description: 'Open example.com',
        params: {
          url: 'https://example.com'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'wait',
        name: 'Wait for Page Load',
        params: {
          selector: 'body',
          type: 'visible'
        },
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'screenshot',
        name: 'Capture Screenshot',
        params: {
          fullPage: true,
          quality: 90
        }
      },
      {
        id: uuidv4(),
        type: 'log',
        name: 'Log Success',
        params: {
          message: 'Successfully navigated to example.com'
        }
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Form Filling & Submission',
    description: 'Fill and submit a test form with validation',
    profileIds: [loadProfileIds()[0]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Navigate to Form',
        params: {
          url: 'https://httpbin.org/forms/post'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Fill Name Field',
        selector: 'input[name="custname"]',
        params: {
          value: 'John Doe',
          clear: true
        },
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Fill Phone Field',
        selector: 'input[name="custtel"]',
        params: {
          value: '1234567890'
        },
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Select Pizza Option',
        selector: 'input[name="size"][value="small"]',
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Add Special Instructions',
        selector: 'textarea[name="comments"]',
        params: {
          value: 'No onions, extra cheese please'
        },
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'screenshot',
        name: 'Screenshot Filled Form',
        params: {
          fullPage: false
        }
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Submit Form',
        selector: 'button[type="submit"]',
        timeout: 5000,
        retries: 2
      },
      {
        id: uuidv4(),
        type: 'wait',
        name: 'Wait for Success Page',
        params: {
          selector: 'body',
          type: 'visible'
        },
        timeout: 10000
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Conditional Login Flow',
    description: 'Check if logged in, if not then login',
    profileIds: [loadProfileIds()[0], loadProfileIds()[1]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Navigate to Dashboard',
        params: {
          url: 'https://example.com/dashboard'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'condition',
        name: 'Check If Logged In',
        params: {
          selector: '.user-profile',
          type: 'exists',
          then: [
            {
              id: uuidv4(),
              type: 'log',
              name: 'Already Logged In',
              params: { message: 'User is already logged in' }
            }
          ],
          else: [
            {
              id: uuidv4(),
              type: 'navigate',
              name: 'Go to Login Page',
              params: { url: 'https://example.com/login' }
            },
            {
              id: uuidv4(),
              type: 'fill',
              name: 'Enter Email',
              selector: 'input[type="email"]',
              params: { value: 'test@example.com' }
            },
            {
              id: uuidv4(),
              type: 'fill',
              name: 'Enter Password',
              selector: 'input[type="password"]',
              params: { value: 'TestPassword123!' }
            },
            {
              id: uuidv4(),
              type: 'click',
              name: 'Click Login Button',
              selector: 'button[type="submit"]'
            }
          ]
        }
      },
      {
        id: uuidv4(),
        type: 'screenshot',
        name: 'Final Screenshot',
        params: { fullPage: true }
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Loop - Scrape Product List',
    description: 'Loop through products and extract data',
    profileIds: [loadProfileIds()[1]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Navigate to Products',
        params: {
          url: 'https://example.com/products'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'loop',
        name: 'Extract Product Information',
        params: {
          selector: '.product-card',
          actions: [
            {
              id: uuidv4(),
              type: 'extract',
              name: 'Get Product Title',
              selector: '.product-title',
              params: {
                attribute: 'text'
              }
            },
            {
              id: uuidv4(),
              type: 'extract',
              name: 'Get Product Price',
              selector: '.product-price',
              params: {
                attribute: 'text',
                regex: '\\$([0-9.]+)'
              }
            },
            {
              id: uuidv4(),
              type: 'extract',
              name: 'Get Product Link',
              selector: 'a.product-link',
              params: {
                attribute: 'href'
              }
            },
            {
              id: uuidv4(),
              type: 'log',
              name: 'Log Product Data',
              params: {
                message: 'Extracted product: {{title}} - {{price}}'
              }
            }
          ]
        }
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Multi-Step Search & Filter',
    description: 'Search for items and apply filters',
    profileIds: [loadProfileIds()[1], loadProfileIds()[2]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Go to Search Page',
        params: {
          url: 'https://example.com/search'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Enter Search Query',
        selector: 'input[name="q"]',
        params: {
          value: 'laptop',
          clear: true
        },
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'keyboard',
        name: 'Press Enter',
        params: {
          key: 'Enter'
        }
      },
      {
        id: uuidv4(),
        type: 'wait',
        name: 'Wait for Results',
        params: {
          selector: '.search-results',
          type: 'visible'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Apply Price Filter',
        selector: 'input[data-filter="price-1000-2000"]',
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Apply Brand Filter',
        selector: 'input[data-filter="brand-dell"]',
        timeout: 5000
      },
      {
        id: uuidv4(),
        type: 'wait',
        name: 'Wait for Filtered Results',
        params: {
          selector: '.search-results .item',
          type: 'visible'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'extract',
        name: 'Count Results',
        selector: '.search-results .item',
        params: {
          attribute: 'count'
        }
      },
      {
        id: uuidv4(),
        type: 'screenshot',
        name: 'Capture Filtered Results',
        params: {
          fullPage: true
        }
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'API Call & Data Processing',
    description: 'Make API call and process response',
    profileIds: [loadProfileIds()[2]],
    steps: [
      {
        id: uuidv4(),
        type: 'api_call',
        name: 'Fetch User Data',
        params: {
          url: 'https://jsonplaceholder.typicode.com/users/1',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'js_execute',
        name: 'Process API Response',
        params: {
          code: `
            const userData = JSON.parse(context.apiResponse);
            return {
              name: userData.name,
              email: userData.email,
              company: userData.company.name
            };
          `
        }
      },
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Navigate to Form',
        params: {
          url: 'https://httpbin.org/post'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Fill with API Data',
        selector: 'input[name="name"]',
        params: {
          value: '{{processedData.name}}'
        }
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Fill Email',
        selector: 'input[name="email"]',
        params: {
          value: '{{processedData.email}}'
        }
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Submit',
        selector: 'button[type="submit"]'
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Error Handling & Retry',
    description: 'Handle errors gracefully with retries',
    profileIds: [loadProfileIds()[0]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Navigate to Unreliable Service',
        params: {
          url: 'https://example.com/unstable'
        },
        timeout: 10000,
        retries: 3,
        skipOnError: false
      },
      {
        id: uuidv4(),
        type: 'wait',
        name: 'Wait for Element',
        params: {
          selector: '.dynamic-content',
          type: 'visible'
        },
        timeout: 5000,
        retries: 2,
        skipOnError: true
      },
      {
        id: uuidv4(),
        type: 'condition',
        name: 'Check If Retries Exhausted',
        params: {
          type: 'expression',
          expression: 'context.lastError !== null',
          then: [
            {
              id: uuidv4(),
              type: 'log',
              name: 'Log Error',
              params: {
                message: 'Failed after retries: {{context.lastError}}'
              }
            },
            {
              id: uuidv4(),
              type: 'api_call',
              name: 'Send Error Report',
              params: {
                url: 'https://example.com/api/report-error',
                method: 'POST',
                body: {
                  error: '{{context.lastError}}',
                  timestamp: '{{timestamp}}'
                }
              }
            }
          ]
        }
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Social Media Follow & Like',
    description: 'Follow users and like posts',
    profileIds: [loadProfileIds()[0], loadProfileIds()[1], loadProfileIds()[2]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Go to Social Media',
        params: {
          url: 'https://example-social.com/feed'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'scroll',
        name: 'Scroll Down',
        params: {
          pixels: 500,
          smooth: true
        }
      },
      {
        id: uuidv4(),
        type: 'loop',
        name: 'Like Posts',
        params: {
          selector: '.post-card',
          maxIterations: 5,
          actions: [
            {
              id: uuidv4(),
              type: 'click',
              name: 'Click Like Button',
              selector: '.like-button'
            },
            {
              id: uuidv4(),
              type: 'wait',
              name: 'Wait for Animation',
              params: { type: 'delay', ms: 500 }
            }
          ]
        }
      },
      {
        id: uuidv4(),
        type: 'loop',
        name: 'Follow Users',
        params: {
          selector: '.user-card',
          maxIterations: 3,
          actions: [
            {
              id: uuidv4(),
              type: 'click',
              name: 'Click Follow',
              selector: '.follow-button'
            },
            {
              id: uuidv4(),
              type: 'wait',
              name: 'Wait for Follow',
              params: { type: 'delay', ms: 1000 }
            }
          ]
        }
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  {
    id: uuidv4(),
    name: 'Data Entry & Validation',
    description: 'Fill multiple fields with validation',
    profileIds: [loadProfileIds()[1]],
    steps: [
      {
        id: uuidv4(),
        type: 'navigate',
        name: 'Open Registration Form',
        params: {
          url: 'https://example.com/register'
        },
        timeout: 10000
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Enter Username',
        selector: 'input[name="username"]',
        params: {
          value: 'testuser_{{timestamp}}'
        }
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Enter Email',
        selector: 'input[name="email"]',
        params: {
          value: 'test_{{timestamp}}@example.com'
        }
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Enter Password',
        selector: 'input[name="password"]',
        params: {
          value: 'SecurePass123!@'
        }
      },
      {
        id: uuidv4(),
        type: 'fill',
        name: 'Confirm Password',
        selector: 'input[name="confirmPassword"]',
        params: {
          value: 'SecurePass123!@'
        }
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Accept Terms',
        selector: 'input[name="terms"]'
      },
      {
        id: uuidv4(),
        type: 'assert',
        name: 'Validate Submit Button',
        params: {
          selector: 'button[type="submit"]',
          property: 'disabled',
          value: false,
          operator: 'equals'
        }
      },
      {
        id: uuidv4(),
        type: 'click',
        name: 'Submit Registration',
        selector: 'button[type="submit"]'
      },
      {
        id: uuidv4(),
        type: 'wait',
        name: 'Wait for Confirmation',
        params: {
          selector: '.success-message',
          type: 'visible'
        },
        timeout: 10000
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

function saveWorkflows(): void {
  const testdataDir = path.join(process.cwd(), 'testdata')
  if (!fs.existsSync(testdataDir)) {
    fs.mkdirSync(testdataDir, { recursive: true })
  }

  fs.writeFileSync(
    path.join(testdataDir, 'automation-workflows.json'),
    JSON.stringify(workflows, null, 2)
  )

  // Also create a workflow-profiles mapping
  const profileWorkflows = workflows.map(w => ({
    id: uuidv4(),
    workflow_id: w.id,
    workflow_name: w.name,
    profile_ids: w.profileIds,
    enabled: true,
    description: w.description,
    created_at: new Date().toISOString()
  }))

  fs.writeFileSync(
    path.join(testdataDir, 'workflow-profile-mapping.json'),
    JSON.stringify(profileWorkflows, null, 2)
  )

  console.log('✅ Automation test data generated!\n')
  console.log('📊 Summary:')
  console.log(`   • Workflows Created: ${workflows.length}`)
  console.log(`   • Total Actions: ${workflows.reduce((sum, w) => sum + w.steps.length, 0)}`)
  console.log(`   • Different Action Types: ${new Set(workflows.flatMap(w => w.steps.map(s => s.type))).size}`)
  console.log(`   • Profiles Used: ${loadProfileIds().length}\n`)

  console.log('📁 Output Files:')
  console.log('   • testdata/automation-workflows.json')
  console.log('   • testdata/workflow-profile-mapping.json\n')

  console.log('🧪 Available Workflows:\n')
  workflows.forEach((workflow, idx) => {
    console.log(`${idx + 1}. ${workflow.name}`)
    console.log(`   📝 ${workflow.description}`)
    console.log(`   ⚙️  Actions: ${workflow.steps.length}`)
    console.log(`   📱 Profiles: ${workflow.profileIds.length}`)
    console.log(`   🔤 Types: ${[...new Set(workflow.steps.map(s => s.type))].join(', ')}`)
    console.log('')
  })

  console.log('🚀 Next Steps:')
  console.log('   1. Import workflows into Ghost Browser')
  console.log('   2. Select a profile and run a workflow')
  console.log('   3. Monitor execution in the automation dashboard')
  console.log('   4. Check logs for any errors')
  console.log('   5. Schedule workflows for repeated execution')
}

saveWorkflows()
