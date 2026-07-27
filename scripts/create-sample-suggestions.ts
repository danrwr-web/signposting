import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createSampleSuggestions() {
  console.log('Creating sample suggestions...')

  // Get some surgeries and symptoms
  const surgeries = await prisma.surgery.findMany({ take: 2 })
  const symptoms = await prisma.baseSymptom.findMany({ take: 3 })

  if (surgeries.length === 0 || symptoms.length === 0) {
    console.log('No surgeries or symptoms found. Please run the seed script first.')
    return
  }

  // Create sample suggestions
  const suggestions = [
    {
      surgeryId: surgeries[0].id,
      baseId: symptoms[0].id,
      symptom: symptoms[0].name,
      userEmail: 'user1@example.com',
      text: 'Could you please add more information about when to seek immediate medical attention for this symptom? The current guidance is helpful but could be more specific about emergency situations.',
      status: 'PENDING' as const
    },
    {
      surgeryId: surgeries[0].id,
      baseId: symptoms[1].id,
      symptom: symptoms[1].name,
      userEmail: 'user2@example.com',
      text: 'I think this symptom page would benefit from including information about self-care measures that patients can try at home before seeking medical help.',
      status: 'PENDING' as const
    },
    {
      surgeryId: surgeries[1].id,
      baseId: symptoms[2].id,
      symptom: symptoms[2].name,
      userEmail: 'user3@example.com',
      text: 'The instructions are clear but could include more details about what to expect during recovery and when to follow up with a GP.',
      status: 'DONE' as const
    },
    {
      surgeryId: surgeries[1].id,
      baseId: symptoms[0].id,
      symptom: symptoms[0].name,
      userEmail: 'user4@example.com',
      text: 'This suggestion is not relevant anymore as the symptom information has been updated.',
      status: 'DECLINED' as const
    },
    {
      surgeryId: surgeries[0].id,
      baseId: null,
      symptom: 'New Symptom Request',
      userEmail: 'user5@example.com',
      text: 'Could you please add a symptom page for "persistent headaches"? This is something many of our patients ask about and it would be helpful to have guidance available.',
      status: 'PENDING' as const
    }
  ]

  // Insert all suggestions
  await prisma.suggestion.createMany({
    data: suggestions,
    skipDuplicates: true,
  })

  console.log(`Created ${suggestions.length} sample suggestions`)
  
  // Show some statistics
  const totalSuggestions = await prisma.suggestion.count()
  console.log(`Total suggestions: ${totalSuggestions}`)
}

createSampleSuggestions()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
