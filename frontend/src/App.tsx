import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Compass } from 'lucide-react'
import { lazy } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { isTransientStatus } from './api/client'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'

// Pages are split so the charting library only loads where it is used.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const AuditResultsRoute = lazy(() => import('./pages/AuditResults').then((m) => ({ default: m.AuditResultsRoute })))
const ReplayRoute = lazy(() => import('./pages/Replay').then((m) => ({ default: m.ReplayRoute })))
const Memory = lazy(() => import('./pages/Memory').then((m) => ({ default: m.Memory })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10_000,
      // Network and gateway errors are retried so a sleeping free-tier backend can wake up;
      // HTTP errors such as 404 are real answers and are not retried.
      retry: (count, err) => isTransientStatus((err as { status?: number }).status) && count < 6,
      retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 15_000),
    },
  },
})

function NotFound() {
  return (
    <EmptyState icon={<Compass className="size-5" />} title="Page not found" action={<Link to="/" className="btn btn-primary">Go to dashboard</Link>}>
      This page does not exist.
    </EmptyState>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="audits" element={<AuditResultsRoute />} />
            <Route path="audits/:id" element={<AuditResultsRoute />} />
            <Route path="audits/:id/replay" element={<ReplayRoute />} />
            <Route path="replay" element={<ReplayRoute />} />
            <Route path="memory" element={<Memory />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
