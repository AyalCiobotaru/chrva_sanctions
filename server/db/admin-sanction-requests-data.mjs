import sql from 'mssql';
import {
  SANCTION_FEE_PER_TEAM,
  SANCTION_NET_INCOME_LIMIT
} from './business-rules.mjs';
import {
  NO_REPLY_EMAIL_FROM,
  addAdminSanctionRequestFilters,
  appendEmailFooter,
  getAdminSanctionRequestById,
  getAdminSanctionRequestCounts,
  getAdminSanctionRequestOptions,
  getAppConfig,
  getDuplicateAdminSanctionIds,
  getNextSanctionId,
  getPool,
  getSanctionClub,
  getTournamentChairs,
  isEmailDeliveryConfigured,
  mapAdminSanctionRequest,
  mapSanctionRequestDetail,
  normalizeSanctionRequestInput,
  normalizeNullableDate,
  queryOptional,
  sendRecipientEmails,
  text,
  toDate,
  validateSanctionRequest,
  buildStartTimes,
  tournamentDirectorEmailFromOptions,
  uniqueEmails,
  whereBase
} from './shared.mjs';

export async function getAdminCurrentSanctionRequests(filters) {
  const pool = await getPool();
  const config = getAppConfig();
  const selectedSeason = Number.parseInt(filters.get('season') || config.currentSeason, 10);
  const season = Number.isInteger(selectedSeason) ? selectedSeason : Number(config.currentSeason);
  const configuredSeasons = [config.previousSeason, config.currentSeason, config.nextSeason]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  const options = await getAdminSanctionRequestOptions(pool, season, configuredSeasons);
  const request = pool.request();
  const where = addAdminSanctionRequestFilters(whereBase(), request, filters, season, { includeStatus: true });

  const result = await request.query(`
    with requests as (
      select
        sr.*,
        (case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) as weekNumber,
        (case
          when datepart(weekday, sr.dte) > 5 then dateadd(week, -3, dateadd(day, 4, dateadd(week, datediff(week, 0, sr.dte), 0)))
          else dateadd(week, -3, dateadd(day, -3, dateadd(week, datediff(week, 0, sr.dte), 0)))
        end) as computedCloseDate
      from sanction_requested sr
      where ${where.join(' and ')}
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
    from requests r
    left join clubcontacts cc on r.clubcode = cc.ClubCode
    left join sanction_specialDates sd on r.weekNumber = sd.week
    left join archive on r.sanctionid = archive.uniqueid
    order by r.weekNumber, r.division, r.priority, r.submitDate
  `);

  const counts = await getAdminSanctionRequestCounts(pool, filters, season);
  const duplicateSanctionIds = await getDuplicateAdminSanctionIds(pool, filters, season);

  return {
    season: String(season),
    options,
    counts,
    duplicateSanctionIds,
    requests: result.recordset.map(mapAdminSanctionRequest)
  };
}

export async function getTournamentDirectorEmailBroadcast(filters) {
  const pool = await getPool();
  const config = getAppConfig();
  const selectedSeason = Number.parseInt(filters.get('season') || config.currentSeason, 10);
  const season = Number.isInteger(selectedSeason) ? selectedSeason : Number(config.currentSeason);
  const request = pool.request();
  const where = addAdminSanctionRequestFilters(whereBase(), request, filters, season, { includeStatus: true });
  const result = await request.query(`
    select
      sr.TournamentDirector_Email,
      max(sr.TournamentDirector_Name) as TournamentDirector_Name,
      max(sr.tournhost) as tournhost,
      max(sr.clubcode) as clubcode
    from sanction_requested sr
    where ${where.join(' and ')}
      and isnull(sr.TournamentDirector_Email, '') <> ''
    group by sr.TournamentDirector_Email
    order by sr.TournamentDirector_Email
  `);

  const recipients = uniqueEmails(result.recordset.map((row) => ({
    email: text(row.TournamentDirector_Email),
    name: text(row.TournamentDirector_Name),
    clubName: text(row.tournhost)
  })));

  return {
    season: String(season),
    recipients,
    recipientCount: recipients.length,
    fromOptions: tournamentDirectorEmailFromOptions(),
    deliveryConfigured: isEmailDeliveryConfigured()
  };
}

