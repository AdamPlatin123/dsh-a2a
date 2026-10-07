import { describe, expect, it } from 'vitest'
import { bearerMatches } from '../src/auth.js'

describe('bearerMatches', () => {
  it('accepts the exact key and rejects everything else', () => {
    expect(bearerMatches('Bearer secret-key', 'secret-key')).toBe(true)
    expect(bearerMatches('Bearer wrong', 'secret-key')).toBe(false)
    expect(bearerMatches('Bearer secret-key-extra', 'secret-key')).toBe(false)
    expect(bearerMatches(undefined, 'secret-key')).toBe(false)
    expect(bearerMatches(['Bearer secret-key'], 'secret-key')).toBe(true)
    expect(bearerMatches(['Bearer wrong'], 'secret-key')).toBe(false)
    expect(bearerMatches('Basic secret-key', 'secret-key')).toBe(false)
  })

  it('never throws on malformed header values', () => {
    expect(bearerMatches('', 'secret-key')).toBe(false)
    expect(bearerMatches('Bearer', 'secret-key')).toBe(false)
    expect(bearerMatches('Bearer ', 'secret-key')).toBe(false)
    expect(() => bearerMatches('Bearer \u0000\u0001', 'secret-key')).not.toThrow()
  })
})
