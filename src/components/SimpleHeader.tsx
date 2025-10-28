import Link from 'next/link'
import SurgerySelector from './SurgerySelector'
import { Surgery } from '@prisma/client'

interface SimpleHeaderProps {
  surgeries: Surgery[]
  currentSurgeryId?: string
}

export default function SimpleHeader({ surgeries, currentSurgeryId }: SimpleHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img
                src="/images/signposting_logo_head.png"
                alt="Signposting"
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Surgery Selector */}
          <div className="flex items-center space-x-6">
            <SurgerySelector 
              surgeries={surgeries} 
              currentSurgeryId={currentSurgeryId}
            />
            
            {/* Admin Link */}
            <Link 
              href="/admin" 
              prefetch={false}
              className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
            >
              Admin
            </Link>
            
            {/* Help Link */}
            <Link 
              href="/help" 
              prefetch={false}
              className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors underline-offset-2 hover:underline"
            >
              User Guide
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
