# Handoff — edge-case-solution-reviewer

Audited against public HEAD `b9c0ace` (2026-11-09T12:06:56-05:00) and the live site.
Live: https://swipswaps.github.io/edge-case-solution-reviewer/ · `/matrix.json` buildId `b9c0ace…` matches HEAD.
Supersedes the Python file plan in notes `f7cf5a908a2574ea_0026.txt` / `_0027.txt`: that audit assumed a Python
layout (`core/adversarial_engine.py`, …). This repository is JavaScript/ESM; the required files below are JS-native.

## 1. How we got here

This is one of four reviewer artefacts built for the GoMeasure *Prompt Quality Reviewer* portfolio
(`gomeasure-rubric-reviewer`, `coding-agent-interaction-reviewer`, `micro1-write-like-human-eval`,
`edge-case-solution-reviewer`). The repeated brief in the notes is: audit an external reference
(the job-search agent video `HoVxjMNFYv4` and `ai-job-search-dev/ai-job-search`) and **deduce the files needed
to address deficiencies**, then write *how we got here / where we are / what makes sense next*.

The thesis of this artefact: a candidate can pass every test it was shown and still be wrong. The reviewer runs
each candidate against visible tests and against hidden cases derived from the problem's stated constraints, and
reports the gap as `edge-case-broken`. That is the portfolio argument; the engineering below is what makes the
argument credible.

## 2. Where we are (verified)

Structure:

    problems/index.mjs       3 problems; 3 visible tests each; 9 hidden cases total
    solutions/index.mjs      10 candidates: 3 reference, 4 edge-case-candidates, 3 incorrect-candidates
    reviewer/run.mjs         node:vm runner, 1000 ms timeout on definition only
    reviewer/review.mjs      verdict logic: correct | edge-case-broken | incorrect | throws
    scripts/review.mjs       writes src/generated + public matrix.json; prints the summary
    src/App.jsx              dashboard: catch panel, per-problem detail, matrix
    tests/                   reviewer.spec.js (logic) + dashboard.spec.js (headless UI + screenshot)
    .github/workflows/       verify.yml (PR gate) + deploy.yml (Pages, matrix staleness gate)

Reproduced locally:

    npm install && npm run review
    # 10 candidates: correct 3, edge-case-broken 4, incorrect 3, threw 0
    # disagreements 0, sound: yes
    npm run build                 # ok
    npx playwright test tests/reviewer.spec.js   # 4 passed
    curl -sI https://swipswaps.github.io/edge-case-solution-reviewer/            # 200
    curl -s  https://swipswaps.github.io/edge-case-solution-reviewer/matrix.json # 200, buildId == HEAD

Strengths worth preserving: deterministic verdicts; explicit reference/edge/incorrect roles checked against the
matrix (`expectations`, `disagreements`); CI refuses a stale committed matrix; Pages provenance note in README;
known limits stated honestly.

Deficiencies found by reading the code (each is actionable, not cosmetic):

- **D1 — the timeout does not cover the call (proven).** `reviewer/run.mjs:12` passes `timeout: 1000` to
  `vm.runInContext` for the *definition*, but `reviewer/run.mjs:18` calls `fn(...)` outside any timeout. A
  candidate whose function body loops forever hangs the whole review. Demonstrated: `timeout 5 node …` on
  `function lengthOfLongestSubstring(s){ while (true) {} }` exits **124** (killed), i.e. the reviewer hangs.
- **D2 — `node:vm` is not a security boundary.** README lines 20-25 already say so. Executing model-generated
  candidates in-process is unsafe for the stated production use.
- **D3 — hidden cases are hand-authored, not derived.** 9 cases across 3 problems; the `class` labels
  (`empty-input`, `interleaved`, …) are a manual taxonomy. Coverage is an assertion, not a measurement.
- **D4 — equality is `JSON.stringify`.** `reviewer/run.mjs:4` treats `[undefined]` and `[null]` as equal and is
  sensitive to key order. Fine for this corpus; wrong as a general reviewer.
- **D5 — function names are hardcoded.** `reviewer/run.mjs:3` maps `P1/P2/P3` to entry points; adding a problem
  requires editing the runner instead of the problem.
- **D6 — no versioned output contract.** `matrix.json` is produced ad hoc; nothing validates its shape, so a
  downstream consumer cannot rely on it.
- **D7 — no pipeline integration.** There is no stable CLI/JSON entry point for a generator loop
  (`ai-job-search` style) to call; the reviewer is a dashboard, not a gate.
- **D8 — narrow corpus.** JavaScript only, 3 problems; `hiddenCases` are not exhaustive and `sound` only means
  "the authored reference and edge candidates behaved as labelled", not "the rubric is complete".

## 3. What makes sense next (priority order)

- **P0 — bounded execution (D1, D2).** Run one candidate-case invocation in a child process (`node:child_process`
  fork) or a worker with `resourceLimits`, and put a wall-clock timeout around the *invocation*, not just the
  definition. Add OS-level isolation (Node permission model, or a container). This is the difference between a
  demo and a reviewer that can touch untrusted code.
  Acceptance: an infinite-loop candidate returns `timeout`/`throws` in ≤ 2 s; a `require('fs')`/network attempt is
  denied; the parent process never hangs.
- **P1 — machine-readable contract (D6).** Version the matrix and validate it in `scripts/review.mjs` before
  writing, and in CI. Acceptance: `schemas/matrix.schema.json` validates both matrices; an intentionally broken
  row fails the gate.
