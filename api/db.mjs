import sql from 'mssql';

let poolPromise;

export function getAppConfig() {
  return {
    previousSeason: requireEnv('CHRVA_PREVIOUS_SEASON'),
    currentSeason: requireEnv('CHRVA_CURRENT_SEASON'),
    nextSeason: requireEnv('CHRVA_NEXT_SEASON'),
    seasonStatus: requireEnv('CHRVA_SEASON_STATUS'),
    sanctionStatus: requireEnv('CHRVA_SANCTION_STATUS')
  };
}

export async function searchClubs(filters) {
  const pool = await getPool();
  const request = pool.request();
  const where = [
    "grouping = 'Juniors'",
    "active = 'Y'"
  ];

  addStartsWith(where, request, 'clubName', 'ClubName', filters.get('clubName'));
  addStartsWith(where, request, 'contactFirstName', 'contactFname', filters.get('contactFirstName'));
  addStartsWith(where, request, 'contactLastName', 'contactLname', filters.get('contactLastName'));
  addStartsWith(where, request, 'state', 'st', filters.get('state'));

  const result = await request.query(`
    select
      ClubCode,
      ClubName,
      contactFname,
      contactLname,
      straddress1,
      straddress2,
      city,
      st,
      zip,
      phone1,
      club_web_page
    from clubcontacts
    where ${where.join(' and ')}
    order by ClubName
  `);

  return result.recordset.map((row) => ({
    clubCode: text(row.ClubCode),
    clubName: text(row.ClubName),
    contactFirstName: text(row.contactFname),
    contactLastName: text(row.contactLname),
    address: [row.straddress1, row.straddress2, row.city].map(text).filter(Boolean).join(', '),
    state: text(row.st),
    zip: text(row.zip),
    website: normalizeWebsite(row.club_web_page),
    phone: text(row.phone1)
  }));
}

export async function searchCoordinators(filters) {
  const pool = await getPool();
  const request = pool.request();
  const where = [];

  addStartsWith(where, request, 'category', 'grouping', filters.get('category'));
  addStartsWith(where, request, 'firstName', 'coordfname', filters.get('firstName'));
  addStartsWith(where, request, 'lastName', 'coordlname', filters.get('lastName'));

  const result = await request.query(`
    select
      category,
      grouping,
      coordfname,
      coordlname,
      straddress1,
      straddress2,
      city,
      st,
      zip,
      phone1,
      phone2,
      ext,
      fax,
      email
    from coordcontacts
    ${where.length ? `where ${where.join(' and ')}` : ''}
    order by grouping, category, coordlname, coordfname
  `);

  return result.recordset.map((row) => ({
    category: text(row.category),
    grouping: text(row.grouping),
    firstName: text(row.coordfname),
    lastName: text(row.coordlname),
    address: [row.straddress1, row.straddress2].map(text).filter(Boolean).join(', '),
    city: text(row.city),
    state: text(row.st),
    zip: text(row.zip),
    phonePrimary: text(row.phone1),
    phoneSecondary: text(row.phone2),
    extension: text(row.ext),
    fax: text(row.fax),
    email: text(row.email)
  }));
}

