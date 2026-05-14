import sql from 'mssql';

const config = await readConfig();
const pool = await sql.connect(config);

try {
  const columns = await pool.request().query(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_name in ('clubcontacts', 'coordcontacts', 'sanction')
    order by table_name, ordinal_position
  `);

  const counts = await pool.request().query(`
    select 'clubcontacts' as table_name, count(*) as rows from clubcontacts
    union all
    select 'coordcontacts' as table_name, count(*) as rows from coordcontacts
    union all
    select 'sanction' as table_name, count(*) as rows from sanction
  `);

  console.log(JSON.stringify({
    server: config.server,
    database: config.database,
    counts: counts.recordset,
    columns: columns.recordset
  }, null, 2));
} finally {
  await pool.close();
}

async function readConfig() {
  return {
    server: requireEnv('CHRVA_DB_HOST'),
    database: requireEnv('CHRVA_DB_NAME'),
    user: requireEnv('CHRVA_DB_USER'),
    password: requireEnv('CHRVA_DB_PASSWORD'),
    options: {
      encrypt: process.env.CHRVA_DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.CHRVA_DB_TRUST_SERVER_CERT !== 'false'
    },
    connectionTimeout: 15000,
    requestTimeout: 15000
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}
