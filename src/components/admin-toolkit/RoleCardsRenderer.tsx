import type { RoleCardsBlock } from '@/lib/adminToolkitContentBlocksShared'
import { splitRoleCardBodyToLines } from '@/lib/adminToolkitContentBlocksShared'

function gridColsClass(columns: number): string {
  if (columns === 4) return 'lg:grid-cols-4'
  if (columns === 2) return 'lg:grid-cols-2'
  return 'lg:grid-cols-3'
}

export default function RoleCardsRenderer({
  block,
  useBlueStyle,
}: {
  block: RoleCardsBlock
  useBlueStyle?: boolean
}) {
  const cards = (block.cards ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex)
  if (cards.length === 0) return null

  const title = (block.title ?? '').trim()
  const layout = block.layout === 'row' ? 'row' : 'grid'
  const columns = block.columns ?? 3
  const isBlue = useBlueStyle === true

  const cardClassName = isBlue
    ? 'rounded-lg border border-nhs-blue bg-nhs-blue p-4 shadow-sm'
    : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
  const titleClassName = isBlue ? 'font-semibold text-white' : 'font-semibold text-gray-900'
  const listClassName = isBlue
    ? 'mt-2 list-disc pl-5 space-y-1 text-sm text-white/90'
    : 'mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700'
  const emptyClassName = isBlue ? 'mt-2 text-sm text-white/80' : 'mt-2 text-sm text-gray-500'

  return (
    <section className="mb-6">
      {title ? <h2 className="text-lg font-semibold text-nhs-dark-blue">{title}</h2> : null}

      <div className={title ? 'mt-3' : ''}>
        {layout === 'row' ? (
          <div className="flex flex-wrap gap-4">
            {cards.map((c) => {
              const lines = splitRoleCardBodyToLines(c.body)
              return (
                <div
                  key={c.id}
                  className={[
                    'w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)]',
                    cardClassName,
                  ].join(' ')}
                >
                  <div className={titleClassName}>{c.title}</div>
                  {lines.length > 0 ? (
                    <ul className={listClassName}>
                      {lines.map((l, idx) => (
                        <li key={idx}>{l}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={emptyClassName}>No responsibilities added yet.</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className={['grid gap-4 grid-cols-1 sm:grid-cols-2', gridColsClass(columns)].join(' ')}>
            {cards.map((c) => {
              const lines = splitRoleCardBodyToLines(c.body)
              return (
                <div key={c.id} className={cardClassName}>
                  <div className={titleClassName}>{c.title}</div>
                  {lines.length > 0 ? (
                    <ul className={listClassName}>
                      {lines.map((l, idx) => (
                        <li key={idx}>{l}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={emptyClassName}>No responsibilities added yet.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

