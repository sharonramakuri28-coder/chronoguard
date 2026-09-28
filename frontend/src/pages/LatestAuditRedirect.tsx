import { ScanSearch } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { EmptyState, ErrorState, PageSkeleton } from '../components/ui'
import { useDashboard } from '../hooks/useApi'

/** Sends /audits and /replay to the most recent audit, or explains how to create one. */
export function LatestAuditRedirect({ to }: { to: (auditId: number) => string }) {
  const { data, isLoading, error, refetch } = useDashboard()
  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  const latest = data?.audits[0]
  if (latest) return <Navigate replace to={to(latest.id)} />
  return (
    <EmptyState
      icon={<ScanSearch className="size-5" />}
      title="No audits yet"
      action={
        <Link to="/" className="btn btn-primary">
          Audit a dataset
        </Link>
      }
    >
      Upload a CSV or run a sample from the dashboard to see results here.
    </EmptyState>
  )
}
