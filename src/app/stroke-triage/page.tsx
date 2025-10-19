import SimpleHeader from '@/components/SimpleHeader'
import { prisma } from '@/lib/prisma'

interface StrokeTriagePageProps {
  searchParams: Promise<{
    surgery?: string
  }>
}

export default async function StrokeTriagePage({ searchParams }: StrokeTriagePageProps) {
  const resolvedSearchParams = await searchParams
  const surgerySlug = resolvedSearchParams.surgery

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={surgerySlug} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-6">
            Stroke Triage and Assessment
          </h1>
          
          <div className="space-y-6">
            <div className="bg-red-50 border-l-4 border-nhs-red p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-nhs-red mb-3">
                ⚡ ACT FAST - Time is Critical
              </h2>
              <p className="text-nhs-red font-medium">
                If you suspect a stroke, call 999 immediately. Every minute counts.
              </p>
            </div>

            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                What is a Stroke?
              </h3>
              <p className="text-nhs-grey mb-4">
                A stroke occurs when blood supply to part of the brain is interrupted or reduced, 
                depriving brain tissue of oxygen and nutrients. This can cause brain cells to die.
              </p>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Remember FAST
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-nhs-light-blue p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-nhs-blue mb-2">F</div>
                  <div className="font-semibold text-nhs-dark-blue">Face</div>
                  <div className="text-sm text-nhs-grey">Drooping on one side</div>
                </div>
                <div className="bg-nhs-light-blue p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-nhs-blue mb-2">A</div>
                  <div className="font-semibold text-nhs-dark-blue">Arms</div>
                  <div className="text-sm text-nhs-grey">Weakness or numbness</div>
                </div>
                <div className="bg-nhs-light-blue p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-nhs-blue mb-2">S</div>
                  <div className="font-semibold text-nhs-dark-blue">Speech</div>
                  <div className="text-sm text-nhs-grey">Slurred or confused</div>
                </div>
                <div className="bg-nhs-light-blue p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-nhs-blue mb-2">T</div>
                  <div className="font-semibold text-nhs-dark-blue">Time</div>
                  <div className="text-sm text-nhs-grey">Call 999 immediately</div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Additional Symptoms
              </h3>
              <ul className="list-disc list-inside text-nhs-grey mb-4 space-y-1">
                <li>Sudden severe headache</li>
                <li>Dizziness or loss of balance</li>
                <li>Vision problems in one or both eyes</li>
                <li>Confusion or difficulty understanding</li>
                <li>Difficulty walking</li>
                <li>Loss of coordination</li>
              </ul>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Risk Factors
              </h3>
              <ul className="list-disc list-inside text-nhs-grey mb-4 space-y-1">
                <li>High blood pressure</li>
                <li>Diabetes</li>
                <li>High cholesterol</li>
                <li>Smoking</li>
                <li>Obesity</li>
                <li>Family history of stroke</li>
                <li>Age (risk increases with age)</li>
              </ul>

              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                Prevention
              </h3>
              <ul className="list-disc list-inside text-nhs-grey mb-4 space-y-1">
                <li>Control blood pressure</li>
                <li>Manage diabetes</li>
                <li>Lower cholesterol</li>
                <li>Quit smoking</li>
                <li>Maintain healthy weight</li>
                <li>Exercise regularly</li>
                <li>Eat a healthy diet</li>
                <li>Limit alcohol consumption</li>
              </ul>
            </div>

            <div className="bg-nhs-light-blue border border-nhs-blue rounded-lg p-6">
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-2">
                Emergency Response
              </h3>
              <p className="text-nhs-grey mb-2">
                If you suspect someone is having a stroke:
              </p>
              <ol className="list-decimal list-inside text-nhs-grey space-y-1">
                <li>Call 999 immediately</li>
                <li>Note the time symptoms started</li>
                <li>Stay with the person</li>
                <li>Do not give them food or drink</li>
                <li>Keep them comfortable and still</li>
              </ol>
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
