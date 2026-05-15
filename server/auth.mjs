import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const cookieName = 'chrva_session';
const sessionMaxAgeSeconds = 60 * 60 * 8;

const users = [
  {
    username: 'aciobotaru',
    role: 'master',
    displayName: 'aciobotaru',
    salt: 'S8ksBhi5zlQnFnwZ0mWCEA',
    passwordHash: 'WKzGdKxE0gVCRK61T03CCnoXgOPS6TjwHHwTHO0LU_FVPcZfYvAEpZt6vNt7Z3GLUEVyJGJJcFSawyaaO4emYQ'
  },
  {
    username: 'toolsAdmin',
    role: 'toolsAdmin',
    displayName: 'toolsAdmin',
    salt: '_tSSERXTCudltJO5LX41Uw',
    passwordHash: 'YN41qgZhmN1RVrJgsMA8vGETwUDckJ3SffOlJT4BefzoCIixjfUajcHTbivzJ5nqBMLcaRuiNceB1a6ECEA2QA'
  }
];

export function authenticateUser(username, password) {
  const user = users.find((candidate) => candidate.username.toLowerCase() === String(username ?? '').toLowerCase());

  if (!user || !isPasswordMatch(user, password)) {
    return null;
  }

  return publicUser(user);
}

export function createSessionCookie(user, request) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.username,
    role: user.role,
    name: user.displayName,
    iat: now,
    exp: now + sessionMaxAgeSeconds
  };
  const token = signPayload(payload);
  const secure = isSecureRequest(request) ? '; Secure' : '';

  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = isSecureRequest(request) ? '; Secure' : '';

  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function getSessionUser(request) {
  const token = parseCookies(request.headers.cookie ?? '')[cookieName];

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  const user = users.find((candidate) => candidate.username === payload.sub && candidate.role === payload.role);
  return user ? publicUser(user) : null;
}

export function requireSession(request) {
  const user = getSessionUser(request);

  if (!user) {
    throw httpError(401, 'Authentication required.', 'ERR_UNAUTHENTICATED');
  }

  return user;
}

export function requireRole(request, role) {
  const user = requireSession(request);

  if (user.role !== role) {
    throw httpError(403, 'You do not have access to this page.', 'ERR_FORBIDDEN');
  }

  return user;
}

function isPasswordMatch(user, password) {
  const actual = scryptSync(String(password ?? ''), user.salt, 64);
  const expected = Buffer.from(user.passwordHash, 'base64url');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function publicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', authSecret()).update(body).digest('base64url');

  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = String(token).split('.');

  if (!body || !signature) {
    return null;
  }

  const expected = createHmac('sha256', authSecret()).update(body).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp && payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(';').reduce((cookies, pair) => {
    const [name, ...valueParts] = pair.trim().split('=');

    if (name) {
      cookies[name] = decodeURIComponent(valueParts.join('='));
    }

    return cookies;
  }, {});
}

function isSecureRequest(request) {
  const host = request.headers.host ?? '';
  const forwardedProto = request.headers['x-forwarded-proto'];

  return forwardedProto === 'https' || (!host.startsWith('localhost') && !host.startsWith('127.0.0.1'));
}

function authSecret() {
  const secret = process.env.CHRVA_AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw httpError(500, 'Missing required environment variable CHRVA_AUTH_SECRET.', 'ERR_CONFIG');
  }

  return 'local-development-only-change-me';
}

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
