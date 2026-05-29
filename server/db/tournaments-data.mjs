import sql from 'mssql';
import {
  addExact,
  addExactDate,
  addStartsWith,
  getPool,
  getAppConfig,
  normalizeNullableDate,
  text,
  toDate,
  toNumber,
  toTime,
  yn
} from './shared.mjs';

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
