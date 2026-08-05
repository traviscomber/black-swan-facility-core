const BASELINE_WARNING = "[baseline-browser-mapping] The data in this module is over two months old."

const originalWarn = console.warn.bind(console)
const originalError = console.error.bind(console)

function isKnownBaselineWarning(args) {
  return args.some((value) => typeof value === "string" && value.includes(BASELINE_WARNING))
}

console.warn = (...args) => {
  if (!isKnownBaselineWarning(args)) originalWarn(...args)
}

console.error = (...args) => {
  if (!isKnownBaselineWarning(args)) originalError(...args)
}
