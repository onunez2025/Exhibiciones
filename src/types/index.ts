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
