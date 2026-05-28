import { requireClubSession } from '../auth.mjs';
import {
  createSanctionRequest,
  deleteSanctionRequest,
  getCurrentSanctionRequests,
  getSanctionRequest,
  getSanctionRequestFormOptions,
  getSanctionRequestHistory,
  getSanctionRequestRenewal,
  updateSanctionRequest
} from '../db.mjs';
import { json, readJson } from './http.mjs';

export async function handleSanctionRequestRoutes({ request, response, route, url }) {
  const sanctionRequestPath = url.pathname.match(/^\/api\/sanction-requests\/([^/]+)(?:\/(?:edit|print))?\/?$/);
  const sanctionRenewalPath = url.pathname.match(/^\/api\/sanction-requests\/renewal\/([^/]+)\/?$/);

  if (route === 'GET /api/sanction-requests/history') {
    const club = requireClubSession(request);
    return json(response, await getSanctionRequestHistory(club.clubCode));
  }

  if (route === 'GET /api/sanction-requests/current') {
    const club = requireClubSession(request);
    return json(response, await getCurrentSanctionRequests(club.clubCode));
  }

  if (route === 'GET /api/sanction-requests/form-options') {
    const club = requireClubSession(request);
    return json(response, await getSanctionRequestFormOptions(club.clubCode));
  }

  if (request.method === 'GET' && sanctionRenewalPath) {
    const club = requireClubSession(request);
    const sourceId = decodeURIComponent(sanctionRenewalPath[1]);
    return json(response, await getSanctionRequestRenewal(club.clubCode, sourceId));
  }

  if (request.method === 'GET' && sanctionRequestPath) {
    const club = requireClubSession(request);
    const requestId = decodeURIComponent(sanctionRequestPath[1]);
    return json(response, await getSanctionRequest(club.clubCode, requestId));
  }

  if (route === 'POST /api/sanction-requests') {
    const club = requireClubSession(request);
    return json(response, await createSanctionRequest(club.clubCode, await readJson(request)), 201);
  }

  if (request.method === 'PUT' && sanctionRequestPath) {
    const club = requireClubSession(request);
    const requestId = decodeURIComponent(sanctionRequestPath[1]);
    return json(response, await updateSanctionRequest(club.clubCode, requestId, await readJson(request)));
  }

  if (request.method === 'DELETE' && sanctionRequestPath) {
    const club = requireClubSession(request);
    const requestId = decodeURIComponent(sanctionRequestPath[1]);
    return json(response, await deleteSanctionRequest(club.clubCode, requestId));
  }

  return false;
}
