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

export async function authenticateSanctionClub(username, password) {
  const pool = await getPool();
  const result = await pool.request()
    .input('username', sql.NVarChar, text(username))
    .input('password', sql.NVarChar, text(password))
    .query(`
      select top 1 ClubCode, ClubName
      from clubcontacts
      where username = @username
        and password = @password
        and active = 'Y'
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  return mapSanctionClub(result.recordset[0]);
}

export async function getSanctionRequestHistory(clubCode) {
  const pool = await getPool();
  const config = getAppConfig();
  const previousSeason = Number(config.previousSeason);
  const currentSeason = Number(config.currentSeason);
  const appendPrevious = seasonSuffix(previousSeason);
  const appendCurrent = seasonSuffix(currentSeason);
  const pushWeeks = currentSeason === 2016 || currentSeason === 2022 ? 1 : 0;
  const club = await getSanctionClub(pool, clubCode);

  const result = await pool.request()
    .input('clubCode', sql.NVarChar, clubCode)
    .input('seasonStart', sql.Date, `${previousSeason - 1}-10-01`)
    .input('seasonEnd', sql.Date, `${previousSeason}-12-31`)
    .query(`
      select
        id,
        sanctionid,
        dte,
        division,
        type,
        number_of_teams,
        site,
        HDP,
        status,
        sanctionStatus,
        (case when datepart(w, dte) = 1 then datepart(ww, dte) - 1 else datepart(ww, dte) end) as weekNumber
      from sanction_requested
      where clubcode = @clubCode
        and sanctionid not like '%C'
        and dte > @seasonStart
        and dte < @seasonEnd
        and sanctionStatus in ('Approved', 'Cancelled')
      order by dte, division
    `);

  const renewalIds = result.recordset
    .map((row) => text(row.sanctionid).replace(appendPrevious, appendCurrent))
    .filter(Boolean);
  const renewalStatuses = await getRenewalStatuses(pool, clubCode, renewalIds);

  return {
    club,
    previousSeason: String(previousSeason),
    currentSeason: String(currentSeason),
    tournaments: result.recordset.map((row) => {
      const renewalSanctionId = text(row.sanctionid).replace(appendPrevious, appendCurrent);

      return {
        id: String(row.id),
        sanctionId: text(row.sanctionid),
        renewalSanctionId,
        date: toDate(row.dte),
        proposedRenewalDate: addWeeksDate(row.dte, 52 + pushWeeks),
        weekNumber: row.weekNumber ?? null,
        division: text(row.division),
        type: text(row.type),
        teamCount: row.number_of_teams ?? null,
        site: text(row.site),
        hdp: text(row.HDP) === 'Y',
        status: text(row.status),
        sanctionStatus: text(row.sanctionStatus),
        renewalStatus: renewalStatuses.get(renewalSanctionId) ?? null
      };
    })
  };
}

export async function getCurrentSanctionRequests(clubCode) {
  const pool = await getPool();
  const config = getAppConfig();
  const previousSeason = Number(config.previousSeason);
  const currentSeason = Number(config.currentSeason);
  const club = await getSanctionClub(pool, clubCode);
  const result = await pool.request()
    .input('clubCode', sql.NVarChar, clubCode)
    .input('seasonStart', sql.Date, `${previousSeason}-10-01`)
    .query(`
      select
        sr.id,
        sr.sanctionid,
        sr.sanctionStatus,
        sr.dte,
        sr.division,
        sr.type,
        sr.number_of_teams,
        sr.entry_fee,
        sr.tournname,
        sr.site,
        sr.HDP,
        sr.sanctionNotes,
        tn.notes,
        (case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) as weekNumber
      from sanction_requested sr
      left join tournamentNotes tn on sr.sanctionid = tn.SanctionKey
      where sr.clubcode = @clubCode
        and sr.dte > @seasonStart
      order by sr.sanctionStatus, sr.dte, sr.division
    `);

  return {
    club,
    currentSeason: String(currentSeason),
    requests: result.recordset.map((row) => ({
      id: String(row.id),
      sanctionId: text(row.sanctionid),
      sanctionStatus: text(row.sanctionStatus),
      date: toDate(row.dte),
      weekNumber: row.weekNumber ?? null,
      division: text(row.division),
      type: text(row.type),
      teamCount: row.number_of_teams ?? null,
      entryFee: toNumber(row.entry_fee),
      name: text(row.tournname),
      site: text(row.site),
      hdp: text(row.HDP) === 'Y',
      sanctionNotes: text(row.sanctionNotes),
      tournamentNotes: text(row.notes),
      canModify: ['Pending', 'Question'].includes(text(row.sanctionStatus))
    }))
  };
}

export async function getSanctionRequestFormOptions(clubCode) {
  const pool = await getPool();
  const club = await getSanctionClub(pool, clubCode);
  const venues = await queryOptional(pool, `
    select name, address
    from venues
    order by name
  `);
  const ageGroups = await queryOptional(pool, `
    select agegroup
    from tblagegroups
    where (substring(agegroup, 1, 1) = 'G' or substring(agegroup, 1, 1) = 'B')
      and year = '2023'
    order by agegroup
  `);

  return {
    club,
    venues: venues.map((row) => ({
      name: text(row.name),
      address: text(row.address)
    })).filter((venue) => venue.name && venue.address),
    ageGroups: ageGroups.map((row) => text(row.agegroup)).filter(Boolean),
    startTimes: buildStartTimes()
  };
}

export async function createSanctionRequest(clubCode, body) {
  const pool = await getPool();
  const config = getAppConfig();
  const club = await getSanctionClub(pool, clubCode);
  const request = normalizeSanctionRequestInput(body);
  const errors = validateSanctionRequest(request);

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const result = await pool.request()
    .input('sanctionid', sql.NVarChar, 'New')
    .input('dte', sql.Date, request.date)
    .input('startTime', sql.Time, request.startTime)
    .input('clubcode', sql.NVarChar, club.clubCode)
    .input('tournname', sql.NVarChar, request.tournamentName)
    .input('taddr', sql.NVarChar, request.siteAddress)
    .input('tournhost', sql.NVarChar, club.clubName)
    .input('site', sql.NVarChar, request.site)
    .input('numberOfTeams', sql.Int, request.numberOfTeams)
    .input('minimumNumberOfTeams', sql.Int, request.minimumNumberOfTeams)
    .input('agedivision', sql.NVarChar, 'Juniors')
    .input('division', sql.NVarChar, request.division)
    .input('entryFee', sql.Money, request.entryFee)
    .input('paymentType', sql.VarChar, request.paymentType)
    .input('checkPayableTo', sql.NVarChar, request.checkPayableTo)
    .input('creditCardPayment', sql.Char, request.creditCardPayment)
    .input('paymentUrl', sql.NVarChar, request.paymentUrl)
    .input('awards', sql.NVarChar, request.awards)
    .input('poolPlay', sql.NVarChar, request.poolPlay)
    .input('playoffFormat', sql.NVarChar, request.playoffFormat)
    .input('quarterFinals', sql.NVarChar, request.quarterFinals)
    .input('semiFinals', sql.NVarChar, request.semiFinals)
    .input('finals', sql.NVarChar, request.finals)
    .input('lockerRoom', sql.NVarChar, request.lockerRoom)
    .input('showers', sql.NVarChar, request.showers)
    .input('food', sql.NVarChar, request.food)
    .input('type', sql.NVarChar, request.type)
    .input('hdp', sql.Char, request.hdp)
    .input('season', sql.Char, config.currentSeason)
    .input('tournamentContactAddress', sql.NVarChar, request.tournamentContactAddress)
    .input('tournamentDirectorName', sql.NVarChar, request.tournamentDirectorName)
    .input('tournamentDirectorEmail', sql.NVarChar, request.tournamentDirectorEmail)
    .input('tournamentDirectorHomePhone', sql.NVarChar, request.tournamentDirectorHomePhone)
    .input('tournamentDirectorTournamentPhone', sql.NVarChar, request.tournamentDirectorTournamentPhone)
    .input('expenseFacility', sql.Decimal(10, 2), request.expenseFacility)
    .input('expenseSanctionFees', sql.Decimal(10, 2), request.expenseSanctionFees)
    .input('expenseOfficialsFees', sql.Decimal(10, 2), request.expenseOfficialsFees)
    .input('expenseVolleyballs', sql.Decimal(10, 2), request.expenseVolleyballs)
    .input('expenseAwards', sql.Decimal(10, 2), request.expenseAwards)
    .input('expenseSupplies', sql.Decimal(10, 2), request.expenseSupplies)
    .input('expenseOther', sql.Decimal(10, 2), request.expenseOther)
    .input('expenseTotals', sql.Decimal(10, 2), request.expenseTotals)
    .input('fee', sql.Decimal(10, 2), request.fee)
    .input('teams', sql.Int, request.teams)
    .input('totalbox', sql.Decimal(10, 2), request.totalbox)
    .input('otherIncome', sql.Decimal(10, 2), request.otherIncome)
    .input('netIncome', sql.Decimal(10, 2), request.netIncome)
    .input('tournamentContactName', sql.NVarChar, request.tournamentContactName)
    .input('information', sql.Text, request.information)
    .input('singleAgeGroupOpen', sql.VarChar, request.singleAgeGroupOpen)
    .input('requester', sql.NVarChar, request.requester)
    .query(`
      insert into sanction_requested (
        sanctionid,
        dte,
        startTime,
        clubcode,
        tournname,
        taddr,
        tournhost,
        site,
        number_of_teams,
        min_number_of_teams,
        agedivision,
        division,
        entry_fee,
        paymentType,
        check_payable_to,
        CCPayment,
        paymentURL,
        awards,
        display_this_record,
        pool_play,
        playoff_format,
        qtr_finals,
        semi_finals,
        finals,
        locker_room,
        showers,
        food,
        type,
        status,
        priority,
        HDP,
        season,
        TournamentContact_address,
        TournamentDirector_Name,
        TournamentDirector_Email,
        TournamentDirector_homePhone,
        TournamentDirector_TournamentPhone,
        Expense_facility,
        Expense_sanctionFees,
        Expense_officialsFees,
        Expense_volleyballs,
        Expense_awards,
        Expense_supplies,
        Expense_other,
        Expense_totals,
        fee,
        teams,
        totalbox,
        otherIncome,
        netIncome,
        TournamentContact_name,
        information,
        SAGO,
        sanctionStatus,
        feeincrease,
        requester,
        posted
      )
      output inserted.id, inserted.sanctionid, inserted.sanctionStatus, inserted.submitDate
      values (
        @sanctionid,
        @dte,
        @startTime,
        @clubcode,
        @tournname,
        @taddr,
        @tournhost,
        @site,
        @numberOfTeams,
        @minimumNumberOfTeams,
        @agedivision,
        @division,
        @entryFee,
        @paymentType,
        @checkPayableTo,
        @creditCardPayment,
        @paymentUrl,
        @awards,
        'No',
        @poolPlay,
        @playoffFormat,
        @quarterFinals,
        @semiFinals,
        @finals,
        @lockerRoom,
        @showers,
        @food,
        @type,
        null,
        0,
        @hdp,
        @season,
        @tournamentContactAddress,
        @tournamentDirectorName,
        @tournamentDirectorEmail,
        @tournamentDirectorHomePhone,
        @tournamentDirectorTournamentPhone,
        @expenseFacility,
        @expenseSanctionFees,
        @expenseOfficialsFees,
        @expenseVolleyballs,
        @expenseAwards,
        @expenseSupplies,
        @expenseOther,
        @expenseTotals,
        @fee,
        @teams,
        @totalbox,
        @otherIncome,
        @netIncome,
        @tournamentContactName,
        @information,
        @singleAgeGroupOpen,
        'Pending',
        'N',
        @requester,
        'N'
      )
    `);

  const created = result.recordset[0];

  return {
    id: String(created.id),
    sanctionId: text(created.sanctionid),
    status: text(created.sanctionStatus),
    submittedDate: toDate(created.submitDate)
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

export async function updateTournamentAddedToAes(tournamentId, body) {
  const id = Number(tournamentId);
  const addedToAesDate = normalizeNullableDate(body?.addedToAesDate);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Tournament id is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('addedToAesDate', sql.Date, addedToAesDate)
    .query(`
      update sanction_requested
      set AES_added = @addedToAesDate
      output inserted.id, inserted.AES_added
      where id = @id
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Tournament was not found.');
    error.statusCode = 404;
    error.code = 'ERR_TOURNAMENT_NOT_FOUND';
    throw error;
  }

  return {
    id: String(result.recordset[0].id),
    addedToAesDate: toDate(result.recordset[0].AES_added)
  };
}

