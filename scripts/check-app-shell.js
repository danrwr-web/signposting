#!/usr/bin/env node

/**
 * Check script to ensure pages under /s/[id]/... don't bypass the app shell.
 * 
 * This script checks that:
 * 1. Pages under src/app/s/[id]/... don't import SimpleHeader directly
 * 2. The layout.tsx exists and includes SimpleHeader
 * 
 * Run with: node scripts/check-app-shell.js
 */

const fs = require('fs')
const path = require('path')

const SURGERY_PAGES_DIR = path.join(__dirname, '../src/app/s/[id]')
const LAYOUT_FILE = path.join(__dirname, '../src/app/s/[id]/layout.tsx')

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList)
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      // Skip layout.tsx itself
      if (file !== 'layout.tsx') {
        fileList.push(filePath)
      }
    }
  })
  
  return fileList
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  
  // Check for SimpleHeader import
  if (content.includes("from '@/components/SimpleHeader'") || 
      content.includes('from "./SimpleHeader"') ||
      content.includes("from '../SimpleHeader'")) {
    return {
      file: path.relative(process.cwd(), filePath),
      issue: 'Imports SimpleHeader directly (should use layout instead)'
    }
  }
  
  // Check for SimpleHeader usage
  if (content.includes('<SimpleHeader')) {
    return {
      file: path.relative(process.cwd(), filePath),
      issue: 'Uses SimpleHeader component (should use layout instead)'
    }
  }
  
  return null
}

function main() {
  console.log('Checking app shell enforcement...\n')
  
  // Check layout exists
  if (!fs.existsSync(LAYOUT_FILE)) {
    console.error('❌ ERROR: Layout file not found at', LAYOUT_FILE)
    process.exit(1)
  }
  
  const layoutContent = fs.readFileSync(LAYOUT_FILE, 'utf-8')
  if (!layoutContent.includes('SimpleHeader')) {
    console.error('❌ ERROR: Layout file does not include SimpleHeader')
    process.exit(1)
  }
  
  console.log('✓ Layout file exists and includes SimpleHeader\n')
  
  // Check pages
  if (!fs.existsSync(SURGERY_PAGES_DIR)) {
    console.log('⚠️  Warning: Surgery pages directory not found')
    return
  }
  
  const files = findFiles(SURGERY_PAGES_DIR)
  const issues = []
  
  files.forEach(file => {
    const issue = checkFile(file)
    if (issue) {
      issues.push(issue)
    }
  })
  
  if (issues.length > 0) {
    console.error('❌ Found pages that bypass the app shell:\n')
    issues.forEach(({ file, issue }) => {
      console.error(`  ${file}`)
      console.error(`    ${issue}\n`)
    })
    console.error('Please remove SimpleHeader from these pages and rely on the layout.')
    process.exit(1)
  }
  
  console.log(`✓ All ${files.length} pages under /s/[id]/... use the shared layout`)
  console.log('✓ App shell is properly enforced\n')
}

main()
