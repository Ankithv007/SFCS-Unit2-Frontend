import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/index.css'
import { router } from './routes'

import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast'
import { SmtAuthProvider } from './context/SmtAuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SmtAuthProvider>
          <RouterProvider router={router} />
        </SmtAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
