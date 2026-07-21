import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const SETUP_SECRET = process.env.PROCUREMENT_SETUP_SECRET || 'blackswan2026'

interface UserData {
  email: string
  password: string
  fullName: string
  role: 'admin' | 'approver'
  approvalLimit?: number
}

const USERS: UserData[] = [
  {
    email: 'juan@n3uralia.com',
    password: 'TemporaryPassword123!',
    fullName: 'Juan Vial',
    role: 'admin',
  },
  {
    email: 'raimundo@blackswn.org',
    password: 'TemporaryPassword123!',
    fullName: 'Raimundo Colvin',
    role: 'approver',
    approvalLimit: 25000000,
  },
  {
    email: 'santiago@blackswn.org',
    password: 'TemporaryPassword123!',
    fullName: 'Santiago Colvin',
    role: 'approver',
    approvalLimit: 25000000,
  },
]

export async function POST(request: Request) {
  try {
    const { secret } = await request.json()

    // Verify secret
    if (secret !== SETUP_SECRET) {
      return Response.json(
        { error: 'Invalid setup secret' },
        { status: 401 }
      )
    }

    const results = []

    for (const user of USERS) {
      try {
        // Create user in auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
          },
        })

        if (authError) {
          results.push({
            email: user.email,
            status: 'error',
            message: authError.message,
          })
          continue
        }

        // Create corresponding procurement_approvers record
        const { data: approverData, error: approverError } = await supabase
          .from('procurement_approvers')
          .insert({
            user_id: authUser?.user?.id,
            role: user.role,
            approval_limit_clp: user.approvalLimit || null,
            is_active: true,
          })

        if (approverError) {
          results.push({
            email: user.email,
            status: 'partial',
            message: `User created but approver record failed: ${approverError.message}`,
            userId: authUser?.user?.id,
          })
          continue
        }

        results.push({
          email: user.email,
          status: 'success',
          userId: authUser?.user?.id,
          fullName: user.fullName,
          role: user.role,
        })
      } catch (error: any) {
        results.push({
          email: user.email,
          status: 'error',
          message: error.message,
        })
      }
    }

    return Response.json({
      success: true,
      message: `Created ${results.filter(r => r.status === 'success').length} users`,
      results,
    })
  } catch (error: any) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
