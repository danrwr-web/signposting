'use client'

import { useEditorState, type Editor } from '@tiptap/react'
import { NHS_TEXT_COLORS, NHS_HIGHLIGHT_COLORS } from '@/components/rich-text/extensions'
import ToolbarButton, { ToolbarSeparator } from '@/components/rich-text/toolbar/ToolbarButton'
import SwatchPopover from '@/components/rich-text/toolbar/SwatchPopover'
import LinkPopover from '@/components/rich-text/toolbar/LinkPopover'

const icon = {
  bulletList: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="3.5" r="1.25" />
      <circle cx="2.5" cy="8" r="1.25" />
      <circle cx="2.5" cy="12.5" r="1.25" />
      <rect x="5.5" y="2.75" width="9" height="1.5" rx="0.75" />
      <rect x="5.5" y="7.25" width="9" height="1.5" rx="0.75" />
      <rect x="5.5" y="11.75" width="9" height="1.5" rx="0.75" />
    </svg>
  ),
  orderedList: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <text x="0.5" y="5" fontSize="5" fontWeight="600">1</text>
      <text x="0.5" y="10" fontSize="5" fontWeight="600">2</text>
      <text x="0.5" y="15" fontSize="5" fontWeight="600">3</text>
      <rect x="5.5" y="2.75" width="9" height="1.5" rx="0.75" />
      <rect x="5.5" y="7.25" width="9" height="1.5" rx="0.75" />
      <rect x="5.5" y="11.75" width="9" height="1.5" rx="0.75" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6.5 9.5l3-3" />
      <path d="M7.5 4.5l1.2-1.2a2.55 2.55 0 013.6 3.6L11 8.2" />
      <path d="M8.5 11.5l-1.2 1.2a2.55 2.55 0 01-3.6-3.6L5 7.8" />
    </svg>
  ),
  undo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5L3 6.5l3 3" />
      <path d="M3 6.5h6a4 4 0 010 8H7" />
    </svg>
  ),
  redo: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3.5l3 3-3 3" />
      <path d="M13 6.5H7a4 4 0 000 8h2" />
    </svg>
  ),
  highlight: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 2.5l3 3-6.5 6.5H4v-3z" />
      <path d="M2 14h12" />
    </svg>
  ),
}

interface ToolbarProps {
  editor: Editor
}

export default function Toolbar({ editor }: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      textColor: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      highlightColor: (e.getAttributes('highlight').color as string | undefined) ?? null,
      linkHref: (e.getAttributes('link').href as string | undefined) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-gray-300 bg-white p-1.5"
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        label="Paragraph"
        active={state.paragraph}
      >
        <span className="text-sm">P</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="Heading"
        active={state.h2}
      >
        <span className="text-sm font-semibold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="Subheading"
        active={state.h3}
      >
        <span className="text-sm font-semibold">H3</span>
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} label="Bold" active={state.bold}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic" active={state.italic}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
        active={state.underline}
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <ToolbarSeparator />

      <SwatchPopover
        label="Text colour"
        swatches={NHS_TEXT_COLORS}
        activeColor={state.textColor}
        onPick={(color) => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
        clearLabel="Remove colour"
      >
        <span className="font-bold" style={{ color: state.textColor ?? undefined }}>
          A
        </span>
      </SwatchPopover>
      <SwatchPopover
        label="Highlight"
        swatches={NHS_HIGHLIGHT_COLORS}
        activeColor={state.highlightColor}
        onPick={(color) => editor.chain().focus().setHighlight({ color }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        clearLabel="Remove highlight"
      >
        {icon.highlight}
      </SwatchPopover>

      <ToolbarSeparator />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
        active={state.bulletList}
      >
        {icon.bulletList}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered list"
        active={state.orderedList}
      >
        {icon.orderedList}
      </ToolbarButton>

      <ToolbarSeparator />

      <LinkPopover editor={editor} activeHref={state.linkHref}>
        {icon.link}
      </LinkPopover>

      <ToolbarSeparator />

      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} label="Undo" disabled={!state.canUndo}>
        {icon.undo}
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} label="Redo" disabled={!state.canRedo}>
        {icon.redo}
      </ToolbarButton>
    </div>
  )
}
