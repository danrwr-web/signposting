'use client'

import Modal from '@/components/appointments/Modal'

interface MoreModalProps {
  title: string
  content: string
  onClose: () => void
}

export default function MoreModal({ title, content, onClose }: MoreModalProps) {
  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-md">
      <div className="text-slate-700 text-sm leading-relaxed">
        {content}
      </div>
    </Modal>
  )
}
