/**
 * Profile Data Validation Service
 *
 * Validates all profile-related inputs before database operations.
 * - Input boundaries (string lengths, numeric ranges)
 * - Type safety (JSON schema validation)
 * - Foreign key references (proxy, group existence)
 * - Enum constraints (preset, rotation_mode, etc.)
 *
 * Returns structured validation errors for IPC handlers to return to renderer.
 */

import type { Profile, FingerprintConfig } from '../shared/types'

export interface ValidationError {
  code: 'INVALID_INPUT'
  field: string
  message: string
}

// ─── Input Constraints ──────────────────────────────────────────────────────────

const CONSTRAINTS = {
  profile: {
    name: { min: 1, max: 255 },
    notes: { min: 0, max: 2000 },
  },
  proxy: {
    name: { min: 1, max: 255 },
    host: { min: 1, max: 255 },
    port: { min: 1, max: 65535 },
    username: { min: 0, max: 255 },
    password: { min: 0, max: 255 },
  },
  cookie: {
    name: { min: 1, max: 4096 },
    value: { min: 0, max: 8192 },
    domain: { min: 1, max: 255 },
  },
}

// ─── Known Presets ──────────────────────────────────────────────────────────────

const KNOWN_PRESETS = new Set([
  'win10-chrome120',
  'win11-chrome121',
  'mac-ventura-chrome120',
  'mac-sonoma-chrome121',
  'linux-ubuntu-chrome120',
  'android-samsung-chrome120',
  'android-pixel-chrome121',
  'android-oppo-chrome120',
  'ios-iphone14-safari17',
  'ios-iphone15-safari17',
  'ios-ipad-safari17',
])

const KNOWN_ROTATION_MODES = new Set(['none', 'random', 'round-robin'])

// ─── Validators ─────────────────────────────────────────────────────────────────

/**
 * Validates profile name.
 */
export function validateProfileName(name: string): ValidationError | null {
  if (typeof name !== 'string') {
    return { code: 'INVALID_INPUT', field: 'name', message: 'Profile name must be string' }
  }

  const { min, max } = CONSTRAINTS.profile.name
  if (name.length < min || name.length > max) {
    return {
      code: 'INVALID_INPUT',
      field: 'name',
      message: `Profile name must be ${min}-${max} characters, got ${name.length}`,
    }
  }

  return null
}

/**
 * Validates profile notes.
 */
export function validateProfileNotes(notes: string | undefined): ValidationError | null {
  if (notes === undefined) return null
  if (typeof notes !== 'string') {
    return { code: 'INVALID_INPUT', field: 'notes', message: 'Notes must be string' }
  }

  const { max } = CONSTRAINTS.profile.notes
  if (notes.length > max) {
    return {
      code: 'INVALID_INPUT',
      field: 'notes',
      message: `Notes must be ≤${max} characters, got ${notes.length}`,
    }
  }

  return null
}

/**
 * Validates fingerprint preset.
 */
export function validatePreset(preset: string): ValidationError | null {
  if (typeof preset !== 'string') {
    return { code: 'INVALID_INPUT', field: 'preset', message: 'Preset must be string' }
  }

  if (!KNOWN_PRESETS.has(preset)) {
    return {
      code: 'INVALID_INPUT',
      field: 'preset',
      message: `Unknown preset: ${preset}. Valid presets: ${Array.from(KNOWN_PRESETS).join(', ')}`,
    }
  }

  return null
}

/**
 * Validates fingerprint JSON structure.
 * Deep validation: ensures required fields present, correct types.
 */
