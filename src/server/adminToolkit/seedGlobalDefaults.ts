import { prisma } from '@/lib/prisma'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

type SeedResult = {
  surgeryId: string
  surgeryName: string
  surgerySlug: string | null
  skipped: boolean
  reason?: string
  categoriesCreated: number
  itemsCreated: number
}

const GLOBAL_DEFAULTS_SLUG = 'global-default-buttons'

function html(...lines: string[]): string {
  return sanitizeHtml(lines.join('\n'))
}

export async function seedAdminToolkitGlobalDefaults(opts?: { force?: boolean }): Promise<SeedResult> {
  const force = opts?.force === true

  const surgery = await prisma.surgery.findFirst({
    where: { OR: [{ id: GLOBAL_DEFAULTS_SLUG }, { slug: GLOBAL_DEFAULTS_SLUG }, { name: GLOBAL_DEFAULTS_SLUG }] },
    select: { id: true, name: true, slug: true },
  })

  if (!surgery) {
    throw new Error(`Global defaults surgery not found (id/slug/name "${GLOBAL_DEFAULTS_SLUG}").`)
  }

  const [existingCategories, existingItems] = await Promise.all([
    prisma.adminCategory.count({ where: { surgeryId: surgery.id, deletedAt: null } }),
    prisma.adminItem.count({ where: { surgeryId: surgery.id, deletedAt: null } }),
  ])

  if (!force && (existingCategories > 0 || existingItems > 0)) {
    return {
      surgeryId: surgery.id,
      surgeryName: surgery.name,
      surgerySlug: surgery.slug,
      skipped: true,
      reason: 'Already seeded (Admin Toolkit content exists).',
      categoriesCreated: 0,
      itemsCreated: 0,
    }
  }

  const categoriesToCreate = [
    'Admin',
    'Registrations',
    '2WW',
    'ERS / Referrals',
    'Prescribing',
    'SARs / Letters / Forms',
    'Team / Roles',
    'Useful links',
  ] as const

  const starterPages: Array<{ categoryName: typeof categoriesToCreate[number]; title: string; contentHtml: string }> = [
    {
      categoryName: 'Admin',
      title: 'New starter checklist (template)',
      contentHtml: html(
        '<p><strong>Template:</strong> adapt this for <em>[Your practice]</em>.</p>',
        '<ul>',
        '<li>Create user account (name + email)</li>',
        '<li>Add to surgery and confirm role</li>',
        '<li>Confirm access to shared drive: <em>[Shared drive location]</em></li>',
        '<li>Show where to find Admin Toolkit pages</li>',
        '</ul>',
      ),
    },
    {
      categoryName: 'Admin',
      title: 'Requesting new user access (template)',
      contentHtml: html(
        '<p>Use this when a staff member needs access to the toolkit.</p>',
        '<ul>',
        '<li>Name</li>',
        '<li>Email</li>',
        '<li>Role needed: <em>[Standard / Admin]</em></li>',
        '<li>Which surgery: <em>[Your practice]</em></li>',
        '</ul>',
        '<p>Add any local checks here (ID checks, HR approval, etc.).</p>',
      ),
    },
    {
      categoryName: 'Registrations',
      title: 'Patient registration overview (template)',
      contentHtml: html(
        '<p><strong>Goal:</strong> register safely and consistently.</p>',
        '<ol>',
        '<li>Check ID and address (if applicable)</li>',
        '<li>Confirm catchment area rules</li>',
        '<li>Send registration pack / link: <em>[Local form/link]</em></li>',
        '<li>Create registration task and track progress</li>',
        '</ol>',
      ),
    },
    {
      categoryName: 'Registrations',
      title: 'New patient summaries (template)',
      contentHtml: html(
        '<p>When a patient registers, make sure key information is highlighted.</p>',
        '<ul>',
        '<li>Repeat medications</li>',
        '<li>Allergies</li>',
        '<li>Long-term conditions</li>',
        '<li>Safeguarding notes (if any)</li>',
        '</ul>',
      ),
    },
    {
      categoryName: '2WW',
      title: '2WW referrals: admin process (template)',
      contentHtml: html(
        '<p><strong>Template:</strong> update the pathway details for your local system.</p>',
        '<ul>',
        '<li>Confirm the referral is marked as <strong>2WW</strong></li>',
        '<li>Send/submit via: <em>[System]</em></li>',
        '<li>Record reference number in notes</li>',
        '<li>Safety net: confirm patient contact details</li>',
        '</ul>',
      ),
    },
    {
      categoryName: 'ERS / Referrals',
      title: 'eRS admin handling (template)',
      contentHtml: html(
        '<p>Use this page to capture your local admin process for eRS.</p>',
        '<ol>',
        '<li>Check the request type and urgency</li>',
        '<li>Assign to the right queue/person</li>',
        '<li>Document any actions taken</li>',
        '<li>Escalate if unclear: <em>[Who to ask]</em></li>',
        '</ol>',
      ),
    },
    {
      categoryName: 'Prescribing',
      title: 'Prescription queries: how we handle them (template)',
      contentHtml: html(
        '<p>Keep this short and practical.</p>',
        '<ul>',
        '<li>Is it urgent today? If yes, escalate to duty clinician</li>',
        '<li>Standard queries go to: <em>[Mailbox / workflow]</em></li>',
        '<li>Record outcome and send reply to patient (if needed)</li>',
        '</ul>',
      ),
    },
    {
      categoryName: 'SARs / Letters / Forms',
      title: 'SAR requests: quick template',
      contentHtml: html(
        '<p><strong>Template:</strong> replace with your local SAR workflow.</p>',
        '<ul>',
        '<li>Verify identity</li>',
        '<li>Record request date and deadline</li>',
        '<li>Assign to: <em>[Responsible role]</em></li>',
        '<li>Store documents in: <em>[Shared drive location]</em></li>',
        '</ul>',
      ),
    },
    {
      categoryName: 'Team / Roles',
      title: 'Who does what (template)',
      contentHtml: html(
        '<p>List key roles and the types of work they handle.</p>',
        '<ul>',
        '<li>Duty doctor: <em>[Responsibilities]</em></li>',
        '<li>Admin lead: <em>[Responsibilities]</em></li>',
        '<li>Reception: <em>[Responsibilities]</em></li>',
        '</ul>',
      ),
    },
    {
      categoryName: 'Useful links',
      title: 'Useful links (template)',
      contentHtml: html(
        '<p>Add quick links used by the team. Keep them current.</p>',
        '<ul>',
        '<li><a href=\"[Local form/link]\">[Local form/link]</a></li>',
        '<li><a href=\"[Shared drive location]\">[Shared drive location]</a></li>',
        '</ul>',
      ),
    },
  ]

  const result = await prisma.$transaction(async (tx) => {
    if (force) {
      // Clear existing (active) content so we can reseed predictably.
      const now = new Date()
      await tx.adminItem.updateMany({ where: { surgeryId: surgery.id, deletedAt: null }, data: { deletedAt: now } })
      await tx.adminCategory.updateMany({ where: { surgeryId: surgery.id, deletedAt: null }, data: { deletedAt: now } })
      await tx.adminItemAttachment.updateMany({ where: { surgeryId: surgery.id, deletedAt: null }, data: { deletedAt: now } })
      await tx.adminItemEditor.deleteMany({ where: { adminItem: { surgeryId: surgery.id } } })
      await tx.adminOnTakeWeek.deleteMany({ where: { surgeryId: surgery.id } })
      await tx.adminDutyRotaEntry.deleteMany({ where: { surgeryId: surgery.id } })
    }

    const createdCategories = await Promise.all(
      categoriesToCreate.map((name, idx) =>
        tx.adminCategory.create({
          data: { surgeryId: surgery.id, name, orderIndex: idx },
          select: { id: true, name: true },
        }),
      ),
    )

    const catIdByName = new Map(createdCategories.map((c) => [c.name, c.id] as const))

    const createdItems = await Promise.all(
      starterPages.map((p) =>
        tx.adminItem.create({
          data: {
            surgeryId: surgery.id,
            categoryId: catIdByName.get(p.categoryName) ?? null,
            type: 'PAGE',
            title: p.title,
            contentHtml: p.contentHtml,
            warningLevel: null,
            lastReviewedAt: null,
            ownerUserId: null,
          },
          select: { id: true },
        }),
      ),
    )

    // Ensure pinned panel exists and is blank for global defaults.
    await tx.adminPinnedPanel.upsert({
      where: { surgeryId: surgery.id },
      update: { taskBuddyText: '', postRouteText: '' },
      create: { surgeryId: surgery.id, taskBuddyText: '', postRouteText: '' },
    })

    // Ensure rota is empty.
    await tx.adminOnTakeWeek.deleteMany({ where: { surgeryId: surgery.id } })

    return { categoriesCreated: createdCategories.length, itemsCreated: createdItems.length }
  })

  return {
    surgeryId: surgery.id,
    surgeryName: surgery.name,
    surgerySlug: surgery.slug,
    skipped: false,
    categoriesCreated: result.categoriesCreated,
    itemsCreated: result.itemsCreated,
  }
}

