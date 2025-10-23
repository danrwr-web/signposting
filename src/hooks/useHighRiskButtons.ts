/**
 * Custom hook for managing high risk button state and API operations
 */

import { useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { HighRiskLink, DefaultHighRiskButtonConfig } from '@/lib/api-contracts'

interface UseHighRiskButtonsProps {
  surgeryId?: string
  surgeries?: Array<{ id: string; slug: string; name: string }>
}

export function useHighRiskButtons({ surgeryId, surgeries }: UseHighRiskButtonsProps) {
  const [highRiskLinks, setHighRiskLinks] = useState<HighRiskLink[]>([])
  const [defaultButtons, setDefaultButtons] = useState<DefaultHighRiskButtonConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [enableDefaultHighRisk, setEnableDefaultHighRisk] = useState(true)

  // Convert surgery ID to slug if needed
  const surgerySlug = surgeryId && surgeries 
    ? surgeries.find(s => s.id === surgeryId)?.slug || surgeryId
    : surgeryId

  const buildApiUrl = (endpoint: string, includeSurgery = true) => {
    const baseUrl = `/api/admin/${endpoint}`
    if (includeSurgery && surgerySlug) {
      return `${baseUrl}?surgery=${surgerySlug}`
    }
    return baseUrl
  }

  const loadHighRiskLinks = useCallback(async () => {
    try {
      const url = buildApiUrl('highrisk')
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setHighRiskLinks(data.links || [])
      } else {
        toast.error('Failed to load high-risk buttons')
      }
    } catch (error) {
      console.error('Error loading high-risk links:', error)
      toast.error('Failed to load high-risk buttons')
    }
  }, [surgerySlug])

  const loadDefaultButtons = useCallback(async () => {
    try {
      const url = buildApiUrl('default-highrisk-buttons')
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setDefaultButtons(data.buttons || [])
        
        // Determine if any default buttons are enabled
        const hasEnabledButtons = data.buttons?.some((button: DefaultHighRiskButtonConfig) => button.isEnabled)
        setEnableDefaultHighRisk(hasEnabledButtons)
      } else {
        toast.error('Failed to load default button configurations')
      }
    } catch (error) {
      console.error('Error loading default buttons:', error)
      toast.error('Failed to load default button configurations')
    } finally {
      setIsLoading(false)
    }
  }, [surgerySlug])

  const toggleDefaultButtons = useCallback(async () => {
    try {
      const url = buildApiUrl('highrisk')
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enableDefaultHighRisk: !enableDefaultHighRisk }),
      })

      if (response.ok) {
        setEnableDefaultHighRisk(!enableDefaultHighRisk)
        toast.success(`Default buttons ${!enableDefaultHighRisk ? 'enabled' : 'disabled'}`)
        await loadHighRiskLinks()
        await loadDefaultButtons()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle default buttons')
      }
    } catch (error) {
      console.error('Error toggling default buttons:', error)
      toast.error('Failed to toggle default buttons')
    }
  }, [enableDefaultHighRisk, surgerySlug, loadHighRiskLinks])

  const toggleIndividualButton = useCallback(async (buttonKey: string, isEnabled: boolean) => {
    try {
      const url = buildApiUrl('default-highrisk-buttons')
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ buttonKey, isEnabled }),
      })

      if (response.ok) {
        toast.success(`Button ${isEnabled ? 'enabled' : 'disabled'}`)
        await loadHighRiskLinks()
        await loadDefaultButtons()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle button')
      }
    } catch (error) {
      console.error('Error toggling individual button:', error)
      toast.error('Failed to toggle button')
    }
  }, [surgerySlug, loadHighRiskLinks])

  const updateButton = useCallback(async (buttonKey: string, label: string, symptomSlug: string) => {
    try {
      const url = buildApiUrl('default-highrisk-buttons')
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ buttonKey, label, symptomSlug }),
      })

      if (response.ok) {
        toast.success('Button updated successfully')
        await loadHighRiskLinks()
        await loadDefaultButtons()
        return true
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update button')
        return false
      }
    } catch (error) {
      console.error('Error updating button:', error)
      toast.error('Failed to update button')
      return false
    }
  }, [surgerySlug, loadHighRiskLinks])

  const addCustomLink = useCallback(async (newLink: { label: string; symptomSlug: string; orderIndex: number }) => {
    if (!newLink.label.trim()) {
      toast.error('Label is required')
      return false
    }

    try {
      const url = buildApiUrl('highrisk')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLink),
      })

      if (response.ok) {
        toast.success('High-risk button added successfully')
        await loadHighRiskLinks()
        return true
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to add high-risk button')
        return false
      }
    } catch (error) {
      console.error('Error adding high-risk link:', error)
      toast.error('Failed to add high-risk button')
      return false
    }
  }, [surgerySlug, loadHighRiskLinks])

  const deleteLink = useCallback(async (id: string) => {
    try {
      const url = buildApiUrl(`highrisk/${id}`)
      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('High-risk button deleted successfully')
        await loadHighRiskLinks()
        return true
      } else {
        toast.error('Failed to delete high-risk button')
        return false
      }
    } catch (error) {
      console.error('Error deleting high-risk link:', error)
      toast.error('Failed to delete high-risk button')
      return false
    }
  }, [surgerySlug, loadHighRiskLinks])

  const updateOrder = useCallback(async (id: string, newOrder: number) => {
    try {
      const url = buildApiUrl(`highrisk/${id}`)
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIndex: newOrder }),
      })

      if (response.ok) {
        await loadHighRiskLinks()
        return true
      }
    } catch (error) {
      console.error('Error updating order:', error)
    }
    return false
  }, [surgerySlug, loadHighRiskLinks])

  return {
    highRiskLinks,
    defaultButtons,
    isLoading,
    enableDefaultHighRisk,
    loadHighRiskLinks,
    loadDefaultButtons,
    toggleDefaultButtons,
    toggleIndividualButton,
    updateButton,
    addCustomLink,
    deleteLink,
    updateOrder
  }
}
