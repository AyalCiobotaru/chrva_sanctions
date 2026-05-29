import sql from 'mssql';
import { isEmailDeliveryConfigured, sendEmail } from '../mail.mjs';

export const NO_REPLY_EMAIL_FROM = 'no-reply@chrvajuniors.org';
export { isEmailDeliveryConfigured };

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


export function uniqueEmails(candidates) {
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

export function clubEmailFromOptions() {
  return [
    { email: NO_REPLY_EMAIL_FROM, name: 'CHRVA Juniors' }
  ];
}

export function tournamentDirectorEmailFromOptions() {
  return [
    { email: NO_REPLY_EMAIL_FROM, name: 'CHRVA Juniors' }
  ];
}

export function appendEmailFooter(htmlBody) {
  return `
    ${htmlBody}
    <hr>
    <p>
      Please do not reply to this email address because it is not monitored.
      Instead, email Program Director Lauren Leventry at
      <a href="mailto:lauren.leventry@chrvavb.org">lauren.leventry@chrvavb.org</a>
      or contact your respective age group coordinator.
    </p>
  `;
}

export async function sendSanctionRequestCreatedEmail(pool, club, request, created) {
  const chairs = await getTournamentChairs(pool);
  const to = [{ email: request.tournamentDirectorEmail, name: request.tournamentDirectorName }];
  const subject = `Tournament Sanction Request: ${club.clubCode} ${formatUsDate(request.date)} - ${request.division} - ${request.type}`;
  const chairName = chairs.map((chair) => chair.name).filter(Boolean).join(', ') || 'Junior Tournament Chair';
  const from = NO_REPLY_EMAIL_FROM;
  const htmlBody = `
    <p>Your tournament request has been submitted.</p>
    <p>Tournament Request Reference Number: ${html(created.id)} / If approved, Sanction Number: ${html(created.sanctionid)}</p>
    <p>
      Please review the tournament details below. If you need to make changes to this request, visit the Current Requests tab and click edit.
      Once the tournament is sanctioned, tournament formats cannot be changed without notifying the CHRVA Girls Jr. Tournament Chair.
    </p>
    <p>
      Tournament: ${html(request.tournamentName)} - ${html(formatUsDate(request.date))} - ${html(request.division)}<br>
      Site: ${html(request.site)}<br>
      Number of teams: ${html(request.numberOfTeams)}<br>
      Format: ${html(request.poolPlay)}<br>
      Playoffs: ${html(request.playoffFormat)}<br>
      Entry Fee: ${html(request.entryFee)}
    </p>
    <hr>
    <p>The status of your tournament request can be viewed on the Current Requests tab of the online request system.</p>
    <p>Non-HDP requests will not be approved until after September 1st.</p>
    <p>
      It is the responsibility of the tournament host to complete all post tournament responsibilities on time.
      Failure to do so by the timelines provided will prevent your club from hosting future tournaments.
      Post reporting duties can be found in the handbook.
    </p>
    <p>If you have any concerns about what is required after reading the guidelines, please feel free to contact me.</p>
    <p>Thanks!<br>${html(chairName)}<br>JR. Girls Tournament Chair</p>
  `;

  return sendEmail({
    from,
    to,
    cc: chairs.map((chair) => chair.email),
    replyTo: chairs.map((chair) => chair.email),
    subject,
    html: appendEmailFooter(htmlBody)
  });
}

export async function sendRecipientEmails({ from, recipients, cc = [], replyTo = [], subject, html: htmlBody }) {
  if (!isEmailDeliveryConfigured()) {
    const delivery = await sendEmail({
      from,
      to: recipients.slice(0, 1),
      cc,
      replyTo,
      subject,
      html: htmlBody
    });

    return {
      ...delivery,
      recipientCount: recipients.length
    };
  }

  let sent = 0;
  let lastMessageId = '';

  for (const recipient of recipients) {
    const delivery = await sendEmail({
      from,
      to: [recipient],
      cc,
      replyTo,
      subject,
      html: htmlBody
    });
    sent += delivery.sent ? 1 : 0;
    lastMessageId = delivery.messageId || lastMessageId;
  }

  return {
    sent: sent === recipients.length,
    dryRun: false,
    recipientCount: sent,
    messageId: lastMessageId
  };
}

export async function getTournamentChairs(pool) {
  const result = await pool.request().query(`
    select email, coordfname, coordlname
    from coordcontacts
    where category = 'Tournament Coordinator'
      and isnull(email, '') <> ''
    order by coordlname, coordfname
  `);

  return result.recordset.map((row) => ({
    email: text(row.email),
    name: `${text(row.coordfname)} ${text(row.coordlname)}`.trim()
  })).filter((chair) => chair.email);
}

export async function getClubByCode(clubCode) {
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
        username,
        password,
        clubType,
        inAttendance2024,
        inAttendance2023,
        acknowledge
      from clubcontacts
      where ClubCode = @clubCode
    `);

  return result.recordset[0] ? mapClub(result.recordset[0]) : null;
}

export function mapClub(row) {
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
    username: text(row.username),
    password: text(row.password),
    active: text(row.active) !== 'N',
    clubType: text(row.clubType),
    comments: text(row.comments),
    attendedMeeting: text(row.inAttendance2024) === 'Yes',
    previousNoShowFlag: row.inAttendance2023 == null,
    acknowledged: text(row.acknowledge) === 'Yes'
  };
}


export async function getSanctionClub(pool, clubCode) {
  const result = await pool.request()
    .input('clubCode', sql.NVarChar, clubCode)
    .query(`
      select top 1 ClubCode, ClubName
      from clubcontacts
      where ClubCode = @clubCode
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Club was not found.');
    error.statusCode = 404;
    error.code = 'ERR_CLUB_NOT_FOUND';
    throw error;
  }

  return mapSanctionClub(result.recordset[0]);
}

