import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// HMR: accept updates without re-executing the module (prevents duplicate createRoot)
if (import.meta.hot) {
  import.meta.hot.accept(() => {})
  import.meta.hot.dispose(() => {
    // Cleanup handled by React's effect cleanup in App.tsx
  })
}
