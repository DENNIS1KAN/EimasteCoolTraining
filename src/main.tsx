import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './app/App'
import { applyTheme } from './app/theme'
import { readConfig } from './config'
import { createBackend } from './data/backend'
import { boot } from './data/store'
import { getLang } from './i18n'
// Registers the beforeinstallprompt listener before the browser fires it (Settings offers an Install button).
import './features/auth/install'

applyTheme()
document.documentElement.lang = getLang()
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void createBackend(readConfig()).then(({ backend, namespace }) => boot(backend, namespace))
