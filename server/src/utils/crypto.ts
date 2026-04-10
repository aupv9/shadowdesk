import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'

const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex')
}

export function generateRandomId(): string {
  return randomBytes(16).toString('hex')
}
