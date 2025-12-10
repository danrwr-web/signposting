import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendDemoRequestEmail } from '@/lib/email'

const demoRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  practice: z.string().min(1, 'Practice name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  message: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate the request body
    const validationResult = demoRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors: Record<string, string> = {}
      validationResult.error.errors.forEach((error) => {
        const field = error.path[0] as string
        errors[field] = error.message
      })
      return NextResponse.json({ errors }, { status: 400 })
    }

    const { name, role, practice, email, phone, message } = validationResult.data

    // Send email
    await sendDemoRequestEmail({
      name,
      role,
      practice,
      email,
      phone,
      message,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Demo request error:', error)
    return NextResponse.json(
      { error: 'Failed to send demo request. Please try again later.' },
      { status: 500 }
    )
  }
}

