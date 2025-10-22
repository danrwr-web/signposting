import { Metadata } from 'next'
import { readFileSync } from 'fs'
import { join } from 'path'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: "User Guide • Signposting Toolkit",
  description: "How to use and customise the Signposting Toolkit at Ide Lane Surgery",
}

interface HelpPageProps {}

export default function HelpPage({}: HelpPageProps) {
  let markdownContent: string
  let version: string

  try {
    // Read the markdown file at build time
    const filePath = join(process.cwd(), 'docs', 'USER_GUIDE.md')
    markdownContent = readFileSync(filePath, 'utf8')
    
    // Get version from environment
    version = process.env.NEXT_PUBLIC_APP_VERSION || '0.9 (Beta)'
  } catch (error) {
    // If file doesn't exist, show error message
    return (
      <main className="min-h-screen bg-nhs-light-grey">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4 border-b border-nhs-blue pb-2 text-nhs-dark-blue">
            User Guide
          </h1>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-nhs-red text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-nhs-dark-blue mb-2">
              User Guide not found
            </h2>
            <p className="text-nhs-grey">
              Please ensure docs/USER_GUIDE.md exists.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-nhs-light-grey">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Sticky page title bar */}
        <div className="sticky top-0 bg-nhs-light-grey z-10 pb-4">
          <h1 className="text-2xl font-bold mb-4 border-b border-nhs-blue pb-2 text-nhs-dark-blue">
            User Guide
          </h1>
          
          {/* PDF download link (disabled for now) */}
          <div className="mb-6">
            <button 
              disabled 
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-nhs-grey bg-gray-100 rounded-md cursor-not-allowed opacity-50"
              aria-label="PDF download coming soon"
            >
              📄 Download PDF (coming soon)
            </button>
            {/* TODO: Implement PDF generation and download functionality */}
          </div>
        </div>

        {/* Markdown content */}
        <article 
          className="prose prose-lg max-w-none prose-headings:text-nhs-dark-blue prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-nhs-grey prose-strong:text-nhs-dark-blue prose-a:text-nhs-blue prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-nhs-blue prose-blockquote:bg-nhs-light-blue prose-blockquote:pl-4 prose-table:border-collapse prose-th:bg-nhs-light-blue prose-th:border prose-th:border-gray-300 prose-th:p-3 prose-td:border prose-td:border-gray-300 prose-td:p-3 prose-ul:text-nhs-grey prose-ol:text-nhs-grey"
          role="article"
        >
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom table styling for mobile responsiveness
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto my-6">
                  <table {...props} className="min-w-full border-collapse border border-gray-300">
                    {children}
                  </table>
                </div>
              ),
              // Ensure proper heading hierarchy
              h1: ({ children, ...props }) => (
                <h1 {...props} className="text-3xl font-bold text-nhs-dark-blue mb-6 mt-8 first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 {...props} className="text-2xl font-bold text-nhs-dark-blue mb-4 mt-6">
                  {children}
                </h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 {...props} className="text-xl font-bold text-nhs-dark-blue mb-3 mt-4">
                  {children}
                </h3>
              ),
              // Custom styling for strong/bold text to match NHS red warnings
              strong: ({ children, ...props }) => (
                <strong {...props} className="font-bold text-nhs-red">
                  {children}
                </strong>
              ),
              // Custom blockquote styling
              blockquote: ({ children, ...props }) => (
                <blockquote {...props} className="border-l-4 border-nhs-blue bg-nhs-light-blue pl-4 py-2 my-4 italic text-nhs-grey">
                  {children}
                </blockquote>
              ),
            }}
          >
            {markdownContent}
          </ReactMarkdown>
        </article>

        {/* Version footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-nhs-grey">
          <p>
            Version {version} — Last updated October 2025
          </p>
        </footer>
      </div>
    </main>
  )
}
