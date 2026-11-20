import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

// Fontes servidas pelo próprio site (sem CDN externo: CSP mais fechada, SEC-100).
import '@fontsource/special-elite/400.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/400-italic.css';
import '@fontsource/courier-prime/700.css';
import '@fontsource/homemade-apple/400.css';
import 'leaflet/dist/leaflet.css';
import './styles.css';

import { AuthProvider, RequireAuth } from './lib/auth.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Layout } from './components/Layout.jsx';
import { NotFound } from './components/States.jsx';
import Home from './pages/Home.jsx';
import Cases from './pages/Cases.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import Report from './pages/Report.jsx';
import Auth from './pages/Auth.jsx';
import MyCases from './pages/MyCases.jsx';
import Ranking from './pages/Ranking.jsx';
import Moderation from './pages/Moderation.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="casos" element={<Cases />} />
              <Route path="casos/:id" element={<CaseDetail />} />
              <Route path="ranking" element={<Ranking />} />
              <Route path="entrar" element={<Auth mode="login" />} />
              <Route path="cadastro" element={<Auth mode="register" />} />
              <Route path="reportar" element={<RequireAuth><Report /></RequireAuth>} />
              <Route path="meus-casos" element={<RequireAuth><MyCases /></RequireAuth>} />
              <Route path="moderacao" element={<RequireAuth role="moderador"><Moderation /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
