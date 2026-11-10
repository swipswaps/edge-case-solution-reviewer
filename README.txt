EDGE-CASE SOLUTION REVIEWER
===========================

A reviewer that runs candidate code solutions against the visible test suite,
then against hidden cases derived from the problem's stated constraints. A
candidate that passes the first and fails the second is reported as edge-case
broken.

THE VERDICTS
------------

  correct            passes visible and hidden
  edge-case-broken   passes visible, fails hidden
  incorrect          fails visible with a wrong answer
  throws             crashes on some case

SANDBOX BOUNDARY
----------------

Each candidate case runs in a child process with a wall-clock timeout and a
128 MB heap cap. Node's vm timeout covers only the definition, not the later
call, so an infinite loop inside a candidate would otherwise hang the review.

When the Node permission model is available, the child may read only this
repository; filesystem writes, network and child processes are denied.
https://nodejs.org/api/permissions.html

node:vm is still not a security boundary (https://nodejs.org/api/vm.html); the
process edge and the permission model are. For hostile code, put a container or
VM in front of this process.

RUN IT
------

    npm ci
    npm run review
    npm run build
    npm run preview

TEST IT
-------

    npx playwright install chromium
    npx playwright test

Visual baselines must be generated inside the pinned Playwright image.
https://playwright.dev/docs/test-snapshots
The verify workflow runs in mcr.microsoft.com/playwright, version pinned by the
scaffold script to match @playwright/test.

MATRIX PROVENANCE
-----------------

The committed matrix contains two non-deterministic fields:

  generatedAt   wall-clock time of the run that produced the matrix
  buildId       GITHUB_SHA on CI, null locally

The deploy workflow's staleness check compares everything except those two, so
a commit produced by a local run and a matrix regenerated in CI agree on the
semantic content even though their timestamps differ.

PAGES BUILD RECORD
------------------

The /repos/{owner}/{repo}/pages/builds/latest endpoint returns 404 for a site
whose Pages was enabled with build_type=workflow. That endpoint reports the
legacy branch-build state; workflow builds deploy an artefact via
actions/deploy-pages@v4 and never produce a record there. The scaffold script
treats the 404 as expected and relies on the site probe, which fetches the
served HTML, the hashed bundle, and the matrix data to confirm the deployment.

KNOWN LIMITS
------------

- JavaScript only.
- Hidden cases are not exhaustive.
- node:vm is not a security boundary; the child process and permission model are.
- No style, complexity or explanation judgement.
