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

  beforeAll(async () => {
    client = new PrismaClient({
      datasources: { db: { url } },
      omit: { user: { password: true }, surgery: { adminPassHash: true } },
    })
    await client.userSurgery.deleteMany({})
    await client.user.deleteMany({})
    await client.surgery.deleteMany({})
    await client.surgery.create({
      data: { id: 's1', name: 'Omit Test Practice', adminEmail: 'admin@example.com', adminPassHash: 'HASH_S' },
    })
    await client.user.create({
      data: { id: 'u1', email: 'user@example.com', password: 'HASH_U', globalRole: 'USER' },
    })
    await client.userSurgery.create({ data: { userId: 'u1', surgeryId: 's1', role: 'ADMIN' } })
  })

  afterAll(async () => {
    await client?.$disconnect()
  })

  it('withholds the hashes from an ordinary read', async () => {
    const user = await client.user.findUnique({ where: { id: 'u1' } })
    const surgery = await client.surgery.findUnique({ where: { id: 's1' } })

    expect((user as Record<string, unknown>).password).toBeUndefined()
    expect((surgery as Record<string, unknown>).adminPassHash).toBeUndefined()
  })

  it('withholds them through nested relation reads too', async () => {
    // The shape that leaked on the admin screens: surgery -> users -> user.
    const surgery = await client.surgery.findUnique({
      where: { id: 's1' },
      include: { users: { include: { user: true } } },
    })

    const member = surgery!.users[0].user as unknown as Record<string, unknown>
    expect(member.password).toBeUndefined()
    expect((surgery as unknown as Record<string, unknown>).adminPassHash).toBeUndefined()
  })

  it('still returns them when a caller opts in, so login keeps working', async () => {
    const user = await client.user.findUnique({ where: { id: 'u1' }, omit: { password: false } })
    const surgery = await client.surgery.findUnique({
      where: { adminEmail: 'admin@example.com' },
      omit: { adminPassHash: false },
    })

    expect(user!.password).toBe('HASH_U')
    expect(surgery!.adminPassHash).toBe('HASH_S')
  })

  it('leaves non-credential columns alone', async () => {
    const surgery = await client.surgery.findUnique({ where: { id: 's1' } })
    expect(surgery!.adminEmail).toBe('admin@example.com')
    expect(surgery!.name).toBe('Omit Test Practice')
  })
})
