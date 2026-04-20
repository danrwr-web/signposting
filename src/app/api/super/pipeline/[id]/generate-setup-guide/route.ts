import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/server/auth'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const PASSWORD_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*'

/**
 * Generate a cryptographically random password containing mixed case letters,
 * digits, and symbols. Length defaults to 12.
 */
function generateTempPassword(length = 12): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length]
  }
  return out
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// POST /api/super/pipeline/[id]/generate-setup-guide
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const entry = await prisma.salesPipeline.findUnique({
      where: { id },
      include: {
        linkedSurgery: { select: { id: true, name: true } },
      },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Pipeline entry not found' }, { status: 404 })
    }

    if (!entry.linkedSurgeryId || !entry.linkedSurgery) {
      return NextResponse.json(
        { error: 'This practice has not been provisioned yet' },
        { status: 400 }
      )
    }

    const template = await prisma.documentTemplate.findFirst({
      where: { documentType: 'SetupGuide', contractVariantId: null },
      select: { templateDocx: true },
    })

    if (!template?.templateDocx) {
      return NextResponse.json(
        { error: 'No setup guide template uploaded yet' },
        { status: 400 }
      )
    }

    const adminMembership = await prisma.userSurgery.findFirst({
      where: { surgeryId: entry.linkedSurgeryId, role: 'ADMIN' },
    })

    if (!adminMembership) {
      return NextResponse.json(
        { error: 'No admin user found for this surgery' },
        { status: 400 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: adminMembership.userId },
      select: { id: true, name: true, email: true },
    })

    if (!adminUser) {
      return NextResponse.json(
        { error: 'No admin user found for this surgery' },
        { status: 400 }
      )
    }

    // Generate the plaintext password up-front; it is only embedded in the
    // generated document and never stored. The hashed password is written to
    // the DB *after* the document has been rendered successfully so a render
    // failure does not leave the admin locked out without credentials.
    const tempPassword = generateTempPassword(12)
    const hashed = await hashPassword(tempPassword)

    const zip = new PizZip(template.templateDocx as unknown as Buffer)
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    })

    doc.render({
      practiceName: entry.linkedSurgery.name,
      date: formatDateLong(new Date()),
      adminName: adminUser.name || adminUser.email,
      adminEmail: adminUser.email,
      tempPassword,
    })

    const output = doc.getZip().generate({ type: 'nodebuffer' }) as Buffer

    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: hashed },
    })

    return new NextResponse(output as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': DOCX_MIME,
        'Content-Disposition': `attachment; filename="setup-guide.docx"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Generate setup guide error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
