import sql from 'mssql';

const season = Number(process.argv[2] ?? process.env.CHRVA_CURRENT_SEASON);
const program = process.argv[3] ?? 'jr';
const programPrefix = {
  adt: 'A',
  boys: 'B',
  jr: 'G',
}[program] ?? 'G';

const pool = await sql.connect({
  server: requiredEnv('CHRVA_DB_HOST'),
  database: requiredEnv('CHRVA_DB_NAME'),
  user: requiredEnv('CHRVA_DB_USER'),
  password: requiredEnv('CHRVA_DB_PASSWORD'),
  options: {
    encrypt: process.env.CHRVA_DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.CHRVA_DB_TRUST_SERVER_CERT !== 'false',
  },
  connectionTimeout: Number(process.env.CHRVA_DB_CONNECTION_TIMEOUT ?? 15000),
  requestTimeout: Number(process.env.CHRVA_DB_REQUEST_TIMEOUT ?? 15000),
});

try {
  const result = await pool.request()
    .input('seasonStart', sql.Date, `${season - 1}-10-01`)
    .input('seasonEnd', sql.Date, `${season}-12-31`)
    .input('programPrefix', sql.NVarChar, programPrefix)
    .query(`
      select top 5
        sr.id,
        sr.sanctionid,
        sr.dte,
        sr.division,
        sr.tournname,
        sr.sanctionStatus,
        sr.AES_added,
        cc.clubname
      from sanction_requested sr
      left join clubcontacts cc on sr.clubcode = cc.clubcode
      where sr.dte > @seasonStart
        and sr.dte < @seasonEnd
        and (sr.sanctionStatus in ('Approved', 'Posted') or sr.AES_added is not null)
        and substring(sr.division, 1, 1) = @programPrefix
      order by sr.dte, sr.division, sr.priority
    `);

  console.table(result.recordset);
} finally {
  await pool.close();
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}
