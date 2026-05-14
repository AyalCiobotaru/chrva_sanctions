import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppConfig, searchClubs, searchCoordinators, searchTournaments } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mirrorRoot = join(__dirname, '..', '..');
const port = Number(process.env.PORT ?? 4300);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const route = `${request.method} ${url.pathname}`;

    if (route === 'GET /api/health') {
      return json(response, { ok: true });
    }

    if (route === 'GET /api/config') {
      return json(response, getAppConfig());
    }

    if (route === 'GET /api/clubs') {
      return json(response, await searchClubs(url.searchParams));
    }

    if (route === 'GET /api/coordinators') {
      return json(response, await searchCoordinators(url.searchParams));
    }

    if (route === 'GET /api/tournaments') {
      return json(response, await searchTournaments(url.searchParams));
    }

    if (route === 'GET /api/migration/inventory') {
      return json(response, await migrationInventory());
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    const status = error.code === 'ELOGIN' || error.code === 'ESOCKET' ? 503 : 500;
    console.error(`[${new Date().toISOString()}] ${request.method} ${request.url} failed`, {
      code: error.code,
      message: error.message
    });
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      error: status === 503 ? 'Database unavailable' : 'Internal server error',
      code: error.code ?? 'ERR_INTERNAL',
      message: error.message
    }));
  }
}).listen(port, () => {
  console.log(`CHRVA migration API listening at http://localhost:${port}`);
});

async function migrationInventory() {
  const path = join(mirrorRoot, '.migration', 'cfml-route-inventory.json');
  const routes = JSON.parse(await readFile(path, 'utf8'));
  const groups = new Map();

  for (const route of routes) {
    const current = groups.get(route.featureArea) ?? {
      featureArea: route.featureArea,
      files: 0,
      hasQuery: 0,
      hasWrite: 0,
      hasMail: 0,
      hasSession: 0
    };
    current.files += 1;
    current.hasQuery += route.hasQuery ? 1 : 0;
    current.hasWrite += route.hasInsert || route.hasUpdate || route.hasDelete ? 1 : 0;
    current.hasMail += route.hasMail ? 1 : 0;
    current.hasSession += route.hasSession ? 1 : 0;
    groups.set(route.featureArea, current);
  }

  return {
    routes: routes.length,
    features: [...groups.values()].sort((a, b) => b.files - a.files)
  };
}

function json(response, body) {
  response.writeHead(200, {
    'access-control-allow-origin': '*',
    'content-type': 'application/json'
  });
  response.end(JSON.stringify(body, null, 2));
}
