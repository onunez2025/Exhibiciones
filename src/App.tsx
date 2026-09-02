import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.js';
import { DialogProvider } from './context/DialogContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { PerfilPage } from './pages/PerfilPage.js';
import { ExhibicionesPage } from './pages/ExhibicionesPage.js';
import { ExhibicionDetallePage } from './pages/ExhibicionDetallePage.js';
import { ExhibicionCrearPage } from './pages/ExhibicionCrearPage.js';
import { ChecklistCrearPage } from './pages/ChecklistCrearPage.js';
import { TicketCrearPage } from './pages/TicketCrearPage.js';
import { ChecklistsPage } from './pages/ChecklistsPage.js';
import { ChecklistDetallePage } from './pages/ChecklistDetallePage.js';
import { TicketsPage } from './pages/TicketsPage.js';
import { TicketDetallePage } from './pages/TicketDetallePage.js';
import { InformacionPage } from './pages/InformacionPage.js';

export default function App() {
    return (
        <ErrorBoundary>
            {/* BrowserRouter envuelve a AuthProvider (y no al revés) para que
                login()/logout() puedan navegar vía SPA (useNavigate) en vez
                de recargar la página entera — eso es lo que hace posible
                animar la transición de salida al cerrar sesión. */}
            <BrowserRouter>
                <AuthProvider>
                    <DialogProvider>
                        <Routes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route element={<MainLayout />}>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="/dashboard" element={<DashboardPage />} />
                                <Route path="/perfil" element={<PerfilPage />} />
                                <Route path="/exhibiciones" element={<ExhibicionesPage />} />
                                <Route path="/exhibiciones/nueva" element={<ExhibicionCrearPage />} />
                                <Route path="/exhibiciones/:id" element={<ExhibicionDetallePage />} />
                                <Route path="/exhibiciones/:id/checklist/nueva" element={<ChecklistCrearPage />} />
                                <Route path="/exhibiciones/:id/tickets/nuevo" element={<TicketCrearPage />} />
                                <Route path="/checklist" element={<ChecklistsPage />} />
                                <Route path="/checklist/:id" element={<ChecklistDetallePage />} />
                                <Route path="/tickets" element={<TicketsPage />} />
                                <Route path="/tickets/:numero" element={<TicketDetallePage />} />
                                <Route path="/informacion" element={<InformacionPage />} />
                                {/* TODO: agrega tus rutas de módulo real aquí */}
                            </Route>
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </DialogProvider>
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}
