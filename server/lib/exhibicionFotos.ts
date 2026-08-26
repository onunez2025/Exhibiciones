// Arma la URL pública de una foto de exhibición en Azure Blob Storage. Puro
// — sin red — para poder probarlo aislado. Verificado en vivo contra el
// storage real: cuenta soleblob1, contenedor "exhibiciones" (no
// "exhibicionesv2", que también existe pero es otro contenedor), blobs
// planos en la raíz nombrados exactamente por VC_archivo_nombre.
export function buildFotoUrl(containerUrl: string, sasToken: string, archivoNombre: string): string {
    const base = containerUrl.replace(/\/+$/, '');
    const sas = sasToken.replace(/^\?/, '');
    const nombreCodificado = encodeURIComponent(archivoNombre);
    return sas ? `${base}/${nombreCodificado}?${sas}` : `${base}/${nombreCodificado}`;
}
