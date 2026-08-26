import sql from 'mssql';
import { cleanEnv } from './lib/security.js';

// Perezosa (dentro de la función, no a nivel de módulo) — en ESM los
// `import` se hoistean y se evalúan antes que `dotenv.config()` (statement,
// no import) en server/index.ts. Si esto se construyera al cargar el
// módulo, process.env.DB_* aún estaría vacío en desarrollo local con `tsx`.
export function buildConfig(): sql.config {
    return {
        server: cleanEnv('DB_SERVER'),
        database: cleanEnv('DB_NAME'),
        user: cleanEnv('DB_USER'),
        password: cleanEnv('DB_PASSWORD'),
        options: {
            encrypt: true,
            trustServerCertificate: false,
            connectTimeout: 30000,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
}

let pool: sql.ConnectionPool | null = null;

export async function getDbConnection(): Promise<sql.ConnectionPool> {
    if (pool && pool.connected) return pool;
    pool = await sql.connect(buildConfig());
    return pool;
}
