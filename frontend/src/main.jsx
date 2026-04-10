import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#131d35',
            color: '#e2e8f0',
            border: '1px solid #1e2d4d',
            borderRadius: '10px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#131d35' } },
          error:   { iconTheme: { primary: '#f43f5e', secondary: '#131d35' } },
        }}
      />
    </AuthProvider>
  </StrictMode>,
)
