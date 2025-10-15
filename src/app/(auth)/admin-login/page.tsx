/**
 * Surgery admin login page
 * Allows surgery administrators to log in
 */

import AdminLoginForm from './AdminLoginForm'

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-nhs-light-grey flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-nhs-dark-blue">
            Surgery Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-nhs-grey">
            Sign in to manage your surgery&apos;s symptom data
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}