export async function searchTournaments(filters) {
  const pool = await getPool();
  const config = getAppConfig();
  const request = pool.request();
  const season = Number(filters.get('season') || config.currentSeason);
  const division = text(filters.get('division'));
  const where = [
    'sr.dte > @seasonStart',
    'sr.dte < @seasonEnd'
  ];

  request.input('seasonStart', sql.Date, `${season - 1}-10-01`);
  request.input('seasonEnd', sql.Date, `${season}-12-31`);

  if (division) {
    where.push("(sr.sanctionStatus in ('Approved', 'SO'))");
  } else {
    where.push("(sr.sanctionStatus in ('Approved', 'Posted') or sr.AES_added is not null)");
  }

  switch (filters.get('program')) {
    case 'adt':
      where.push("substring(sr.division, 1, 1) = 'A'");
      break;
    case 'boys':
      where.push("substring(sr.division, 1, 1) = 'B'");
      break;
    case 'jr':
    default:
      where.push("substring(sr.division, 1, 1) = 'G'");
      break;
  }

  addExact(where, request, 'division', 'sr.division', division);
  addStartsWith(where, request, 'host', 'sr.tournhost', filters.get('host'));
  addStartsWith(where, request, 'name', 'sr.tournname', filters.get('name'));
  addExact(where, request, 'type', 'sr.type', filters.get('type'));
  addExact(where, request, 'clubCode', 'sr.clubcode', filters.get('clubCode'));
  addExactDate(where, request, 'date', 'sr.dte', filters.get('date'));

  if (filters.get('hasNotes') === 'true') {
    where.push('datalength(sr.AES_notes) <> 0');
  }

  if (filters.get('notPosted') === 'true') {
    where.push('sr.AES_added is null');
  }

  const result = await request.query(`
    select
      sr.id,
      sr.sanctionid,
      sr.dte,
      sr.startTime,
      sr.division,
      sr.type,
      sr.tournname,
      sr.tournhost,
      sr.clubcode,
      cc.clubname,
      sr.number_of_teams,
      sr.min_number_of_teams,
      sr.site,
      sr.taddr,
      sr.closing_dte,
      sr.priority,
      sr.sanctionStatus,
      sr.AES_added,
      sr.AES_okToPay,
      sr.paymentType,
      sr.check_payable_to,
      sr.fee,
      (case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) as weekNumber
    from sanction_requested sr
    left join clubcontacts cc on sr.clubcode = cc.clubcode
    where ${where.join(' and ')}
    order by sr.dte, sr.division, sr.priority
  `);

  return result.recordset.map((row) => ({
    id: String(row.id),
    uniqueId: text(row.sanctionid),
    date: toDate(row.dte),
    startTime: toTime(row.startTime),
    division: text(row.division),
    type: text(row.type),
    name: text(row.tournname),
    host: text(row.tournhost),
    clubCode: text(row.clubcode),
    clubName: text(row.clubname),
    teamCount: row.number_of_teams ?? null,
    minimumTeamCount: row.min_number_of_teams ?? null,
    site: text(row.site),
    siteAddress: text(row.taddr),
    closeDate: toDate(row.closing_dte),
    priority: row.priority == null ? null : String(row.priority),
    status: text(row.sanctionStatus),
    addedToAesDate: toDate(row.AES_added),
    okToPay: text(row.AES_okToPay) === 'Y',
    paymentType: text(row.paymentType),
    checkPayableTo: text(row.check_payable_to),
    fee: toNumber(row.fee),
    weekNumber: row.weekNumber ?? null
  }));
}

async function getPool() {
  poolPromise ??= sql.connect(await readDbConfig());
  return poolPromise;
}

async function readDbConfig() {
  return {
    server: requireEnv('CHRVA_DB_HOST'),
    port: Number(process.env.CHRVA_DB_PORT ?? 1433),
    database: requireEnv('CHRVA_DB_NAME'),
    user: requireEnv('CHRVA_DB_USER'),
    password: requireEnv('CHRVA_DB_PASSWORD'),
    options: {
      encrypt: process.env.CHRVA_DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.CHRVA_DB_TRUST_SERVER_CERT !== 'false'
    },
    connectionTimeout: Number(process.env.CHRVA_DB_CONNECTION_TIMEOUT ?? 15000),
    requestTimeout: Number(process.env.CHRVA_DB_REQUEST_TIMEOUT ?? 15000)
  };
}

function addStartsWith(where, request, name, column, value) {
  const normalized = text(value);
  if (!normalized) {
    return;
  }
  request.input(name, sql.NVarChar, `${normalized}%`);
  where.push(`${column} like @${name}`);
}

function addExact(where, request, name, column, value) {
  const normalized = text(value);
  if (!normalized) {
    return;
  }
  request.input(name, sql.NVarChar, normalized);
  where.push(`${column} = @${name}`);
}

function addExactDate(where, request, name, column, value) {
  const normalized = text(value);
  if (!normalized) {
    return;
  }
  request.input(name, sql.Date, normalized);
  where.push(`cast(${column} as date) = @${name}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function normalizeWebsite(value) {
  return text(value).replace(/^https?:\/\//i, '').replace(/^\/\//, '');
}

function text(value) {
  return String(value ?? '').trim();
}

function toDate(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString().slice(0, 10);
}

function toTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }

  return text(value).slice(0, 5) || null;
}

function toNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
