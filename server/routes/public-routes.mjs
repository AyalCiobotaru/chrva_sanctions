import {
  authenticateUser,
  clearClubSessionCookie,
  clearSessionCookie,
  createClubSessionCookie,
  createSessionCookie,
  getClubSession,
  getSessionUser
} from '../auth.mjs';
import { authenticateSanctionClub, getAppConfig, searchPublicClubs } from '../db.mjs';
import { json, readJson } from './http.mjs';

export async function handlePublicRoutes({ request, response, route, url }) {
  if (route === 'GET /api/health') {
    return json(response, { ok: true });
  }

  if (route === 'GET /api/public/clubs') {
    return json(response, await searchPublicClubs(url.searchParams));
  }

  if (route === 'GET /api/auth/session') {
    const user = getSessionUser(request);
    return json(response, { authenticated: Boolean(user), user });
  }

  if (route === 'POST /api/auth/login') {
    const credentials = await readJson(request);
    const user = authenticateUser(credentials.username, credentials.password);

    if (!user) {
      return json(response, {
        error: 'Invalid username or password.',
        code: 'ERR_INVALID_LOGIN'
      }, 401);
    }

    return json(response, { authenticated: true, user }, 200, {
      'set-cookie': createSessionCookie(user, request)
    });
  }

  if (route === 'POST /api/auth/logout') {
    return json(response, { authenticated: false, user: null }, 200, {
      'set-cookie': clearSessionCookie(request)
    });
  }

  if (route === 'GET /api/config') {
    return json(response, getAppConfig());
  }

  if (route === 'GET /api/sanction-requests/auth/session') {
    const club = getClubSession(request);
    return json(response, { authenticated: Boolean(club), club });
  }

  if (route === 'POST /api/sanction-requests/auth/login') {
    const credentials = await readJson(request);

    if (!credentials.agree || !credentials.agreePenalties) {
      return json(response, {
        error: 'Hosting requirement agreement is required.',
        code: 'ERR_AGREEMENT_REQUIRED'
      }, 400);
    }

    const club = await authenticateSanctionClub(credentials.username, credentials.password);

    if (!club) {
      return json(response, {
        error: 'Invalid club username or password.',
        code: 'ERR_INVALID_CLUB_LOGIN'
      }, 401);
    }

    return json(response, { authenticated: true, club }, 200, {
      'set-cookie': createClubSessionCookie(club, request)
    });
  }

  if (route === 'POST /api/sanction-requests/auth/logout') {
    return json(response, { authenticated: false, club: null }, 200, {
      'set-cookie': clearClubSessionCookie(request)
    });
  }

  return false;
}
