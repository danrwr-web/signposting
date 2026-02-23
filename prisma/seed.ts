import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const normalizeStaffLabel = (label: string) =>
  label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'STAFF'

import { DEFAULT_DAILY_DOSE_TAG_NAMES } from '../src/lib/editorial/defaultDailyDoseTags'

async function ensureDailyDoseTags() {
  for (const name of DEFAULT_DAILY_DOSE_TAG_NAMES) {
    const trimmed = name.trim()
    if (!trimmed) continue
    await prisma.dailyDoseTag.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    })
  }
}

async function ensureBuiltInStaffTypes() {
  const builtInTypes = [
    { label: 'All', defaultColour: 'bg-nhs-yellow-tint', orderIndex: 0 },
    { label: 'PN', defaultColour: 'bg-nhs-green-tint', orderIndex: 1 },
    { label: 'HCA', defaultColour: 'bg-nhs-red-tint', orderIndex: 2 },
    { label: 'Dr', defaultColour: 'bg-nhs-light-blue', orderIndex: 3 }
  ]

  for (const type of builtInTypes) {
    await prisma.appointmentStaffType.upsert({
      where: {
        surgeryId_normalizedLabel: {
          surgeryId: null as unknown as string,
          normalizedLabel: normalizeStaffLabel(type.label)
        }
      },
      update: {},
      create: {
        label: type.label,
        normalizedLabel: normalizeStaffLabel(type.label),
        defaultColour: type.defaultColour,
        orderIndex: type.orderIndex,
        isBuiltIn: true,
        isEnabled: true
      }
    })
  }
}

async function ensureDailyDoseTopics(surgeryId: string) {
  const topics = [
    { name: 'Safer signposting language (demo)', roleScope: ['ADMIN', 'GP', 'NURSE'], ordering: 1 },
    { name: 'Reception triage basics (demo)', roleScope: ['ADMIN'], ordering: 2 },
    { name: 'Clinician safety refresh (demo)', roleScope: ['GP', 'NURSE'], ordering: 3 },
    { name: 'Practice workflow updates (demo)', roleScope: ['ADMIN', 'GP', 'NURSE'], ordering: 4 },
    { name: 'Safeguarding awareness (demo)', roleScope: ['ADMIN', 'GP', 'NURSE'], ordering: 5 },
  ]

  const results: Array<{ id: string; name: string }> = []
  for (const topic of topics) {
    const existing = await prisma.dailyDoseTopic.findFirst({
      where: { surgeryId, name: topic.name },
    })
    if (existing) {
      results.push({ id: existing.id, name: existing.name })
      continue
    }
    const created = await prisma.dailyDoseTopic.create({
      data: {
        surgeryId,
        name: topic.name,
        roleScope: topic.roleScope,
        ordering: topic.ordering,
        isActive: true,
      },
    })
    results.push({ id: created.id, name: created.name })
  }
  return results
}

