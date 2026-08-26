export interface ResolveCorsOptions {
    origin: string | undefined;
    host: string | undefined;
    nodeEnv: string | undefined;
    allowedOrigins: string; // raw ALLOWED_ORIGINS env value, comma-separated
}

// Decide si una petición debe pasar CORS. Puro — sin tocar Express — para
// poder probarlo sin levantar un servidor. El caso que rompió la vez pasada:
// el propio dominio de la app pegándole a su propia API con ALLOWED_ORIGINS
// vacío. sameOrigin se evalúa ANTES que la allowlist para que eso nunca
// vuelva a bloquear el sitio a sí mismo.
export function resolveCorsAllow(opts: ResolveCorsOptions): boolean {
    const { origin, host, nodeEnv, allowedOrigins } = opts;

    if (nodeEnv !== 'production') return true;
    if (!origin) return true;

    const sameOrigin = host ? origin === `https://${host}` : false;
    if (sameOrigin) return true;

    const allowed = allowedOrigins.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.includes(origin);
}
