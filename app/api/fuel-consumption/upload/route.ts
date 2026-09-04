import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Direct fuel import persistence is disabled. Validate the file in Combustibles and use the controlled intake workflow before saving operational records.',
      code: 'FUEL_IMPORT_PERSISTENCE_DISABLED',
    },
    { status: 410 },
  )
}