async function ensureDailyDoseCards(surgeryId: string, topics: Array<{ id: string; name: string }>) {
  const demoSource = {
    title: 'Demo source (not clinical guidance)',
    org: 'Signposting Toolkit',
    url: 'https://example.com/demo-source',
    publishedDate: 'Demo content',
  }

  const cards = [
    {
      title: 'Using calm, consistent wording at the front desk',
      topicName: 'Safer signposting language (demo)',
      roleScope: ['ADMIN', 'GP', 'NURSE'],
      contentBlocks: [
        { type: 'paragraph', text: 'Demo content only: this card shows how Daily Dose content is structured.' },
        {
          type: 'question',
          questionType: 'MCQ',
          prompt: 'Which option sounds most neutral and supportive?',
          options: ['You must book online', 'Let us look at the safest option together'],
          correctAnswer: 'Let us look at the safest option together',
          rationale: 'A calm, shared approach helps keep conversations respectful.',
          difficulty: 1,
        },
        { type: 'reveal', text: 'Keep language consistent so patients feel listened to and supported.' },
      ],
    },
    {
      title: 'Five-minute triage essentials for reception teams',
      topicName: 'Reception triage basics (demo)',
      roleScope: ['ADMIN'],
      contentBlocks: [
        { type: 'paragraph', text: 'Demo content only: use this template to capture local triage reminders.' },
        {
          type: 'question',
          questionType: 'TRUE_FALSE',
          prompt: 'True or false: it helps to confirm preferred contact details early.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          rationale: 'Confirming contact details early avoids delays later.',
          difficulty: 1,
        },
        { type: 'reveal', text: 'Short checklists can help new colleagues stay confident on busy days.' },
      ],
    },
    {
      title: 'Clinical safety refresh: escalation cues',
      topicName: 'Clinician safety refresh (demo)',
      roleScope: ['GP', 'NURSE'],
      contentBlocks: [
        { type: 'paragraph', text: 'Demo content only: replace with approved clinical guidance.' },
        {
          type: 'question',
          questionType: 'SCENARIO',
          prompt: 'A colleague is unsure if a case needs escalation. What is the safest next step?',
          options: ['Wait until later', 'Check the agreed escalation pathway'],
          correctAnswer: 'Check the agreed escalation pathway',
          rationale: 'Agreed pathways support consistent, safe decisions.',
          difficulty: 2,
        },
        { type: 'reveal', text: 'Document local escalation steps so everyone follows the same route.' },
      ],
    },
    {
      title: 'Keeping workflow notes up to date',
      topicName: 'Practice workflow updates (demo)',
      roleScope: ['ADMIN', 'GP', 'NURSE'],
      contentBlocks: [
        { type: 'paragraph', text: 'Demo content only: highlight how to keep workflow notes current.' },
        {
          type: 'question',
          questionType: 'MCQ',
          prompt: 'What helps staff stay aligned with workflow changes?',
          options: ['Informal updates only', 'A single shared reference point'],
          correctAnswer: 'A single shared reference point',
          rationale: 'Shared references reduce confusion and drift.',
          difficulty: 2,
        },
        { type: 'reveal', text: 'Weekly refreshes help everyone stay confident with the latest process.' },
      ],
    },
    {
      title: 'Safeguarding refresher: listen and record',
      topicName: 'Safeguarding awareness (demo)',
      roleScope: ['ADMIN', 'GP', 'NURSE'],
      contentBlocks: [
        { type: 'paragraph', text: 'Demo content only: include safeguarding reminders approved locally.' },
        {
          type: 'question',
          questionType: 'TRUE_FALSE',
          prompt: 'True or false: always record safeguarding concerns promptly.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          rationale: 'Prompt recording keeps care safe and traceable.',
          difficulty: 1,
        },
        { type: 'reveal', text: 'Use local guidance to keep safeguarding steps clear and consistent.' },
      ],
    },
  ]

  const createdCards: Array<{ id: string; title: string }> = []
  for (const card of cards) {
    const topic = topics.find((item) => item.name === card.topicName)
    if (!topic) continue
    const existing = await prisma.dailyDoseCard.findFirst({
      where: { surgeryId, title: card.title },
    })
    if (existing) {
      createdCards.push({ id: existing.id, title: existing.title })
      continue
    }
    const created = await prisma.dailyDoseCard.create({
      data: {
        surgeryId,
        title: card.title,
        topicId: topic.id,
        roleScope: card.roleScope,
        contentBlocks: card.contentBlocks,
        sources: [demoSource],
        status: 'PUBLISHED',
        version: 1,
      },
    })
    createdCards.push({ id: created.id, title: created.title })
  }
  return createdCards
}

