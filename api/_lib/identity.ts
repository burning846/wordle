import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Device tokens and link codes are both bearer secrets, so only their hashes are
 * stored. A token is generated once per device and kept in that browser; a link code
 * is read aloud or copied to a second device to bind it to the same player.
 */
export function createToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/**
 * Excludes characters that are misread when typed from another screen: no O/0, I/1,
 * or S/5. 12 characters from a 30-symbol alphabet is about 59 bits, and codes expire.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'
const CODE_GROUPS = 3
const GROUP_SIZE = 4

export function createLinkCode(): string {
  const groups = Array.from({ length: CODE_GROUPS }, () =>
    Array.from({ length: GROUP_SIZE }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
      '',
    ),
  )
  return groups.join('-')
}

/** Accepts a code typed with any spacing or casing. */
export function normaliseLinkCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashLinkCode(code: string): string {
  return hashSecret(normaliseLinkCode(code))
}

/** Constant-time comparison, for the rare paths that compare secrets directly. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export const LINK_CODE_TTL_MS = 10 * 60 * 1000
