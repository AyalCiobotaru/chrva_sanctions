import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireRole, requireSession } from '../auth.mjs';
import {
  createClub,
  createCoordinator,
  deleteCoordinator,
  exportClubsDirectory,
  getAdminCurrentSanctionRequests,
  getAdminSanctionRequestDetail,
  getClubEmailBroadcast,
  getTournamentDirectorEmailBroadcast,
  searchClubs,
  searchCoordinators,
  searchTournaments,
  sendClubEmailBroadcast,
  sendTournamentDirectorEmailBroadcast,
  updateAdminSanctionRequestReview,
  updateClub,
  updateCoordinator,
  updateTournamentAddedToAes,
  updateTournamentOkToPay
} from '../db.mjs';
import { excel, json, readJson } from './http.mjs';

export async function handleProtectedRoutes({ appRoot, request, response, route, url }) {
  requireSession(request);

  if (route === 'GET /api/migration/inventory') {
    requireRole(request, 'master');
    return json(response, await migrationInventory(appRoot));
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

  if (route === 'POST /api/coordinators') {
    return json(response, await createCoordinator(await readJson(request)), 201);
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/coordinators/')) {
    const category = decodeURIComponent(url.pathname.slice('/api/coordinators/'.length));
    return json(response, await updateCoordinator(category, await readJson(request)));
  }

  if (request.method === 'DELETE' && url.pathname.startsWith('/api/coordinators/')) {
    const category = decodeURIComponent(url.pathname.slice('/api/coordinators/'.length));
    return json(response, await deleteCoordinator(category));
  }

  if (route === 'GET /api/tournaments') {
    return json(response, await searchTournaments(url.searchParams));
  }

  if (route === 'GET /api/admin/sanction-requests/current') {
    return json(response, await getAdminCurrentSanctionRequests(url.searchParams));
  }

  if (route === 'GET /api/admin/sanction-requests/tournament-director-email') {
    return json(response, await getTournamentDirectorEmailBroadcast(url.searchParams));
  }

  if (route === 'POST /api/admin/sanction-requests/tournament-director-email') {
    return json(response, await sendTournamentDirectorEmailBroadcast(url.searchParams, await readJson(request)));
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/admin/sanction-requests/')) {
    const requestId = decodeURIComponent(url.pathname.slice('/api/admin/sanction-requests/'.length));
    return json(response, await getAdminSanctionRequestDetail(requestId));
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/admin/sanction-requests/') && url.pathname.endsWith('/review')) {
    const requestId = decodeURIComponent(url.pathname.slice('/api/admin/sanction-requests/'.length, -'/review'.length));
    return json(response, await updateAdminSanctionRequestReview(requestId, await readJson(request)));
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/tournaments/') && url.pathname.endsWith('/added-to-aes')) {
    const tournamentId = decodeURIComponent(url.pathname.slice('/api/tournaments/'.length, -'/added-to-aes'.length));
    return json(response, await updateTournamentAddedToAes(tournamentId, await readJson(request)));
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/tournaments/') && url.pathname.endsWith('/ok-to-pay')) {
    const tournamentId = decodeURIComponent(url.pathname.slice('/api/tournaments/'.length, -'/ok-to-pay'.length));
    return json(response, await updateTournamentOkToPay(tournamentId, await readJson(request)));
  }

  return false;
}

async function migrationInventory(appRoot) {
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
