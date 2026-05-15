import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sql = require('../../api/node_modules/mssql');
const toolDir = dirname(fileURLToPath(import.meta.url));

const tables = process.argv.slice(2);

if (tables.length === 0) {
  throw new Error('Usage: node --env-file=../../api/.env.prod export-table-schema.mjs <table> [table...]');
}

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
  for (const table of tables) {
    await exportTable(table);
  }
} finally {
  await pool.close();
}

async function exportTable(table) {
  const columns = await pool.request()
    .input('schema', sql.NVarChar, 'dbo')
    .input('table', sql.NVarChar, table)
    .query(`
      select
        c.column_id,
        c.name as column_name,
        ty.name as type_name,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        ic.seed_value,
        ic.increment_value,
        dc.definition as default_definition
      from sys.tables t
      join sys.schemas s on t.schema_id = s.schema_id
      join sys.columns c on t.object_id = c.object_id
      join sys.types ty on c.user_type_id = ty.user_type_id
      left join sys.identity_columns ic
        on c.object_id = ic.object_id
       and c.column_id = ic.column_id
      left join sys.default_constraints dc
        on c.default_object_id = dc.object_id
      where s.name = @schema
        and t.name = @table
      order by c.column_id
    `);

  if (columns.recordset.length === 0) {
    throw new Error(`Table dbo.${table} was not found`);
  }

  const primaryKeys = await pool.request()
    .input('schema', sql.NVarChar, 'dbo')
    .input('table', sql.NVarChar, table)
    .query(`
      select c.name as column_name
      from sys.indexes i
      join sys.index_columns ic
        on i.object_id = ic.object_id
       and i.index_id = ic.index_id
      join sys.columns c
        on ic.object_id = c.object_id
       and ic.column_id = c.column_id
      join sys.tables t on i.object_id = t.object_id
      join sys.schemas s on t.schema_id = s.schema_id
      where i.is_primary_key = 1
        and s.name = @schema
        and t.name = @table
      order by ic.key_ordinal
    `);

  const lines = [
    'set nocount on;',
    'go',
    '',
    `if object_id(N'dbo.${escapeSqlLiteral(table)}', N'U') is null`,
    'begin',
    `  create table dbo.${quoteName(table)} (`,
  ];

  const columnLines = columns.recordset.map((column) => {
    const parts = [
      `    ${quoteName(column.column_name)}`,
      formatType(column),
      column.is_identity ? `identity(${column.seed_value ?? 1},${column.increment_value ?? 1})` : '',
      column.is_nullable ? 'null' : 'not null',
      column.default_definition ? `default ${column.default_definition}` : '',
    ].filter(Boolean);

    return parts.join(' ');
  });

  const pkColumns = primaryKeys.recordset.map((row) => quoteName(row.column_name));

  if (pkColumns.length > 0) {
    columnLines.push(`    constraint ${quoteName(`PK_${table}`)} primary key (${pkColumns.join(', ')})`);
  }

  lines.push(columnLines.map((line, index) => {
    return index === columnLines.length - 1 ? line : `${line},`;
  }).join('\n'));
  lines.push('  );');
  lines.push(`  print 'created dbo.${escapeSqlLiteral(table)}';`);
  lines.push('end');
  lines.push('else');
  lines.push(`  print 'exists dbo.${escapeSqlLiteral(table)}';`);
  lines.push('go');
  lines.push('');

  const outPath = resolve(toolDir, '..', 'tables', `${table}.sql`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath}`);
}

function formatType(column) {
  const type = column.type_name.toLowerCase();

  if (['char', 'varchar', 'nchar', 'nvarchar', 'binary', 'varbinary'].includes(type)) {
    const bytes = column.max_length;
    const length = bytes === -1 ? 'max' : String(type.startsWith('n') ? bytes / 2 : bytes);
    return `${type}(${length})`;
  }

  if (['decimal', 'numeric'].includes(type)) {
    return `${type}(${column.precision},${column.scale})`;
  }

  if (['datetime2', 'datetimeoffset', 'time'].includes(type)) {
    return `${type}(${column.scale})`;
  }

  return type;
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