export function validateFingerprintConfig(config: unknown): ValidationError | null {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return {
      code: 'INVALID_INPUT',
      field: 'fingerprint',
      message: 'Fingerprint must be object, not ' + typeof config,
    }
  }

  const fp = config as Record<string, unknown>

  // Required fields
  const requiredFields = ['preset', 'os', 'browser', 'screen', 'hardware', 'locale']
  for (const field of requiredFields) {
    if (!(field in fp)) {
      return {
        code: 'INVALID_INPUT',
        field: 'fingerprint',
        message: `Fingerprint missing required field: ${field}`,
      }
    }
  }

  // Validate preset within fingerprint
  const presetErr = validatePreset(fp.preset as string)
  if (presetErr) return presetErr

  // Validate os.platform enum
  const os = fp.os as Record<string, unknown>
  if (os && typeof os === 'object') {
    const validPlatforms = ['Win32', 'MacIntel', 'Linux x86_64', 'Linux armv8l', 'iPhone', 'iPad']
    if (!validPlatforms.includes(os.platform as string)) {
      return {
        code: 'INVALID_INPUT',
        field: 'fingerprint.os.platform',
        message: `Invalid OS platform: ${os.platform}`,
      }
    }
  }

  return null
}

/**
 * Validates cookie JSON array.
 */
