import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, RefreshCw, Loader2, UserX } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';
import { cn } from '../utils/cn.js';
import { MobileMenuButton } from '../components/layout/MobileMenuButton.js';
import { StatusTabs, type StatusTabOption } from '../components/common/StatusTabs.js';
import { Pagination } from '../components/exhibiciones/Pagination.js';
import { UsuarioCard } from '../components/seguridad/UsuarioCard.js';
import { UsuarioModal } from '../components/seguridad/UsuarioModal.js';
import { PasswordModal } from '../components/seguridad/PasswordModal.js';
import { MatrizPermisos } from '../components/seguridad/MatrizPermisos.js';
import type {
    UsuarioListItem,
    UsuariosListResponse,
    UsuarioCrearPayload,
    UsuarioEditarPayload,
    RolItem,
    PermisoItem,
} from '../types/index.js';

type SeguridadTab = 'usuarios' | 'roles';
const DEFAULT_PAGE_SIZE = 20;

export function SeguridadPage() {
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const [activeTab, setActiveTab] = useState<SeguridadTab>('usuarios');

    // Estado Usuarios
    const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
    const [totalUsuarios, setTotalUsuarios] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filtroRolId, setFiltroRolId] = useState<number | undefined>(undefined);
    const [filtroActivo, setFiltroActivo] = useState<string>('todos');
    const [loadingUsuarios, setLoadingUsuarios] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [error, setError] = useState('');

    // Catálogos
    const [roles, setRoles] = useState<RolItem[]>([]);
    const [permisos, setPermisos] = useState<PermisoItem[]>([]);
    const [loadingCatalogos, setLoadingCatalogos] = useState(false);

    // Modales
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [usuarioToEdit, setUsuarioToEdit] = useState<UsuarioListItem | null>(null);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [usuarioForPassword, setUsuarioForPassword] = useState<UsuarioListItem | null>(null);

    // Debounce búsqueda
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Cargar Catálogos (Roles y Permisos)
    const loadCatalogos = useCallback(async () => {
        setLoadingCatalogos(true);
        try {
            const [rolesData, permisosData] = await Promise.all([
                apiClient.get<RolItem[]>('/roles'),
                apiClient.get<PermisoItem[]>('/roles/catalogo/permisos'),
            ]);
            setRoles(rolesData || []);
            setPermisos(permisosData || []);
        } catch (err) {
            console.error('[Seguridad] Error cargando catálogos:', err);
        } finally {
            setLoadingCatalogos(false);
        }
    }, []);

    useEffect(() => {
        loadCatalogos();
    }, [loadCatalogos]);

    // Cargar Usuarios
    const requestSeq = useRef(0);
    const fetchUsuarios = useCallback(async (pageToLoad: number, append: boolean) => {
        const seq = ++requestSeq.current;
        if (append) {
            setLoadingMore(true);
            setLoadMoreError(false);
        } else {
            setLoadingUsuarios(true);
            setError('');
        }

        try {
            const params = new URLSearchParams();
            params.set('page', String(pageToLoad));
            params.set('pageSize', String(pageSize));
            if (search) params.set('search', search);
            if (filtroRolId) params.set('rolId', String(filtroRolId));
            if (filtroActivo === 'activos') params.set('activo', 'true');
            else if (filtroActivo === 'inactivos') params.set('activo', 'false');

            const data = await apiClient.get<UsuariosListResponse>(`/usuarios?${params.toString()}`);
            if (seq !== requestSeq.current) return;
            setTotalUsuarios(data.total);
            setPage(data.page);
            setUsuarios(prev => (append ? [...prev, ...data.items] : data.items));
        } catch (err) {
            if (seq !== requestSeq.current) return;
            console.error('[Seguridad] Error fetch usuarios:', err);
            if (append) setLoadMoreError(true);
            else setError('No se pudo cargar la lista de usuarios.');
        } finally {
            if (seq === requestSeq.current) {
                if (append) setLoadingMore(false);
                else setLoadingUsuarios(false);
            }
        }
    }, [pageSize, search, filtroRolId, filtroActivo]);

    useEffect(() => {
        setUsuarios([]);
        setLoadMoreError(false);
        fetchUsuarios(1, false);
    }, [search, filtroRolId, filtroActivo, pageSize, isDesktop, fetchUsuarios]);

    // Scroll infinito en mobile
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (isDesktop || loadMoreError || loadingMore) return;
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            entries => {
                const first = entries[0];
                if (first.isIntersecting && usuarios.length < totalUsuarios && !loadingUsuarios) {
                    fetchUsuarios(page + 1, true);
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [isDesktop, loadMoreError, loadingMore, usuarios.length, totalUsuarios, loadingUsuarios, page, fetchUsuarios]);

    // Handlers de Acciones
    const handleOpenCreate = () => {
        setUsuarioToEdit(null);
        setUserModalOpen(true);
    };

    const handleOpenEdit = (user: UsuarioListItem) => {
        setUsuarioToEdit(user);
        setUserModalOpen(true);
    };

    const handleOpenPassword = (user: UsuarioListItem) => {
        setUsuarioForPassword(user);
        setPasswordModalOpen(true);
    };

    const handleSaveUser = async (payload: UsuarioCrearPayload | UsuarioEditarPayload, isEdit: boolean) => {
        if (isEdit && usuarioToEdit) {
            await apiClient.put(`/usuarios/${usuarioToEdit.id}`, payload);
        } else {
            await apiClient.post('/usuarios', payload);
        }
        fetchUsuarios(1, false);
        loadCatalogos();
    };

    const handleResetPassword = async (userId: number, newPass: string) => {
        await apiClient.put(`/usuarios/${userId}/password`, { newPassword: newPass });
    };

    const handleToggleActivo = async (user: UsuarioListItem) => {
        try {
            await apiClient.patch(`/usuarios/${user.id}/toggle-activo`);
            setUsuarios(prev =>
                prev.map(u => (u.id === user.id ? { ...u, activo: !u.activo } : u))
            );
        } catch (err) {
            console.error('[Seguridad] Error toggle activo:', err);
        }
    };

    const tabs: StatusTabOption<SeguridadTab>[] = [
        { id: 'usuarios', label: 'Gestión de Usuarios', badgeCount: totalUsuarios },
        { id: 'roles', label: 'Roles y Permisos (RBAC)' },
    ];

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            {/* Header */}
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="flex items-center gap-2">
                    <MobileMenuButton />
                    <div>
                        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>Seguridad y Accesos</h1>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>
                            Gestión de usuarios, roles de sistema y matriz de permisos RBAC
                        </p>
                    </div>
                </div>
            </div>

            {/* Contenedor Principal */}
            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>
                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-cb-bg">
                    {/* Pestañas Rápidas */}
                    <StatusTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

                    {/* ============================================================ */}
                    {/* PESTAÑA 1: GESTIÓN DE USUARIOS                               */}
                    {/* ============================================================ */}
                    {activeTab === 'usuarios' && (
                        <div className="space-y-4">
                            {/* Barra de Búsqueda y Filtros */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={e => setSearchInput(e.target.value)}
                                        placeholder="Buscar por usuario, nombre o correo..."
                                        className="block w-full pl-10 pr-3 py-2 bg-card text-cb-text-primary border border-cb-border rounded-xl focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none text-xs"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Selector de Rol */}
                                    <select
                                        value={filtroRolId ?? ''}
                                        onChange={e => setFiltroRolId(e.target.value ? Number(e.target.value) : undefined)}
                                        className="px-3 py-2 bg-card border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none cursor-pointer"
                                    >
                                        <option value="">Todos los roles</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.nombre}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Selector de Estado */}
                                    <select
                                        value={filtroActivo}
                                        onChange={e => setFiltroActivo(e.target.value)}
                                        className="px-3 py-2 bg-card border border-cb-border rounded-xl text-xs text-cb-text-primary outline-none cursor-pointer"
                                    >
                                        <option value="todos">Todos los estados</option>
                                        <option value="activos">Activos</option>
                                        <option value="inactivos">Inactivos</option>
                                    </select>

                                    {/* Botón Refrescar */}
                                    <button
                                        type="button"
                                        onClick={() => fetchUsuarios(1, false)}
                                        title="Refrescar lista"
                                        className="p-2 bg-card border border-cb-border text-cb-text-secondary hover:text-primary rounded-xl transition-colors cursor-pointer"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>

                                    {/* Botón Nuevo Usuario */}
                                    <button
                                        type="button"
                                        onClick={handleOpenCreate}
                                        className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'cursor-pointer text-xs flex items-center gap-1.5 shrink-0')}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Nuevo Usuario
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Usuarios */}
                            {loadingUsuarios ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-2 text-cb-text-secondary">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    <span className="text-xs">Cargando usuarios...</span>
                                </div>
                            ) : error ? (
                                <div className="py-12 text-center text-red-600 text-xs font-semibold">
                                    {error}
                                </div>
                            ) : usuarios.length === 0 ? (
                                <div className="py-16 text-center text-cb-text-secondary text-xs">
                                    <UserX className="w-8 h-8 mx-auto mb-2 text-cb-neutral opacity-50" />
                                    No se encontraron usuarios con los filtros seleccionados.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {usuarios.map(u => (
                                        <UsuarioCard
                                            key={u.id}
                                            usuario={u}
                                            onEdit={handleOpenEdit}
                                            onChangePassword={handleOpenPassword}
                                            onToggleActivo={handleToggleActivo}
                                        />
                                    ))}

                                    {/* Paginación Desktop */}
                                    {isDesktop && (
                                        <Pagination
                                            page={page}
                                            pageSize={pageSize}
                                            total={totalUsuarios}
                                            onPageChange={p => fetchUsuarios(p, false)}
                                            onPageSizeChange={s => setPageSize(s)}
                                        />
                                    )}

                                    {/* Sentinel Mobile Scroll */}
                                    {!isDesktop && (
                                        <div ref={sentinelRef} className="py-3 text-center">
                                            {loadingMore && <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />}
                                            {loadMoreError && (
                                                <button
                                                    type="button"
                                                    onClick={() => fetchUsuarios(page + 1, true)}
                                                    className="text-xs text-primary font-semibold hover:underline"
                                                >
                                                    Error al cargar más. Toca aquí para reintentar.
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* PESTAÑA 2: MATRIZ DE ROLES Y PERMISOS (RBAC)                 */}
                    {/* ============================================================ */}
                    {activeTab === 'roles' && (
                        <div>
                            {loadingCatalogos ? (
                                <div className="py-16 flex flex-col items-center justify-center gap-2 text-cb-text-secondary">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    <span className="text-xs">Cargando configuración RBAC...</span>
                                </div>
                            ) : (
                                <MatrizPermisos roles={roles} permisos={permisos} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modales */}
            <UsuarioModal
                isOpen={userModalOpen}
                onClose={() => setUserModalOpen(false)}
                onSave={handleSaveUser}
                usuarioToEdit={usuarioToEdit}
                roles={roles}
            />

            <PasswordModal
                isOpen={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
                onResetPassword={handleResetPassword}
                usuario={usuarioForPassword}
            />
        </div>
    );
}

export default SeguridadPage;
