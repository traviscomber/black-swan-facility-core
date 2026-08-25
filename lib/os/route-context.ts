import { resolveAreaForPath } from "./navigation.ts"

export function buildOsRouteContext(pathname: string) {
  return { pathname, area: resolveAreaForPath(pathname) }
}
