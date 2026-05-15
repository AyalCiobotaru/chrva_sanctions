import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sql = require('../../api/node_modules/mssql');
const toolDir = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(toolDir, '..', 'seeds', '001_current_app_data.sql');
const seasons = parseSeasons(process.argv.slice(2));

const pool = await sql.connect({
  server: requiredEnv('CHRVA_DB_HOST'),
  database: requiredEnv('CHRVA_DB_NAME'),
  user: requiredEnv('CHRVA_DB_USER'),
  password: requiredEnv('CHRVA_DB_PASSWORD'),
  port: Number(process.env.CHRVA_DB_PORT ?? 1433),
  options: {
    encrypt: process.env.CHRVA_DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.CHRVA_DB_TRUST_SERVER_CERT !== 'false',
  },
  connectionTimeout: Number(process.env.CHRVA_DB_CONNECTION_TIMEOUT ?? 15000),
  requestTimeout: Number(process.env.CHRVA_DB_REQUEST_TIMEOUT ?? 15000),
});

try {
  const selectedTournaments = await querySanctionRequests();
  const clubCodes = [...new Set(selectedTournaments.map((row) => text(row.clubcode)).filter(Boolean))].sort();
  const clubs = await queryClubs(clubCodes);
  const coordinators = await queryAll('coordcontacts');
  const rowVersionColumns = await queryRowVersionColumns(['clubcontacts', 'coordcontacts', 'sanction_requested']);

  const script = [
    'set nocount on;',
    'go',
    '',
    'begin transaction;',
    '',
    `print 'Seeding CHRVA current app data for seasons ${seasons.join(', ')}';`,
    '',
    deleteStatement('sanction_requested'),
    deleteStatement('clubcontacts'),
    deleteStatement('coordcontacts'),
    '',
    ...insertRows('coordcontacts', coordinators, rowVersionColumns),
    '',
    ...insertRows('clubcontacts', clubs, rowVersionColumns, {
      password: () => null,
    }),
    '',
    ...insertRows('sanction_requested', selectedTournaments, rowVersionColumns, {}, { identityInsert: true }),
    '',
    'commit transaction;',
    'go',
    '',
    'select',
    "  'clubcontacts' as [table],",
    '  count(*) as [rows]',
    'from dbo.clubcontacts',
    'union all',
    "select 'coordcontacts', count(*) from dbo.coordcontacts",
    'union all',
    "select 'sanction_requested', count(*) from dbo.sanction_requested;",
    'go',
    '',
  ].join('\n');

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, script, 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`coordcontacts=${coordinators.length}`);
  console.log(`clubcontacts=${clubs.length}`);
  console.log(`sanction_requested=${selectedTournaments.length}`);
  console.log(`inactive_or_non_junior_referenced_clubs=${clubs.filter((row) => text(row.active) !== 'Y' || text(row.grouping) !== 'Juniors').length}`);
} finally {
  await pool.close();
}

async function querySanctionRequests() {
  const request = pool.request();
  seasons.forEach((season, index) => request.input(`season${index}`, sql.Int, season));
  const placeholders = seasons.map((_, index) => `@season${index}`).join(', ');

  const result = await request.query(`
    select *
    from dbo.sanction_requested
    where datepart(year, dte) in (${placeholders})
      and (
        sanctionStatus in ('Approved', 'Posted', 'SO')
        or AES_added is not null
      )
    order by dte, division, priority, id
  `);

  return result.recordset;
}

async function queryClubs(clubCodes) {
  const request = pool.request();
  clubCodes.forEach((clubCode, index) => request.input(`clubCode${index}`, sql.NVarChar, clubCode));
  const placeholders = clubCodes.map((_, index) => `@clubCode${index}`).join(', ');

  const result = await request.query(`
    select *
    from dbo.clubcontacts
    where (active = 'Y' and grouping = 'Juniors')
      ${clubCodes.length ? `or ClubCode in (${placeholders})` : ''}
    order by ClubName, ClubCode
  `);

  return result.recordset;
}

async function queryAll(table) {
  const result = await pool.request().query(`select * from dbo.${quoteName(table)} order by 1`);
  return result.recordset;
}

async function queryRowVersionColumns(tables) {
  const request = pool.request();
  tables.forEach((table, index) => request.input(`table${index}`, sql.NVarChar, table));
  const placeholders = tables.map((_, index) => `@table${index}`).join(', ');
  const result = await request.query(`
    select
      t.name as table_name,
      c.name as column_name
    from sys.tables t
    join sys.schemas s on t.schema_id = s.schema_id
    join sys.columns c on t.object_id = c.object_id
    join sys.types ty on c.user_type_id = ty.user_type_id
    where s.name = 'dbo'
      and t.name in (${placeholders})
      and ty.name in ('timestamp', 'rowversion')
  `);

  return result.recordset.reduce((map, row) => {
    const key = row.table_name;
    map[key] ??= new Set();
    map[key].add(row.column_name);
    return map;
  }, {});
}

function insertRows(table, rows, rowVersionColumns, transforms = {}, options = {}) {
  if (rows.length === 0) {
    return [`print 'no rows for dbo.${escapeSqlLiteral(table)}';`];
  }

  const skipped = rowVersionColumns[table] ?? new Set();
  const columns = Object.keys(rows[0]).filter((column) => !skipped.has(column));
  const lines = [
    `print 'inserting ${rows.length} rows into dbo.${escapeSqlLiteral(table)}';`,
  ];

  if (options.identityInsert) {
    lines.push(`set identity_insert dbo.${quoteName(table)} on;`);
  }

  for (const row of rows) {
    const values = columns.map((column) => {
      const value = transforms[column] ? transforms[column](row[column], row) : row[column];
      return sqlLiteral(value);
    });

    lines.push(`insert into dbo.${quoteName(table)} (${columns.map(quoteName).join(', ')}) values (${values.join(', ')});`);
  }

  if (options.identityInsert) {
    lines.push(`set identity_insert dbo.${quoteName(table)} off;`);
  }

  return lines;
}

function deleteStatement(table) {
  return `delete from dbo.${quoteName(table)};`;
}

function sqlLiteral(value) {
  if (value == null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (value instanceof Date) {
    return `'${value.toISOString().replace('T', ' ').replace('Z', '')}'`;
  }

  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`;
  }

  return `N'${String(value).replaceAll("'", "''")}'`;
}

function parseSeasons(args) {
  const value = args.find((arg) => arg.startsWith('--seasons='))?.split('=', 2)[1] ?? '2025,2026,2027';
  const parsed = value.split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item));

  if (parsed.length === 0) {
    throw new Error('At least one season is required. Example: --seasons=2025,2026,2027');
  }

  return parsed;
}

function quoteName(value) {
  return `[${String(value).replaceAll(']', ']]')}]`;
}

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}

function text(value) {
  return String(value ?? '').trim();
}
