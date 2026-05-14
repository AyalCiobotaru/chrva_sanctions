import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mirrorRoot = join(__dirname, '..', '..');
const port = Number(process.env.PORT ?? 4300);

const legacyConfig = {
  previousSeason: '2026',
  currentSeason: '2027',
  nextSeason: '2028',
  seasonStatus: 'Open',
  sanctionStatus: 'Open'
};

const clubs = [
  {
    clubCode: 'MIGRATION-SAMPLE',
    clubName: 'Migration Sample Volleyball Club',
    contactFirstName: 'Legacy',
    contactLastName: 'Contact',
    address: 'Replace with clubcontacts query results',
    state: 'VA',
    zip: '',
    website: 'www.chrva.org',
    phone: ''
  }
];

const tournaments = [
  {
    id: 'migration-sample',
    uniqueId: 'MIGRATION-SAMPLE',
    date: '2027-01-01',
    division: 'Girls 16',
    type: 'Open',
    name: 'Migration Sample Tournament',
    host: 'Replace with sanction query results',
    teamCount: null,
    site: 'TBD',
    closeDate: null,
    priority: null,
    status: 'Draft'
  }
];

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const route = `${request.method} ${url.pathname}`;

    if (route === 'GET /api/health') {
      return json(response, { ok: true });
    }

    if (route === 'GET /api/config') {
      return json(response, legacyConfig);
    }

    if (route === 'GET /api/clubs') {
      return json(response, filterClubs(url.searchParams));
    }

    if (route === 'GET /api/tournaments') {
      return json(response, filterTournaments(url.searchParams));
    }

    if (route === 'GET /api/migration/inventory') {
      return json(response, await migrationInventory());
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error.message }));
  }
}).listen(port, () => {
  console.log(`CHRVA migration API listening at http://localhost:${port}`);
});

function filterClubs(params) {
  return clubs.filter((club) => {
    return startsWith(club.clubName, params.get('clubName')) &&
      startsWith(club.contactFirstName, params.get('contactFirstName')) &&
      startsWith(club.contactLastName, params.get('contactLastName')) &&
      startsWith(club.state, params.get('state'));
  });
}

function filterTournaments(params) {
  return tournaments.filter((tournament) => {
    return startsWith(tournament.division, params.get('division')) &&
      startsWith(tournament.host, params.get('host')) &&
      startsWith(tournament.name, params.get('name'));
  });
}

function startsWith(value, filter) {
  if (!filter) {
    return true;
  }
  return String(value ?? '').toLowerCase().startsWith(String(filter).toLowerCase());
}

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