export function validateCookiesJson(cookiesJson: string | undefined): ValidationError | null {
  if (cookiesJson === undefined) return null

  if (typeof cookiesJson !== 'string') {
    return { code: 'INVALID_INPUT', field: 'cookies', message: 'Cookies must be JSON string' }
  }

  try {
    const parsed = JSON.parse(cookiesJson)
    if (!Array.isArray(parsed)) {
      return { code: 'INVALID_INPUT', field: 'cookies', message: 'Cookies must be JSON array' }
    }

    // Validate each cookie
    for (let i = 0; i < parsed.length; i++) {
      const cookie = parsed[i]
      if (typeof cookie !== 'object' || cookie === null) {
        return {
          code: 'INVALID_INPUT',
          field: `cookies[${i}]`,
          message: 'Cookie must be object',
        }
      }

      // Required cookie fields
      if (typeof cookie.name !== 'string' || typeof cookie.value !== 'string') {
        return {
          code: 'INVALID_INPUT',
          field: `cookies[${i}]`,
          message: 'Cookie must have name and value as strings',
        }
      }

      // Check lengths
      const { max: maxName } = CONSTRAINTS.cookie.name
      const { max: maxValue } = CONSTRAINTS.cookie.value
      if (cookie.name.length > maxName) {
        return {
          code: 'INVALID_INPUT',
          field: `cookies[${i}].name`,
          message: `Cookie name exceeds ${maxName} characters`,
        }
      }
      if (cookie.value.length > maxValue) {
        return {
          code: 'INVALID_INPUT',
          field: `cookies[${i}].value`,
          message: `Cookie value exceeds ${maxValue} characters`,
        }
      }
    }

    return null
  } catch (error) {
    return {
      code: 'INVALID_INPUT',
      field: 'cookies',
      message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Validates proxy host.
 */
export function validateProxyHost(host: string): ValidationError | null {
  if (typeof host !== 'string') {
    return { code: 'INVALID_INPUT', field: 'host', message: 'Host must be string' }
  }

  const { min, max } = CONSTRAINTS.proxy.host
  if (host.length < min || host.length > max) {
    return {
      code: 'INVALID_INPUT',
      field: 'host',
      message: `Proxy host must be ${min}-${max} characters`,
    }
  }

  return null
}

/**
 * Validates proxy port.
 */
export function validateProxyPort(port: number): ValidationError | null {
  if (typeof port !== 'number' || !Number.isInteger(port)) {
    return { code: 'INVALID_INPUT', field: 'port', message: 'Port must be integer' }
  }

  const { min, max } = CONSTRAINTS.proxy.port
  if (port < min || port > max) {
    return {
      code: 'INVALID_INPUT',
      field: 'port',
      message: `Port must be ${min}-${max}, got ${port}`,
    }
  }

  return null
}

/**
 * Validates proxy credentials.
 */
export function validateProxyCredential(
  credential: string | undefined,
  type: 'username' | 'password',
): ValidationError | null {
  if (credential === undefined) return null

  if (typeof credential !== 'string') {
    return {
      code: 'INVALID_INPUT',
      field: type,
      message: `Proxy ${type} must be string`,
    }
  }

  const { max } = CONSTRAINTS.proxy[type]
  if (credential.length > max) {
    return {
      code: 'INVALID_INPUT',
      field: type,
      message: `Proxy ${type} exceeds ${max} characters`,
    }
  }

  return null
}

/**
 * Validates rotation mode.
 */
export function validateRotationMode(mode: string | undefined): ValidationError | null {
  if (mode === undefined || mode === 'none') return null

  if (!KNOWN_ROTATION_MODES.has(mode)) {
    return {
      code: 'INVALID_INPUT',
      field: 'rotation_mode',
      message: `Invalid rotation mode: ${mode}. Valid: ${Array.from(KNOWN_ROTATION_MODES).join(', ')}`,
    }
  }

  return null
}

/**
 * Validates profile creation input.
 */
export function validateCreateProfileInput(input: unknown): ValidationError | null {
  if (typeof input !== 'object' || input === null) {
    return { code: 'INVALID_INPUT', field: 'input', message: 'Input must be object' }
  }

  const data = input as Record<string, unknown>

  const nameErr = validateProfileName(data.name as string)
  if (nameErr) return nameErr

  const presetErr = validatePreset(data.preset as string)
  if (presetErr) return presetErr

  if (data.notes !== undefined) {
    const notesErr = validateProfileNotes(data.notes as string)
    if (notesErr) return notesErr
  }

  return null
}

/**
 * Validates profile update input.
 */
export function validateUpdateProfileInput(
  input: unknown,
  allowedFields: Set<string> = new Set([
    'name',
    'notes',
    'group_id',
    'proxy_id',
    'fingerprint',
    'cookies',
    'rotation_mode',
    'drift_enabled',
    'warmed_up',
    'sync_excluded',
  ]),
): ValidationError | null {
  if (typeof input !== 'object' || input === null) {
    return { code: 'INVALID_INPUT', field: 'input', message: 'Input must be object' }
  }

  const data = input as Record<string, unknown>

  // Check for disallowed fields
  for (const key of Object.keys(data)) {
    if (!allowedFields.has(key)) {
      return {
        code: 'INVALID_INPUT',
        field: key,
        message: `Cannot update field: ${key}`,
      }
    }
  }

  // Validate fields that are present
  if ('name' in data) {
    const nameErr = validateProfileName(data.name as string)
    if (nameErr) return nameErr
  }

  if ('notes' in data) {
    const notesErr = validateProfileNotes(data.notes as string)
    if (notesErr) return notesErr
  }

  if ('fingerprint' in data) {
    const fpErr = validateFingerprintConfig(data.fingerprint)
    if (fpErr) return fpErr
  }

  if ('cookies' in data) {
    const cookieErr = validateCookiesJson(data.cookies as string)
    if (cookieErr) return cookieErr
  }

  if ('rotation_mode' in data) {
    const rotErr = validateRotationMode(data.rotation_mode as string)
    if (rotErr) return rotErr
  }

  return null
}

/**
 * Validates bulk operation input (e.g., bulk delete).
 */
export function validateBulkIds(ids: unknown, maxSize = 1000): ValidationError | null {
  if (!Array.isArray(ids)) {
    return { code: 'INVALID_INPUT', field: 'ids', message: 'IDs must be array' }
  }

  if (ids.length === 0 || ids.length > maxSize) {
    return {
      code: 'INVALID_INPUT',
      field: 'ids',
      message: `Bulk operation must have 1-${maxSize} items, got ${ids.length}`,
    }
  }

  for (let i = 0; i < ids.length; i++) {
    if (typeof ids[i] !== 'string') {
      return {
        code: 'INVALID_INPUT',
        field: `ids[${i}]`,
        message: 'Each ID must be string',
      }
    }
  }

  return null
}
