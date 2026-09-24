import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  formatBytes,
  getIntegrityReport,
  listAssetJobs,
  startAssetJob,
  type AssetJobType,
  type IntegrityReport,
} from '@/lib/assetsApi'
import { useCan } from '@/auth/AuthContext'
import { permissionHint } from '@/auth/permissions'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate } from '@/lib/ui'

const JOB_LABELS: Record<AssetJobType, string> = {
  'manifest-rebuild': 'Manifest rebuild',
  'integrity-report': 'Integrity report',
}

export default function AssetJobs() {
  const canRun = useCan('editAssets')
  const queryClient = useQueryClient()
  const [verifyHashes, setVerifyHashes] = useState(false)

  const jobs = useQuery({
    queryKey: ['asset-jobs'],
    queryFn: listAssetJobs,
    refetchInterval: (query) => (query.state.data?.some((job) => job.status === 'running') ? 5_000 : false),
  })
  const report = useQuery({ queryKey: ['asset-integrity'], queryFn: getIntegrityReport })

  const start = useMutation({
    mutationFn: (type: AssetJobType) => startAssetJob(type, { verifyHashes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['asset-jobs'] })
      void queryClient.invalidateQueries({ queryKey: ['asset-integrity'] })
    },
  })

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Link to="/assets" className="text-sm text-indigo-600">
        Back to library
      </Link>
      <PageHeader title="Asset jobs and integrity" description="Manifest rebuilds and storage integrity reports." />

      <Section title="Run a job">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={buttonClass.secondary}
            disabled={!canRun || start.isPending}
            title={canRun ? undefined : permissionHint('editAssets')}
            onClick={() => start.mutate('manifest-rebuild')}
          >
            Rebuild manifest
          </button>
          <button
            className={buttonClass.secondary}
            disabled={!canRun || start.isPending}
            title={canRun ? undefined : permissionHint('editAssets')}
            onClick={() => start.mutate('integrity-report')}
          >
            Run integrity report
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={verifyHashes} onChange={(event) => setVerifyHashes(event.target.checked)} />
            Re-hash originals (slow)
          </label>
        </div>
        <div className="mt-2">
          <ErrorNotice error={start.error} />
        </div>
      </Section>

      <Section title="Recent jobs">
        <ErrorNotice error={jobs.error} />
        {jobs.data && jobs.data.length === 0 && <p className="text-sm text-gray-500">No jobs since the service started.</p>}
        {jobs.data && jobs.data.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="py-1">Job</th>
                <th className="py-1">Status</th>
                <th className="py-1">Started</th>
                <th className="py-1">Finished</th>
                <th className="py-1">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.data.map((job) => (
                <tr key={job.id}>
                  <td className="py-1">{JOB_LABELS[job.type] ?? job.type}</td>
                  <td className="py-1">
                    <Pill tone={job.status === 'succeeded' ? 'green' : job.status === 'failed' ? 'red' : 'blue'}>{job.status}</Pill>
                    {job.error && <span className="ml-2 text-xs text-red-700">{job.error.message}</span>}
                  </td>
                  <td className="py-1">{formatDate(job.startedAt)}</td>
                  <td className="py-1">{formatDate(job.finishedAt)}</td>
                  <td className="py-1">{job.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Latest integrity report">
        <ErrorNotice error={report.error} />
        {report.isSuccess && report.data === null && <p className="text-sm text-gray-500">No integrity report has run yet.</p>}
        {report.data && <IntegritySummary report={report.data} />}
      </Section>
    </div>
  )
}

function IntegritySummary({ report }: { report: IntegrityReport }) {
  const problems: Array<[string, number]> = [
    ['Missing files', report.counts.missingFiles],
    ['Orphaned files', report.counts.orphanedFiles],
    ['Hash mismatches', report.counts.hashMismatches],
    ['Invalid keys', report.counts.invalidKeys],
  ]
  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-600">
        Finished {formatDate(report.finishedAt)} in {(report.durationMs / 1000).toFixed(1)}s
        {report.verifyHashes ? `, ${report.counts.hashesVerified} hashes verified` : ', hashes not re-verified'}.
      </p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {problems.map(([label, value]) => (
          <div key={label} className={`rounded-md p-3 ${value > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <dt className="text-xs uppercase text-gray-500">{label}</dt>
            <dd className={`text-xl font-semibold ${value > 0 ? 'text-red-700' : 'text-gray-900'}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
        <dt className="text-gray-500">Originals</dt>
        <dd>
          {report.storage.blobs.files} files, {formatBytes(report.storage.blobs.bytes)}
        </dd>
        <dt className="text-gray-500">Derivatives</dt>
        <dd>
          {report.storage.derivatives.files} files, {formatBytes(report.storage.derivatives.bytes)}
        </dd>
        <dt className="text-gray-500">Quarantine</dt>
        <dd>
          {report.storage.quarantine.files} files, {formatBytes(report.storage.quarantine.bytes)}
        </dd>
        <dt className="text-gray-500">Total</dt>
        <dd>{formatBytes(report.storage.totalBytes)}</dd>
      </dl>
      {report.missingFiles.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Missing files</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {report.missingFiles.map((file) => (
              <li key={`${file.location}:${file.key}`}>
                {file.key} ({file.location}){file.assetIds?.length ? ` · ${file.assetIds.join(', ')}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.hashMismatches.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Hash mismatches</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {report.hashMismatches.map((file) => (
              <li key={`${file.location}:${file.key}`}>
                {file.key} · {file.assetIds.join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.orphanedFiles.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Orphaned files</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {report.orphanedFiles.map((file) => (
              <li key={`${file.location}:${file.key}`}>
                {file.key} ({file.location}, {formatBytes(file.bytes)})
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.truncated && <p className="text-xs text-gray-500">Lists are truncated; see the asset-service report for all entries.</p>}
    </div>
  )
}
