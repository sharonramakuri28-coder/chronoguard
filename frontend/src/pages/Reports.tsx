import { Download, FileText, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { AuditPicker } from '../components/AuditPicker'
import { Markdown } from '../components/Markdown'
import { ErrorState, GlassCard, PageHeader, PageSkeleton, Pill } from '../components/ui'
import { useReport } from '../hooks/useApi'
import { fmtDateTime } from '../lib/format'
import { LatestAuditRedirect } from './LatestAuditRedirect'

export function ReportsRoute() {
  const { id } = useParams()
  if (!id) return <LatestAuditRedirect to={(a) => `/reports/${a}`} prefer={(a) => a.leaked_features > 0} />
  return <Report id={Number(id)} />
}

function Report({ id }: { id: number }) {
  const { data, isLoading, error, refetch } = useReport(id)
  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  const r = data!

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="One-click audit report"
          title="Reports"
          subtitle="Executive summary, risk score, evidence, timeline, replay, memory references and recommended fixes, generated from the stored audit. Download it as Markdown for a ticket or print it to PDF."
          actions={
            <>
              <AuditPicker current={id} path={(x) => `/reports/${x}`} />
              <a className="btn btn-ghost" href={api.reportDownloadUrl(id)} download>
                <Download className="size-4" aria-hidden /> Download .md
              </a>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print / PDF
              </button>
            </>
          }
        />
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Pill>
            <FileText className="size-3.5" aria-hidden /> generated {fmtDateTime(r.generated_at)}
          </Pill>
          <Link to={`/audits/${id}`} className="text-accent hover:underline">
            Open audit #{id}
          </Link>
        </div>
      </div>
      <GlassCard className="print-surface">
        <article className="mx-auto max-w-4xl">
          <Markdown source={r.markdown} />
        </article>
      </GlassCard>
    </>
  )
}
