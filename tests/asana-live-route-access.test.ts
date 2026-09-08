import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const navigation = readFileSync(new URL("../lib/os/navigation.ts", import.meta.url), "utf8")
const authorizedNavigation = readFileSync(new URL("../lib/os/authorized-navigation-client.ts", import.meta.url), "utf8")
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8")

test("live Asana navigation is limited to admin and approver roles", () => {
  assert.match(navigation, /key:\s*["']asana-live["']/)
  assert.match(navigation, /allowedRoles:\s*\[["']admin["'],\s*["']approver["']\]/)
  assert.match(navigation, /viewDomain:\s*["']operations["']/)
  assert.match(authorizedNavigation, /role:\s*access\.role_key/)
})

test("direct live Asana routes fail closed for other roles", () => {
  assert.match(proxy, /isPathFamily\(pathname, ["']\/asana-live["']\)/)
  assert.match(proxy, /role === ["']admin["'] \|\| role === ["']approver["']/)
  assert.match(proxy, /isRoleRestrictedPathAllowed\(effectivePathname, routeAccess\.role_key\)/)
  assert.match(proxy, /domain:\s*["']operations["'],\s*required:\s*["']view["']/)
})

test("restricted start paths cannot create an authorization redirect loop", () => {
  assert.match(proxy, /isRoleRestrictedPathAllowed\(preferredStartPath, routeAccess\.role_key\)/)
  assert.match(proxy, /startAllowed \? preferredStartPath : ["']\/os["']/)
})