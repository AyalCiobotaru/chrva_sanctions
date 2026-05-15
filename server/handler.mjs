import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createClub,
  exportClubsDirectory,
  getClubEmailBroadcast,
  getAppConfig,
  searchClubs,
  searchCoordinators,
  sendClubEmailBroadcast,
  searchTournaments,
  updateClub,
  updateTournamentAddedToAes,
  updateTournamentOkToPay
} from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

export async function handleApiRequest(request, response) {
  try {
    if (request.method === 'OPTIONS') {
      return empty(response, 204);
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
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

    if (route === 'POST /api/clubs') {
      return json(response, await createClub(await readJson(request)), 201);
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/clubs/')) {
      const clubCode = decodeURIComponent(url.pathname.slice('/api/clubs/'.length));
      return json(response, await updateClub(clubCode, await readJson(request)));
    }

    if (route === 'GET /api/clubs/export') {
      return excel(response, await exportClubsDirectory(), 'CHRVA_Club_Export.xls');
    }

    if (route === 'GET /api/clubs/email-broadcast') {
      return json(response, await getClubEmailBroadcast(url.searchParams));
    }

    if (route === 'POST /api/clubs/email-broadcast') {
      return json(response, await sendClubEmailBroadcast(await readJson(request)));
    }

    if (route === 'GET /api/coordinators') {
      return json(response, await searchCoordinators(url.searchParams));
    }

    if (route === 'GET /api/tournaments') {
      return json(response, await searchTournaments(url.searchParams));
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/tournaments/') && url.pathname.endsWith('/added-to-aes')) {
      const tournamentId = decodeURIComponent(url.pathname.slice('/api/tournaments/'.length, -'/added-to-aes'.length));
      return json(response, await updateTournamentAddedToAes(tournamentId, await readJson(request)));
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/api/tournaments/') && url.pathname.endsWith('/ok-to-pay')) {
      const tournamentId = decodeURIComponent(url.pathname.slice('/api/tournaments/'.length, -'/ok-to-pay'.length));
      return json(response, await updateTournamentOkToPay(tournamentId, await readJson(request)));
    }

    if (route === 'GET /api/migration/inventory') {
      return json(response, await migrationInventory());
    }

    return json(response, { error: 'Not found' }, 404);
  } catch (error) {
    const status = error.statusCode ?? (error.code === 'ELOGIN' || error.code === 'ESOCKET' ? 503 : 500);
    console.error(`[${new Date().toISOString()}] ${request.method} ${request.url} failed`, {
      code: error.code,
      message: error.message
    });
    return json(response, {
      error: status === 503 ? 'Database unavailable' : [400, 404, 409].includes(status) ? error.message : 'Internal server error',
      code: error.code ?? 'ERR_INTERNAL',
      message: error.message
    }, status);
  }
}

async function migrationInventory() {
  const path = join(appRoot, '.migration', 'cfml-route-inventory.json');

  let routes;
  try {
    routes = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        routes: 0,
        features: [],
        unavailable: true
      };
    }
    throw error;
  }

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

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function empty(response, status = 204) {
  response.writeHead(status, corsHeaders());
  response.end();
}

function json(response, body, status = 200) {
  response.writeHead(status, {
    ...corsHeaders(),
    'content-type': 'application/json'
  });
  response.end(JSON.stringify(body, null, 2));
}

function excel(response, body, filename) {
  response.writeHead(200, {
    ...corsHeaders(),
    'content-disposition': `inline; filename=${filename}`,
    'content-type': 'application/vnd.ms-excel; charset=utf-8'
  });
  response.end(body);
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}
