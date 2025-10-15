import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create sample surgeries
  const surgery1 = await prisma.surgery.upsert({
    where: { slug: 'ide-lane' },
    update: {},
    create: {
      name: 'Ide Lane Surgery',
      slug: 'ide-lane',
    },
  })

  const surgery2 = await prisma.surgery.upsert({
    where: { slug: 'health-centre' },
    update: {},
    create: {
      name: 'Health Centre',
      slug: 'health-centre',
    },
  })

  console.log('Created surgeries:', { surgery1, surgery2 })

  // Create sample base symptoms
  const symptoms = [
    {
      slug: 'chest-pain',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      briefInstruction: 'Seek immediate medical attention for chest pain',
      instructions: 'Chest pain can be a sign of a serious condition. If you experience chest pain, especially if it is severe, crushing, or accompanied by shortness of breath, nausea, or sweating, call 999 immediately. Do not drive yourself to the hospital.',
      highlightedText: 'Call 999 immediately for severe chest pain',
      linkToPage: 'Stroke',
    },
    {
      slug: 'difficulty-breathing',
      name: 'Difficulty Breathing',
      ageGroup: 'Adult',
      briefInstruction: 'Emergency - call 999 if breathing is severely affected',
      instructions: 'If you are having severe difficulty breathing, call 999 immediately. For mild breathing problems, try sitting upright, using a fan for air circulation, and avoiding triggers like smoke or allergens. If symptoms worsen or persist, seek medical attention.',
      highlightedText: 'Severe breathing difficulties require immediate emergency care',
      linkToPage: null,
    },
    {
      slug: 'high-fever',
      name: 'High Fever',
      ageGroup: 'U5',
      briefInstruction: 'Monitor temperature and seek medical advice if concerned',
      instructions: 'For children under 5 with high fever (over 38°C), monitor closely. Keep them cool with light clothing, offer plenty of fluids, and use age-appropriate fever reducers as directed. Contact your GP if fever persists for more than 24 hours or if the child appears unwell.',
      highlightedText: 'Seek immediate medical attention if child appears very unwell',
      linkToPage: null,
    },
    {
      slug: 'severe-headache',
      name: 'Severe Headache',
      ageGroup: 'Adult',
      briefInstruction: 'Seek medical attention for severe or sudden headaches',
      instructions: 'Severe headaches, especially those that come on suddenly or are described as "the worst headache of your life," require immediate medical attention. Rest in a dark, quiet room, stay hydrated, and avoid triggers. If symptoms worsen or include vision changes, weakness, or confusion, call 999.',
      highlightedText: 'Sudden severe headaches may indicate a medical emergency',
      linkToPage: 'Stroke',
    },
    {
      slug: 'allergic-reaction',
      name: 'Allergic Reaction',
      ageGroup: 'Adult',
      briefInstruction: 'Use EpiPen if available and call 999 for severe reactions',
      instructions: 'For mild allergic reactions, avoid the allergen and take antihistamines as directed. For severe reactions with difficulty breathing, swelling of face/throat, or widespread hives, use EpiPen if available and call 999 immediately. Even after using EpiPen, you must go to hospital.',
      highlightedText: 'Severe allergic reactions require immediate emergency treatment',
      linkToPage: 'Anaphylaxis',
    },
    {
      slug: 'nausea-vomiting',
      name: 'Nausea and Vomiting',
      ageGroup: 'O5',
      briefInstruction: 'Stay hydrated and seek medical advice if symptoms persist',
      instructions: 'For nausea and vomiting, rest, stay hydrated with small sips of water or oral rehydration solutions, and avoid solid foods initially. Gradually reintroduce bland foods. Seek medical attention if vomiting persists for more than 24 hours, if there are signs of dehydration, or if vomiting is bloody.',
      highlightedText: 'Seek medical attention if vomiting persists or contains blood',
      linkToPage: null,
    },
    {
      slug: 'rash',
      name: 'Rash',
      ageGroup: 'O5',
      briefInstruction: 'Monitor rash and seek medical advice if concerning',
      instructions: 'Most rashes are not serious. Keep the area clean and dry, avoid scratching, and use gentle moisturizers. Seek medical attention if the rash is widespread, painful, blistered, or accompanied by fever, difficulty breathing, or swelling of face/throat.',
      highlightedText: 'Seek immediate medical attention for widespread or painful rashes',
      linkToPage: null,
    },
    {
      slug: 'abdominal-pain',
      name: 'Abdominal Pain',
      ageGroup: 'Adult',
      briefInstruction: 'Seek medical attention for severe or persistent abdominal pain',
      instructions: 'Mild abdominal pain often resolves with rest and gentle movement. Avoid eating if nauseous. Seek medical attention if pain is severe, persistent, or accompanied by fever, vomiting, or changes in bowel habits. Severe abdominal pain may indicate a medical emergency.',
      highlightedText: 'Severe abdominal pain may require immediate medical attention',
      linkToPage: null,
    },
  ]

  for (const symptomData of symptoms) {
    await prisma.baseSymptom.create({
      data: symptomData,
    })
  }

  console.log('Created base symptoms')

  // Create some sample overrides for Ide Lane Surgery
  const chestPainSymptom = await prisma.baseSymptom.findFirst({
    where: { name: 'Chest Pain' }
  })

  if (chestPainSymptom) {
    await prisma.surgerySymptomOverride.upsert({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId: surgery1.id,
          baseSymptomId: chestPainSymptom.id,
        }
      },
      update: {},
      create: {
        surgeryId: surgery1.id,
        baseSymptomId: chestPainSymptom.id,
        briefInstruction: 'Ide Lane Surgery: Seek immediate medical attention for chest pain',
        instructions: 'At Ide Lane Surgery, we take chest pain very seriously. If you experience chest pain, especially if it is severe, crushing, or accompanied by shortness of breath, nausea, or sweating, call 999 immediately. Our emergency protocol requires immediate assessment.',
        highlightedText: 'Ide Lane Surgery Emergency Protocol: Call 999 immediately',
      },
    })
  }

  console.log('Created sample overrides')

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
