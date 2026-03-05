'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  description?: string
  initialFocusRef?: React.RefObject<HTMLElement>
  widthClassName?: string
}

export default function Modal({
  title,
  onClose,
  children,
  description,
  initialFocusRef,
  widthClassName = 'max-w-xl'
}: ModalProps) {
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) onClose()
    },
    [onClose]
  )

  const onOpenAutoFocus = React.useCallback(
    (e: Event) => {
      if (initialFocusRef?.current) {
        e.preventDefault()
        initialFocusRef.current.focus()
      }
    },
    [initialFocusRef]
  )

  return (
    <Dialog.Root open onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Overlay
            className="fixed inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden
          />
          <Dialog.Content
          onOpenAutoFocus={initialFocusRef ? onOpenAutoFocus : undefined}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            onClose()
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault()
            onClose()
          }}
          className={`relative w-full ${widthClassName} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-0 shadow-xl focus:outline-none`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold text-nhs-dark-blue">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-2 text-sm text-nhs-grey">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-full p-2 text-nhs-grey hover:text-nhs-dark-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                aria-label="Close dialog"
                onClick={onClose}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M5 5l10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>
          <div className="px-6 py-5">{children}</div>
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
