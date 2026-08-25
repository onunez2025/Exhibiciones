// Algunos paneles (EasyPanel/Docker Compose env_file, entre otros) no despojan
// comillas envolventes de los valores como sí hace `dotenv` — un valor pegado
// como DB_PASSWORD="algo" puede llegar a process.env literalmente con las
// comillas incluidas. Esto limpia una sola capa de comillas (simples o
// dobles) que envuelvan todo el valor, y recorta espacios.
export function cleanEnv(name: string): string {
    let v = (process.env[name] || '').trim();
    if (v.length >= 2) {
        const first = v[0];
        const last = v[v.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            v = v.slice(1, -1);
        }
    }
    return v;
}

export function safeError(err: unknown): string {
    if (process.env.NODE_ENV !== 'production') {
        if (err instanceof Error) return err.message;
        return String(err);
    }
    return 'Internal server error';
}

export function sanitizeLog(val: unknown, maxLen = 200): string {
    const s = String(val ?? '').replace(/[\x00-\x1F\x7F]/g, '?');
    return s.length > maxLen ? s.substring(0, maxLen) + '…' : s;
}
