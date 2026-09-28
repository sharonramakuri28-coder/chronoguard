import { motion } from 'framer-motion'
import { ArrowRight, Brain, Database, FileSpreadsheet, FlaskConical, Loader2, ShieldAlert, Sparkles, Users } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { RiskByAudit } from '../components/charts'
import { RiskGauge } from '../components/RiskGauge'
import { UploadDropzone } from '../components/UploadDropzone'
import { BandBadge, ErrorState, GlassCard, PageHeader, PageSkeleton, SectionTitle, StatTile } from '../components/ui'
import { useAuditSample, useDashboard, useSamples, useUpload } from '../hooks/useApi'
import { fmtBytes, fmtDate, fmtDelta, fmtInt } from '../lib/format'

export function Dashboard() {
  const navigate = useNavigate()
  const dash = useDashboard()
  const samples = useSamples()
  const upload = useUpload()
  const sample = useAuditSample()
  const busy = upload.isPending || sample.isPending
  const actionError = upload.error ?? sample.error

  const onAudited = (id: number) => navigate(`/audits/${id}`)

  if (dash.isLoading) return <PageSkeleton />
  if (dash.error) return <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
  const d = dash.data!
  const latest = d.audits[0]

  return (
    <>
      <PageHeader
        eyebrow="Temporal ML audit"
        title={
          <>
            Your model should only know <span className="text-gradient">what the world knew.</span>
          </>
        }
        subtitle="ChronoGuard checks every feature value against the moment each prediction was made, scores the risk, recalls similar past incidents, and replays the model without the leak to measure the real impact."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-3">
          <SectionTitle hint="CSV · long or wide layout · up to 20 MB">Audit a dataset</SectionTitle>
          <UploadDropzone busy={upload.isPending} onFile={(f) => upload.mutate(f, { onSuccess: (a) => onAudited(a.id) })} />
          {actionError && (
            <p role="alert" className="mt-3 rounded-xl border border-leak/30 bg-leak/10 px-3 py-2 text-sm text-leak">
              {actionError.message}
            </p>
          )}
          {samples.data && samples.data.length > 0 && (
            <div className="mt-5">
              <p className="label mb-2">Or run a bundled sample (synthetic data)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {samples.data.map((s) => (
                  <button
                    key={s.name}
                    disabled={busy}
                    onClick={() => sample.mutate(s.name, { onSuccess: (a) => onAudited(a.id) })}
                    className="group flex flex-col items-start gap-1 rounded-xl border border-line bg-white/[0.02] p-3 text-left transition hover:border-accent/40 hover:bg-accent/[0.04] disabled:opacity-50"
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-white">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-accent" aria-hidden /> {s.title}
                      </span>
                      {sample.isPending && sample.variables === s.name ? (
                        <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden />
                      ) : (
                        <ArrowRight className="size-3.5 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
                      )}
                    </span>
                    <span className="text-xs text-muted">{s.description}</span>
                    <span className="text-[10px] text-muted">{fmtBytes(s.size_bytes)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col items-center justify-center gap-4 lg:col-span-2" delay={0.05}>
          {latest ? (
            <>
              <p className="label">Latest audit risk</p>
              <RiskGauge score={latest.risk_score} band={latest.risk_band} />
              <div className="text-center">
                <p className="font-mono text-sm text-white">{latest.dataset_name}</p>
                <p className="mt-1 text-xs text-muted">
                  {latest.leaked_features} of {latest.features} features leaked · {fmtInt(latest.affected_decisions)} of{' '}
                  {fmtInt(latest.decisions)} decisions affected
                </p>
              </div>
              <Link to={`/audits/${latest.id}`} className="btn btn-ghost">
                View audit <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <div className="text-center text-sm text-muted">
              <Sparkles className="mx-auto mb-2 size-6 text-accent" aria-hidden />
              Upload a dataset or run a sample to see its risk score.
            </div>
          )}
        </GlassCard>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Datasets audited"
          icon={<Database className="size-4" />}
          value={<AnimatedNumber value={d.datasets_audited} format={(n) => fmtInt(Math.round(n))} />}
          sub={`${fmtInt(d.decisions_audited)} decisions checked`}
        />
        <StatTile
          label="Leaked features"
          tone="leak"
          icon={<ShieldAlert className="size-4" />}
          value={<AnimatedNumber value={d.leaked_features} format={(n) => fmtInt(Math.round(n))} />}
          sub={`${fmtInt(d.affected_decisions)} decisions affected`}
        />
        <StatTile
          label="Memory incidents"
          tone="memory"
          icon={<Brain className="size-4" />}
          value={<AnimatedNumber value={d.incidents} format={(n) => fmtInt(Math.round(n))} />}
          sub={`${d.recurring_matches} recurring leak${d.recurring_matches === 1 ? '' : 's'} recognised`}
        />
        <StatTile
          label="Mean AUC inflation"
          tone="accent"
          icon={<FlaskConical className="size-4" />}
          value={d.mean_auc_inflation === null ? '—' : fmtDelta(d.mean_auc_inflation)}
          sub={d.replays ? `measured over ${d.replays} replay${d.replays === 1 ? '' : 's'}` : 'run a replay to measure'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-2" delay={0.1}>
          <SectionTitle hint="0–100, higher is riskier">Risk by dataset</SectionTitle>
          {d.audits.length ? (
            <RiskByAudit
              audits={[...d.audits].reverse().map((a) => ({ name: `#${a.id}`, score: a.risk_score, band: a.risk_band }))}
            />
          ) : (
            <p className="text-sm text-muted">No audits yet.</p>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-3" delay={0.15}>
          <SectionTitle hint={`${d.audits.length} total`}>Recent audits</SectionTitle>
          <ul className="space-y-2">
            {d.audits.slice(0, 8).map((a, i) => (
              <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
                <Link
                  to={`/audits/${a.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-white/[0.02] px-4 py-3 transition hover:border-accent/30 hover:bg-white/[0.04]"
                >
                  <span className="num w-8 text-xs text-muted">#{a.id}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-white">{a.dataset_name}</span>
                  <span className="text-xs text-muted">
                    <Users className="mr-1 inline size-3" aria-hidden />
                    {fmtInt(a.decisions)}
                  </span>
                  <span className="text-xs text-muted">{a.leaked_features} leaked</span>
                  {a.auc_delta !== null && <span className="num text-xs text-accent">AUC {fmtDelta(a.auc_delta)}</span>}
                  <span className="text-xs text-muted">{fmtDate(a.created_at)}</span>
                  <BandBadge band={a.risk_band}>{a.risk_score.toFixed(0)}</BandBadge>
                </Link>
              </motion.li>
            ))}
            {d.audits.length === 0 && <li className="text-sm text-muted">Nothing audited yet.</li>}
          </ul>
        </GlassCard>
      </div>
    </>
  )
}
