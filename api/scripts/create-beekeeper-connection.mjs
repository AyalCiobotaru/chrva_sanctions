import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];

  if (!arg.startsWith('--')) {
    continue;
  }

  const [key, inlineValue] = arg.slice(2).split('=', 2);
  const nextValue = process.argv[index + 1];
  const value = inlineValue ?? (nextValue && !nextValue.startsWith('--') ? nextValue : 'true');

  args.set(key, value);

  if (inlineValue === undefined && value === nextValue) {
    index += 1;
  }
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}

function booleanEnv(name, fallback) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function encode(value) {
  return encodeURIComponent(value);
}

const host = requiredEnv('CHRVA_DB_HOST');
const database = requiredEnv('CHRVA_DB_NAME');
const username = requiredEnv('CHRVA_DB_USER');
const password = requiredEnv('CHRVA_DB_PASSWORD');
const port = Number.parseInt(process.env.CHRVA_DB_PORT ?? '1433', 10);
const encrypt = booleanEnv('CHRVA_DB_ENCRYPT', true);
const trustServerCertificate = booleanEnv('CHRVA_DB_TRUST_SERVER_CERTIFICATE', true);
const connectionName = args.get('name') ?? process.env.BEEKEEPER_CONNECTION_NAME ?? 'CHRVA Prod SQL Server';
const outPath = resolve(args.get('out') ?? 'beekeeper-connection.prod.json');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid CHRVA_DB_PORT: ${process.env.CHRVA_DB_PORT}`);
}

const query = new URLSearchParams({
  encrypt: String(encrypt),
  trustServerCertificate: String(trustServerCertificate),
});
const databaseUrl = `mssql://${encode(username)}:${encode(password)}@${host}:${port}/${encode(database)}?${query}`;
const adoNetConnectionString = [
  `Server=tcp:${host},${port}`,
  `Database=${database}`,
  `User ID=${username}`,
  `Password=${password}`,
  `Encrypt=${encrypt ? 'True' : 'False'}`,
  `TrustServerCertificate=${trustServerCertificate ? 'True' : 'False'}`,
  'Connection Timeout=30',
].join(';');

const payload = {
  type: 'beekeeper-sqlserver-connection',
  version: 1,
  note: 'Generated from modernized/api environment variables. Contains credentials.',
  databaseUrl,
  connectionStrings: {
    mssqlUrl: databaseUrl,
    adoNet: adoNetConnectionString,
  },
  connections: [
    {
      name: connectionName,
      connectionType: 'sqlserver',
      client: 'sqlserver',
      databaseType: 'sqlserver',
      host,
      port,
      database,
      defaultDatabase: database,
      username,
      user: username,
      password,
      ssl: encrypt,
      trustServerCertificate,
      options: {
        encrypt,
        trustServerCertificate,
      },
    },
  ],
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });

console.log(`Wrote ${outPath}`);
console.log(`Connection: ${connectionName}`);
console.log(`Host: ${host}:${port}`);
console.log(`Database: ${database}`);
console.log(`User: ${username}`);