export async function getRenewalStatuses(pool, clubCode, sanctionIds) {
  const statuses = new Map();

  if (sanctionIds.length === 0) {
    return statuses;
  }

  const request = pool.request()
    .input('clubCode', sql.NVarChar, clubCode);
  const placeholders = sanctionIds.map((sanctionId, index) => {
    const name = `sanctionId${index}`;
    request.input(name, sql.NVarChar, sanctionId);
    return `@${name}`;
  });
  const result = await request.query(`
    select sanctionid, sanctionStatus
    from sanction_requested
    where clubcode = @clubCode
      and sanctionid in (${placeholders.join(', ')})
  `);

  for (const row of result.recordset) {
    statuses.set(text(row.sanctionid), text(row.sanctionStatus));
  }

  return statuses;
}

export async function getSanctionRequestRow(pool, clubCode, requestId) {
  const parsedRequestId = Number(requestId);

  if (!Number.isInteger(parsedRequestId)) {
    const error = new Error('Sanction request was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_REQUEST_NOT_FOUND';
    throw error;
  }

  const result = await pool.request()
    .input('id', sql.Int, parsedRequestId)
    .input('clubCode', sql.NVarChar, clubCode)
    .query(`
      select top 1
        sr.*,
        cc.ClubName,
        (case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) as weekNumber
      from sanction_requested sr
      left join clubcontacts cc on sr.clubcode = cc.ClubCode
      where sr.id = @id
        and sr.clubcode = @clubCode
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Sanction request was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_REQUEST_NOT_FOUND';
    throw error;
  }

  return result.recordset[0];
}

export function ensureEditableSanctionRequest(row) {
  if (!['Pending', 'Question'].includes(text(row.sanctionStatus))) {
    const error = new Error('Approved sanction requests cannot be edited or deleted.');
    error.statusCode = 409;
    error.code = 'ERR_SANCTION_REQUEST_LOCKED';
    throw error;
  }
}

export function mapSanctionRequestDetail(row) {
  return {
    id: String(row.id),
    club: {
      clubCode: text(row.clubcode),
      clubName: text(row.ClubName)
    },
    sanctionId: text(row.sanctionid),
    sanctionStatus: text(row.sanctionStatus),
    submitDate: toDate(row.submitDate),
    weekNumber: row.weekNumber ?? null,
    canModify: ['Pending', 'Question'].includes(text(row.sanctionStatus)),
    request: {
      sanctionId: text(row.sanctionid),
      tournamentContactName: text(row.TournamentContact_name),
      tournamentDirectorName: text(row.TournamentDirector_Name),
      tournamentContactAddress: text(row.TournamentContact_address),
      tournamentDirectorEmail: text(row.TournamentDirector_Email),
      tournamentDirectorHomePhone: text(row.TournamentDirector_homePhone),
      tournamentDirectorTournamentPhone: text(row.TournamentDirector_TournamentPhone),
      date: toDate(row.dte),
      startTime: formatDisplayTime(row.startTime) || '8:30 AM',
      division: text(row.division),
      numberOfTeams: formString(row.number_of_teams),
      minimumNumberOfTeams: formString(row.min_number_of_teams),
      tournamentName: text(row.tournname),
      site: text(row.site),
      siteAddress: text(row.taddr),
      type: text(row.type),
      entryFee: formString(row.entry_fee),
      checkPayableTo: text(row.check_payable_to),
      paymentType: normalizePaymentTypes(row.paymentType),
      creditCardPayment: text(row.CCPayment) || (normalizePaymentTypes(row.paymentType).includes('Credit Card') ? 'Y' : 'N'),
      paymentUrl: text(row.paymentURL),
      singleAgeGroupOpen: text(row.SAGO) || 'N',
      hdp: text(row.HDP) === 'Y' ? 'Y' : 'N',
      poolPlay: text(row.pool_play),
      playoffFormat: text(row.playoff_format),
      quarterFinals: text(row.qtr_finals),
      semiFinals: text(row.semi_finals),
      finals: text(row.finals),
      showers: text(row.showers),
      awards: text(row.awards),
      food: text(row.food),
      lockerRoom: text(row.locker_room),
      information: text(row.information),
      requester: text(row.requester),
      expenseFacility: formString(row.Expense_facility),
      expenseOfficialsFees: formString(row.Expense_officialsFees),
      expenseVolleyballs: formString(row.Expense_volleyballs),
      expenseAwards: formString(row.Expense_awards),
      expenseSupplies: formString(row.Expense_supplies),
      expenseOther: formString(row.Expense_other),
      otherIncome: formString(row.otherIncome),
      netIncome: formString(row.netIncome)
    }
  };
}

export async function queryOptional(pool, query) {
  try {
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    if (error.code === 'EREQUEST' && /Invalid object name/i.test(error.message)) {
      return [];
    }

    throw error;
  }
}

export async function getAdminSanctionRequestOptions(pool, season, configuredSeasons) {
  const seasons = await pool.request().query(`
    select distinct datepart(year, dte) as season
    from sanction_requested
    where dte is not null
    order by datepart(year, dte) desc
  `);
  const ageGroups = await pool.request().query(`
    select distinct agegroup
    from tblagegroups
    where grouping in ('Juniors', 'Boys')
      and agegroup is not null
    order by agegroup
  `);
  const clubs = await pool.request()
    .input('seasonStart', sql.Date, `${season - 1}-10-01`)
    .input('seasonEnd', sql.Date, `${season}-12-31`)
    .query(`
      select distinct
        sr.clubcode,
        cc.ClubName
      from sanction_requested sr
      left join clubcontacts cc on sr.clubcode = cc.ClubCode
      where sr.clubcode is not null
        and sr.dte > @seasonStart
        and sr.dte < @seasonEnd
      order by cc.ClubName, sr.clubcode
    `);

  const seasonOptions = new Set([
    ...configuredSeasons.map((option) => String(option)),
    ...seasons.recordset.map((row) => String(row.season)).filter(Boolean)
  ]);

  return {
    seasons: [...seasonOptions].sort((a, b) => Number(b) - Number(a)),
    ageGroups: ageGroups.recordset.map((row) => text(row.agegroup)).filter(Boolean),
    clubs: clubs.recordset.map((row) => ({
      clubCode: text(row.clubcode),
      clubName: text(row.ClubName)
    })).filter((club) => club.clubCode)
  };
}

export async function getAdminSanctionRequestCounts(pool, filters, season) {
  const request = pool.request();
  const where = addAdminSanctionRequestFilters(whereBase(), request, filters, season, { includeStatus: false });
  const result = await request.query(`
    select
      count(*) as total,
      sum(case when sanctionStatus = 'Pending' then 1 else 0 end) as pending,
      sum(case when sanctionStatus in ('Approved', 'SO') then 1 else 0 end) as approved,
      sum(case when sanctionStatus = 'Denied' then 1 else 0 end) as denied,
      sum(case when lower(sanctionStatus) = 'cancelled' then 1 else 0 end) as cancelled,
      sum(case when HDP = 'Y' then 1 else 0 end) as hdp,
      sum(case when SAGO = 'Y' then 1 else 0 end) as sago
    from sanction_requested sr
    where ${where.join(' and ')}
  `);
  const row = result.recordset[0] ?? {};

  return {
    total: row.total ?? 0,
    pending: row.pending ?? 0,
    approved: row.approved ?? 0,
    denied: row.denied ?? 0,
    cancelled: row.cancelled ?? 0,
    hdp: row.hdp ?? 0,
    sago: row.sago ?? 0
  };
}

export async function getDuplicateAdminSanctionIds(pool, filters, season) {
  const request = pool.request();
  const where = addAdminSanctionRequestFilters(whereBase(), request, filters, season, {
    includeStatus: false,
    includeHdp: false,
    includeSago: false
  });
  where.push("sr.sanctionStatus in ('Approved', 'Posted')");
  where.push("sr.sanctionid not in ('New', 'Denied')");
  where.push("sr.sanctionid is not null");

  const result = await request.query(`
    select sr.sanctionid, count(*) as duplicateCount
    from sanction_requested sr
    where ${where.join(' and ')}
    group by sr.sanctionid
    having count(*) > 1
    order by sr.sanctionid
  `);

  return result.recordset.map((row) => ({
    sanctionId: text(row.sanctionid),
    count: row.duplicateCount ?? 0
  }));
}

export async function getAdminSanctionRequestById(pool, id) {
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      with request as (
        select
          sr.*,
          (case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) as weekNumber,
          (case
            when datepart(weekday, sr.dte) > 5 then dateadd(week, -3, dateadd(day, 4, dateadd(week, datediff(week, 0, sr.dte), 0)))
            else dateadd(week, -3, dateadd(day, -3, dateadd(week, datediff(week, 0, sr.dte), 0)))
          end) as computedCloseDate
        from sanction_requested sr
        where sr.id = @id
      ),
      archive as (
        select uniqueid, max(status) as archiveStatus
        from sanctionArchive
        group by uniqueid
      )
      select
        r.id,
        r.sanctionid,
        r.sanctionStatus,
        r.sanctionNotes,
        r.submitDate,
        r.dte,
        r.startTime,
        r.priority,
        r.division,
        r.type,
        r.number_of_teams,
        r.entry_fee,
        r.tournname,
        r.site,
        r.clubcode,
        r.HDP,
        r.SAGO,
        r.AES_added,
        r.TournamentDirector_Email,
        r.TournamentDirector_Name,
        r.weekNumber,
        r.computedCloseDate,
        cc.ClubName,
        sd.id as specialDateId,
        sd.label as specialDateLabel,
        sd.notes as specialDateNotes,
        archive.archiveStatus
      from request r
      left join clubcontacts cc on r.clubcode = cc.ClubCode
      left join sanction_specialDates sd on r.weekNumber = sd.week
      left join archive on r.sanctionid = archive.uniqueid
    `);

  return result.recordset[0] ? mapAdminSanctionRequest(result.recordset[0]) : null;
}

export async function getNextSanctionId(pool, division, dateValue) {
  const code = getSanctionDivisionCode(division);
  const year = dateValue ? new Date(dateValue).getFullYear() : Number(getAppConfig().currentSeason);
  const yy = String(year).slice(-2);

  if (!code) {
    const error = new Error('A sanction ID is required for this division.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const prefix = `${code}-%`;
  const result = await pool.request()
    .input('prefix', sql.NVarChar, `${prefix}%`)
    .input('yy', sql.NVarChar, `_${yy}`)
    .query(`
      select max(try_convert(int, substring(
        sanctionid,
        charindex('-', sanctionid) + 1,
        charindex('_', sanctionid) - charindex('-', sanctionid) - 1
      ))) as maxNumber
      from sanction_requested
      where sanctionid like @prefix
        and right(sanctionid, 3) = @yy
        and sanctionStatus not in ('SO', 'Denied')
        and charindex('-', sanctionid) > 0
        and charindex('_', sanctionid) > charindex('-', sanctionid)
    `);
  const next = (result.recordset[0]?.maxNumber ?? 0) + 1;
  const padded = next < 10 ? `0${next}` : String(next);

  return `${code}-${padded}_${yy}`;
}

export function getSanctionDivisionCode(division) {
  const normalized = text(division).toLowerCase();
  const suffix = normalized.startsWith('boys') ? 'B' : '';
  const numbers = normalized.match(/\d+/g) ?? [];

  if (numbers.length === 0) {
    return '';
  }

  const ordered = numbers
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b)
    .join('');

  return ordered ? `CH${ordered}${suffix}` : '';
}

export function addAdminSanctionRequestFilters(where, request, filters, season, options = {}) {
  const includeStatus = options.includeStatus !== false;
  const includeHdp = options.includeHdp !== false;
  const includeSago = options.includeSago !== false;
  const divisions = text(filters.get('divisions')).split(',').map(text).filter(Boolean);
  const weekNumber = Number.parseInt(filters.get('weekNumber'), 10);

  request.input('seasonStart', sql.Date, `${season - 1}-10-01`);
  request.input('seasonEnd', sql.Date, `${season}-12-31`);

  if (divisions.length > 0) {
    const placeholders = divisions.map((division, index) => {
      const name = `division${index}`;
      request.input(name, sql.NVarChar, division);
      return `@${name}`;
    });
    where.push(`sr.division in (${placeholders.join(', ')})`);
  }

  addExact(where, request, 'clubCode', 'sr.clubcode', filters.get('clubCode'));
  addExact(where, request, 'tournamentType', 'sr.type', filters.get('tournamentType'));
  addExact(where, request, 'duplicateSanctionId', 'sr.sanctionid', filters.get('duplicateSanctionId'));

  if (Number.isInteger(weekNumber) && weekNumber > 0) {
    request.input('weekNumber', sql.Int, weekNumber);
    where.push('(case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) = @weekNumber');
  }

  addDateRange(where, request, 'fromDate', 'toDate', 'sr.dte', filters.get('fromDate'), filters.get('toDate'));

  if (includeStatus) {
    switch (text(filters.get('status')).toLowerCase()) {
      case 'pending':
        where.push("sr.sanctionStatus = 'Pending'");
        break;
      case 'approved':
        where.push("sr.sanctionStatus in ('Approved', 'SO')");
        break;
      case 'denied':
        where.push("sr.sanctionStatus = 'Denied'");
        break;
      case 'cancelled':
        where.push("lower(sr.sanctionStatus) = 'cancelled'");
        break;
      case 'question':
        where.push("sr.sanctionStatus like 'Q%'");
        break;
      default:
        break;
    }
  }

  if (includeHdp && filters.get('hdpOnly') === 'true') {
    where.push("sr.HDP = 'Y'");
  }

  if (includeSago && filters.get('sagoOnly') === 'true') {
    where.push("sr.SAGO = 'Y'");
  }

  return where;
}

export function whereBase() {
  return [
    'sr.dte > @seasonStart',
    'sr.dte < @seasonEnd'
  ];
}

export function addDateRange(where, request, fromName, toName, column, fromValue, toValue) {
  const fromDate = text(fromValue);
  const toDate = text(toValue);

  if (fromDate) {
    request.input(fromName, sql.Date, fromDate);
    where.push(`cast(${column} as date) >= @${fromName}`);
  }

  if (toDate) {
    request.input(toName, sql.Date, toDate);
    where.push(`cast(${column} as date) <= @${toName}`);
  }
}

export function mapAdminSanctionRequest(row) {
  const division = text(row.division);
  const sanctionId = text(row.sanctionid);

  return {
    id: String(row.id),
    sanctionId,
    suggestedSanctionId: '',
    sanctionStatus: text(row.sanctionStatus),
    statusCode: text(row.sanctionStatus).slice(0, 2),
    archiveStatus: text(row.archiveStatus).slice(0, 1),
    sanctionNotes: text(row.sanctionNotes),
    submitDate: toDate(row.submitDate),
    date: toDate(row.dte),
    startTime: toTime(row.startTime),
    closeDate: toDate(row.computedCloseDate),
    priority: row.priority == null ? null : String(row.priority),
    division,
    divisionLabel: division.replace(/^Girls\s+/i, ''),
    type: text(row.type),
    teamCount: row.number_of_teams ?? null,
    entryFee: toNumber(row.entry_fee),
    name: text(row.tournname),
    site: text(row.site),
    clubCode: text(row.clubcode),
    clubName: text(row.ClubName),
    hdp: text(row.HDP) === 'Y',
    sago: text(row.SAGO) === 'Y',
    addedToAes: row.AES_added != null,
    tournamentDirectorEmail: text(row.TournamentDirector_Email),
    tournamentDirectorName: text(row.TournamentDirector_Name),
    weekNumber: row.weekNumber ?? null,
    specialDate: {
      id: row.specialDateId == null ? null : String(row.specialDateId),
      label: text(row.specialDateLabel),
      notes: text(row.specialDateNotes)
    },
    sanctionDivisionMismatch: hasSanctionDivisionMismatch(sanctionId, division)
  };
}

export function hasSanctionDivisionMismatch(sanctionId, division) {
  if (!sanctionId || sanctionId === 'New' || sanctionId === 'Denied') {
    return false;
  }

  if (sanctionId.startsWith('CHReg') || sanctionId.startsWith('CHB') || division.startsWith('Boys')) {
    return false;
  }

  const hyphenIndex = sanctionId.indexOf('-');

  if (hyphenIndex < 0) {
    return false;
  }

  const sanctionDivision = sanctionId.slice(2, hyphenIndex);
  const expectedDivision = girlsDivisionCode(division);
  return expectedDivision !== '0' && sanctionDivision !== expectedDivision;
}

export function girlsDivisionCode(division) {
  const normalized = text(division);
  const lookup = {
    'Girls 10': '10',
    'Girls 11': '11',
    'Girls 12': '12',
    'Girls 13': '13',
    'Girls 14': '14',
    'Girls 15': '15',
    'Girls 16': '16',
    'Girls 17': '17',
    'Girls 18': '18',
    'Girls 12/11': '1112',
    'Girls 14/13': '1314',
    'Girls 16/15': '1516',
    'Girls 18/17': '1718'
  };

  return lookup[normalized] ?? '0';
}

export function mapSanctionClub(row) {
  return {
    clubCode: text(row.ClubCode),
    clubName: text(row.ClubName)
  };
}

export function seasonSuffix(season) {
  return `_${String(season).replace(/^20/, '')}`;
}

export function addWeeksDate(value, weeks) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  date.setDate(date.getDate() + (weeks * 7));
  return toDate(date);
}

export function buildStartTimes() {
  const times = [];
  const current = new Date('2000-01-01T08:00:00');
  const end = new Date('2000-01-01T15:00:00');

  while (current <= end) {
    times.push(current.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }));
    current.setMinutes(current.getMinutes() + 15);
  }

  return times;
}

