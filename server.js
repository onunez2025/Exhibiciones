import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(__dirname);

// If port passed in argv, assign to ASPNETCORE_PORT and PORT
if (process.argv[2] && /^\d+$/.test(process.argv[2])) {
  process.env.ASPNETCORE_PORT = process.argv[2];
  process.env.PORT = process.argv[2];
}

const require = createRequire(import.meta.url);

process.env.NODE_PATH = [
  path.join(__dirname, 'node_modules'),
  'C:\\home\\site\\wwwroot\\node_modules',
  'D:\\home\\site\\wwwroot\\node_modules'
].join(path.delimiter);

require('module').Module._initPaths();

console.log('[STARTUP] Starting server from:', __dirname, 'PORT:', process.env.ASPNETCORE_PORT || process.env.PORT);

import('./server/index.js').catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
