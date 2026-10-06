import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@cometchat/chat-uikit-react/styles'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