export async function getPool() {
  poolPromise ??= sql.connect(await readDbConfig());
  return poolPromise;
}

export async function readDbConfig() {
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

export function addStartsWith(where, request, name, column, value) {
  const normalized = text(value);
  if (!normalized) {
    return;
  }
  request.input(name, sql.NVarChar, `${normalized}%`);
  where.push(`${column} like @${name}`);
}

export function addExact(where, request, name, column, value) {
  const normalized = text(value);
  if (!normalized) {
    return;
  }
  request.input(name, sql.NVarChar, normalized);
  where.push(`${column} = @${name}`);
}

export function addExactDate(where, request, name, column, value) {
  const normalized = text(value);
  if (!normalized) {
    return;
  }
  request.input(name, sql.Date, normalized);
  where.push(`cast(${column} as date) = @${name}`);
}

export function normalizeSanctionRequestInput(body) {
  const numberOfTeams = wholeNumber(body?.numberOfTeams);
  const entryFee = money(body?.entryFee);
  const expenseSanctionFees = numberOfTeams * 7;
  const totalbox = entryFee * numberOfTeams;
  const expenseFacility = money(body?.expenseFacility);
  const expenseOfficialsFees = money(body?.expenseOfficialsFees);
  const expenseVolleyballs = money(body?.expenseVolleyballs);
  const expenseAwards = money(body?.expenseAwards);
  const expenseSupplies = money(body?.expenseSupplies);
  const expenseOther = money(body?.expenseOther);
  const expenseTotals = expenseFacility
    + expenseSanctionFees
    + expenseOfficialsFees
    + expenseVolleyballs
    + expenseAwards
    + expenseSupplies
    + expenseOther;
  const otherIncome = money(body?.otherIncome);
  const paymentTypes = Array.isArray(body?.paymentType)
    ? body.paymentType.map(text).filter(Boolean)
    : text(body?.paymentType).split(',').map(text).filter(Boolean);

  return {
    sanctionId: text(body?.sanctionId),
    tournamentContactName: text(body?.tournamentContactName),
    tournamentDirectorName: text(body?.tournamentDirectorName),
    tournamentContactAddress: text(body?.tournamentContactAddress),
    tournamentDirectorEmail: text(body?.tournamentDirectorEmail),
    tournamentDirectorHomePhone: text(body?.tournamentDirectorHomePhone),
    tournamentDirectorTournamentPhone: text(body?.tournamentDirectorTournamentPhone),
    date: text(body?.date),
    startTime: parseStartTime(body?.startTime),
    division: text(body?.division),
    numberOfTeams,
    minimumNumberOfTeams: nullableWholeNumber(body?.minimumNumberOfTeams),
    tournamentName: text(body?.tournamentName),
    site: text(body?.site),
    siteAddress: text(body?.siteAddress),
    type: text(body?.type),
    entryFee,
    checkPayableTo: text(body?.checkPayableTo),
    paymentType: paymentTypes.join(', '),
    creditCardPayment: paymentTypes.includes('Credit Card') ? 'Y' : 'N',
    paymentUrl: text(body?.paymentUrl),
    singleAgeGroupOpen: yn(body?.singleAgeGroupOpen),
    hdp: yn(body?.hdp),
    poolPlay: text(body?.poolPlay),
    playoffFormat: text(body?.playoffFormat),
    quarterFinals: text(body?.quarterFinals),
    semiFinals: text(body?.semiFinals),
    finals: text(body?.finals),
    showers: text(body?.showers),
    awards: text(body?.awards),
    food: text(body?.food),
    lockerRoom: text(body?.lockerRoom),
    information: text(body?.information),
    requester: text(body?.requester),
    expenseFacility,
    expenseSanctionFees,
    expenseOfficialsFees,
    expenseVolleyballs,
    expenseAwards,
    expenseSupplies,
    expenseOther,
    expenseTotals,
    fee: entryFee,
    teams: numberOfTeams,
    totalbox,
    otherIncome,
    netIncome: otherIncome + totalbox - expenseTotals
  };
}

export function validateSanctionRequest(request) {
  const required = [
    ['tournamentContactName', 'Club Contact Name'],
    ['tournamentDirectorName', 'Tournament Director Name'],
    ['tournamentContactAddress', 'Tournament Contact Address'],
    ['tournamentDirectorEmail', 'Tournament Director Email'],
    ['tournamentDirectorHomePhone', 'Tournament Director Phone'],
    ['tournamentDirectorTournamentPhone', 'Cell Phone'],
    ['date', 'Tournament Date'],
    ['startTime', 'Start Time'],
    ['division', 'Age Group'],
    ['tournamentName', 'Tournament Name'],
    ['site', 'Tournament Site'],
    ['siteAddress', 'Tournament Address'],
    ['type', 'Type'],
    ['checkPayableTo', 'Make Check Payable To'],
    ['paymentType', 'Accepted Payment Types'],
    ['requester', 'Person Submitting Request']
  ];
  const errors = required
    .filter(([key]) => !request[key])
    .map(([, label]) => `${label} is required.`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date)) {
    errors.push('Tournament Date must be a valid date.');
  }

  if (!request.numberOfTeams || request.numberOfTeams <= 0) {
    errors.push('Number of Teams must be greater than 0.');
  }

  if (request.minimumNumberOfTeams != null && request.minimumNumberOfTeams <= 0) {
    errors.push('Minimum Teams must be greater than 0.');
  }

  if (!request.entryFee || request.entryFee <= 0) {
    errors.push('Tournament Fee must be greater than 0.');
  }

  if (request.tournamentDirectorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.tournamentDirectorEmail)) {
    errors.push('Tournament Director Email must be valid.');
  }

  if (request.paymentType.length > 50) {
    errors.push('Accepted Payment Types must be 50 characters or fewer.');
  }

  if (request.netIncome > 250) {
    errors.push('Net Income exceeds a valid limit. Modify your tournament fee or worksheet.');
  }

  return errors;
}

