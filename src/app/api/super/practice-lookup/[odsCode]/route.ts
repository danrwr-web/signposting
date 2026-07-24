import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getPracticeDetail, OdsLookupError } from '@/server/odsLookup'
import { LIST_SIZE_STALE_DAYS } from '@/server/practiceListSize'

const odsCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,12}$/)

// GET /api/super/practice-lookup/[odsCode] — ODS practice detail + cached list size
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ odsCode: string }> }
) {
  try {
    await requireSuperuser()

    const { odsCode: rawCode } = await params
    const parsed = odsCodeSchema.safeParse(rawCode)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid ODS code' }, { status: 400 })
    }
    const odsCode = parsed.data

    const [detail, cached] = await Promise.all([
      getPracticeDetail(odsCode),
      prisma.nationalPracticeData.findUnique({ where: { odsCode } }),
    ])

    const staleCutoff = Date.now() - LIST_SIZE_STALE_DAYS * 24 * 60 * 60 * 1000
    return NextResponse.json({
      odsCode: detail.odsCode,
      name: detail.name,
      addressLines: detail.addressLines,
      town: detail.town,
      postcode: detail.postcode,
      pcnName: detail.pcnName,
      listSize: cached?.listSize ?? null,
      listSizeExtractDate: cached?.extractDate?.toISOString() ?? null,
      listSizeStale: !cached || cached.updatedAt.getTime() < staleCutoff,
    })
  } catch (error) {
    if (error instanceof OdsLookupError) {
      console.error('ODS detail error:', error.message)
      return NextResponse.json(
        { error: error.clientMessage },
        { status: error.status === 404 ? 404 : 502 }
      )
    }
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
