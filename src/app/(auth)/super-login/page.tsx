/**
 * Superuser login page
 * Allows superuser to manage surgeries and system settings
 */

import SuperLoginForm from './SuperLoginForm'

export default function SuperLoginPage() {
  return (
    <div className="min-h-screen bg-nhs-light-grey flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-nhs-dark-blue">
            Superuser Login
          </h2>
          <p className="mt-2 text-center text-sm text-nhs-grey">
            Sign in to manage surgeries and system settings
          </p>
        </div>
        <SuperLoginForm />
      </div>
    </div>
  )
}
