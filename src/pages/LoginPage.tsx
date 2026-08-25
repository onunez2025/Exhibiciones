import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../services/apiClient.js';
import type { User as AppUser } from '../types/index.js';

interface LoginResponse {
    user: AppUser;
    token: string;
}

export function LoginPage() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await apiClient.post<LoginResponse>('/auth/login', { username, password });
            login(data.token, data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('auth.error_generic'));
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => (
        <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label htmlFor="username" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                    {t('auth.username')}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                        <User className="w-[18px] h-[18px]" />
                    </div>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('auth.username_placeholder')}
                        autoComplete="username"
                        required
                        autoFocus
                        className="block w-full pl-11 pr-3 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium placeholder:text-cb-neutral/50"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="password" className="block text-xs font-bold text-cb-text-secondary uppercase tracking-wider mb-2 ml-0.5">
                    {t('auth.password')}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                        <Lock className="w-[18px] h-[18px]" />
                    </div>
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.password_placeholder')}
                        autoComplete="current-password"
                        required
                        className="block w-full pl-11 pr-11 py-3 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-4 focus:ring-primary/12 focus:border-primary transition-all outline-none text-sm font-medium placeholder:text-cb-neutral/50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-cb-neutral hover:text-primary transition-colors cursor-pointer"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : t('auth.login_button')}
            </button>
        </form>
    );

    return (
        <div className="min-h-dvh flex flex-col md:flex-row bg-[#F7F8FA] dark:bg-[#050B14]">
            {/* ═══ MOBILE (<768px) ═══ */}
            <div className="flex flex-col md:hidden min-h-dvh w-full">
                <div className="relative bg-primary overflow-hidden shrink-0 pb-12 pt-10 min-h-[38dvh]">
                    <div className="absolute -top-14 -right-10 w-52 h-52 rounded-full bg-white/8 pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl mb-5">
                            <span className="text-primary font-black text-2xl tracking-tighter">S</span>
                        </div>
                        <h1 className="text-white text-2xl font-bold tracking-tight">Grupo Sole</h1>
                        <p className="text-white/75 text-sm mt-1.5 max-w-[240px]">{t('auth.subtitle')}</p>
                    </div>
                    <svg className="absolute bottom-0 left-0 w-full h-12" viewBox="0 0 375 48" preserveAspectRatio="none">
                        <path d="M0,24 C90,52 285,-4 375,20 L375,48 L0,48 Z" fill="currentColor" className="text-[#F7F8FA] dark:text-[#050B14]" />
                    </svg>
                </div>
                <div className="flex-1 flex flex-col justify-center px-6 py-8">
                    <div className="max-w-sm mx-auto w-full">{renderForm()}</div>
                </div>
            </div>

            {/* ═══ DESKTOP (≥768px) ═══ */}
            <div className="hidden md:flex md:flex-row w-full">
                <div className="hidden md:flex flex-col justify-between w-1/2 bg-primary text-white p-12 lg:p-16 relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/6 pointer-events-none" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0">
                            <span className="text-primary font-black text-lg tracking-tighter">S</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">Grupo Sole</span>
                    </div>
                    <div className="relative z-10 max-w-md">
                        <h1 className="text-4xl lg:text-5xl font-bold mb-5 leading-[1.15] text-wrap-balance">
                            Plataforma de<br />Gestión de<br />Exhibiciones
                        </h1>
                        <p className="text-white/75 text-base leading-relaxed">
                            Registro, seguimiento y control de exhibidores, checklists de visita y requerimientos en punto de venta.
                        </p>
                    </div>
                    <div className="relative z-10 text-xs text-white/50 font-medium">
                        © {new Date().getFullYear()} Grupo Sole Rinnai Corporation. Todos los derechos reservados.
                    </div>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 bg-[#F7F8FA] dark:bg-[#050B14] relative">
                    <div className="w-full max-w-[380px] space-y-8">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold tracking-tight text-cb-text-primary">{t('auth.title')}</h2>
                            <p className="mt-1.5 text-sm text-cb-text-secondary">{t('auth.subtitle')}</p>
                        </div>
                        <div className="bg-card border border-cb-border rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none p-8">
                            {renderForm()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
