import { describe, expect, it } from 'vitest'
import { wrapRemoteReply } from '../src/tools.js'

describe('wrapRemoteReply', () => {
  it('labels the reply with the remote agent and a not-instructions warning', () => {
    const wrapped = wrapRemoteReply('specialist', 'hello')
    expect(wrapped).toContain('[remote a2a agent specialist')
    expect(wrapped).toContain('not instructions')
    expect(wrapped).toContain('hello')
  })

  it('caps oversized replies and says so', () => {
    const huge = 'x'.repeat(50_000)
    const wrapped = wrapRemoteReply('specialist', huge)
    expect(wrapped.length).toBeLessThan(20_000 + 200)
    expect(wrapped).toContain('truncated')
  })

  it('keeps short replies intact', () => {
    const wrapped = wrapRemoteReply('specialist', 'short answer')
    expect(wrapped.endsWith('short answer')).toBe(true)
  })
})
