import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createSampleEngagementData() {
  console.log('Creating sample engagement data...')

  // Get some surgeries and symptoms
  const surgeries = await prisma.surgery.findMany({ take: 2 })
  const symptoms = await prisma.baseSymptom.findMany({ take: 5 })

  if (surgeries.length === 0 || symptoms.length === 0) {
    console.log('No surgeries or symptoms found. Please run the seed script first.')
    return
  }

  // Create sample engagement events
  const events = []
  
  // Create events for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    
    // Random number of events per day (0-10)
    const eventsPerDay = Math.floor(Math.random() * 11)
    
    for (let j = 0; j < eventsPerDay; j++) {
      const randomSurgery = surgeries[Math.floor(Math.random() * surgeries.length)]
      const randomSymptom = symptoms[Math.floor(Math.random() * symptoms.length)]
      
      // Random user email (some events have no user)
      const userEmail = Math.random() > 0.3 ? `user${Math.floor(Math.random() * 5) + 1}@example.com` : null
      
      events.push({
        surgeryId: randomSurgery.id,
        baseId: randomSymptom.id,
        userEmail,
        event: 'view_symptom',
        createdAt: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000), // Random time in the day
      })
    }
  }

  // Insert all events
  await prisma.engagementEvent.createMany({
    data: events,
    skipDuplicates: true,
  })

  console.log(`Created ${events.length} sample engagement events`)
  
  // Show some statistics
  const totalEvents = await prisma.engagementEvent.count()
  const eventsBySurgery = await prisma.engagementEvent.groupBy({
    by: ['surgeryId'],
    _count: { surgeryId: true },
  })
  
  console.log(`Total engagement events: ${totalEvents}`)
  console.log('Events by surgery:', eventsBySurgery)
}

createSampleEngagementData()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