export function normalizeClubInput(body) {
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
    username: text(body?.username),
    password: text(body?.password),
    comments: text(body?.comments),
    clubType: text(body?.clubType) || 'G',
    active: body?.active === false ? 'N' : 'Y'
  };
}

export function validateClub(club) {
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

  if (club.password.length > 15) {
    errors.push('Password must be 15 characters or fewer.');
  }

  return errors;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function normalizeWebsite(value) {
  return text(value).replace(/^https?:\/\//i, '').replace(/^\/\//, '');
}

export function html(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function text(value) {
  return String(value ?? '').trim();
}

export function formatUsDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return text(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  }).format(date);
}

export function toDate(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString().slice(0, 10);
}

export function normalizeNullableDate(value) {
  const normalized = text(value);

  if (!normalized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const error = new Error('Added to AES must be a valid date.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  return normalized;
}

export function parseStartTime(value) {
  const normalized = text(value);
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }

  return new Date(1970, 0, 1, hours, minutes, 0);
}

export function toTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }

  return text(value).slice(0, 5) || null;
}

export function toNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

export function wholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : 0;
}

export function nullableWholeNumber(value) {
  const normalized = text(value);

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);
  return Number.isInteger(number) ? number : 0;
}

export function yn(value) {
  return text(value).toUpperCase() === 'Y' ? 'Y' : 'N';
}

export function formString(value) {
  if (value == null || value === '') {
    return '';
  }

  return String(value).trim();
}

export function normalizePaymentTypes(value) {
  const normalized = text(value).toLowerCase();
  const types = [];

  if (normalized.includes('credit card')) {
    types.push('Credit Card');
  }

  if (normalized.includes('zelle')) {
    types.push('Zelle');
  }

  if (normalized.includes('venmo')) {
    types.push('Venmo');
  }

  if (normalized.includes('check')) {
    types.push('Check');
  }

  return types.length > 0 ? types : ['Credit Card'];
}

export function formatDisplayTime(value) {
  if (!value) {
    return '';
  }

  const stringValue = text(value);
  const timeMatch = stringValue.match(/^(\d{1,2}):(\d{2})/);

  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    const meridiem = hours >= 12 ? 'PM' : 'AM';

    if (hours === 0) {
      hours = 12;
    } else if (hours > 12) {
      hours -= 12;
    }

    return `${hours}:${minutes} ${meridiem}`;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}
