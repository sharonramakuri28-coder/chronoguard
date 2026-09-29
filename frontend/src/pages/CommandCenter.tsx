import { motion } from 'framer-motion'
import { ArrowRight, Boxes, Brain, Cloud, Download, FileSpreadsheet, FlaskConical, Gauge, Loader2, Repeat, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { SampleOut } from '../api/types'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { RiskByAudit } from '../components/charts'
import { DemoStory } from '../components/DemoStory'
import { NeuralMemory } from '../components/NeuralMemory'
import { RiskGauge } from '../components/RiskGauge'
import { UploadDropzone } from '../components/UploadDropzone'
import { BandBadge, ErrorState, GlassCard, PageSkeleton, SectionTitle, Skeleton } from '../components/ui'
import { useAuditSample, useCommandCenter, useMemoryGraph, useSamples, useUpload } from '../hooks/useApi'
import { fmtBytes, fmtDate, fmtDelta, fmtInt, hindsightLabel } from '../lib/format'

function Kpi({ label, value, sub, icon, tone, delay }: {
  label: string
  value: ReactNode
  sub: ReactNode
  icon: ReactNode
  tone: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong group relative overflow-hidden p-4 sm:p-5"
    >
      <div className={`pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-20 blur-2xl ${tone}`} aria-hidden />
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="text-muted">{icon}</span>
      </div>
      <div className="num mt-3 text-3xl font-semibold text-white sm:text-4xl">{value}</div>
      <div className="mt-1.5 text-xs text-muted">{sub}</div>
    </motion.div>
  )
}

const GROUPS: { key: SampleOut['group']; title: string }[] = [
  { key: 'demo', title: 'Demo story' },
  { key: 'history', title: 'Memory history (audited on first start)' },
  { key: 'more', title: 'More samples' },
]

function Samples({ samples, onAudited }: { samples: SampleOut[]; onAudited: (id: number) => void }) {
  const sample = useAuditSample()
  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const list = samples.filter((s) => s.group === g.key)
        if (!list.length) return null
        return (
          <div key={g.key}>
            <p className="label mb-2">{g.title}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((s) => (
                <div key={s.name} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white/[0.02] transition hover:border-accent/40">
                  <button
                    disabled={sample.isPending}
                    onClick={() => sample.mutate(s.name, { onSuccess: (a) => onAudited(a.id) })}
                    className="group flex flex-1 flex-col items-start gap-1 p-3 text-left transition hover:bg-accent/[0.04] disabled:opacity-50"
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-white">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 shrink-0 text-accent" aria-hidden /> {s.title}
                      </span>
                      {sample.isPending && sample.variables === s.name ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" aria-hidden />
                      ) : (
                        <ArrowRight className="size-3.5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
                      )}
                    </span>
                    <span className="text-xs text-muted">{s.description}</span>
                  </button>
                  <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-muted">
                    <span>
                      {s.model} · {fmtBytes(s.size_bytes)}
                    </span>
                    <a href={api.sampleDownloadUrl(s.name)} download={s.name} className="inline-flex items-center gap-1 hover:text-accent" aria-label={`Download ${s.name}`}>
                      <Download className="size-3" aria-hidden /> CSV
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {sample.error && <p role="alert" className="text-sm text-leak">{sample.error.message}</p>}
    </div>
  )
}

export function CommandCenter() {
  const navigate = useNavigate()
  const cc = useCommandCenter()
  const graph = useMemoryGraph()
  const samples = useSamples()
  const upload = useUpload()
  const [modelName, setModelName] = useState('')
  const onAudited = (id: number) => navigate(`/audits/${id}`)

  if (cc.isLoading) return <PageSkeleton />
  if (cc.error) return <ErrorState error={cc.error} onRetry={() => cc.refetch()} />
  const d = cc.data!
  const latest = d.audits[0]
  const int = (n: number) => fmtInt(Math.round(n))
  const demoAvailable = !!samples.data?.some((s) => s.group === 'demo')

  return (
    <>
      <section className="relative mb-6 overflow-hidden">
        <p className="label mb-2 flex items-center gap-2 text-accent">
          <Sparkles className="size-3.5" aria-hidden /> AI Reliability Engineer
        </p>
        <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
          Remembers every ML failure. <span className="text-memory-gradient">Prevents the next one.</span>
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted sm:text-base">
          ChronoGuard audits training data for information from the future, measures how much it inflated the model, and retains every
          incident in Hindsight long-term memory, so when the same failure returns under a new name, it is recognised before the model ships.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#demo" className="btn btn-primary">
            <Sparkles className="size-4" aria-hidden /> Start the 5-scene demo
          </a>
          <a href="#audit" className="btn btn-ghost">
            Audit your own dataset
          </a>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          label="Models protected"
          icon={<ShieldCheck className="size-4" />}
          tone="bg-accent"
          delay={0}
          value={<AnimatedNumber value={d.models_protected} format={int} />}
          sub={`${int(d.datasets_audited)} datasets · ${int(d.decisions_audited)} decisions audited`}
        />
        <Kpi
          label="Incidents learned"
          icon={<Brain className="size-4" />}
          tone="bg-memory"
          delay={0.05}
          value={<AnimatedNumber value={d.incidents_learned} format={int} />}
          sub={`${d.patterns} failure pattern${d.patterns === 1 ? '' : 's'} · ${d.repeat_failures_caught} repeat${d.repeat_failures_caught === 1 ? '' : 's'} caught`}
        />
        <Kpi
          label="Prevented failures"
          icon={<Boxes className="size-4" />}
          tone="bg-safe"
          delay={0.1}
          value={<AnimatedNumber value={d.prevented_failures} format={int} />}
          sub={d.feedback_count ? 'leaked features whose fix the team confirmed' : 'confirmed by fix feedback · none yet'}
        />
        <Kpi
          label="Memory confidence"
          icon={<Gauge className="size-4" />}
          tone="bg-accent-2"
          delay={0.15}
          value={d.memory_confidence === null ? '—' : <AnimatedNumber value={d.memory_confidence * 100} format={(n) => `${n.toFixed(0)}%`} />}
          sub={d.feedback_count ? `from ${d.feedback_count} fix report${d.feedback_count === 1 ? '' : 's'}` : 'no fix feedback yet'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <GlassCard className="glass-strong lg:col-span-3" delay={0.1}>
          <SectionTitle
            hint={
              <Link to="/memory" className="inline-flex items-center gap-1 text-accent hover:underline">
                Hindsight Memory <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          >
            🧠 Hindsight Memory network
          </SectionTitle>
          {graph.data ? <NeuralMemory graph={graph.data} /> : <Skeleton className="h-[340px]" />}
        </GlassCard>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <GlassCard className="flex items-center gap-4" delay={0.15}>
            {latest ? (
              <>
                <RiskGauge score={latest.risk_score} band={latest.risk_band} size={128} />
                <div className="min-w-0">
                  <p className="label">Latest audit</p>
                  <p className="mt-1 truncate font-mono text-sm text-white">{latest.dataset_name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {latest.leaked_features} of {latest.features} features leaked
                    {latest.recalled > 0 && <> · {latest.recalled} recalled from memory</>}
                  </p>
                  <Link to={`/audits/${latest.id}`} className="btn btn-ghost mt-3 h-8 px-3 text-xs">
                    Open <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">No audits yet. Start the demo below.</p>
            )}
          </GlassCard>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass p-3">
              <p className="label flex items-center gap-1.5">
                <Repeat className="size-3" aria-hidden /> Repeats caught
              </p>
              <p className="num mt-1 text-xl font-semibold text-memory">{d.repeat_failures_caught}</p>
            </div>
            <div className="glass p-3">
              <p className="label flex items-center gap-1.5">
                <FlaskConical className="size-3" aria-hidden /> AUC inflation
              </p>
              <p className="num mt-1 text-xl font-semibold text-accent">{d.mean_auc_inflation === null ? '—' : fmtDelta(d.mean_auc_inflation)}</p>
            </div>
            <div className="glass p-3">
              <p className="label flex items-center gap-1.5">
                <Cloud className="size-3" aria-hidden /> Hindsight
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{hindsightLabel(d.hindsight)}</p>
              <p className="text-[11px] text-muted">{d.hindsight_retained} incidents retained</p>
            </div>
            <div className="glass p-3">
              <p className="label">Average risk</p>
              <p className="num mt-1 text-xl font-semibold text-white">{d.average_risk === null ? '—' : d.average_risk.toFixed(0)}</p>
              <p className="text-[11px] text-muted">across {d.audits.length} audits</p>
            </div>
          </div>
        </div>
      </div>

      <GlassCard className="mt-4 scroll-mt-6" delay={0.2}>
        <div id="demo" className="scroll-mt-24" />
        <SectionTitle hint="Synthetic data · every number is computed live">The story: one failure, remembered</SectionTitle>
        <DemoStory audits={d.audits} available={demoAvailable} />
      </GlassCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-3" delay={0.25}>
          <div id="audit" className="scroll-mt-24" />
          <SectionTitle hint="CSV · long or wide layout · up to 20 MB">Audit a dataset</SectionTitle>
          <label className="mb-3 block text-xs text-muted" htmlFor="model-name">
            Model name <span className="opacity-70">(optional; groups audits of the same model)</span>
            <input
              id="model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              maxLength={255}
              placeholder="e.g. Card fraud classifier"
              className="mt-1 h-9 w-full rounded-lg border border-line bg-ink-950/60 px-3 text-sm text-white placeholder:text-muted focus:border-accent/50 focus:outline-none"
            />
          </label>
          <UploadDropzone busy={upload.isPending} onFile={(file) => upload.mutate({ file, modelName }, { onSuccess: (a) => onAudited(a.id) })} />
          {upload.error && (
            <p role="alert" className="mt-3 rounded-xl border border-leak/30 bg-leak/10 px-3 py-2 text-sm text-leak">
              {upload.error.message}
            </p>
          )}
          {samples.data && samples.data.length > 0 && (
            <div className="mt-5">
              <Samples samples={samples.data} onAudited={onAudited} />
            </div>
          )}
        </GlassCard>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <GlassCard delay={0.3}>
            <SectionTitle hint="0–100, higher is riskier">Risk by audit</SectionTitle>
            {d.audits.length ? (
              <RiskByAudit audits={[...d.audits].reverse().map((a) => ({ name: `#${a.id}`, score: a.risk_score, band: a.risk_band }))} />
            ) : (
              <p className="text-sm text-muted">No audits yet.</p>
            )}
          </GlassCard>
          <GlassCard delay={0.35}>
            <SectionTitle hint={`${d.audits.length} total`}>Recent audits</SectionTitle>
            <ul className="space-y-2">
              {d.audits.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/audits/${a.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 transition hover:border-accent/30 hover:bg-white/[0.04]"
                  >
                    <span className="num text-xs text-muted">#{a.id}</span>
                    <span className="min-w-0 flex-1 basis-36 truncate font-mono text-sm text-white">{a.dataset_name}</span>
                    <span className="text-xs text-muted">
                      <Users className="mr-1 inline size-3" aria-hidden />
                      {fmtInt(a.decisions)}
                    </span>
                    {a.recalled > 0 && <span className="text-xs text-memory">{a.recalled} recalled</span>}
                    <span className="text-xs text-muted">{fmtDate(a.created_at)}</span>
                    <BandBadge band={a.risk_band}>{a.risk_score.toFixed(0)}</BandBadge>
                  </Link>
                </li>
              ))}
              {d.audits.length === 0 && <li className="text-sm text-muted">Nothing audited yet.</li>}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  )
}