export async function sendTournamentDirectorEmailBroadcast(filters, body) {
  const subject = text(body?.subject);
  const from = NO_REPLY_EMAIL_FROM;
  const information = text(body?.information);
  const broadcast = await getTournamentDirectorEmailBroadcast(filters);
  const recipients = Array.isArray(body?.recipients) && body.recipients.length > 0
    ? uniqueEmails(body.recipients.map((recipient) => ({
        email: text(typeof recipient === 'string' ? recipient : recipient?.email),
        name: text(recipient?.name),
        clubName: text(recipient?.clubName)
      })))
    : broadcast.recipients;
  const chairs = await getTournamentChairs(await getPool());
  const errors = [];

  if (!subject) {
    errors.push('Subject is required.');
  }

  if (recipients.length === 0) {
    errors.push('At least one tournament director recipient is required.');
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
    cc: chairs.map((chair) => chair.email),
    replyTo: chairs.map((chair) => chair.email),
    subject,
    html: appendEmailFooter(information)
  });

  return {
    sent: delivery.sent,
    dryRun: delivery.dryRun,
    recipientCount: recipients.length,
    message: delivery.dryRun
      ? 'Email delivery is not configured. This tournament director broadcast was validated but not sent.'
      : `Requestor email sent to ${recipients.length} recipient${recipients.length > 1 ? 's':''}.`
  };
}

export async function getAdminSanctionRequestDetail(requestId) {
  const id = Number(requestId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Sanction request id is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      select
        sr.*,
        cc.ClubName,
        (case when datepart(w, sr.dte) = 1 then datepart(ww, sr.dte) - 1 else datepart(ww, sr.dte) end) as weekNumber
      from sanction_requested sr
      left join clubcontacts cc on sr.clubcode = cc.ClubCode
      where sr.id = @id
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Sanction request was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_REQUEST_NOT_FOUND';
    throw error;
  }

  return mapSanctionRequestDetail(result.recordset[0]);
}

