/**
 * Bundle entry point.
 *
 * Mounts the shell. The grain overlay and the scrollbar rules live in the
 * global stylesheet, so there is nothing to wire here beyond React itself.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
