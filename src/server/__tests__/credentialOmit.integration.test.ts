/**
 * @jest-environment node
 */
/**
 * Runs against a real Postgres when INTEGRATION_DATABASE_URL is set; skipped
 * otherwise. Global omit (src/lib/prisma.ts) strips credential columns at
 * runtime but is NOT reflected in the generated types, so nothing here fails to
 * compile if an opt-in is dropped — a lost `omit: { password: false }` would
 * silently break login instead. These assertions are the safety net.
 */
import { PrismaClient } from '@prisma/client'

const url = process.env.INTEGRATION_DATABASE_URL
const describeIf = url ? describe : describe.skip

describeIf('credential columns under global omit', () => {
  // Constructed in beforeAll, not in the describe body: describe.skip still
  // evaluates its body, so building the client here would throw on an
  // undefined URL in every run that has no database.
  let client: PrismaClient

  // Fixtures are uniquely named per run and removed by id. Never deleteMany({}):
  // INTEGRATION_DATABASE_URL may point at a populated database, and a blanket
  // delete would erase it.
  const RUN = `omitspec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const SURGERY_ID = `${RUN}-s`
  const USER_ID = `${RUN}-u`

  beforeAll(async () => {
    client = new PrismaClient({
      datasources: { db: { url } },
      omit: { user: { password: true }, surgery: { adminPassHash: true } },
    })
    await client.surgery.create({
      data: {
        id: SURGERY_ID,
        name: `${RUN} Practice`,
        adminEmail: `${RUN}@example.invalid`,
        adminPassHash: 'HASH_S',
      },
    })
    await client.user.create({
      data: {
        id: USER_ID,
        email: `${RUN}@user.invalid`,
        password: 'HASH_U',
        globalRole: 'USER',
      },
    })
    await client.userSurgery.create({
      data: { userId: USER_ID, surgeryId: SURGERY_ID, role: 'ADMIN' },
    })
  })

  afterAll(async () => {
    if (!client) return
    // Ordered child-first so a foreign key cannot strand a fixture, and each
    // delete is scoped to this run's ids.
    await client.userSurgery.deleteMany({ where: { userId: USER_ID } })
    await client.user.deleteMany({ where: { id: USER_ID } })
    await client.surgery.deleteMany({ where: { id: SURGERY_ID } })
    await client.$disconnect()
  })

  it('withholds the hashes from an ordinary read', async () => {
    const user = await client.user.findUnique({ where: { id: USER_ID } })
    const surgery = await client.surgery.findUnique({ where: { id: SURGERY_ID } })

    expect((user as Record<string, unknown>).password).toBeUndefined()
    expect((surgery as Record<string, unknown>).adminPassHash).toBeUndefined()
  })

  it('withholds them through nested relation reads too', async () => {
    // The shape that leaked on the admin screens: surgery -> users -> user.
    const surgery = await client.surgery.findUnique({
      where: { id: SURGERY_ID },
      include: { users: { include: { user: true } } },
    })

    const member = surgery!.users[0].user as unknown as Record<string, unknown>
    expect(member.password).toBeUndefined()
    expect((surgery as unknown as Record<string, unknown>).adminPassHash).toBeUndefined()
  })

  it('still returns them when a caller opts in, so login keeps working', async () => {
    const user = await client.user.findUnique({ where: { id: USER_ID }, omit: { password: false } })
    const surgery = await client.surgery.findUnique({
      where: { adminEmail: `${RUN}@example.invalid` },
      omit: { adminPassHash: false },
    })

    expect(user!.password).toBe('HASH_U')
    expect(surgery!.adminPassHash).toBe('HASH_S')
  })

  it('leaves non-credential columns alone', async () => {
    const surgery = await client.surgery.findUnique({ where: { id: SURGERY_ID } })
    expect(surgery!.adminEmail).toBe(`${RUN}@example.invalid`)
    expect(surgery!.name).toBe(`${RUN} Practice`)
  })
})
