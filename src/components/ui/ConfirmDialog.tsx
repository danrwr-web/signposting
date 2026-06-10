'use client'

import { useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close (cancel, backdrop, Escape) */
  onClose: () => void
  /** Called when the confirm button is clicked; may be async */
  onConfirm: () => void | Promise<void>
  /** Dialog title */
  title: string
  /** Plain message; use children instead for rich content */
  message?: ReactNode
  /** Rich body content (takes precedence over message) */
  children?: ReactNode
  /** Confirm button label (default: 'Confirm') */
  confirmLabel?: string
  /** Cancel button label (default: 'Cancel') */
  cancelLabel?: string
  /** Confirm button styling (default: 'danger') */
  variant?: 'danger' | 'primary'
  /** Disables cancel and shows a spinner on the confirm button */
  loading?: boolean
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  // Focus lands on Cancel by default — the safe choice for destructive actions
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width="md"
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ?? <p className="text-sm text-nhs-grey">{message}</p>}
    </Dialog>
  )
}
