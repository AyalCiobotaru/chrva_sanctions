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
      level,
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
      email,
      display_record,
      type
    from coordcontacts
    ${where.length ? `where ${where.join(' and ')}` : ''}
    order by grouping, category, coordlname, coordfname
  `);

  return result.recordset.map(mapCoordinator);
}

export async function createCoordinator(body) {
  const coordinator = normalizeCoordinatorInput(body);
  validateCoordinator(coordinator);
  const pool = await getPool();
  const existing = await pool.request()
    .input('category', sql.NVarChar, coordinator.category)
    .query('select category from coordcontacts where category = @category');

  if (existing.recordset.length > 0) {
    const error = new Error(`Regional junior contact "${coordinator.category}" already exists.`);
    error.statusCode = 409;
    error.code = 'ERR_COORDINATOR_EXISTS';
    throw error;
  }

  await pool.request()
    .input('category', sql.NVarChar, coordinator.category)
    .input('level', sql.NVarChar, coordinator.level)
    .input('grouping', sql.NVarChar, coordinator.grouping)
    .input('coordfname', sql.NVarChar, coordinator.firstName)
    .input('coordlname', sql.NVarChar, coordinator.lastName)
    .input('straddress1', sql.NVarChar, coordinator.address1)
    .input('straddress2', sql.NVarChar, coordinator.address2)
    .input('city', sql.NVarChar, coordinator.city)
    .input('st', sql.NVarChar, coordinator.state)
    .input('zip', sql.NVarChar, coordinator.zip)
    .input('phone1', sql.NVarChar, coordinator.phonePrimary)
    .input('phone2', sql.NVarChar, coordinator.phoneSecondary)
    .input('ext', sql.NVarChar, coordinator.extension)
    .input('fax', sql.NVarChar, coordinator.fax)
    .input('email', sql.NVarChar, coordinator.email)
    .query(`
      insert into coordcontacts (
        category, level, grouping, coordfname, coordlname, straddress1, straddress2,
        city, st, zip, phone1, phone2, ext, fax, email, display_record, type
      )
      values (
        @category, @level, @grouping, @coordfname, @coordlname, @straddress1, @straddress2,
        @city, @st, @zip, @phone1, @phone2, @ext, @fax, @email, null, 'Juniors'
      )
    `);

  return getCoordinatorByCategory(coordinator.category);
}

export async function updateCoordinator(category, body) {
  const originalCategory = text(category);
  const coordinator = normalizeCoordinatorInput(body);
  validateCoordinator(coordinator);
  const pool = await getPool();

  const current = await pool.request()
    .input('category', sql.NVarChar, originalCategory)
    .query("select category from coordcontacts where category = @category and type = 'Juniors'");

  if (current.recordset.length === 0) {
    const error = new Error('Regional junior contact not found.');
    error.statusCode = 404;
    error.code = 'ERR_COORDINATOR_NOT_FOUND';
    throw error;
  }

  if (coordinator.category.toLowerCase() !== originalCategory.toLowerCase()) {
    const duplicate = await pool.request()
      .input('category', sql.NVarChar, coordinator.category)
      .query('select category from coordcontacts where category = @category');

    if (duplicate.recordset.length > 0) {
      const error = new Error(`Regional junior contact "${coordinator.category}" already exists.`);
      error.statusCode = 409;
      error.code = 'ERR_COORDINATOR_EXISTS';
      throw error;
    }
  }

  await pool.request()
    .input('originalCategory', sql.NVarChar, originalCategory)
    .input('category', sql.NVarChar, coordinator.category)
    .input('level', sql.NVarChar, coordinator.level)
    .input('grouping', sql.NVarChar, coordinator.grouping)
    .input('coordfname', sql.NVarChar, coordinator.firstName)
    .input('coordlname', sql.NVarChar, coordinator.lastName)
    .input('straddress1', sql.NVarChar, coordinator.address1)
    .input('straddress2', sql.NVarChar, coordinator.address2)
    .input('city', sql.NVarChar, coordinator.city)
    .input('st', sql.NVarChar, coordinator.state)
    .input('zip', sql.NVarChar, coordinator.zip)
    .input('phone1', sql.NVarChar, coordinator.phonePrimary)
    .input('phone2', sql.NVarChar, coordinator.phoneSecondary)
    .input('ext', sql.NVarChar, coordinator.extension)
    .input('fax', sql.NVarChar, coordinator.fax)
    .input('email', sql.NVarChar, coordinator.email)
    .query(`
      update coordcontacts
      set category = @category,
        level = @level,
        grouping = @grouping,
        coordfname = @coordfname,
        coordlname = @coordlname,
        straddress1 = @straddress1,
        straddress2 = @straddress2,
        city = @city,
        st = @st,
        zip = @zip,
        phone1 = @phone1,
        phone2 = @phone2,
        ext = @ext,
        fax = @fax,
        email = @email,
        type = 'Juniors'
      where category = @originalCategory
        and type = 'Juniors'
    `);

  return getCoordinatorByCategory(coordinator.category);
}

export async function deleteCoordinator(category) {
  const pool = await getPool();
  const result = await pool.request()
    .input('category', sql.NVarChar, text(category))
    .query("delete from coordcontacts where category = @category and type = 'Juniors'");

  if (result.rowsAffected[0] === 0) {
    const error = new Error('Regional junior contact not found.');
    error.statusCode = 404;
    error.code = 'ERR_COORDINATOR_NOT_FOUND';
    throw error;
  }

  return { deleted: true };
}

async function getCoordinatorByCategory(category) {
  const pool = await getPool();
  const result = await pool.request()
    .input('category', sql.NVarChar, text(category))
    .query(`
      select
        category,
        level,
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
        email,
        display_record,
        type
      from coordcontacts
      where category = @category
        and type = 'Juniors'
    `);

  if (result.recordset.length === 0) {
    const error = new Error('Regional junior contact not found.');
    error.statusCode = 404;
    error.code = 'ERR_COORDINATOR_NOT_FOUND';
    throw error;
  }

  return mapCoordinator(result.recordset[0]);
}

function mapCoordinator(row) {
  return {
    category: text(row.category),
    level: text(row.level),
    grouping: text(row.grouping),
    firstName: text(row.coordfname),
    lastName: text(row.coordlname),
    address1: text(row.straddress1),
    address2: text(row.straddress2),
    address: [row.straddress1, row.straddress2].map(text).filter(Boolean).join(', '),
    city: text(row.city),
    state: text(row.st),
    zip: text(row.zip),
    phonePrimary: text(row.phone1),
    phoneSecondary: text(row.phone2),
    extension: text(row.ext),
    fax: text(row.fax),
    email: text(row.email),
    displayRecord: text(row.display_record),
    type: text(row.type)
  };
}

function normalizeCoordinatorInput(body) {
  return {
    category: text(body?.category),
    level: text(body?.level),
    grouping: text(body?.grouping) || 'Coordinator',
    firstName: text(body?.firstName),
    lastName: text(body?.lastName),
    address1: text(body?.address1),
    address2: text(body?.address2),
    city: text(body?.city),
    state: text(body?.state).toUpperCase(),
    zip: text(body?.zip),
    phonePrimary: text(body?.phonePrimary),
    phoneSecondary: text(body?.phoneSecondary),
    extension: text(body?.extension),
    fax: text(body?.fax),
    email: text(body?.email)
  };
}

function validateCoordinator(coordinator) {
  const errors = [];

  if (!coordinator.category) {
    errors.push('Function is required.');
  }

  if (!coordinator.grouping) {
    errors.push('Category is required.');
  }

  if (!coordinator.firstName) {
    errors.push('First name is required.');
  }

  if (!coordinator.lastName) {
    errors.push('Last name is required.');
  }

  if (!coordinator.address1) {
    errors.push('Street address is required.');
  }

  if (!coordinator.state) {
    errors.push('State is required.');
  }

  if (!coordinator.zip) {
    errors.push('Zip is required.');
  }

  if (!coordinator.phonePrimary) {
    errors.push('Phone is required.');
  }

  if (coordinator.email && !coordinator.email.includes('@')) {
    errors.push('Email must be valid.');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.code = 'ERR_VALIDATION';
    throw error;
  }
}
