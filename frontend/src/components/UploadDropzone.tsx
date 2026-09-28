import clsx from 'clsx'
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'

export function UploadDropzone({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)

  const choose = (file: File | undefined) => {
    if (!file) return
    setPicked(file)
    onFile(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    if (!busy) choose(e.dataTransfer.files?.[0])
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={clsx(
        'relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed px-6 py-10 text-center transition',
        drag ? 'border-accent bg-accent/[0.06]' : 'border-line bg-white/[0.02] hover:border-accent/40',
      )}
    >
      {busy && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full animate-pulse bg-linear-to-b from-accent/10 to-transparent" />
      )}
      <div className="grid size-12 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <UploadCloud className="size-5" aria-hidden />}
      </div>
      <div>
        <p className="font-semibold text-white">{busy ? 'Auditing dataset…' : 'Drop a CSV to audit'}</p>
        <p className="mt-1 text-xs text-muted">
          Needs a prediction timestamp and per-feature availability timestamps. Add a target column to enable replay.
        </p>
      </div>
      {picked && (
        <p className="flex items-center gap-1.5 text-xs text-slate-300">
          <FileSpreadsheet className="size-3.5 text-accent" aria-hidden /> {picked.name}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}>
        Choose file
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Upload CSV dataset"
        onChange={(e) => {
          choose(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
