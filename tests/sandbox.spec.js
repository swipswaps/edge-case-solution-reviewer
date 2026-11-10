import { test, expect } from '@playwright/test'
import { runCaseIsolated, isolation } from '../reviewer/sandbox.mjs'

test('an infinite-loop candidate is bounded, not hung', () => {
  const started = Date.now()
  const result = runCaseIsolated(
    'P1',
    'function lengthOfLongestSubstring(s) { while (true) {} }',
    { input: 'a', expected: 1 },
    { timeoutMs: 1000 },
  )
  const elapsed = Date.now() - started
  expect(result.status).toBe('threw')
  expect(elapsed).toBeLessThan(3000)
})

test('a normal candidate still passes through the boundary', () => {
  const code = 'function lengthOfLongestSubstring(s) { return new Set(s).size }'
  expect(runCaseIsolated('P1', code, { input: 'abcabcbb', expected: 3 }).status).toBe('pass')
})

test('the child cannot read outside the repository when the permission model is on', () => {
  test.skip(!isolation.permission, 'Node permission model unavailable')
  const code = [
    'function lengthOfLongestSubstring(s) {',
    "  const p = this.constructor.constructor('return process')()",
    "  return p.getBuiltinModule('fs').readFileSync('/etc/hostname', 'utf8').length",
    '}',
  ].join('\n')
  expect(runCaseIsolated('P1', code, { input: 'a', expected: 1 }).status).toBe('threw')
})
