import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: '#005EB8',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 12,
          fontFamily: 'var(--font-display)',
        }}
      >
        ST
      </span>
      <span style={{ fontWeight: 600, fontSize: 16, color: '#003087' }}>
        Signposting Toolkit
      </span>
      <span
        style={{
          fontWeight: 400,
          fontSize: 14,
          color: '#768692',
          marginLeft: 4,
          paddingLeft: 8,
          borderLeft: '1px solid #D8DDE0',
        }}
      >
        Docs
      </span>
    </span>
  ),
  project: {
    link: 'https://github.com/danrwr-web/signposting',
  },
  docsRepositoryBase: 'https://github.com/danrwr-web/signposting/tree/main/docs',
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Signposting Toolkit — Documentation for NHS GP care-navigation teams" />
      <meta name="og:title" content="Signposting Toolkit Docs" />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />
    </>
  ),
  color: {
    hue: { dark: 210, light: 210 },
    saturation: { dark: 100, light: 100 },
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
  navigation: {
    prev: true,
    next: true,
  },
  editLink: {
    component: null,
  },
  feedback: {
    content: null,
  },
  footer: {
    content: (
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13, color: '#768692' }}>
        <span>© {new Date().getFullYear()} Signposting Toolkit</span>
        <a
          href="mailto:contact@signpostingtool.co.uk"
          style={{ color: '#005EB8', textDecoration: 'none' }}
        >
          contact@signpostingtool.co.uk
        </a>
      </div>
    ),
  },
}

export default config
