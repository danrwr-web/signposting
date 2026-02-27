'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const ROLES = ['ADMIN', 'GP', 'NURSE'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin / Reception',
  GP: 'GP / Prescriber',
  NURSE: 'Nurse / HCA',
}

interface RoleTemplate {
  role: Role
  template: string
  defaultTemplate: string
  isCustom: boolean
  updatedAt: string | null
  updatedBy: string | null
}

interface Tag {
  id: string
  name: string
  createdAt: string
  createdBy: string | null
  creator: {
    id: string
    name: string | null
    email: string
  } | null
}

type TabType = 'prompts' | 'tags' | 'pathway'

interface LearningCategory {
  id: string
  name: string
  slug: string
  ordering: number
  isActive: boolean
  subsections: string[]
  createdAt: string
  updatedAt: string
  _count: { cards: number }
}

export default function EditorialSettingsClient() {
  const [activeTab, setActiveTab] = useState<TabType>('prompts')
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [activeRole, setActiveRole] = useState<Role>('ADMIN')
  const [editedTemplate, setEditedTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Tags state
  const [tags, setTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [tagSaving, setTagSaving] = useState(false)
  const [tagDeleting, setTagDeleting] = useState<string | null>(null)
  const [tagSeeding, setTagSeeding] = useState(false)

  // Learning pathway state
  const [categories, setCategories] = useState<LearningCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySeeding, setCategorySeeding] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null)
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    slug: '',
    ordering: 0,
    subsectionsText: '',
  })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryForm, setEditingCategoryForm] = useState({
    name: '',
    ordering: 0,
    subsectionsText: '',
  })
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [categorySaving, setCategorySaving] = useState(false)

  const activeTemplate = templates.find((t) => t.role === activeRole)
  const isModified = activeTemplate ? editedTemplate !== activeTemplate.template : false
  const isCustom = activeTemplate?.isCustom ?? false

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/settings/prompt-templates')
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to load templates')
        return
      }
      const fetched = payload.templates as RoleTemplate[]
      setTemplates(fetched)
      // Set the editor to the active role's template
      const active = fetched.find((t) => t.role === activeRole)
      if (active) {
        setEditedTemplate(active.template)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [activeRole])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // When switching tabs, load the template for that role
  const handleTabChange = (role: Role) => {
    setActiveRole(role)
    const t = templates.find((tpl) => tpl.role === role)
    if (t) {
      setEditedTemplate(t.template)
    }
    setSuccessMessage(null)
    setError(null)
    setShowResetConfirm(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/editorial/settings/prompt-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole, template: editedTemplate }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to save template')
        return
      }
      setSuccessMessage(`${ROLE_LABELS[activeRole]} template saved successfully.`)
      // Refresh templates from server
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setError(null)
    setSuccessMessage(null)
    setShowResetConfirm(false)
    try {
      const response = await fetch('/api/editorial/settings/prompt-templates/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to reset template')
        return
      }
      setSuccessMessage(`${ROLE_LABELS[activeRole]} template reset to default.`)
      // Refresh templates from server
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setResetting(false)
    }
  }

  const handleRevertEdits = () => {
    if (activeTemplate) {
      setEditedTemplate(activeTemplate.template)
    }
    setSuccessMessage(null)
  }

  // Tags functions
  const fetchTags = useCallback(async () => {
    setTagsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/settings/tags')
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to load tags')
        return
      }
      setTags(payload.tags || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setTagsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'tags') {
      fetchTags()
    }
  }, [activeTab, fetchTags])

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true)
    setCategoryError(null)
    try {
      const response = await fetch('/api/editorial/settings/learning-categories')
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setCategoryError(payload?.error?.message || 'Failed to load learning categories')
        return
      }
      setCategories(payload.categories || [])
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'pathway') {
      fetchCategories()
    }
  }, [activeTab, fetchCategories])

  const handleSeedDefaultCategories = async () => {
    setCategorySeeding(true)
    setCategoryError(null)
    setCategorySuccess(null)
    try {
      const response = await fetch('/api/editorial/settings/learning-categories/seed', {
        method: 'POST',
      })
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setCategoryError(payload?.error?.message || 'Failed to seed categories')
        return
      }
      setCategorySuccess(
        `Seeded ${payload.created} categories (${payload.skipped} already existed).`
      )
      await fetchCategories()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCategorySeeding(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryForm.name.trim() || !newCategoryForm.slug.trim() || !newCategoryForm.subsectionsText.trim()) return
    setCategorySaving(true)
    setCategoryError(null)
    setCategorySuccess(null)
    try {
      const subsections = newCategoryForm.subsectionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const response = await fetch('/api/editorial/settings/learning-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryForm.name.trim(),
          slug: newCategoryForm.slug.trim(),
          ordering: newCategoryForm.ordering,
          subsections,
        }),
      })
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setCategoryError(payload?.error?.message || 'Failed to create category')
        return
      }
      setCategorySuccess(`Category "${newCategoryForm.name}" created.`)
      setNewCategoryForm({ name: '', slug: '', ordering: 0, subsectionsText: '' })
      await fetchCategories()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCategorySaving(false)
    }
  }

  const handleStartEditCategory = (cat: LearningCategory) => {
    setEditingCategoryId(cat.id)
    setEditingCategoryForm({
      name: cat.name,
      ordering: cat.ordering,
      subsectionsText: cat.subsections.join('\n'),
    })
    setCategoryError(null)
    setCategorySuccess(null)
  }

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null)
  }

  const handleUpdateCategory = async (id: string) => {
    setCategorySaving(true)
    setCategoryError(null)
    setCategorySuccess(null)
    try {
      const subsections = editingCategoryForm.subsectionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const response = await fetch(`/api/editorial/settings/learning-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCategoryForm.name.trim(),
          ordering: editingCategoryForm.ordering,
          subsections,
        }),
      })
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setCategoryError(payload?.error?.message || 'Failed to update category')
        return
      }
      setCategorySuccess('Category updated.')
      setEditingCategoryId(null)
      await fetchCategories()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCategorySaving(false)
    }
  }

  const handleToggleCategoryActive = async (cat: LearningCategory) => {
    setCategorySaving(true)
    setCategoryError(null)
    setCategorySuccess(null)
    try {
      const response = await fetch(`/api/editorial/settings/learning-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      })
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setCategoryError(payload?.error?.message || 'Failed to update category')
        return
      }
      setCategorySuccess(`Category ${cat.isActive ? 'deactivated' : 'reactivated'}.`)
      await fetchCategories()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCategorySaving(false)
    }
  }

  // Auto-generate a slug from the category name
  const generateSlug = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60)

  const handleSeedDefaultTags = async () => {
    setTagSeeding(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/editorial/settings/tags/seed', { method: 'POST' })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to load default tags')
        return
      }
      const created = payload.created ?? 0
      setSuccessMessage(
        created === 0
          ? 'Default tag library is already loaded.'
          : `${created} tag(s) added. Default tag library is now available.`,
      )
      await fetchTags()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setTagSeeding(false)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    setTagSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/editorial/settings/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to create tag')
        return
      }
      setSuccessMessage(`Tag "${newTagName.trim()}" created successfully.`)
      setNewTagName('')
      await fetchTags()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setTagSaving(false)
    }
  }

  const handleStartEditTag = (tag: Tag) => {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
    setError(null)
    setSuccessMessage(null)
  }

  const handleCancelEditTag = () => {
    setEditingTagId(null)
    setEditingTagName('')
  }

  const handleUpdateTag = async (tagId: string) => {
    if (!editingTagName.trim()) return
    setTagSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/editorial/settings/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId, name: editingTagName.trim() }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to update tag')
        return
      }
      setSuccessMessage(`Tag updated successfully.`)
      setEditingTagId(null)
      setEditingTagName('')
      await fetchTags()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setTagSaving(false)
    }
  }

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    if (!confirm(`Delete tag "${tagName}"? This action cannot be undone.`)) return
    setTagDeleting(tagId)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/editorial/settings/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to delete tag')
        return
      }
      setSuccessMessage(`Tag "${tagName}" deleted successfully.`)
      await fetchTags()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setTagDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-nhs-dark-blue">Editorial settings</h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage prompt templates and available tags for Daily Dose cards. Changes apply globally to all surgeries.
            </p>
          </div>
          <Link
            href="/editorial"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-nhs-blue hover:bg-nhs-light-blue"
          >
            ← Back to generator
          </Link>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">
          {successMessage}
        </div>
      )}

      {/* Main content */}
      <div className="rounded-lg border border-slate-200 bg-white">
        {/* Top-level tab bar (Prompts vs Tags) */}
        <div className="border-b border-slate-200" role="tablist" aria-label="Settings sections">
          <div className="flex">
            <button
              role="tab"
              aria-selected={activeTab === 'prompts'}
              aria-controls="tabpanel-prompts"
              id="tab-prompts"
              onClick={() => {
                setActiveTab('prompts')
                setError(null)
                setSuccessMessage(null)
              }}
              className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'prompts'
                  ? 'border-b-2 border-nhs-blue text-nhs-blue'
                  : 'text-slate-600 hover:text-nhs-dark-blue'
              }`}
            >
              Prompt Templates
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'tags'}
              aria-controls="tabpanel-tags"
              id="tab-tags"
              onClick={() => {
                setActiveTab('tags')
                setError(null)
                setSuccessMessage(null)
              }}
              className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'tags'
                  ? 'border-b-2 border-nhs-blue text-nhs-blue'
                  : 'text-slate-600 hover:text-nhs-dark-blue'
              }`}
            >
              Available Tags
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'pathway'}
              aria-controls="tabpanel-pathway"
              id="tab-pathway"
              onClick={() => {
                setActiveTab('pathway')
                setError(null)
                setSuccessMessage(null)
                setCategoryError(null)
                setCategorySuccess(null)
              }}
              className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'pathway'
                  ? 'border-b-2 border-nhs-blue text-nhs-blue'
                  : 'text-slate-600 hover:text-nhs-dark-blue'
              }`}
            >
              Learning Pathway
            </button>
          </div>
        </div>

        {/* Prompts tab panel */}
        {activeTab === 'prompts' && (
          <>
            {/* Role tab bar */}
            <div className="border-b border-slate-200" role="tablist" aria-label="Role prompt templates">
              <div className="flex">
                {ROLES.map((role) => {
                  const isActive = role === activeRole
                  const tpl = templates.find((t) => t.role === role)
                  return (
                    <button
                      key={role}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`tabpanel-${role}`}
                      id={`tab-${role}`}
                      onClick={() => handleTabChange(role)}
                      className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-b-2 border-nhs-blue text-nhs-blue'
                          : 'text-slate-600 hover:text-nhs-dark-blue'
                      }`}
                    >
                      {ROLE_LABELS[role]}
                      {tpl?.isCustom && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          Custom
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Role tab panel */}
            <div
              role="tabpanel"
              id={`tabpanel-${activeRole}`}
              aria-labelledby={`tab-${activeRole}`}
              className="p-6"
            >
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
              Loading templates…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center gap-3">
                <span
                  role="status"
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isCustom
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCustom ? 'Custom template' : 'Default template'}
                </span>
                {isModified && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    Unsaved changes
                  </span>
                )}
                {activeTemplate?.updatedAt && isCustom && (
                  <span className="text-xs text-slate-400">
                    Last saved: {new Date(activeTemplate.updatedAt).toLocaleString('en-GB')}
                  </span>
                )}
              </div>

              {/* Editor */}
              <div>
                <label htmlFor={`template-editor-${activeRole}`} className="sr-only">
                  System prompt template for {ROLE_LABELS[activeRole]}
                </label>
                <textarea
                  id={`template-editor-${activeRole}`}
                  rows={20}
                  value={editedTemplate}
                  onChange={(e) => setEditedTemplate(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 font-mono text-xs leading-relaxed ${
                    isModified
                      ? 'border-blue-400 bg-blue-50/30'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                  aria-describedby={`template-hint-${activeRole}`}
                />
                <p id={`template-hint-${activeRole}`} className="mt-1 text-xs text-slate-400">
                  This is the system message sent to the AI when generating {ROLE_LABELS[activeRole]} cards.
                  The user prompt (including toolkit context, tags, and JSON schema) is constructed separately.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving || !isModified}
                  onClick={handleSave}
                  className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Save template'}
                </button>
                {isModified && (
                  <button
                    type="button"
                    onClick={handleRevertEdits}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue"
                  >
                    Revert changes
                  </button>
                )}
                {isCustom && !showResetConfirm && (
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => setShowResetConfirm(true)}
                    className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Reset to default
                  </button>
                )}
                {showResetConfirm && (
                  <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
                    <span className="text-xs text-red-700">Discard your custom template?</span>
                    <button
                      type="button"
                      disabled={resetting}
                      onClick={handleReset}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                    >
                      {resetting ? 'Resetting…' : 'Yes, reset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Default template preview (when custom is active) */}
              {isCustom && activeTemplate?.defaultTemplate && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                    View default template for comparison
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                    {activeTemplate.defaultTemplate}
                  </pre>
                </details>
              )}
            </div>
          )}
            </div>
          </>
        )}

        {/* Tags tab panel */}
        {activeTab === 'tags' && (
          <div role="tabpanel" id="tabpanel-tags" aria-labelledby="tab-tags" className="p-6">
            {tagsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
                Loading tags…
              </div>
            ) : (
              <div className="space-y-6">
                {/* Load default tag library */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-base font-semibold text-nhs-dark-blue mb-2">Default tag library</h2>
                  <p className="text-sm text-slate-600 mb-3">
                    Load the standard set of tags (body systems, clinical and operational domains). Only missing tags are added; existing tags are left unchanged.
                  </p>
                  <button
                    type="button"
                    onClick={handleSeedDefaultTags}
                    disabled={tagSeeding}
                    className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {tagSeeding ? 'Loading…' : 'Load default tag library'}
                  </button>
                </div>

                {/* Add new tag */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-base font-semibold text-nhs-dark-blue mb-3">Add new tag</h2>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !tagSaving && newTagName.trim()) {
                          handleCreateTag()
                        }
                      }}
                      placeholder="Enter tag name"
                      maxLength={50}
                      className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                      aria-label="New tag name"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={tagSaving || !newTagName.trim()}
                      className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {tagSaving ? 'Adding…' : 'Add tag'}
                    </button>
                  </div>
                </div>

                {/* Tags list */}
                <div>
                  <h2 className="text-base font-semibold text-nhs-dark-blue mb-3">
                    Available tags ({tags.length})
                  </h2>
                  {tags.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">No tags yet. Add your first tag above.</p>
                  ) : (
                    <div className="space-y-2">
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3"
                        >
                          {editingTagId === tag.id ? (
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !tagSaving && editingTagName.trim()) {
                                    handleUpdateTag(tag.id)
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditTag()
                                  }
                                }}
                                maxLength={50}
                                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateTag(tag.id)}
                                disabled={tagSaving || !editingTagName.trim()}
                                className="rounded bg-nhs-blue px-3 py-1 text-xs font-semibold text-white hover:bg-nhs-dark-blue disabled:opacity-70"
                              >
                                {tagSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditTag}
                                disabled={tagSaving}
                                className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-70"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <span className="inline-flex items-center rounded-full bg-nhs-light-blue px-2.5 py-0.5 text-sm font-medium text-nhs-blue">
                                  {tag.name}
                                </span>
                                {tag.creator && (
                                  <span className="ml-3 text-xs text-slate-500">
                                    Created by {tag.creator.name || tag.creator.email}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTag(tag)}
                                  disabled={tagDeleting === tag.id}
                                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-nhs-blue hover:text-nhs-blue disabled:opacity-70"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                                  disabled={tagDeleting === tag.id}
                                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:border-red-400 hover:bg-red-50 disabled:opacity-70"
                                >
                                  {tagDeleting === tag.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Learning Pathway tab panel */}
        {activeTab === 'pathway' && (
          <div role="tabpanel" id="tabpanel-pathway" aria-labelledby="tab-pathway" className="p-6">
            {categoryError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                {categoryError}
              </div>
            )}
            {categorySuccess && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">
                {categorySuccess}
              </div>
            )}

            {categoriesLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
                Loading categories…
              </div>
            ) : (
              <div className="space-y-6">
                {/* Seed defaults */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h2 className="mb-2 text-base font-semibold text-nhs-dark-blue">Seed default categories</h2>
                  <p className="mb-3 text-sm text-slate-600">
                    Load the 12 standard learning pathway categories. Categories whose slug already exists are skipped.
                  </p>
                  <button
                    type="button"
                    onClick={handleSeedDefaultCategories}
                    disabled={categorySeeding || categorySaving}
                    className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {categorySeeding ? 'Seeding…' : 'Load default categories'}
                  </button>
                </div>

                {/* Add new category */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h2 className="mb-3 text-base font-semibold text-nhs-dark-blue">Add new category</h2>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="new-cat-name">
                          Name
                        </label>
                        <input
                          id="new-cat-name"
                          type="text"
                          value={newCategoryForm.name}
                          onChange={(e) => {
                            const name = e.target.value
                            setNewCategoryForm((f) => ({
                              ...f,
                              name,
                              slug: f.slug === '' || f.slug === generateSlug(f.name) ? generateSlug(name) : f.slug,
                            }))
                          }}
                          placeholder="e.g. Respiratory & ENT"
                          maxLength={100}
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="w-48">
                        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="new-cat-slug">
                          Slug
                        </label>
                        <input
                          id="new-cat-slug"
                          type="text"
                          value={newCategoryForm.slug}
                          onChange={(e) => setNewCategoryForm((f) => ({ ...f, slug: e.target.value }))}
                          placeholder="respiratory_ent"
                          maxLength={60}
                          pattern="[a-z0-9_]+"
                          className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm"
                        />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="new-cat-order">
                          Order
                        </label>
                        <input
                          id="new-cat-order"
                          type="number"
                          min={0}
                          value={newCategoryForm.ordering}
                          onChange={(e) => setNewCategoryForm((f) => ({ ...f, ordering: parseInt(e.target.value, 10) || 0 }))}
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="new-cat-subsections">
                        Subsections (one per line)
                      </label>
                      <textarea
                        id="new-cat-subsections"
                        rows={4}
                        value={newCategoryForm.subsectionsText}
                        onChange={(e) => setNewCategoryForm((f) => ({ ...f, subsectionsText: e.target.value }))}
                        placeholder="Asthma&#10;Sore Throat&#10;Ear Wax"
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={
                        categorySaving ||
                        !newCategoryForm.name.trim() ||
                        !newCategoryForm.slug.trim() ||
                        !newCategoryForm.subsectionsText.trim()
                      }
                      className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {categorySaving ? 'Adding…' : 'Add category'}
                    </button>
                  </div>
                </div>

                {/* Category list */}
                <div>
                  <h2 className="mb-3 text-base font-semibold text-nhs-dark-blue">
                    Categories ({categories.length})
                  </h2>
                  {categories.length === 0 ? (
                    <p className="py-4 text-sm text-slate-500">
                      No categories yet. Seed the defaults or add one above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className={`rounded-md border bg-white ${cat.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
                        >
                          {editingCategoryId === cat.id ? (
                            <div className="p-4 space-y-3">
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
                                  <input
                                    type="text"
                                    value={editingCategoryForm.name}
                                    onChange={(e) => setEditingCategoryForm((f) => ({ ...f, name: e.target.value }))}
                                    maxLength={100}
                                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                    autoFocus
                                  />
                                </div>
                                <div className="w-24">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">Order</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editingCategoryForm.ordering}
                                    onChange={(e) => setEditingCategoryForm((f) => ({ ...f, ordering: parseInt(e.target.value, 10) || 0 }))}
                                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">Subsections (one per line)</label>
                                <textarea
                                  rows={6}
                                  value={editingCategoryForm.subsectionsText}
                                  onChange={(e) => setEditingCategoryForm((f) => ({ ...f, subsectionsText: e.target.value }))}
                                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCategory(cat.id)}
                                  disabled={categorySaving || !editingCategoryForm.name.trim() || !editingCategoryForm.subsectionsText.trim()}
                                  className="rounded-md bg-nhs-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-nhs-dark-blue disabled:opacity-70"
                                >
                                  {categorySaving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditCategory}
                                  disabled={categorySaving}
                                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-70"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-1 items-center gap-3 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedCategoryId(expandedCategoryId === cat.id ? null : cat.id)}
                                    className="flex items-center gap-2 text-left min-w-0"
                                    aria-expanded={expandedCategoryId === cat.id}
                                  >
                                    <span className="text-slate-400 text-xs select-none">
                                      {expandedCategoryId === cat.id ? '▼' : '▶'}
                                    </span>
                                    <span className="font-medium text-sm text-nhs-dark-blue truncate">{cat.name}</span>
                                  </button>
                                  <span className="shrink-0 font-mono text-[11px] text-slate-400">{cat.slug}</span>
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                    {cat._count.cards} card{cat._count.cards !== 1 ? 's' : ''}
                                  </span>
                                  {!cat.isActive && (
                                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCategory(cat)}
                                    disabled={categorySaving}
                                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-nhs-blue hover:text-nhs-blue disabled:opacity-70"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCategoryActive(cat)}
                                    disabled={categorySaving}
                                    className={`rounded border px-2 py-1 text-xs disabled:opacity-70 ${
                                      cat.isActive
                                        ? 'border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-50'
                                        : 'border-green-200 text-green-700 hover:border-green-400 hover:bg-green-50'
                                    }`}
                                  >
                                    {cat.isActive ? 'Deactivate' : 'Reactivate'}
                                  </button>
                                </div>
                              </div>
                              {expandedCategoryId === cat.id && (
                                <div className="mt-3 ml-5 space-y-1">
                                  {cat.subsections.map((sub) => (
                                    <div key={sub} className="flex items-center gap-2 text-sm text-slate-600">
                                      <span className="text-slate-300">└</span>
                                      {sub}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
