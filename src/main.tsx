import React from 'react'
import ReactDOM from 'react-dom/client'
import { NextUIProvider } from '@nextui-org/react'
// import { CmdKConfigurer } from "@cmdk/react-ui-toolkit"
import App from "./App";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './index.css'
import { Toaster } from './components/ui/toaster';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>


      <NextUIProvider>

        <Toaster />
        <Router>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="*" element={<>
              <h1>404</h1>
              <p>Page not found</p>
            </>} />
          </Routes>
        </Router>
      </NextUIProvider>
  </React.StrictMode>,
)