- **P2 — generated hidden cases (D3).** Use property-based generators from each problem's stated constraints,
  plus differential comparison against the reference solution; record the seed so failures reproduce.
  Acceptance: `npm run review -- --seed <n>` is deterministic; each edge-case candidate is still caught.
- **P3 — equality and problem metadata (D4, D5).** Replace `JSON.stringify` with `util.isDeepStrictEqual` after
  explicit normalisation, and move the entry-point name onto each problem object.
  Acceptance: `tests/reviewer.spec.js` still passes; a new problem needs no runner edit.
- **P4 — pipeline hook and corpus (D7, D8).** Add a CLI that consumes `{problem, candidate}` and emits one
  schema-valid verdict on stdout, and expand the corpus (more languages/problems) or state the boundary in the
  README. Acceptance: a fixture generator calls the hook and gets parseable JSON; documented coverage.

## 4. Required files

    reviewer/sandbox.mjs        P0  fork/worker boundary; per-invocation timeout + resourceLimits
    reviewer/invoke.mjs         P0  child entrypoint: one case in, one JSON result out
    reviewer/equality.mjs       P3  util.isDeepStrictEqual + explicit normalisation
    reviewer/fuzz.mjs           P2  fast-check generators derived from constraints; seeded
    reviewer/graph.mjs          P3  move toList/fromList out of run.mjs
    schemas/matrix.schema.json  P1  JSON Schema 2020-12 for the full matrix
    schemas/verdict.schema.json P1  JSON Schema 2020-12 for one review row
    integration/pipeline-hook.mjs P4 CLI: --problem --candidate --json, one verdict on stdout
    problems/index.mjs          P3  add `entry` per problem; single source of truth
    problems/P4/index.mjs       P4  one worked example of the new problem contract
    tests/sandbox.spec.js       P0  infinite loop is killed; fs/network denied
    tests/fuzz.spec.js          P2  invariants for reference; seeded reproduction
    scripts/review.mjs          P1  validate + version output; keep the anti-staleness contract
    docs/ADR-0001-sandbox.md    P0  decision record: why a subprocess, not vm

Each file is additive except `reviewer/run.mjs`, `problems/index.mjs`, and `scripts/review.mjs`, which are the
only edits the roadmap requires.

## 5. Verification plan

    npm ci
    npm run review                       # expect sound: yes and 4 edge-case-broken
    npm run build
    npx playwright test                  # run inside mcr.microsoft.com/playwright to keep the snapshot valid
    # P0 proof: must return quickly, never hang
    timeout 5 node --input-type=module -e "import {reviewOne} from './reviewer/sandbox.mjs'; console.log(reviewOne('P1',{code:'function lengthOfLongestSubstring(s){while(true){}}'},{input:'a',expected:1}))"
    # P1 proof
    node -e "import('./scripts/validate-matrix.mjs')"
    # live proof after push
    curl -s https://swipswaps.github.io/edge-case-solution-reviewer/matrix.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);if(d.buildId!==process.argv[1])process.exit(1);console.log('ok',d.buildId)})" "$(git rev-parse HEAD)"

## 6. References

- Node.js `vm` — "not a security mechanism": https://nodejs.org/api/vm.html
- Node.js permission model: https://nodejs.org/api/permissions.html
- Node.js `worker_threads` `resourceLimits`: https://nodejs.org/api/worker_threads.html
- Node.js `child_process`: https://nodejs.org/api/child_process.html
- Node.js `util.isDeepStrictEqual`: https://nodejs.org/api/util.html
- JSON Schema 2020-12: https://json-schema.org/draft/2020-12
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Claessen, K. & Hughes, J. (2000). *QuickCheck: a lightweight tool for random testing of Haskell programs.*
  ICFP '00. DOI: 10.1145/351240.351266. ISBN 1-58113-202-6.
- MacIver, D. R. (2019). *Hypothesis: A new approach to property-based testing.* JOSS 4(43), 1591.
  DOI: 10.21105/joss.01591.
- Chen, T. Y., Kuo, F.-C., Liu, H., Poon, P.-L., Towey, D., Tse, T. H. & Zhou, Z. Q. (2018).
  *Metamorphic Testing: A Review of Challenges and Opportunities.* ACM Computing Surveys 51(1), 4.
  DOI: 10.1145/3143561.
- McKeeman, W. M. (1998). *Differential Testing for Software.* Digital Technical Journal 10(1), 100-107.
- Dijkstra, E. W. (1972). *The Humble Programmer.* Communications of the ACM 15(10), 859-866.
  DOI: 10.1145/355604.361591.
- Reference consumer: https://github.com/ai-job-search-dev/ai-job-search

## 7. Status log

- **2026-11-10 — P0 implemented on top of `b9c0ace`.** New `reviewer/sandbox.mjs` and
  `reviewer/invoke.mjs`; `reviewer/review.mjs` now calls the bounded child instead of the in-process
  `runCase`. `tests/sandbox.spec.js` adds the regression. Evidence: an infinite-loop candidate now returns
  `{"status":"threw","error":"timeout after 1000ms"}` in ~1.0 s (previously hung, exit 124); `npm run review`
  remains `sound: yes` (4 edge-case-broken, 0 disagreements) in ~2.4 s; reviewer + sandbox specs 7 passed;
  build ok. Permission model active in the child (`isolation.permission: true`).
