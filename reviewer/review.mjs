import { runCaseIsolated } from './sandbox.mjs'
export function reviewCandidate(problem, candidate) {
  const visible = problem.visibleTests.map((c) => ({ case: c, result: runCaseIsolated(problem.id, candidate.code, c) }))
  const hidden = problem.hiddenCases.map((c) => ({ case: c, result: runCaseIsolated(problem.id, candidate.code, c) }))
  const visiblePass = visible.every((v) => v.result.status === 'pass')
  const hiddenPass = hidden.every((h) => h.result.status === 'pass')
  const anyThrow = visible.some((v) => v.result.status === 'threw') || hidden.some((h) => h.result.status === 'threw')
  let verdict
  if (!visiblePass) verdict = anyThrow ? 'throws' : 'incorrect'
  else if (!hiddenPass) verdict = 'edge-case-broken'
  else verdict = 'correct'
  const firstHiddenFailure = hidden.find((h) => h.result.status !== 'pass') ?? null
  return {
    problemId: problem.id, candidateId: candidate.id, label: candidate.label, role: candidate.role,
    visiblePass, hiddenPass, verdict, visible, hidden,
    firstHiddenFailure: firstHiddenFailure ? {
      input: firstHiddenFailure.case.input, expected: firstHiddenFailure.case.expected,
      actual: firstHiddenFailure.result.actual ?? null, error: firstHiddenFailure.result.error ?? null,
      catches: firstHiddenFailure.case.catches, class: firstHiddenFailure.case.class,
    } : null,
    note: buildNote(verdict, firstHiddenFailure),
  }
}
function buildNote(verdict, failure) {
  if (verdict === 'correct') return 'Passes the visible tests and every hidden case derived from the stated constraints.'
  if (verdict === 'edge-case-broken' && failure) return `Passes every visible test and fails on input ${JSON.stringify(failure.case.input)} (expected ${JSON.stringify(failure.case.expected)}, got ${JSON.stringify(failure.result.actual)}). ${failure.case.catches}`
  if (verdict === 'incorrect') return 'Fails at least one visible test. Wrong answer on a case the candidate was shown.'
  return 'Throws on at least one case. A crash is a different review note from a wrong answer.'
}