export async function getAdminSanctionRequestFormOptions(requestId) {
  const id = Number(requestId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Sanction request id is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const pool = await getPool();
  const requestResult = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      select top 1 clubcode
      from sanction_requested
      where id = @id
    `);

  if (requestResult.recordset.length === 0) {
    const error = new Error('Sanction request was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_REQUEST_NOT_FOUND';
    throw error;
  }

  const club = await getSanctionClub(pool, text(requestResult.recordset[0].clubcode));
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
    startTimes: buildStartTimes(),
    sanctionFeePerTeam: SANCTION_FEE_PER_TEAM,
    sanctionNetIncomeLimit: SANCTION_NET_INCOME_LIMIT
  };
}

export async function updateAdminSanctionRequest(requestId, body) {
  const id = Number(requestId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Sanction request id is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const request = normalizeSanctionRequestInput(body);
  const errors = validateSanctionRequest(request);

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const pool = await getPool();
  const existing = await getAdminSanctionRequestDetail(String(id));

  await pool.request()
    .input('id', sql.Int, id)
    .input('sanctionid', sql.NVarChar, request.sanctionId || existing.sanctionId)
    .input('dte', sql.Date, request.date)
    .input('startTime', sql.Time, request.startTime)
    .input('tournname', sql.NVarChar, request.tournamentName)
    .input('taddr', sql.NVarChar, request.siteAddress)
    .input('site', sql.NVarChar, request.site)
    .input('numberOfTeams', sql.Int, request.numberOfTeams)
    .input('minimumNumberOfTeams', sql.Int, request.minimumNumberOfTeams)
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
      update sanction_requested
      set
        sanctionid = @sanctionid,
        dte = @dte,
        startTime = @startTime,
        tournname = @tournname,
        taddr = @taddr,
        site = @site,
        number_of_teams = @numberOfTeams,
        min_number_of_teams = @minimumNumberOfTeams,
        division = @division,
        entry_fee = @entryFee,
        paymentType = @paymentType,
        check_payable_to = @checkPayableTo,
        CCPayment = @creditCardPayment,
        paymentURL = @paymentUrl,
        awards = @awards,
        pool_play = @poolPlay,
        playoff_format = @playoffFormat,
        qtr_finals = @quarterFinals,
        semi_finals = @semiFinals,
        finals = @finals,
        locker_room = @lockerRoom,
        showers = @showers,
        food = @food,
        type = @type,
        HDP = @hdp,
        TournamentContact_address = @tournamentContactAddress,
        TournamentDirector_Name = @tournamentDirectorName,
        TournamentDirector_Email = @tournamentDirectorEmail,
        TournamentDirector_homePhone = @tournamentDirectorHomePhone,
        TournamentDirector_TournamentPhone = @tournamentDirectorTournamentPhone,
        Expense_facility = @expenseFacility,
        Expense_sanctionFees = @expenseSanctionFees,
        Expense_officialsFees = @expenseOfficialsFees,
        Expense_volleyballs = @expenseVolleyballs,
        Expense_awards = @expenseAwards,
        Expense_supplies = @expenseSupplies,
        Expense_other = @expenseOther,
        Expense_totals = @expenseTotals,
        fee = @fee,
        teams = @teams,
        totalbox = @totalbox,
        otherIncome = @otherIncome,
        netIncome = @netIncome,
        TournamentContact_name = @tournamentContactName,
        information = @information,
        SAGO = @singleAgeGroupOpen,
        feeincrease = 'N',
        requester = @requester,
        updated = getdate()
      where id = @id
    `);

  return getAdminSanctionRequestDetail(String(id));
}

export async function updateAdminSanctionRequestReview(requestId, body) {
  const id = Number(requestId);
  const allowedStatuses = new Set([
    'Approved',
    'Denied',
    'Pending',
    'SO',
    'Posted',
    'Question',
    'Regionals',
    'Cancelled',
    'Suspended'
  ]);
  const sanctionStatus = text(body?.sanctionStatus);
  const priority = Number.parseInt(body?.priority, 10);
  let sanctionId = text(body?.sanctionId);
  const sanctionNotes = text(body?.sanctionNotes);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Sanction request id is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  if (!allowedStatuses.has(sanctionStatus)) {
    const error = new Error('Sanction status is invalid.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  if (!Number.isInteger(priority) || priority < 0 || priority > 9) {
    const error = new Error('Priority must be a number from 0 to 9.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const pool = await getPool();
  const existing = await getAdminSanctionRequestById(pool, id);

  if (!existing) {
    const error = new Error('Sanction request was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_REQUEST_NOT_FOUND';
    throw error;
  }

  if (sanctionStatus === 'Approved' && (!sanctionId || sanctionId === 'New')) {
    sanctionId = await getNextSanctionId(pool, existing.division, existing.date);
  }

  if (sanctionStatus === 'Denied' && (!sanctionId || sanctionId === 'New')) {
    sanctionId = 'Denied';
  }

  if (!sanctionId) {
    const error = new Error('Sanction ID is required.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  if (sanctionId.length > 15) {
    const error = new Error('Sanction ID must be 15 characters or fewer.');
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  await pool.request()
    .input('id', sql.Int, id)
    .input('sanctionId', sql.NVarChar, sanctionId)
    .input('priority', sql.TinyInt, priority)
    .input('sanctionNotes', sql.NVarChar, sanctionNotes)
    .input('sanctionStatus', sql.VarChar, sanctionStatus)
    .query(`
      update sanction_requested
      set sanctionid = @sanctionId,
        priority = @priority,
        sanctionNotes = @sanctionNotes,
        sanctionStatus = @sanctionStatus,
        updated = getdate()
      where id = @id
    `);

  return getAdminSanctionRequestById(pool, id);
}
