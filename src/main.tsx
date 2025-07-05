import React from 'react'
import ReactDOM from 'react-dom/client'
import { NextUIProvider } from '@nextui-org/react'
// import { CmdKConfigurer } from "@cmdk/react-ui-toolkit"
import App from "./App";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './index.css'
import { Toaster } from './components/ui/toaster';
import NotFound from './components/dom/404';
import TypeSafeApi from './components/typeSafeApi';
import UserListComponent from './UserListComponent';
import Example from './example.tsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './query-client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <NextUIProvider>

        <Toaster />
        <Router>
          <Routes>
            <Route path="/" element={<Example />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </NextUIProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
