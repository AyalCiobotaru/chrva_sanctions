import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { empty, json } from './routes/http.mjs';
import { handleProtectedRoutes } from './routes/protected-routes.mjs';
import { handlePublicRoutes } from './routes/public-routes.mjs';
import { handleSanctionRequestRoutes } from './routes/sanction-request-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

export async function handleApiRequest(request, response) {
  try {
    if (request.method === 'OPTIONS') {
      return empty(response, 204);
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const route = `${request.method} ${url.pathname}`;
    const context = { appRoot, request, response, route, url };

    if (await handlePublicRoutes(context)) {
      return;
    }

    if (await handleSanctionRequestRoutes(context)) {
      return;
    }

    if (await handleProtectedRoutes(context)) {
      return;
    }

    return json(response, { error: 'Not found' }, 404);
  } catch (error) {
    const status = error.statusCode ?? (error.code === 'ELOGIN' || error.code === 'ESOCKET' ? 503 : 500);
    console.error(`[${new Date().toISOString()}] ${request.method} ${request.url} failed`, {
      code: error.code,
      message: error.message
    });
    return json(response, {
      error: status === 503 ? 'Database unavailable' : [400, 401, 403, 404, 409].includes(status) ? error.message : 'Internal server error',
      code: error.code ?? 'ERR_INTERNAL',
      message: error.message
    }, status);
  }
}
