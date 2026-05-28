import sql from 'mssql';
import {
  addWeeksDate,
  buildStartTimes,
  ensureEditableSanctionRequest,
  formString,
  formatDisplayTime,
  formatUsDate,
  getAppConfig,
  getClubByCode,
  getPool,
  getRenewalStatuses,
  getSanctionClub,
  getSanctionRequestRow,
  html,
  mapSanctionRequestDetail,
  money,
  normalizeSanctionRequestInput,
  normalizeNullableDate,
  parseStartTime,
  queryOptional,
  seasonSuffix,
  sendSanctionRequestCreatedEmail,
  text,
  toDate,
  toNumber,
  toTime,
  validateSanctionRequest,
  wholeNumber,
  yn
} from './shared.mjs';

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

export async function getSanctionRequestRenewal(clubCode, sourceId) {
  const pool = await getPool();
  const config = getAppConfig();
  const parsedSourceId = Number(sourceId);
  const previousSeason = Number(config.previousSeason);
  const currentSeason = Number(config.currentSeason);
  const appendPrevious = seasonSuffix(previousSeason);
  const appendCurrent = seasonSuffix(currentSeason);
  const pushWeeks = currentSeason === 2016 || currentSeason === 2022 ? 1 : 0;

  await getSanctionClub(pool, clubCode);

  if (!Number.isInteger(parsedSourceId)) {
    const error = new Error('Sanction history item was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_HISTORY_NOT_FOUND';
    throw error;
  }

  const result = await pool.request()
    .input('clubCode', sql.NVarChar, clubCode)
    .input('id', sql.Int, parsedSourceId)
    .input('seasonStart', sql.Date, `${previousSeason - 1}-10-01`)
    .input('seasonEnd', sql.Date, `${previousSeason}-12-31`)
    .query(`
      select top 1
        id,
        sanctionid,
        dte,
        startTime,
        tournname,
        taddr,
        site,
        number_of_teams,
        min_number_of_teams,
        division,
        entry_fee,
        paymentType,
        check_payable_to,
        paymentURL,
        awards,
        pool_play,
        playoff_format,
        qtr_finals,
        semi_finals,
        finals,
        locker_room,
        showers,
        food,
        type,
        HDP,
        TournamentContact_address,
        TournamentDirector_Name,
        TournamentDirector_Email,
        TournamentDirector_homePhone,
        TournamentDirector_TournamentPhone,
        Expense_facility,
        Expense_officialsFees,
        Expense_volleyballs,
        Expense_awards,
        Expense_supplies,
        Expense_other,
        otherIncome,
        TournamentContact_name,
        information,
        SAGO
      from sanction_requested
      where id = @id
        and clubcode = @clubCode
        and sanctionid not like '%C'
        and dte > @seasonStart
        and dte < @seasonEnd
        and sanctionStatus in ('Approved', 'Cancelled')
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Sanction history item was not found.');
    error.statusCode = 404;
    error.code = 'ERR_SANCTION_HISTORY_NOT_FOUND';
    throw error;
  }

  const row = result.recordset[0];
  const sanctionId = text(row.sanctionid);
  const renewalSanctionId = sanctionId.replace(appendPrevious, appendCurrent);
  const existingRenewal = await getRenewalStatuses(pool, clubCode, [renewalSanctionId]);

  if (existingRenewal.has(renewalSanctionId)) {
    const error = new Error('A renewal request has already been submitted for this sanction.');
    error.statusCode = 409;
    error.code = 'ERR_RENEWAL_EXISTS';
    throw error;
  }

  return {
    source: {
      id: String(row.id),
      sanctionId,
      date: toDate(row.dte),
      division: text(row.division),
      site: text(row.site)
    },
    request: {
      sanctionId: renewalSanctionId,
      tournamentContactName: text(row.TournamentContact_name),
      tournamentDirectorName: text(row.TournamentDirector_Name),
      tournamentContactAddress: text(row.TournamentContact_address),
      tournamentDirectorEmail: text(row.TournamentDirector_Email),
      tournamentDirectorHomePhone: text(row.TournamentDirector_homePhone),
      tournamentDirectorTournamentPhone: text(row.TournamentDirector_TournamentPhone),
      date: addWeeksDate(row.dte, 52 + pushWeeks),
      startTime: formatDisplayTime(row.startTime) || '8:30 AM',
      division: text(row.division).includes('/') ? '' : text(row.division),
      numberOfTeams: formString(row.number_of_teams),
      minimumNumberOfTeams: formString(row.min_number_of_teams),
      tournamentName: text(row.tournname),
      site: text(row.site),
      siteAddress: text(row.taddr),
      type: text(row.type),
      entryFee: formString(row.entry_fee),
      checkPayableTo: text(row.check_payable_to),
      paymentType: normalizePaymentTypes(row.paymentType),
      creditCardPayment: normalizePaymentTypes(row.paymentType).includes('Credit Card') ? 'Y' : 'N',
      paymentUrl: text(row.paymentURL),
      singleAgeGroupOpen: text(row.SAGO) || (text(row.type).startsWith('Open') && !text(row.division).includes('/') ? 'Y' : 'N'),
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
      requester: '',
      expenseFacility: formString(row.Expense_facility),
      expenseOfficialsFees: formString(row.Expense_officialsFees),
      expenseVolleyballs: formString(row.Expense_volleyballs),
      expenseAwards: formString(row.Expense_awards),
      expenseSupplies: formString(row.Expense_supplies),
      expenseOther: formString(row.Expense_other),
      otherIncome: formString(row.otherIncome)
    }
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

export async function getSanctionRequest(clubCode, requestId) {
  const pool = await getPool();
  const row = await getSanctionRequestRow(pool, clubCode, requestId);

  return mapSanctionRequestDetail(row);
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

  if (request.sanctionId && request.sanctionId !== 'New') {
    const duplicate = await pool.request()
      .input('clubCode', sql.NVarChar, club.clubCode)
      .input('sanctionId', sql.NVarChar, request.sanctionId)
      .query(`
        select top 1 id
        from sanction_requested
        where clubcode = @clubCode
          and sanctionid = @sanctionId
      `);

    if (duplicate.recordset.length > 0) {
      const error = new Error('A renewal request has already been submitted for this sanction.');
      error.statusCode = 409;
      error.code = 'ERR_RENEWAL_EXISTS';
      throw error;
    }
  }

  const result = await pool.request()
    .input('sanctionid', sql.NVarChar, request.sanctionId || 'New')
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
  const emailResult = await sendSanctionRequestCreatedEmail(pool, club, request, created).catch((error) => {
    console.error('Sanction request was created, but confirmation email delivery failed.', {
      code: error.code,
      message: error.message
    });
    return {
      sent: false,
      dryRun: false,
      recipientCount: 0,
      message: 'Sanction request was created, but confirmation email delivery failed.'
    };
  });

  return {
    id: String(created.id),
    sanctionId: text(created.sanctionid),
    status: text(created.sanctionStatus),
    submittedDate: toDate(created.submitDate),
    email: emailResult
  };
}

export async function updateSanctionRequest(clubCode, requestId, body) {
  const pool = await getPool();
  const existing = await getSanctionRequestRow(pool, clubCode, requestId);

  ensureEditableSanctionRequest(existing);

  const request = normalizeSanctionRequestInput(body);
  const errors = validateSanctionRequest(request);

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }

  const result = await pool.request()
    .input('id', sql.Int, Number(requestId))
    .input('clubCode', sql.NVarChar, clubCode)
    .input('sanctionid', sql.NVarChar, request.sanctionId || text(existing.sanctionid))
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
      output inserted.*
      where id = @id
        and clubcode = @clubCode
    `);

  return mapSanctionRequestDetail(result.recordset[0]);
}

export async function deleteSanctionRequest(clubCode, requestId) {
  const pool = await getPool();
  const existing = await getSanctionRequestRow(pool, clubCode, requestId);

  ensureEditableSanctionRequest(existing);

  await pool.request()
    .input('id', sql.Int, Number(requestId))
    .input('clubCode', sql.NVarChar, clubCode)
    .query(`
      delete from sanction_requested
      where id = @id
        and clubcode = @clubCode
    `);

  return { deleted: true, id: String(requestId) };
}
