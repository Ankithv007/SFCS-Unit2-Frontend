import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/index.css'
import { router } from './routes'

import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast'
import { SmtAuthProvider } from './context/SmtAuthContext'
import { BackendAuthProvider } from './context/BackendAuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SmtAuthProvider>
          <BackendAuthProvider>
            <RouterProvider router={router} />
          </BackendAuthProvider>
        </SmtAuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
