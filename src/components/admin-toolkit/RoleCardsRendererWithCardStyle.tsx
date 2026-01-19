'use client'

import { useCardStyle } from '@/context/CardStyleContext'
import type { RoleCardsBlock } from '@/lib/adminToolkitContentBlocksShared'
import RoleCardsRenderer from './RoleCardsRenderer'

export default function RoleCardsRendererWithCardStyle({ block }: { block: RoleCardsBlock }) {
  const { cardStyle } = useCardStyle()
  const isBlue = cardStyle === 'powerappsBlue'
  return <RoleCardsRenderer block={block} useBlueStyle={isBlue} />
}

