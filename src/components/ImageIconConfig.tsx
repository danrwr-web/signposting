'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'

interface ImageIcon {
  id: string
  phrase: string
  imageUrl: string
  alt: string | null
  width: number | null
  height: number | null
  cardSize: string
  instructionSize: string
  isEnabled: boolean
  surgeryId: string | null
  createdBy: string
  createdAt: string
}

interface ImageIconConfigProps {
  isSuperuser?: boolean
  isAdmin?: boolean // If true, is a surgery admin (can toggle but not create/delete)
}

export default function ImageIconConfig({ isSuperuser = false, isAdmin = false }: ImageIconConfigProps) {
  const [icons, setIcons] = useState<ImageIcon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingIcon, setEditingIcon] = useState<ImageIcon | null>(null)
  const [uploading, setUploading] = useState(false)
  const [newIcon, setNewIcon] = useState({
    phrase: '',
    alt: '',
    cardSize: 'medium' as 'small' | 'medium' | 'large',
    instructionSize: 'medium' as 'small' | 'medium' | 'large',
    file: null as File | null
  })

  // Load existing icons
  useEffect(() => {
    loadIcons()
  }, [])

  const loadIcons = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/image-icons')
      if (response.ok) {
        const data = await response.json()
        setIcons(data.icons || [])
      } else {
        toast.error('Failed to load image icons')
      }
    } catch (error) {
      console.error('Error loading image icons:', error)
      toast.error('Failed to load image icons')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, WebP, or GIF image')
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB')
      return
    }

    setNewIcon({ ...newIcon, file })
  }

  const handleAddIcon = async () => {
    if (!newIcon.phrase.trim()) {
      toast.error('Please enter a phrase')
      return
    }

    if (!newIcon.file) {
      toast.error('Please select an image file')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', newIcon.file)
      formData.append('phrase', newIcon.phrase.trim())
      formData.append('cardSize', newIcon.cardSize)
      formData.append('instructionSize', newIcon.instructionSize)
      if (newIcon.alt) {
        formData.append('alt', newIcon.alt.trim())
      }

      const response = await fetch('/api/image-icons', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('Image icon added successfully')
        setNewIcon({ phrase: '', alt: '', cardSize: 'medium', instructionSize: 'medium', file: null })
        setShowAddForm(false)
        loadIcons()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to add image icon')
      }
    } catch (error) {
      console.error('Error adding image icon:', error)
      toast.error('Failed to add image icon')
    } finally {
      setUploading(false)
    }
  }

  const handleToggleIcon = async (id: string, isEnabled: boolean) => {
    try {
      const response = await fetch(`/api/image-icons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled })
      })

      if (response.ok) {
        toast.success(`Image icon ${isEnabled ? 'enabled' : 'disabled'}`)
        loadIcons()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update image icon')
      }
    } catch (error) {
      console.error('Error updating image icon:', error)
      toast.error('Failed to update image icon')
    }
  }

  const handleUpdateIcon = async (icon: ImageIcon, updates: { cardSize?: string; instructionSize?: string; alt?: string }) => {
    try {
      const response = await fetch(`/api/image-icons/${icon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        toast.success('Image icon updated successfully')
        setEditingIcon(null)
        loadIcons()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update image icon')
      }
    } catch (error) {
      console.error('Error updating image icon:', error)
      toast.error('Failed to update image icon')
    }
  }

  const handleDeleteIcon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image icon?')) {
      return
    }

    try {
      const response = await fetch(`/api/image-icons/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Image icon deleted successfully')
        loadIcons()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete image icon')
      }
    } catch (error) {
      console.error('Error deleting image icon:', error)
      toast.error('Failed to delete image icon')
    }
  }

  // Allow superusers and admins to see this (admins can toggle, superusers can create/delete)
  if (!isSuperuser && !isAdmin) {
    return null
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
          Image Icons
        </h3>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nhs-blue mx-auto"></div>
          <p className="text-nhs-grey mt-2">Loading image icons...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-nhs-dark-blue">
            Image Icons
          </h3>
          <p className="text-sm text-nhs-grey mt-1">
            Images shown on symptom cards when their phrase appears in brief instructions
          </p>
        </div>
        {isSuperuser && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            {showAddForm ? 'Cancel' : 'Add Icon'}
          </button>
        )}
      </div>

      {/* Add New Icon Form - Superuser only */}
      {showAddForm && isSuperuser && (
        <div className="bg-nhs-light-grey rounded-lg p-4 mb-6">
          <h4 className="text-md font-medium text-nhs-dark-blue mb-3">Add New Image Icon</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Matching Phrase
              </label>
              <input
                type="text"
                value={newIcon.phrase}
                onChange={(e) => setNewIcon({ ...newIcon, phrase: e.target.value })}
                placeholder="e.g., pharmacy first, emergency"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
              <p className="text-xs text-nhs-grey mt-1">Image shows when this phrase appears in brief instructions</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Alt Text (optional)
              </label>
              <input
                type="text"
                value={newIcon.alt}
                onChange={(e) => setNewIcon({ ...newIcon, alt: e.target.value })}
                placeholder="Description for accessibility"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Size on Symptom Cards
              </label>
              <select
                value={newIcon.cardSize}
                onChange={(e) => setNewIcon({ ...newIcon, cardSize: e.target.value as 'small' | 'medium' | 'large' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Size on Instruction Pages
              </label>
              <select
                value={newIcon.instructionSize}
                onChange={(e) => setNewIcon({ ...newIcon, instructionSize: e.target.value as 'small' | 'medium' | 'large' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Image File (max 2MB, JPEG/PNG/WebP/GIF)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
              {newIcon.file && (
                <p className="text-xs text-nhs-grey mt-1">
                  Selected: {newIcon.file.name} ({(newIcon.file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={handleAddIcon}
                disabled={!newIcon.phrase.trim() || !newIcon.file || uploading}
                className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Add Icon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Icon Form - Superuser only */}
      {editingIcon && isSuperuser && (
        <div className="bg-nhs-light-grey rounded-lg p-4 mb-6">
          <h4 className="text-md font-medium text-nhs-dark-blue mb-3">Edit Image Icon</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Phrase (cannot be changed)
              </label>
              <input
                type="text"
                value={editingIcon.phrase}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Alt Text
              </label>
              <input
                type="text"
                value={editingIcon.alt || ''}
                onChange={(e) => setEditingIcon({ ...editingIcon, alt: e.target.value })}
                placeholder="Description for accessibility"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Size on Symptom Cards
              </label>
              <select
                value={editingIcon.cardSize}
                onChange={(e) => setEditingIcon({ ...editingIcon, cardSize: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Size on Instruction Pages
              </label>
              <select
                value={editingIcon.instructionSize}
                onChange={(e) => setEditingIcon({ ...editingIcon, instructionSize: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-end space-x-2">
              <button
                onClick={() => handleUpdateIcon(editingIcon, {
                  cardSize: editingIcon.cardSize,
                  instructionSize: editingIcon.instructionSize,
                  alt: editingIcon.alt || undefined
                })}
                className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingIcon(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Icons */}
      <div className="space-y-3">
        {icons.length === 0 ? (
          <div className="text-center py-8 text-nhs-grey">
            <p>No image icons configured.</p>
            <p className="text-sm">Click &quot;Add Icon&quot; to create your first image icon.</p>
          </div>
        ) : (
          icons.map((icon) => (
            <div key={icon.id} className="flex items-center justify-between bg-nhs-light-grey rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <Image
                    src={icon.imageUrl}
                    alt={icon.alt || icon.phrase}
                    fill
                    className="object-contain rounded"
                  />
                </div>
                <div>
                  <div className="font-medium text-nhs-dark-blue">
                    &quot;{icon.phrase}&quot;
                  </div>
                  <div className="text-sm text-nhs-grey">
                    Card: {icon.cardSize} | Instruction: {icon.instructionSize}
                  </div>
                  {icon.alt && (
                    <div className="text-xs text-nhs-grey italic">
                      Alt: {icon.alt}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggleIcon(icon.id, !icon.isEnabled)}
                  className={`px-3 py-1 rounded text-sm ${
                    icon.isEnabled 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {icon.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
                {isSuperuser && (
                  <>
                    <button
                      onClick={() => setEditingIcon(icon)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteIcon(icon.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
