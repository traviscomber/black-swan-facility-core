import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loginPage = readFileSync(new URL('../app/auth/login/page.tsx', import.meta.url), 'utf8')
const loginRoute = readFileSync(new URL('../app/api/auth/login/route.ts', import.meta.url), 'utf8')

test('login has a server-side fallback independent of client hydration', () => {
  assert.match(loginPage, /<form action="\/api\/auth\/login" method="post"/)
  assert.match(loginPage, /name="email"/)
  assert.match(loginPage, /name="password"/)
  assert.match(loginPage, /name="language"/)
  assert.match(loginPage, /name="next"/)
  assert.match(loginRoute, /signInWithPassword/)
  assert.match(loginRoute, /user_access_profiles/)
  assert.match(loginRoute, /NextResponse\.redirect/)
})

test('server-side login only redirects to safe internal paths', () => {
  assert.match(loginRoute, /!value\.startsWith\('\/'\)/)
  assert.match(loginRoute, /value\.startsWith\('\/\/'\)/)
  assert.match(loginRoute, /303/)
})
