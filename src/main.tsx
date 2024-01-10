import React from 'react'
import ReactDOM from 'react-dom/client'
import { NextUIProvider } from '@nextui-org/react'
import { CmdKConfigurer } from "@cmdk/react-ui-toolkit"
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CmdKConfigurer
      token={import.meta.env.VITE_CMDK_TOKEN as string}
    >
      <NextUIProvider>
        <App />
      </NextUIProvider>
    </CmdKConfigurer>
  </React.StrictMode>,
)
