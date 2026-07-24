'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Card, AlertBanner, ConfirmDialog, Skeleton, EmptyState } from '@/components/ui'
import { parseListSizeCsv, ParsedListSizeCsv } from '@/lib/practiceCsv'

interface PracticeDataStatus {
  practiceCount: number
  extractDate: string | null
  lastRefreshedAt: string | null
  sourceUrl: string | null
  stale: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function PracticeDataTab() {
  const [status, setStatus] = useState<PracticeDataStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNotes, setRefreshNotes] = useState<string[]>([])
  const [pendingUpload, setPendingUpload] = useState<ParsedListSizeCsv | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/super/practice-data')
      if (res.ok) setStatus(await res.json())
    } catch {
      // status card just shows dashes
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    setRefreshNotes([])
    try {
      const res = await fetch('/api/super/practice-data/refresh', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Refresh failed')
        return
      }
      toast.success(
        `Imported ${data.count.toLocaleString()} practices` +
          (data.extractDate ? ` (extract date ${formatDate(data.extractDate)})` : '')
      )
      if (Array.isArray(data.diagnostics) && data.diagnostics.length > 0) {
        setRefreshNotes(data.diagnostics)
      }
      await fetchStatus()
    } catch {
      setError('Refresh failed — check the connection and try again, or use the CSV upload below.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleFileChosen(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseListSizeCsv(text)
      setPendingUpload(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleConfirmUpload() {
    if (!pendingUpload) return
    setUploading(true)
    setError(null)
    try {
      const res = await fetch('/api/super/practice-data/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: pendingUpload.rows,
          extractDate: pendingUpload.extractDate?.toISOString() ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Upload failed')
        return
      }
      toast.success(`Imported ${data.count.toLocaleString()} practices from the uploaded file`)
      setPendingUpload(null)
      await fetchStatus()
    } catch {
      setError('Upload failed — please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton height="8rem" rounded="lg" />
        <Skeleton height="6rem" rounded="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {refreshNotes.length > 0 && (
        <AlertBanner variant="info">
          <span className="font-medium">
            Newer publication pages were skipped during the refresh:
          </span>
          <ul className="mt-1 ml-4 list-disc text-sm break-all">
            {refreshNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </AlertBanner>
      )}

      {status && status.practiceCount > 0 && status.stale && (
        <AlertBanner variant="warning">
          The national list-size data is more than 45 days old. Refresh it so new pipeline entries
          pick up current practice list sizes.
        </AlertBanner>
      )}

      {status && status.practiceCount === 0 ? (
        <EmptyState
          title="No national practice data loaded"
          description="Load the NHS Digital list-size data so the Add Practice lookup can autofill practice list sizes. Practice names, addresses and PCNs always come live from the NHS ODS register and don't need this data."
          illustration="documents"
          action={{ label: refreshing ? 'Downloading…' : 'Download latest data', onClick: handleRefresh }}
          secondaryAction={{ label: 'Upload CSV instead', onClick: () => fileInputRef.current?.click() }}
        />
      ) : (
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
            National practice list-size data
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Practices loaded</dt>
              <dd className="font-medium text-gray-900">
                {status?.practiceCount.toLocaleString() ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Data extract date</dt>
              <dd className="font-medium text-gray-900">{formatDate(status?.extractDate ?? null)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Last refreshed</dt>
              <dd className="font-medium text-gray-900">
                {formatDate(status?.lastRefreshedAt ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Source</dt>
              <dd className="font-medium text-gray-900 truncate">
                {status?.sourceUrl === 'manual-upload' ? (
                  'Manual upload'
                ) : status?.sourceUrl ? (
                  <a
                    href={status.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-nhs-blue hover:underline"
                  >
                    NHS Digital CSV
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={handleRefresh} loading={refreshing}>
              {refreshing ? 'Downloading…' : 'Refresh now'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Upload CSV
            </Button>
          </div>
        </Card>
      )}

      <Card padding="lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">About this data</h3>
        <p className="text-sm text-gray-600">
          List sizes come from the NHS Digital{' '}
          <a
            href="https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice"
            target="_blank"
            rel="noreferrer"
            className="text-nhs-blue hover:underline"
          >
            &ldquo;Patients Registered at a GP Practice&rdquo;
          </a>{' '}
          monthly publication and refresh automatically on the 5th of each month. If the automatic
          download fails, download <code className="text-xs">gp-reg-pat-prac-all.csv</code> from that
          publication and upload it here. Practice names, addresses and PCNs are always looked up
          live from the NHS ODS register — only list sizes are cached.
        </p>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFileChosen(file)
        }}
      />

      <ConfirmDialog
        open={!!pendingUpload}
        onClose={() => setPendingUpload(null)}
        onConfirm={handleConfirmUpload}
        title="Replace national practice data"
        message={
          pendingUpload ? (
            <>
              Replace the {status?.practiceCount.toLocaleString() ?? 0} cached practices with{' '}
              <span className="font-medium">{pendingUpload.rows.length.toLocaleString()}</span> rows
              from this file
              {pendingUpload.extractDate
                ? ` (extract date ${formatDate(pendingUpload.extractDate.toISOString())})`
                : ''}
              ?
              {pendingUpload.skipped > 0 && (
                <> {pendingUpload.skipped.toLocaleString()} malformed rows will be skipped.</>
              )}
            </>
          ) : null
        }
        confirmLabel="Replace data"
        loading={uploading}
      />
    </div>
  )
}
