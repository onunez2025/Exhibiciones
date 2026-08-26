import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { DialogProvider } from './context/DialogContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
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
                                    {/* TODO: agrega tus rutas de módulo aquí */}
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
