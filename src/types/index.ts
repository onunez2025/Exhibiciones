export interface User {
    id: number;
    username: string;
    full_name: string;
    email?: string;
    celular?: string;
    zona?: string;
    role_id: number | null;
    role_name: string;
    is_active?: boolean;
    avatar_url?: string;
    permissions: string[];
}

export interface Exhibicion {
    id: number;
    nroExhibicion: string;
    nombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    tipoNombre: string | null;
    ubicacionNombre: string | null;
    estadoId: 1 | 2;
    fechaCrea: string;
}

export interface ExhibicionesListResponse {
    items: Exhibicion[];
    total: number;
    page: number;
    pageSize: number;
}

export interface FiltroOpcion {
    id: number;
    nombre: string;
}

export interface ExhibicionesFiltroOpciones {
    tipos: FiltroOpcion[];
    ubicaciones: FiltroOpcion[];
}

export interface ExhibicionesFiltros {
    tipo?: number;
    estado?: 1 | 2;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface ExhibicionComponenteItem {
    id: number;
    nombre: string | null;
    cantidad: number;
}

export interface ExhibicionComponentesAgrupados {
    carcasas: ExhibicionComponenteItem[];
    productos: ExhibicionComponenteItem[];
}

export interface ExhibicionFoto {
    id: number;
    url: string;
    esFotoPrincipal: boolean;
}

export interface ExhibicionDetalle {
    id: number;
    nroExhibicion: string;
    nombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    piso: string | null;
    tipoNombre: string | null;
    pisoDetalleNombre: string | null;
    estadoId: 1 | 2;
    fechaCrea: string;
    canAprobar: boolean;
    componentes: ExhibicionComponentesAgrupados;
    fotos: ExhibicionFoto[];
}

export interface AprobarExhibicionResponse {
    estadoId: 1 | 2;
}

export interface TiendaOpcion {
    clienteCodigo: string;
    clienteNombre: string;
    sucursalCodigo: string;
    sucursalNombre: string;
    direccion: string | null;
}

export interface ExhibicionesOpcionesCrear {
    tiendas: TiendaOpcion[];
    tipos: FiltroOpcion[];
    pisoDetalles: FiltroOpcion[];
}

export interface CrearExhibicionInput {
    clienteCodigo: string;
    clienteNombre: string;
    sucursalCodigo: string;
    sucursalNombre: string;
    direccion: string | null;
    nombre: string;
    tipoId: number;
    piso: string | null;
    pisoDetalleId: number | null;
}

export interface CrearExhibicionResponse {
    id: number;
    nroExhibicion: string;
}

export interface ComponenteCatalogoItem {
    codigo: string;
    nombre: string;
}

export interface CatalogoComponentesResponse {
    productos: ComponenteCatalogoItem[];
    carcasas: ComponenteCatalogoItem[];
}

export interface AgregarComponenteInput {
    tipo: 1 | 2;
    codigoProducto: string;
    cantidad: number;
}

export interface AgregarFotoInput {
    archivoBase64: string;
    contentType: string;
    esFotoPrincipal: boolean;
}

export interface ChecklistCatalogoItem {
    visualCodigo: string;
    nombre: string;
}

export interface ChecklistCatalogoCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistCatalogoItem[];
}

export interface ChecklistCatalogoResponse {
    categorias: ChecklistCatalogoCategoria[];
}

export interface ChecklistItemInput {
    visualCodigo: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface CrearChecklistInput {
    items: ChecklistItemInput[];
}

export interface CrearChecklistResponse {
    id: number;
    checklistNumber: number;
}

export interface TipoTicketOpcion {
    id: number;
    codigo: string;
    nombre: string;
}

export interface TiposTicketResponse {
    tipos: TipoTicketOpcion[];
}

export interface TicketComponenteInput {
    componenteId: number;
    cantidad: number;
}

export interface CrearTicketInput {
    tipoId: number;
    motivo: string;
    componentes: TicketComponenteInput[];
}

export interface CrearTicketResponse {
    numero: string;
}

export interface AgregarFotoTicketInput {
    archivoBase64: string;
    contentType: string;
}

export interface TicketFoto {
    id: number;
    url: string;
}

export interface ChecklistListItem {
    id: number;
    checklistNumber: number;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    estadoId: number;
    conforme: boolean;
    fechaCrea: string;
}

export interface ChecklistsListResponse {
    items: ChecklistListItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ChecklistsFiltros {
    conforme?: 'si' | 'no';
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface ChecklistDetalleItem {
    visualCodigo: string;
    nombre: string;
    desconforme: boolean;
    motivo: string | null;
}

export interface ChecklistDetalleCategoria {
    tipoId: number;
    tipoNombre: string;
    items: ChecklistDetalleItem[];
}

export interface ChecklistDetalle {
    id: number;
    checklistNumber: number;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    estadoId: number;
    conforme: boolean;
    fechaCrea: string;
    categorias: ChecklistDetalleCategoria[];
}

export interface AtenderChecklistResponse {
    estadoId: 2;
}

export interface AnularChecklistResponse {
    estadoId: 0;
}

export interface TicketListItem {
    numero: string;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    tipoId: number;
    tipoNombre: string;
    motivo: string;
    estadoCodigo: string;
    estadoNombre: string;
    usuarioCrea: string;
    fechaCrea: string;
}

export interface TicketsListResponse {
    items: TicketListItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface TicketsFiltros {
    estado?: string;
    tipoId?: number;
    tienda?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface TicketDetalleComponente {
    id: number;
    codigo: string;
    nombre: string;
    cantidad: number;
}

export interface TicketDetalleFoto {
    id: number;
    url: string;
    fechaCrea: string;
}

export interface TicketDetalle {
    numero: string;
    exhibicionId: number;
    exhibicionNroExhibicion: string;
    exhibicionNombre: string;
    clienteNombre: string;
    sucursalNombre: string;
    tipoId: number;
    tipoNombre: string;
    motivo: string;
    estadoCodigo: string;
    estadoNombre: string;
    usuarioCrea: string;
    fechaCrea: string;
    componentes: TicketDetalleComponente[];
    fotos: TicketDetalleFoto[];
}

export interface AtenderTicketResponse {
    estadoCodigo: '05';
    estadoNombre: string;
}

export interface AnularTicketResponse {
    estadoCodigo: '00';
}

