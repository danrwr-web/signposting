import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { can, requireAuth, resolveSurgeryIdFromIdentifier } from '@/lib/rbac'

export const runtime = 'nodejs'

const helpEventSchema = z
  .object({
    event: z.enum(['open_help_panel', 'click_help_link']),
    surgeryId: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    url: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.event === 'click_help_link') {
      if (!value.title) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'title is required for click_help_link',
          path: ['title'],
        })
      }
      if (!value.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'url is required for click_help_link',
          path: ['url'],
        })
      }
    }
  })

type ErrorResponse = {
  error: {
    code: string
    message: string
  }
}

const jsonError = (code: string, message: string, status: number) =>
  NextResponse.json<ErrorResponse>({ error: { code, message } }, { status })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = helpEventSchema.safeParse(body)

    if (!parsed.success) {
      return jsonError('invalid_input', 'Invalid help event payload', 400)
    }

    const user = await requireAuth()
    const { event, surgeryId, title, url } = parsed.data

    let resolvedSurgeryId: string | null = null
    if (surgeryId) {
      resolvedSurgeryId = await resolveSurgeryIdFromIdentifier(surgeryId)
      if (!resolvedSurgeryId) {
        return jsonError('surgery_not_found', 'Surgery not found', 404)
      }
      if (!can(user).viewSurgery(resolvedSurgeryId)) {
        return jsonError('forbidden', 'Surgery access required', 403)
      }
    }

    await prisma.helpEngagementEvent.create({
      data: {
        event,
        surgeryId: resolvedSurgeryId,
        userEmail: user.email,
        linkTitle: title ?? null,
        linkUrl: url ?? null,
      },
    })

    return NextResponse.json({ recorded: true })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError('invalid_json', 'Invalid JSON body', 400)
    }
    if (error instanceof Error && error.message === 'Authentication required') {
      return jsonError('unauthenticated', 'Authentication required', 401)
    }
    console.error('Error recording help panel event:', error)
    return jsonError('server_error', 'Failed to record help event', 500)
  }
}
