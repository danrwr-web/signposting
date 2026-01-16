import { seedAdminToolkitGlobalDefaults } from '@/server/adminToolkit/seedGlobalDefaults'

async function main() {
  const force = process.argv.includes('--force')
  console.log('Seeding Admin Toolkit global defaults…', { force })

  const res = await seedAdminToolkitGlobalDefaults({ force })

  if (res.skipped) {
    console.log('Skipped:', res.reason)
    console.log('Surgery:', { id: res.surgeryId, name: res.surgeryName, slug: res.surgerySlug })
    return
  }

  console.log('Seed complete.')
  console.log('Surgery:', { id: res.surgeryId, name: res.surgeryName, slug: res.surgerySlug })
  console.log('Created:', { categories: res.categoriesCreated, items: res.itemsCreated })
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

