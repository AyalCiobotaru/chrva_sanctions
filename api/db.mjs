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
  const activeStatus = text(filters.get('activeStatus') || 'active').toLowerCase();
  const meetingNoShows = filters.get('meetingNoShows') === 'true';
  const where = [
    "grouping = 'Juniors'"
  ];

  if (meetingNoShows) {
    where.push("active = 'Y'");
    where.push('inAttendance2023 is null');
  } else if (activeStatus === 'active') {
    where.push("active = 'Y'");
  } else if (activeStatus === 'inactive') {
    where.push("active = 'N'");
  }

  addStartsWith(where, request, 'clubName', 'ClubName', filters.get('clubName'));
  addStartsWith(where, request, 'state', 'st', filters.get('state'));

  const query = `
    from clubcontacts
    where ${where.join(' and ')}
  `;

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
      phone2,
      email,
      altEmail,
      club_web_page,
      comments,
      active,
      clubType,
      inAttendance2024,
      inAttendance2023,
      acknowledge
    ${query}
    order by ClubName
  `);

  const counts = await pool.request().query(`
    select
      (select count(*) from clubcontacts where grouping = 'Juniors' and active = 'Y') as activeTotal,
      (select count(*) from clubcontacts where inAttendance2024 = 'Yes') as attendingTotal
  `);
  const clubs = result.recordset.map(mapClub);

  return {
    clubs,
    total: clubs.length,
    activeTotal: counts.recordset[0]?.activeTotal ?? 0,
    attendingTotal: counts.recordset[0]?.attendingTotal ?? 0
  };
}

export async function createClub(body) {
  const pool = await getPool();
  const club = normalizeClubInput(body);
  const errors = validateClub(club);

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const duplicate = await pool.request()
    .input('clubCode', sql.NVarChar, club.clubCode)
    .query('select ClubCode from clubcontacts where ClubCode = @clubCode');

  if (duplicate.recordset.length > 0) {
    const error = new Error('Club Code must be unique. This code has already been assigned.');
    error.statusCode = 409;
    error.code = 'ERR_DUPLICATE_CLUB';
    throw error;
  }

  await pool.request()
    .input('clubCode', sql.NVarChar, club.clubCode)
    .input('clubName', sql.NVarChar, club.clubName)
    .input('contactFirstName', sql.NVarChar, club.contactFirstName)
    .input('contactLastName', sql.NVarChar, club.contactLastName)
    .input('address1', sql.NVarChar, club.address1)
    .input('address2', sql.NVarChar, club.address2)
    .input('city', sql.NVarChar, club.city)
    .input('state', sql.NVarChar, club.state)
    .input('zip', sql.NVarChar, club.zip)
    .input('phone1', sql.NVarChar, club.phone1)
    .input('phone2', sql.NVarChar, club.phone2)
    .input('extension', sql.NVarChar, club.extension)
    .input('fax', sql.NVarChar, club.fax)
    .input('website', sql.NVarChar, club.website)
    .input('email', sql.NVarChar, club.email)
    .input('alternateEmail', sql.NVarChar, club.alternateEmail)
    .input('comments', sql.NVarChar, club.comments)
    .input('clubType', sql.NVarChar, club.clubType)
    .input('active', sql.NChar, club.active)
    .query(`
      insert into clubcontacts (
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
        ext,
        phone2,
        fax,
        club_web_page,
        email,
        altEmail,
        comments,
        grouping,
        clubType,
        active
      )
      values (
        @clubCode,
        @clubName,
        @contactFirstName,
        @contactLastName,
        @address1,
        @address2,
        @city,
        @state,
        @zip,
        @phone1,
        @extension,
        @phone2,
        @fax,
        @website,
        @email,
        @alternateEmail,
        @comments,
        'Juniors',
        @clubType,
        @active
      )
    `);

  return getClubByCode(club.clubCode);
}

export async function updateClub(clubCode, body) {
  const pool = await getPool();
  const club = {
    ...normalizeClubInput(body),
    clubCode: text(clubCode).toUpperCase()
  };
  const errors = validateClub(club);

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const existing = await pool.request()
    .input('clubCode', sql.NVarChar, club.clubCode)
    .query("select ClubCode from clubcontacts where ClubCode = @clubCode and grouping = 'Juniors'");

  if (existing.recordset.length === 0) {
    const error = new Error('Club was not found.');
    error.statusCode = 404;
    error.code = 'ERR_CLUB_NOT_FOUND';
    throw error;
  }

  await pool.request()
    .input('clubCode', sql.NVarChar, club.clubCode)
    .input('clubName', sql.NVarChar, club.clubName)
    .input('contactFirstName', sql.NVarChar, club.contactFirstName)
    .input('contactLastName', sql.NVarChar, club.contactLastName)
    .input('address1', sql.NVarChar, club.address1)
    .input('address2', sql.NVarChar, club.address2)
    .input('city', sql.NVarChar, club.city)
    .input('state', sql.NVarChar, club.state)
    .input('zip', sql.NVarChar, club.zip)
    .input('phone1', sql.NVarChar, club.phone1)
    .input('phone2', sql.NVarChar, club.phone2)
    .input('extension', sql.NVarChar, club.extension)
    .input('fax', sql.NVarChar, club.fax)
    .input('website', sql.NVarChar, club.website)
    .input('email', sql.NVarChar, club.email)
    .input('alternateEmail', sql.NVarChar, club.alternateEmail)
    .input('comments', sql.NVarChar, club.comments)
    .input('clubType', sql.NVarChar, club.clubType)
    .input('active', sql.NChar, club.active)
    .query(`
      update clubcontacts
      set
        ClubName = @clubName,
        contactFname = @contactFirstName,
        contactLname = @contactLastName,
        straddress1 = @address1,
        straddress2 = @address2,
        city = @city,
        st = @state,
        zip = @zip,
        phone1 = @phone1,
        ext = @extension,
        phone2 = @phone2,
        fax = @fax,
        club_web_page = @website,
        email = @email,
        altEmail = @alternateEmail,
        comments = @comments,
        clubType = @clubType,
        active = @active
      where ClubCode = @clubCode
        and grouping = 'Juniors'
    `);

  return getClubByCode(club.clubCode);
}

export async function getClubEmailBroadcast(filters = new URLSearchParams()) {
  const pool = await getPool();
  const clubType = text(filters.get('clubType') || 'R').toUpperCase();
  const where = [
    "active = 'Y'",
    "isnull(clubType, '') <> 'A'"
  ];
  const request = pool.request();

  if (clubType !== 'R') {
    request.input('clubType', sql.NVarChar, `%${clubType}%`);
    where.push('clubType like @clubType');
  }

  const result = await request.query(`
    select
      email,
      altEmail,
      contactFname,
      contactLname,
      clubName
    from clubcontacts
    where ${where.join(' and ')}
    order by clubName
  `);

  const recipients = uniqueEmails(result.recordset.flatMap((row) => {
    const name = `${text(row.contactFname)} ${text(row.contactLname)}`.trim() || text(row.clubName);
    return [
      { email: text(row.email), name, clubName: text(row.clubName) },
      { email: text(row.altEmail), name, clubName: text(row.clubName) }
    ];
  }));

  return {
    clubType,
    recipients,
    recipientCount: recipients.length,
    fromOptions: clubEmailFromOptions()
  };
}

export async function sendClubEmailBroadcast(body) {
  const subject = text(body?.subject);
  const from = text(body?.from);
  const information = text(body?.information);
  const recipients = Array.isArray(body?.recipients)
    ? uniqueEmails(body.recipients.map((recipient) => ({
        email: text(typeof recipient === 'string' ? recipient : recipient?.email),
        name: text(recipient?.name),
        clubName: text(recipient?.clubName)
      })))
    : [];
  const errors = [];

  if (!from) {
    errors.push('From address is required.');
  }

  if (!subject) {
    errors.push('Subject is required.');
  }

  if (recipients.length === 0) {
    errors.push('At least one recipient is required.');
  }

  if (!information) {
    errors.push('Email body is required.');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  return {
    sent: false,
    dryRun: true,
    recipientCount: recipients.length,
    message: 'Email delivery is not configured yet. This broadcast was validated but not sent.'
  };
}

export async function exportClubsDirectory() {
  const pool = await getPool();
  const result = await pool.request().query(`
    select
      ClubCode,
      ClubName,
      contactFname,
      contactLname,
      city,
      st,
      zip,
      phone1,
      phone2,
      email,
      altEmail,
      club_web_page,
      active
    from clubcontacts
    where grouping = 'Juniors'
      and active = 'Y'
    order by ClubName
  `);

  const generated = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  }).format(new Date());

  const rows = result.recordset.map((row) => `
    <tr>
      <td>${html(row.ClubCode)}</td>
      <td>${html(row.ClubName)}${text(row.active) === 'N' ? ' (**Not Active**)' : ''}</td>
      <td>${html(`${text(row.contactFname)} ${text(row.contactLname)}`.trim())}</td>
      <td>${html([row.email, row.altEmail].map(text).filter(Boolean).join(' / '))}</td>
      <td>${html(row.city)}</td>
      <td>${html(row.st)}</td>
      <td>${html(row.zip)}</td>
      <td>${html([row.phone1, row.phone2].map(text).filter(Boolean).join(' / '))}</td>
      <td>${html(row.club_web_page)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>CHRVA Club Export</title>
</head>
<body>
  <table border="0" cellpadding="3" cellspacing="0" width="100%">
    <tr>
      <td colspan="9" align="center">
        <h3>CHRVA Junior Girls Club Directory<br>Date Generated: ${html(generated)}</h3>
      </td>
    </tr>
    <tr>
      <td>Club Code</td>
      <td>Club Name</td>
      <td>Director</td>
      <td>Email / Alt Email</td>
      <td>City</td>
      <td>State</td>
      <td>Zip</td>
      <td>Phone1 / Phone2</td>
      <td>Web Page</td>
    </tr>
    ${rows}
  </table>
</body>
</html>`;
}

function uniqueEmails(candidates) {
  const seen = new Set();
  const recipients = [];

  for (const candidate of candidates) {
    const email = text(candidate.email);
    const normalized = email.toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.') || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    recipients.push({
      email,
      name: text(candidate.name),
      clubName: text(candidate.clubName)
    });
  }

  return recipients;
}

function clubEmailFromOptions() {
  return [
    { email: 'peggy.vanlowe@chrvajuniors.org', name: 'Peggy Van Lowe' },
    { email: 'scott.vanlowe@chrvajuniors.org', name: 'Scott Van Lowe' },
    { email: 'chris.cant@chrvajuniors.org', name: 'Chris Cant' },
    { email: 'noel.okoye@chrvajuniors.org', name: 'Noel Okoye' },
    { email: 'corby.lawrence@chrvajuniors.org', name: 'Corby Lawrence' },
    { email: 'dado.singer@chrvajuniors.org', name: 'Dado Singer' },
    { email: 'lauren.leventry@chrvajuniors.org', name: 'Lauren Leventry' },
    { email: 'laura.kuckuda@chrvajuniors.org', name: 'Laura Kuckuda' },
    { email: 'lisa.digiacinto@chrvajuniors.org', name: 'Lisa Digiacinto' }
  ];
}

async function getClubByCode(clubCode) {
  const pool = await getPool();
  const result = await pool.request()
    .input('clubCode', sql.NVarChar, clubCode)
    .query(`
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
        phone2,
        email,
        altEmail,
        club_web_page,
        comments,
        active,
        clubType,
        inAttendance2024,
        inAttendance2023,
        acknowledge
      from clubcontacts
      where ClubCode = @clubCode
    `);

  return result.recordset[0] ? mapClub(result.recordset[0]) : null;
}

function mapClub(row) {
  return {
    clubCode: text(row.ClubCode),
    clubName: text(row.ClubName),
    contactFirstName: text(row.contactFname),
    contactLastName: text(row.contactLname),
    address1: text(row.straddress1),
    address2: text(row.straddress2),
    address: [row.straddress1, row.straddress2, row.city].map(text).filter(Boolean).join(', '),
    city: text(row.city),
    state: text(row.st),
    zip: text(row.zip),
    website: normalizeWebsite(row.club_web_page),
    phone: text(row.phone1),
    phoneSecondary: text(row.phone2),
    email: text(row.email),
    alternateEmail: text(row.altEmail),
    active: text(row.active) !== 'N',
    clubType: text(row.clubType),
    comments: text(row.comments),
    attendedMeeting: text(row.inAttendance2024) === 'Yes',
    previousNoShowFlag: row.inAttendance2023 == null,
    acknowledged: text(row.acknowledge) === 'Yes'
  };
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

function normalizeClubInput(body) {
  return {
    clubCode: text(body?.clubCode).toUpperCase(),
    clubName: text(body?.clubName),
    contactFirstName: text(body?.contactFirstName),
    contactLastName: text(body?.contactLastName),
    address1: text(body?.address1),
    address2: text(body?.address2),
    city: text(body?.city),
    state: text(body?.state).toUpperCase(),
    zip: text(body?.zip),
    phone1: text(body?.phone1),
    phone2: text(body?.phone2),
    extension: text(body?.extension),
    fax: text(body?.fax),
    website: normalizeWebsite(body?.website),
    email: text(body?.email),
    alternateEmail: text(body?.alternateEmail),
    comments: text(body?.comments),
    clubType: text(body?.clubType) || 'G',
    active: body?.active === false ? 'N' : 'Y'
  };
}

function validateClub(club) {
  const required = [
    ['clubCode', 'Club Code'],
    ['clubName', 'Club Name'],
    ['contactFirstName', 'Contact First Name'],
    ['contactLastName', 'Contact Last Name'],
    ['city', 'City'],
    ['state', 'State'],
    ['zip', 'Zip'],
    ['phone1', 'Phone 1'],
    ['email', 'Email Address']
  ];
  const errors = required
    .filter(([key]) => !club[key])
    .map(([, label]) => `${label} is required.`);

  if (club.clubCode.length > 5) {
    errors.push('Club Code must be 5 characters or fewer.');
  }

  if (club.state.length > 2) {
    errors.push('State must be 2 characters.');
  }

  return errors;
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

function html(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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
