'use client'

import { useState } from 'react'
import MoreModal from './MoreModal'

const MAX_LENGTH = 120

interface TruncateWithMoreProps {
  text: string
  title: string
  /** Max chars before showing "More" (default 120) */
  maxLength?: number
  className?: string
  /** When true, renders inline (span) for use inside paragraphs */
  inline?: boolean
}

export default function TruncateWithMore({
  text,
  title,
  maxLength = MAX_LENGTH,
  className = '',
  inline = false,
}: TruncateWithMoreProps) {
  const [showModal, setShowModal] = useState(false)
  const isLong = text.length > maxLength
  const displayText = isLong ? `${text.slice(0, maxLength).trim()}…` : text

  const Wrapper = inline ? 'span' : 'div'

  return (
    <>
      <Wrapper className={className}>
        {inline ? (
          <>
            <span>{displayText}</span>
            {isLong && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-1 rounded"
                >
                  More
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <span className="line-clamp-2 block">{displayText}</span>
            {isLong && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-1 text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-1 rounded"
              >
                More
              </button>
            )}
          </>
        )}
      </Wrapper>
      {showModal && <MoreModal title={title} content={text} onClose={() => setShowModal(false)} />}
    </>
  )
}