async function ensureLearningPathway(
  surgeryId: string,
  userId: string,
  cards: Array<{ id: string; title: string }>
) {
  const themeDefs = [
    {
      name: 'Safe Signposting Language',
      description: 'Learn consistent, calm phrasing to guide patients safely and respectfully.',
      ordering: 1,
      units: [
        { title: 'Introduction to Safe Language', level: 'INTRO', ordering: 1 },
        { title: 'Common Phrases to Avoid', level: 'INTRO', ordering: 2 },
        { title: 'Confident Redirecting', level: 'CORE', ordering: 1 },
        { title: 'Handling Difficult Conversations', level: 'CORE', ordering: 2 },
        { title: 'Advanced De-escalation', level: 'STRETCH', ordering: 1 },
      ],
    },
    {
      name: 'Reception Triage Essentials',
      description: 'Core triage skills for front-desk teams to route patients safely.',
      ordering: 2,
      units: [
        { title: 'What is Triage?', level: 'INTRO', ordering: 1 },
        { title: 'Red Flag Recognition', level: 'INTRO', ordering: 2 },
        { title: 'Prioritising Same-Day Requests', level: 'CORE', ordering: 1 },
        { title: 'Working with Clinicians', level: 'CORE', ordering: 2 },
        { title: 'Complex Multi-Symptom Calls', level: 'STRETCH', ordering: 1 },
      ],
    },
    {
      name: 'Safeguarding Awareness',
      description: 'Recognise, record, and escalate safeguarding concerns appropriately.',
      ordering: 3,
      units: [
        { title: 'What is Safeguarding?', level: 'INTRO', ordering: 1 },
        { title: 'Recognising Signs of Concern', level: 'CORE', ordering: 1 },
        { title: 'Recording and Escalation', level: 'CORE', ordering: 2 },
        { title: 'Multi-Agency Working', level: 'STRETCH', ordering: 1 },
        { title: 'Difficult Disclosure Scenarios', level: 'STRETCH', ordering: 2 },
      ],
    },
  ]

  // Demo progress patterns: some secure, some in-progress, some not started
  // Indexed by [themeIndex][unitIndex]
  const progressPatterns: Array<
    Array<{ sessionsCompleted: number; correctCount: number; totalQuestions: number } | null>
  > = [
    // Theme 1: Safe Signposting Language — good progress
    [
      { sessionsCompleted: 3, correctCount: 9, totalQuestions: 10 }, // SECURE (90%)
      { sessionsCompleted: 2, correctCount: 8, totalQuestions: 10 }, // SECURE (80%)
      { sessionsCompleted: 1, correctCount: 6, totalQuestions: 10 }, // IN_PROGRESS (60%)
      null, // NOT_STARTED
      null, // NOT_STARTED
    ],
    // Theme 2: Reception Triage — just started
    [
      { sessionsCompleted: 2, correctCount: 9, totalQuestions: 10 }, // SECURE (90%)
      { sessionsCompleted: 1, correctCount: 7, totalQuestions: 10 }, // IN_PROGRESS (70%)
      null,
      null,
      null,
    ],
    // Theme 3: Safeguarding — not started at all
    [null, null, null, null, null],
  ]

  for (let ti = 0; ti < themeDefs.length; ti++) {
    const themeDef = themeDefs[ti]

    // Find or create theme
    let theme = await prisma.dailyDoseTheme.findFirst({
      where: { surgeryId, name: themeDef.name },
    })
    if (!theme) {
      theme = await prisma.dailyDoseTheme.create({
        data: {
          surgeryId,
          name: themeDef.name,
          description: themeDef.description,
          ordering: themeDef.ordering,
          isActive: true,
        },
      })
    }

    for (let ui = 0; ui < themeDef.units.length; ui++) {
      const unitDef = themeDef.units[ui]

      // Find or create unit
      let unit = await prisma.dailyDoseUnit.findFirst({
        where: { themeId: theme.id, title: unitDef.title },
      })
      if (!unit) {
        unit = await prisma.dailyDoseUnit.create({
          data: {
            themeId: theme.id,
            title: unitDef.title,
            level: unitDef.level,
            ordering: unitDef.ordering,
            isActive: true,
          },
        })
      }

      // Link a card to this unit if available (round-robin through cards)
      if (cards.length > 0) {
        const cardIndex = (ti * themeDef.units.length + ui) % cards.length
        const card = cards[cardIndex]
        const existingLink = await prisma.dailyDoseUnitCard.findUnique({
          where: { unitId_cardId: { unitId: unit.id, cardId: card.id } },
        })
        if (!existingLink) {
          await prisma.dailyDoseUnitCard.create({
            data: { unitId: unit.id, cardId: card.id, ordering: 0 },
          })
        }
      }

      // Create demo progress for the admin user
      const pattern = progressPatterns[ti]?.[ui]
      if (pattern) {
        const status =
          pattern.sessionsCompleted >= 2 &&
          pattern.totalQuestions > 0 &&
          pattern.correctCount / pattern.totalQuestions >= 0.8
            ? 'SECURE'
            : 'IN_PROGRESS'

        await prisma.userUnitProgress.upsert({
          where: { userId_unitId: { userId, unitId: unit.id } },
          update: {},
          create: {
            userId,
            unitId: unit.id,
            surgeryId,
            status,
            sessionsCompleted: pattern.sessionsCompleted,
            correctCount: pattern.correctCount,
            totalQuestions: pattern.totalQuestions,
            lastSessionAt: new Date(),
          },
        })
      }
    }
  }

  console.log('Created learning pathway themes, units, and demo progress')
}