export async function updateTournamentOkToPay(tournamentId, body) {
  const id = Number(tournamentId);
  const okToPay = body?.okToPay === true ? 'Y' : 'N';

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Tournament id is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('okToPay', sql.NChar, okToPay)
    .query(`
      update sanction_requested
      set AES_okToPay = @okToPay
      output inserted.id, inserted.AES_okToPay
      where id = @id
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Tournament was not found.');
    error.statusCode = 404;
    error.code = 'ERR_TOURNAMENT_NOT_FOUND';
    throw error;
  }

  return {
    id: String(result.recordset[0].id),
    okToPay: text(result.recordset[0].AES_okToPay) === 'Y'
  };
}

async function getSanctionClub(pool, clubCode) {
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

async function getRenewalStatuses(pool, clubCode, sanctionIds) {
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

async function queryOptional(pool, query) {
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

function mapSanctionClub(row) {
  return {
    clubCode: text(row.ClubCode),
    clubName: text(row.ClubName)
  };
}

function seasonSuffix(season) {
  return `_${String(season).replace(/^20/, '')}`;
}

function addWeeksDate(value, weeks) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  date.setDate(date.getDate() + (weeks * 7));
  return toDate(date);
}

function buildStartTimes() {
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

function normalizeSanctionRequestInput(body) {
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

function validateSanctionRequest(request) {
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
    username: text(body?.username),
    password: text(body?.password),
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

  if (club.password.length > 15) {
    errors.push('Password must be 15 characters or fewer.');
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

function normalizeNullableDate(value) {
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

function parseStartTime(value) {
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

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function wholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : 0;
}

function nullableWholeNumber(value) {
  const normalized = text(value);

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);
  return Number.isInteger(number) ? number : 0;
}

function yn(value) {
  return text(value).toUpperCase() === 'Y' ? 'Y' : 'N';
}
