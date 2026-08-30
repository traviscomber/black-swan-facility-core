import { spawnSync } from "node:child_process"

const result = spawnSync(process.execPath, ["scripts/audit-i18n.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: process.env,
})

const stdout = result.stdout ?? ""
const stderr = result.stderr ?? ""
process.stdout.write(stdout)
process.stderr.write(stderr)

if (result.error) {
  console.error(`Global Polyglot audit could not run: ${result.error.message}`)
  process.exit(1)
}

const combined = `${stdout}\n${stderr}`
const backlog = combined.match(/Global Polyglot backlog \(reported, non-blocking during Orchard phase\): (\d+) structural locale collapse\(s\) \+ (\d+) interior\/catalog coverage gap\(s\)\./)

if (!backlog) {
  if ((result.status ?? 0) !== 0) process.exit(result.status ?? 1)
  console.error("Global Polyglot audit could not determine the global backlog from scripts/audit-i18n.mjs output.")
  process.exit(1)
}

const structural = Number(backlog[1])
const coverage = Number(backlog[2])

if (structural > 0 || coverage > 0) {
  console.error(`Blocking global i18n gate: ${structural} structural locale collapse(s) + ${coverage} interior/catalog coverage gap(s).`)
  process.exit(1)
}

if ((result.status ?? 0) !== 0) process.exit(result.status ?? 1)
console.log("Global Polyglot gate passed: en/es/de structural and interior coverage backlog is zero.")
