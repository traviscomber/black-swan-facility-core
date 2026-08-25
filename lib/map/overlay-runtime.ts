export type OverlayRuntimeState = {
  status: "idle" | "loading" | "ready" | "error"
  featureCount?: number
  error?: string
  source?: string
  totalMs?: number
}

export function createOverlayLoadQueue({ concurrency }: { concurrency: number }) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("concurrency must be a positive integer")
  let active = 0
  const pending: Array<() => void> = []

  const release = () => {
    active -= 1
    const next = pending.shift()
    if (next) next()
  }

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (active >= concurrency) await new Promise<void>((resolve) => pending.push(resolve))
      active += 1
      try {
        return await task()
      } finally {
        release()
      }
    },
  }
}
