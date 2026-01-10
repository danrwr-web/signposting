import React from 'react'
import type { ReactElement } from 'react'

export const WORKFLOW_ICON_KEYS = [
  // General
  'document',
  'clipboard',
  'checklist',
  'folder',
  'inbox',
  'envelope',
  'tag',
  // Comms / guidance
  'chat',
  'information',
  'question',
  // Clinical / safety
  'stethoscope',
  'heart',
  'shield',
  'shieldCheck',
  'warning',
  'lock',
  // Tests / meds
  'beaker',
  'pill',
  // Actions / flow
  'arrowDownTray',
  'paperAirplane',
  'arrowRight',
  // Admin / ops
  'cog',
  'wrench',
  'user',
  'users',
  // Private / finance
  'briefcase',
  'creditCard',
  'buildingOffice',
] as const

export type WorkflowIconKey = (typeof WORKFLOW_ICON_KEYS)[number]

export const DEFAULT_WORKFLOW_ICON_KEY: WorkflowIconKey = 'document'

export const WORKFLOW_ICON_REGISTRY: Record<
  WorkflowIconKey,
  { label: string; tags: string[]; Icon: (props: { className?: string }) => ReactElement }
> = {
  document: {
    label: 'Document',
    tags: ['document', 'letter', 'form', 'paper'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M8 7.5A2.5 2.5 0 0 1 10.5 5h6A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-6A2.5 2.5 0 0 1 8 16.5v-9Z' }),
        React.createElement('path', { d: 'M11 9h5M11 12h5M11 15h3' }),
      ),
  },
  clipboard: {
    label: 'Clipboard',
    tags: ['clipboard', 'review', 'notes'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M9 5.25A2.25 2.25 0 0 1 11.25 3h1.5A2.25 2.25 0 0 1 15 5.25V6h1.5A2.25 2.25 0 0 1 18.75 8.25v10.5A2.25 2.25 0 0 1 16.5 21h-9A2.25 2.25 0 0 1 5.25 18.75V8.25A2.25 2.25 0 0 1 7.5 6H9v-.75Z' }),
        React.createElement('path', { d: 'M9.75 11.25h4.5M9.75 15h4.5' }),
      ),
  },
  checklist: {
    label: 'Checklist',
    tags: ['check', 'tasks', 'steps', 'process'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M9 6h11M9 12h11M9 18h11' }),
        React.createElement('path', { d: 'm3.5 6 1 1 2-2' }),
        React.createElement('path', { d: 'm3.5 12 1 1 2-2' }),
        React.createElement('path', { d: 'm3.5 18 1 1 2-2' }),
      ),
  },
  folder: {
    label: 'Folder',
    tags: ['folder', 'filing', 'archive'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', {
          d: 'M3.75 6.75A2.25 2.25 0 0 1 6 4.5h4.1c.6 0 1.17.24 1.6.66l.8.84H18A2.25 2.25 0 0 1 20.25 8.25v9A2.25 2.25 0 0 1 18 19.5H6A2.25 2.25 0 0 1 3.75 17.25v-10.5Z',
        }),
      ),
  },
  inbox: {
    label: 'Inbox',
    tags: ['inbox', 'incoming', 'mail'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M4 13V7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V13' }),
        React.createElement('path', { d: 'M20 13l-2 6H6l-2-6' }),
        React.createElement('path', { d: 'M9.5 13a2.5 2.5 0 0 0 5 0' }),
      ),
  },
  envelope: {
    label: 'Envelope',
    tags: ['letter', 'correspondence', 'mail'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z' }),
        React.createElement('path', { d: 'm5.5 7 6.5 5 6.5-5' }),
      ),
  },
  tag: {
    label: 'Tag',
    tags: ['tag', 'category', 'label'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M3.75 12.5V6.75A2.25 2.25 0 0 1 6 4.5h5.75L21 13.75 13.75 21 3.75 12.5Z' }),
        React.createElement('path', { d: 'M7.5 7.5h.01' }),
      ),
  },
  chat: {
    label: 'Chat',
    tags: ['advice', 'guidance', 'message', 'communication'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M8 10h8M8 14h5' }),
        React.createElement('path', { d: 'M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z' }),
      ),
  },
  information: {
    label: 'Information',
    tags: ['info', 'guidance', 'help'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 17v-5' }),
        React.createElement('path', { d: 'M12 8h.01' }),
        React.createElement('path', { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' }),
      ),
  },
  question: {
    label: 'Question',
    tags: ['question', 'help', 'query'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 17h.01' }),
        React.createElement('path', { d: 'M9.75 9.75a2.25 2.25 0 1 1 3.75 1.65c-.8.6-1.5 1.1-1.5 2.6' }),
        React.createElement('path', { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' }),
      ),
  },
  stethoscope: {
    label: 'Stethoscope',
    tags: ['clinical', 'gp', 'review', 'doctor'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M6 3v6a6 6 0 1 0 12 0V3' }),
        React.createElement('path', { d: 'M12 15v2.5A3.5 3.5 0 0 0 15.5 21H17' }),
        React.createElement('path', { d: 'M18.5 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z' }),
      ),
  },
  heart: {
    label: 'Heart',
    tags: ['clinical', 'health', 'urgent'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 21s-7-4.6-9.3-9A5.7 5.7 0 0 1 12 5.8 5.7 5.7 0 0 1 21.3 12C19 16.4 12 21 12 21Z' }),
      ),
  },
  shield: {
    label: 'Shield',
    tags: ['safety', 'governance', 'safeguarding'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 3 20 7v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z' }),
      ),
  },
  shieldCheck: {
    label: 'Shield (check)',
    tags: ['safety', 'approved', 'licensing'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 3 20 7v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z' }),
        React.createElement('path', { d: 'm9 12 2 2 4-4' }),
      ),
  },
  warning: {
    label: 'Warning',
    tags: ['warning', 'urgent', 'triage', 'risk'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 9v4' }),
        React.createElement('path', { d: 'M12 17h.01' }),
        React.createElement('path', { d: 'M10.3 4.3a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-2.7l8-14Z' }),
      ),
  },
  lock: {
    label: 'Lock',
    tags: ['secure', 'confidential', 'licensing'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M7.5 11V8.5A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 4.5 4.5V11' }),
        React.createElement('path', { d: 'M6.5 11h11A2.5 2.5 0 0 1 20 13.5v5A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-5A2.5 2.5 0 0 1 6.5 11Z' }),
      ),
  },
  beaker: {
    label: 'Beaker',
    tags: ['blood', 'test', 'pathology', 'results', 'lab'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M9 3h6' }),
        React.createElement('path', { d: 'M10 3v6.5l-4.6 7.6A3.75 3.75 0 0 0 8.6 22h6.8a3.75 3.75 0 0 0 3.2-4.9L14 9.5V3' }),
        React.createElement('path', { d: 'M8.25 14.25h7.5' }),
      ),
  },
  pill: {
    label: 'Pill',
    tags: ['medication', 'prescription', 'repeat'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M9.5 14.5 14.5 9.5' }),
        React.createElement('path', { d: 'M7.05 16.95a5 5 0 0 1 0-7.07l.83-.83a5 5 0 0 1 7.07 0l.83.83a5 5 0 0 1 0 7.07l-.83.83a5 5 0 0 1-7.07 0l-.83-.83Z' }),
      ),
  },
  arrowDownTray: {
    label: 'Download',
    tags: ['discharge', 'download', 'incoming'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 3v10.5m0 0 3.75-3.75M12 13.5 8.25 9.75' }),
        React.createElement('path', { d: 'M4.5 15.75v3A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-3' }),
      ),
  },
  paperAirplane: {
    label: 'Send',
    tags: ['referral', 'send', 'forward'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M21 3 10 14' }),
        React.createElement('path', { d: 'M21 3 14 21l-4-7-7-4 18-7Z' }),
      ),
  },
  arrowRight: {
    label: 'Arrow right',
    tags: ['next', 'forward', 'route'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M5 12h14' }),
        React.createElement('path', { d: 'm13 5 7 7-7 7' }),
      ),
  },
  cog: {
    label: 'Settings',
    tags: ['admin', 'settings', 'configuration'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' }),
        React.createElement('path', { d: 'M19.4 15a8.6 8.6 0 0 0 .1-6l-2.1.4a7 7 0 0 0-1.6-1.6l.4-2.1a8.6 8.6 0 0 0-6-.1l.4 2.1a7 7 0 0 0-1.6 1.6l-2.1-.4a8.6 8.6 0 0 0-.1 6l2.1-.4a7 7 0 0 0 1.6 1.6l-.4 2.1a8.6 8.6 0 0 0 6 .1l-.4-2.1a7 7 0 0 0 1.6-1.6l2.1.4Z' }),
      ),
  },
  wrench: {
    label: 'Tools',
    tags: ['admin', 'tools', 'maintenance'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M21 6.5a5 5 0 0 1-7 4.6L6 19l-2 2-1-1 2-2 7.9-8A5 5 0 0 1 21 6.5Z' }),
      ),
  },
  user: {
    label: 'User',
    tags: ['person', 'gp', 'review'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z' }),
        React.createElement('path', { d: 'M4.5 20a7.5 7.5 0 0 1 15 0' }),
      ),
  },
  users: {
    label: 'Users',
    tags: ['team', 'people'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M9 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 9 12Z' }),
        React.createElement('path', { d: 'M17 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z' }),
        React.createElement('path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0' }),
        React.createElement('path', { d: 'M14.5 20a5.5 5.5 0 0 1 7 0' }),
      ),
  },
  briefcase: {
    label: 'Briefcase',
    tags: ['private', 'insurance', 'medico-legal', 'work'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M9 6.75A2.25 2.25 0 0 1 11.25 4.5h1.5A2.25 2.25 0 0 1 15 6.75V7.5H9v-.75Z' }),
        React.createElement('path', { d: 'M3.75 7.5h16.5A1.5 1.5 0 0 1 21.75 9v9.75A2.25 2.25 0 0 1 19.5 21H4.5a2.25 2.25 0 0 1-2.25-2.25V9A1.5 1.5 0 0 1 3.75 7.5Z' }),
        React.createElement('path', { d: 'M8.25 12h7.5' }),
      ),
  },
  creditCard: {
    label: 'Card / payment',
    tags: ['private', 'payment', 'fee'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z' }),
        React.createElement('path', { d: 'M4.5 9.5h15' }),
        React.createElement('path', { d: 'M7.5 15.5h4' }),
      ),
  },
  buildingOffice: {
    label: 'Building / office',
    tags: ['provider', 'organisation', 'private'],
    Icon: ({ className }) =>
      React.createElement(
        'svg',
        {
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        React.createElement('path', { d: 'M4 21V5.5A2.5 2.5 0 0 1 6.5 3H14v18' }),
        React.createElement('path', { d: 'M14 8h3.5A2.5 2.5 0 0 1 20 10.5V21' }),
        React.createElement('path', { d: 'M7 7h.01M7 10h.01M7 13h.01M10 7h.01M10 10h.01M10 13h.01' }),
      ),
  },
}

export function isWorkflowIconKey(value: string): value is WorkflowIconKey {
  return (WORKFLOW_ICON_KEYS as readonly string[]).includes(value)
}

export function getWorkflowIcon(iconKey?: string | null): {
  key: WorkflowIconKey
  label: string
  tags: string[]
  Icon: (props: { className?: string }) => ReactElement
} {
  if (iconKey && isWorkflowIconKey(iconKey)) {
    return { key: iconKey, ...WORKFLOW_ICON_REGISTRY[iconKey] }
  }
  return { key: DEFAULT_WORKFLOW_ICON_KEY, ...WORKFLOW_ICON_REGISTRY[DEFAULT_WORKFLOW_ICON_KEY] }
}

