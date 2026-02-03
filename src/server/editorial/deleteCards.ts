import 'server-only'

import { prisma } from '@/lib/prisma'

/**
 * Permanently deletes a single Daily Dose card and its dependent rows.
 * Prisma schema uses onDelete: Cascade for DailyDoseCardVersion,
 * DailyDoseUserCardState, and DailyDoseFlaggedContent, so a single
 * delete of the card is sufficient.
 *
 * @param cardId - Card ID
 * @param surgeryId - Surgery ID (ensures card belongs to this surgery)
 * @returns The deleted card id, or null if not found / wrong surgery
 */
export async function deleteCard(
  cardId: string,
  surgeryId: string
): Promise<{ deleted: string } | null> {
  const card = await prisma.dailyDoseCard.findFirst({
    where: { id: cardId, surgeryId },
    select: { id: true },
  })
  if (!card) return null

  await prisma.dailyDoseCard.delete({
    where: { id: card.id },
  })
  return { deleted: card.id }
}

/**
 * Permanently deletes multiple Daily Dose cards in a transaction.
 * Only cards that belong to the given surgery are deleted.
 *
 * @param cardIds - Array of card IDs
 * @param surgeryId - Surgery ID (only cards for this surgery are deleted)
 * @returns Count of cards actually deleted
 */
export async function deleteCards(
  cardIds: string[],
  surgeryId: string
): Promise<{ deletedCount: number }> {
  if (cardIds.length === 0) return { deletedCount: 0 }

  const deleted = await prisma.$transaction(async (tx) => {
    const toDelete = await tx.dailyDoseCard.findMany({
      where: { id: { in: cardIds }, surgeryId },
      select: { id: true },
    })
    const ids = toDelete.map((c) => c.id)
    if (ids.length === 0) return 0
    await tx.dailyDoseCard.deleteMany({
      where: { id: { in: ids } },
    })
    return ids.length
  })

  return { deletedCount: deleted }
}
