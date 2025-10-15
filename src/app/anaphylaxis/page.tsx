import SimpleHeader from '@/components/SimpleHeader'
import { prisma } from '@/lib/prisma'

interface AnaphylaxisPageProps {
  searchParams: Promise<{
    surgery?: string
  }>
}

export default async function AnaphylaxisPage({ searchParams }: AnaphylaxisPageProps) {
  const resolvedSearchParams = await searchParams
  const surgerySlug = resolvedSearchParams.surgery

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgerySlug={surgerySlug} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-6">
            Anaphylaxis Emergency Response
          </h1>
          
          <div className="space-y-6">
            <div className="bg-red-50 border-l-4 border-nhs-red p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-nhs-red mb-3">
                🚨 IMMEDIATE ACTION REQUIRED
              </h2>
              <p className="text-nhs-red font-medium">
                This is a medical emergency. Call 999 immediately.
              </p>
            </div>

            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                What is Anaphylaxis?
              </h3>
              <p className="text-nhs-grey mb-4">
                Anaphylaxis is a severe, life-threatening allergic reaction that can occur within 
                minutes of exposure to an allergen. It requires immediate emergency treatment.
              </p>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Signs and Symptoms
              </h3>
              <ul className="list-disc list-inside text-nhs-grey mb-4 space-y-1">
                <li>Difficulty breathing or wheezing</li>
                <li>Swelling of the face, lips, tongue, or throat</li>
                <li>Rapid or weak pulse</li>
                <li>Dizziness or fainting</li>
                <li>Nausea, vomiting, or diarrhea</li>
                <li>Skin rash or hives</li>
                <li>Feeling of impending doom</li>
              </ul>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Emergency Actions
              </h3>
              <ol className="list-decimal list-inside text-nhs-grey mb-4 space-y-2">
                <li><strong>Call 999 immediately</strong> - This is a medical emergency</li>
                <li>If the person has an EpiPen, help them use it</li>
                <li>Lie them down flat (unless they&apos;re having breathing difficulties)</li>
                <li>Elevate their legs if possible</li>
                <li>Stay with them until emergency services arrive</li>
                <li>Be prepared to perform CPR if they stop breathing</li>
              </ol>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Prevention
              </h3>
              <p className="text-nhs-grey mb-4">
                If you have a known severe allergy, always carry your EpiPen and wear a medical 
                alert bracelet. Avoid known triggers and inform others about your allergy.
              </p>
            </div>

            <div className="bg-nhs-light-blue border border-nhs-blue rounded-lg p-6">
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-2">
                Important Reminder
              </h3>
              <p className="text-nhs-grey">
                Even if symptoms seem to improve after using an EpiPen, you must still go to 
                the hospital immediately. A second reaction can occur hours later.
              </p>
            </div>
          </div>

          <div className="mt-8 flex space-x-4">
            <button
              onClick={() => window.history.back()}
              className="nhs-button-secondary"
            >
              Back to Symptoms
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