async function main() {
  console.log('Starting seed...')

  await ensureBuiltInStaffTypes()
  await ensureDailyDoseTags()

  // Create sample surgeries
  const surgery1 = await prisma.surgery.upsert({
    where: { name: 'Ide Lane Surgery' },
    update: {},
    create: {
      name: 'Ide Lane Surgery',
      slug: 'ide-lane',
    },
  })

  const surgery2 = await prisma.surgery.upsert({
    where: { name: 'Health Centre' },
    update: {},
    create: {
      name: 'Health Centre',
      slug: 'health-centre',
    },
  })

  console.log('Created surgeries:', { surgery1, surgery2 })

  // Create RBAC users
  const superuser = await prisma.user.upsert({
    where: { email: 'superuser@example.com' },
    update: {},
    create: {
      email: 'superuser@example.com',
      name: 'Super User',
      globalRole: 'SUPERUSER',
      defaultSurgeryId: surgery1.id,
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      globalRole: 'USER',
      defaultSurgeryId: surgery1.id,
    },
  })

  const standardUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Standard User',
      globalRole: 'USER',
      defaultSurgeryId: surgery1.id,
    },
  })

  console.log('Created users:', { superuser, adminUser, standardUser })

  // Create surgery memberships
  await prisma.userSurgery.upsert({
    where: {
      userId_surgeryId: {
        userId: adminUser.id,
        surgeryId: surgery1.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      surgeryId: surgery1.id,
      role: 'ADMIN',
    },
  })

  await prisma.userSurgery.upsert({
    where: {
      userId_surgeryId: {
        userId: standardUser.id,
        surgeryId: surgery1.id,
      },
    },
    update: {},
    create: {
      userId: standardUser.id,
      surgeryId: surgery1.id,
      role: 'STANDARD',
    },
  })

  console.log('Created surgery memberships')

  const dailyDoseTopics = await ensureDailyDoseTopics(surgery1.id)
  const dailyDoseCards = await ensureDailyDoseCards(surgery1.id, dailyDoseTopics)

  await prisma.dailyDoseProfile.upsert({
    where: {
      userId_surgeryId: {
        userId: adminUser.id,
        surgeryId: surgery1.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      surgeryId: surgery1.id,
      role: 'ADMIN',
      onboardingCompleted: true,
      preferences: {
        weekdayOnlyStreak: true,
        chosenFocusTopicIds: dailyDoseTopics.slice(0, 2).map((topic) => topic.id),
        baselineConfidence: 3,
      },
    },
  })

  await prisma.dailyDoseProfile.upsert({
    where: {
      userId_surgeryId: {
        userId: standardUser.id,
        surgeryId: surgery1.id,
      },
    },
    update: {},
    create: {
      userId: standardUser.id,
      surgeryId: surgery1.id,
      role: 'NURSE',
      onboardingCompleted: true,
      preferences: {
        weekdayOnlyStreak: true,
        chosenFocusTopicIds: dailyDoseTopics.slice(2, 4).map((topic) => topic.id),
        baselineConfidence: 2,
      },
    },
  })

  if (dailyDoseCards.length > 0) {
    await prisma.dailyDoseSession.create({
      data: {
        userId: standardUser.id,
        surgeryId: surgery1.id,
        cardIds: [dailyDoseCards[0].id],
        cardResults: [{ cardId: dailyDoseCards[0].id, correctCount: 1, questionCount: 1 }],
        questionsAttempted: 1,
        correctCount: 1,
        xpEarned: 15,
        completedAt: new Date(),
      },
    })
  }

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
    await prisma.baseSymptom.upsert({
      where: { slug: symptomData.slug },
      update: symptomData,
      create: symptomData,
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

  // Seed learning pathway
  await ensureLearningPathway(surgery1.id, adminUser.id, dailyDoseCards)

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
