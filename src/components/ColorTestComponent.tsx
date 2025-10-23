/**
 * Debug component to test TipTap colour functionality
 */

'use client'

import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'

export default function ColorTestComponent() {
  const [html, setHtml] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
    ],
    content: '<p>Test text for colour</p>',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setHtml(html)
      console.log('Editor HTML:', html)
    },
  }, [mounted])

  if (!mounted || !editor) {
    return <div>Loading editor...</div>
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-bold mb-4">Colour Test</h3>
      
      {/* Toolbar */}
      <div className="mb-4 flex gap-2">
         <button
           onClick={() => editor.chain().focus().setColor('#ff0000').run()}
           className="px-3 py-1 bg-red-500 text-white rounded"
         >
           Red
         </button>
         <button
           onClick={() => editor.chain().focus().setColor('#00ff00').run()}
           className="px-3 py-1 bg-green-500 text-white rounded"
         >
           Green
         </button>
         <button
           onClick={() => editor.chain().focus().setColor('#0000ff').run()}
           className="px-3 py-1 bg-blue-500 text-white rounded"
         >
           Blue
         </button>
         <button
           onClick={() => editor.chain().focus().unsetColor().run()}
           className="px-3 py-1 bg-gray-500 text-white rounded"
         >
           Remove Colour
         </button>
      </div>

      {/* Editor */}
      <div className="border rounded p-2 min-h-[100px]">
        <EditorContent editor={editor} />
      </div>

      {/* Output */}
      <div className="mt-4">
        <h4 className="font-bold">HTML Output:</h4>
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
          {html}
        </pre>
      </div>

      {/* Debug Info */}
      <div className="mt-4">
        <h4 className="font-bold">Debug Info:</h4>
        <p>Active colour: {editor.getAttributes('textStyle').color || 'none'}</p>
        <p>Is TextStyle active: {editor.isActive('textStyle') ? 'yes' : 'no'}</p>
      </div>
    </div>
  )
}
