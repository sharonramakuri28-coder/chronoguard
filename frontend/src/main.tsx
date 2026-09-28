import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="p-8 text-white bg-slate-950">ChronoGuard</div>
  </StrictMode>,
)
