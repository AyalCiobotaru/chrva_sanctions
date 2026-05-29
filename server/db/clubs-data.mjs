import sql from 'mssql';
import {
  NO_REPLY_EMAIL_FROM,
  addExact,
  addStartsWith,
  appendEmailFooter,
  clubEmailFromOptions,
  getClubByCode,
  getPool,
  html,
  mapClub,
  normalizeClubInput,
  sendRecipientEmails,
  text,
  uniqueEmails,
  validateClub
} from './shared.mjs';

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

  if (filters.get('clubType')) {
    request.input('clubType', sql.NVarChar, `%${text(filters.get('clubType')).toUpperCase()}%`);
    where.push('clubType like @clubType');
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
      username,
      password,
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
    .input('username', sql.NVarChar, club.username)
    .input('password', sql.NVarChar, club.password)
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
        username,
        password,
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
        @username,
        @password,
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
    .input('username', sql.NVarChar, club.username)
    .input('password', sql.NVarChar, club.password)
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
        username = @username,
        password = @password,
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
  const from = NO_REPLY_EMAIL_FROM;
  const information = text(body?.information);
  const recipients = Array.isArray(body?.recipients)
    ? uniqueEmails(body.recipients.map((recipient) => ({
        email: text(typeof recipient === 'string' ? recipient : recipient?.email),
        name: text(recipient?.name),
        clubName: text(recipient?.clubName)
      })))
    : [];
  const errors = [];

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

  const delivery = await sendRecipientEmails({
    from,
    recipients,
    subject,
    html: appendEmailFooter(information)
  });

  return {
    sent: delivery.sent,
    dryRun: delivery.dryRun,
    recipientCount: recipients.length,
    message: delivery.dryRun
      ? 'Email delivery is not configured. This broadcast was validated but not sent.'
      : `Email broadcast sent to ${recipients.length} recipients.`
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
