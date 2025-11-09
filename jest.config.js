const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|unified|bail|is-plain-obj|trough|vfile|vfile-message|unist-util-stringify-position|micromark|mdast-util-from-markdown|mdast-util-to-markdown|mdast-util-to-string|mdast-util-gfm|micromark-extension-gfm|micromark-extension-gfm-strikethrough|micromark-extension-gfm-table|micromark-extension-gfm-task-list-item|micromark-extension-gfm-autolink-literal|micromark-extension-gfm-footnote|micromark-extension-gfm-tagfilter|micromark-extension-gfm-autolink-literal|micromark-extension-gfm-footnote|micromark-extension-gfm-tagfilter|jose)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
