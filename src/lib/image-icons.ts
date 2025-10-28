import prisma from './prisma'

export interface ImageIcon {
  id: string
  phrase: string
  filePath: string
  imageUrl: string
  alt: string | null
  width: number | null
  height: number | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Get all image icons
 */
export async function getAllImageIcons(): Promise<ImageIcon[]> {
  return await prisma.imageIcon.findMany({
    orderBy: { phrase: 'asc' }
  })
}

/**
 * Find image icon by phrase (case-insensitive)
 */
export async function findImageIconByPhrase(briefInstruction: string | null): Promise<ImageIcon | null> {
  if (!briefInstruction) return null
  
  // Search for matching phrase in the brief instruction
  const icons = await prisma.imageIcon.findMany({
    orderBy: { phrase: 'asc' }
  })

  // Find the first icon whose phrase appears in the brief instruction (case-insensitive)
  for (const icon of icons) {
    if (briefInstruction.toLowerCase().includes(icon.phrase.toLowerCase())) {
      return icon
    }
  }

  return null
}

/**
 * Check if a surgery has image icons enabled
 */
export async function getSurgeryImageIconsSetting(surgeryId?: string): Promise<boolean> {
  if (!surgeryId) return true

  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { enableImageIcons: true }
  })

  return surgery?.enableImageIcons ?? true
}
