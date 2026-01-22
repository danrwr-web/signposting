/**
 * Shared (client-safe) types for Admin Toolkit Quick Access buttons.
 *
 * Stored in `Surgery.uiConfig.adminToolkit.quickAccessButtons`.
 */

export type AdminToolkitQuickAccessButton = {
  id: string
  label: string
  itemId: string
  backgroundColour: string // hex, e.g. "#005EB8"
  textColour: string // hex, e.g. "#FFFFFF"
  orderIndex: number
}

export type AdminToolkitUiConfig = {
  adminToolkit?: {
    quickAccessButtons?: AdminToolkitQuickAccessButton[]
  }
}

