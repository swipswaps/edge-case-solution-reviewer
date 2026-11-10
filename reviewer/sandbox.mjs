// Bounded execution boundary for candidate code.
//
// The in-process node:vm runner cannot stop an infinite loop inside a candidate
// function: vm's timeout covers the definition, not the later call. So every
// invocation runs in a child process with a wall-clock timeout and a heap cap.
// When Node's permission model is available, the child can read only this
// repository: writes, network and child processes are denied.
//
// node:vm is still not a security boundary; the process + permission model is.
// https://nodejs.org/api/vm.html
// https://nodejs.org/api/permissions.html
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const INVOKE = resolve(HERE, 'invoke.mjs')
const DEFAULT_TIMEOUT_MS = 1000
const HEAP_MB = 128

function detectPermissionFlag() {
  for (const flag of ['--experimental-permission', '--permission']) {
    const probe = spawnSync(process.execPath, [flag, `--allow-fs-read=${ROOT}`, '-e', '0'], {
      encoding: 'utf8', timeout: 5000,
    })
    if (probe.status === 0) return flag
  }
  return null
}

const PERMISSION_FLAG = detectPermissionFlag()

export const isolation = Object.freeze({
  permission: PERMISSION_FLAG !== null,
  heapMb: HEAP_MB,
  timeoutMs: DEFAULT_TIMEOUT_MS,
})

function childArgs() {
  const args = [`--max-old-space-size=${HEAP_MB}`]
  if (PERMISSION_FLAG) args.push(PERMISSION_FLAG, `--allow-fs-read=${ROOT}`)
  args.push(INVOKE)
  return args
}

export function runCaseIsolated(problemId, code, testCase, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const payload = Buffer.from(JSON.stringify({ problemId, code, testCase }), 'utf8').toString('base64')
  const result = spawnSync(process.execPath, [...childArgs(), payload], {
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: 1 << 20,
  })

  if (result.error && result.error.code === 'ETIMEDOUT') {
    return { status: 'threw', error: `timeout after ${timeoutMs}ms` }
  }
  if (result.signal === 'SIGKILL' || result.signal === 'SIGTERM') {
    return { status: 'threw', error: `killed after ${timeoutMs}ms` }
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim()
    return { status: 'threw', error: detail ? detail.slice(0, 400) : `child exited ${result.status}` }
  }

  const out = (result.stdout || '').trim()
  try {
    return JSON.parse(out)
  } catch {
    return { status: 'threw', error: `unparseable child output: ${out.slice(0, 200)}` }
  }
}
