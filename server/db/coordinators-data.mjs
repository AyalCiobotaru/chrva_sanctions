import sql from 'mssql';
import { addStartsWith, getPool, text } from './shared.mjs';

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
