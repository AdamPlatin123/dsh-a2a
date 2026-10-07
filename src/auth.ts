/**
 * Constant-time Bearer comparison shared by the inbound endpoint and the
 * management routes.
 *
 * @module dsh-a2a/auth
 */

import { createHash, timingSafeEqual } from 'node:crypto'

/** Compare a presented Authorization header against the expected key. */
export function bearerMatches(presented: string | string[] | undefined, expected: string): boolean {
  const value = Array.isArray(presented) ? presented[0] : presented
  if (typeof value !== 'string' || !value.startsWith('Bearer ') || expected.length === 0) {
    return false
  }
  // Hash both sides to a fixed length first: timingSafeEqual rejects
  // mismatched buffer lengths, and length-dependent early exits leak the key
  // length through timing.
  const presentedHash = createHash('sha256').update(value.slice('Bearer '.length)).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(presentedHash, expectedHash)
}
