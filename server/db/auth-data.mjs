import sql from 'mssql';
import { getPool, mapSanctionClub, text } from './shared.mjs';

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
