// Child-process entrypoint. One case in, one JSON result out.
// The job is passed as base64 argv (not stdin) so the child never needs fs reads
// for input, which keeps it compatible with the Node permission model.
import { runCase } from './run.mjs'

const b64 = process.argv[2] ?? ''
let job
try {
  job = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
} catch (err) {
  process.stdout.write(JSON.stringify({ status: 'threw', error: `job decode: ${err.message}` }))
  process.exit(0)
}

const result = runCase(job.problemId, job.code, job.testCase)
process.stdout.write(JSON.stringify(result))
