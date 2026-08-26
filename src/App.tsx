import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { DialogProvider } from './context/DialogContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { PerfilPage } from './pages/PerfilPage.js';
import { ComingSoonPage } from './pages/ComingSoonPage.js';
import { Image, ListChecks, Ticket, Info } from 'lucide-react';
// TODO (sub-proyectos futuros): importa tus páginas de módulo aquí

export default function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <DialogProvider>
                        <BrowserRouter>
                            <Routes>
                                <Route path="/login" element={<LoginPage />} />
                                <Route element={<MainLayout />}>
                                    <Route index element={<Navigate to="/dashboard" replace />} />
                                    <Route path="/dashboard" element={<DashboardPage />} />
                                    <Route path="/perfil" element={<PerfilPage />} />
                                    <Route path="/exhibiciones" element={<ComingSoonPage titleKey="nav.exhibiciones" icon={Image} />} />
                                    <Route path="/checklist" element={<ComingSoonPage titleKey="nav.checklist" icon={ListChecks} />} />
                                    <Route path="/tickets" element={<ComingSoonPage titleKey="nav.tickets" icon={Ticket} />} />
                                    <Route path="/informacion" element={<ComingSoonPage titleKey="nav.informacion" icon={Info} />} />
                                    {/* TODO: agrega tus rutas de módulo real aquí */}
                                </Route>
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                        </BrowserRouter>
                    </DialogProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}
