import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeInternalPath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = typeof formData.get('email') === 'string' ? String(formData.get('email')).trim() : ''
  const password = typeof formData.get('password') === 'string' ? String(formData.get('password')) : ''
  const language = typeof formData.get('language') === 'string' && ['es','en','de'].includes(String(formData.get('language')))
    ? String(formData.get('language'))
    : 'es'

  const fallbackLogin = `/${language}/auth/login`
  const requested = safeInternalPath(formData.get('next'), '')

  if (!email || !password) {
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=missing_credentials`, request.url), 303)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=invalid_login`, request.url), 303)
  }

  const { data: accessProfile } = await supabase
    .from('user_access_profiles')
    .select('os_start_path')
    .eq('user_id', data.user.id)
    .maybeSingle()

  const profileStart = typeof accessProfile?.os_start_path === 'string'
    && accessProfile.os_start_path.startsWith('/')
    && !accessProfile.os_start_path.startsWith('//')
      ? accessProfile.os_start_path
      : '/'

  const destination = requested || `/${language}${profileStart === '/' ? '' : profileStart}`
  return NextResponse.redirect(new URL(destination, request.url), 303)
}
