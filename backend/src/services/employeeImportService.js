const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');
const { canTerminateUser, canAssignEmployeeRole, canChangeEmployeeRole, effectiveRole } = require('../utils/terminationPermissions');
const { validateEmployeeFields } = require('../utils/employeeFields');
const { DEPARTMENTS, normalizeDepartment } = require('../config/departments');
const {
  allocateEmployeeIds, withEmployeeIdentityLock, newEmployee, insertEmployees, updateEmployees
} = require('./employeeDirectoryService');

const roleLabel = role => ({ COO: 'Director', Manager: 'Project Manager', 'CO Head': 'Co-Lead', Member: 'Intern' })[role] || role;
const VALID_ROLES = ['CEO', 'COO', 'Manager', 'Team Lead', 'CO Head', 'HR', 'Member'];

// Spreadsheet header (lowercased, punctuation stripped) -> user field.
const HEADER_ALIASES = {
  employeeId: ['employee id', 'emp id', 'empid', 'employee code', 'emp code', 'employee no', 'emp no', 'staff id', 'id'],
  name: ['name', 'full name', 'employee name', 'emp name', 'fullname'],
  firstName: ['first name', 'firstname', 'given name'],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'email id', 'email address', 'e mail', 'e mail id', 'e mail address', 'mail', 'mail id', 'official email', 'official email id', 'work email', 'company email'],
  personalEmail: ['personal email', 'personal email id', 'personal mail'],
  phone: ['phone', 'phone no', 'phone number', 'mobile', 'mobile no', 'mobile number', 'contact', 'contact no', 'contact number', 'whatsapp', 'whatsapp no'],
  role: ['role', 'access role', 'system role', 'access level'],
  designation: ['designation', 'title', 'job title', 'position', 'post'],
  department: ['department', 'dept', 'division', 'vertical', 'domain'],
  team: ['team', 'team name', 'squad', 'sub team'],
  manager: ['manager', 'reporting manager', 'reports to', 'reporting to', 'supervisor', 'lead', 'team lead name'],
  joinDate: ['join date', 'joining date', 'date of joining', 'doj', 'start date', 'joined on', 'intern date of joining', 'intern doj'],
  dateOfBirth: ['dob', 'date of birth', 'birth date', 'birthday'],
  gender: ['gender', 'sex'],
  bloodGroup: ['blood group', 'blood type'],
  workLocation: ['work location', 'location', 'office', 'base location', 'work mode'],
  employmentType: ['employment type', 'type', 'employee type', 'contract type'],
  status: ['status', 'employment status', 'active'],
  address: ['address', 'current address', 'residential address'],
  emergencyContactName: ['emergency contact', 'emergency contact name'],
  emergencyContactPhone: ['emergency contact number', 'emergency contact phone', 'emergency phone', 'emergency no'],
  college: ['college', 'university', 'institute'],
  degree: ['degree', 'qualification', 'course'],
  password: ['password', 'initial password', 'temp password']
};

const ALIAS_LOOKUP = Object.entries(HEADER_ALIASES).reduce((acc, [field, aliases]) => {
  aliases.forEach((alias) => { acc[alias] = field; });
  return acc;
}, Object.create(null));

const normalizeHeader = (h) => String(h || '')
  .toLowerCase()
  .replace(/[_\-./()#:]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const clean = (v) => {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v.text) return String(v.text).trim(); // exceljs hyperlink/rich text
  if (typeof v === 'object' && v.result !== undefined) return clean(v.result); // exceljs formula
  return String(v).trim();
};

function mapHeaders(headers) {
  const mapping = Object.create(null);
  const unmapped = [];
  headers.forEach((h) => {
    const field = ALIAS_LOOKUP[normalizeHeader(h)];
    if (field && !Object.values(mapping).includes(field)) mapping[h] = field;
    else if (String(h || '').trim()) unmapped.push(h);
  });
  return { mapping, unmapped };
}

function normalizeRole(raw) {
  const role = normalizeHeader(raw);
  if (!role || ['member', 'intern', 'employee', 'engineer'].includes(role)) return 'Member';
  if (/\bco\s*(lead|head)\b/.test(role)) return 'CO Head';
  if (role === 'ceo' || role.includes('chief executive') || role === 'founder') return 'CEO';
  if (role === 'coo' || role.includes('chief operating') || role === 'director') return 'COO';
  if (['project manager', 'pm', 'manager'].includes(role)) return 'Manager';
  if (['team lead', 'lead', 'tl', 'tech lead'].includes(role)) return 'Team Lead';
  if (['hr', 'coordinator'].includes(role) || role.includes('human resource')) return 'HR';
  return raw;
}

// Accepts JS Date, Excel serial numbers, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, "12 Jan 2024".
function parseDate(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().split('T')[0];
  const s = String(raw).trim();
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      return new Date(ms).toISOString().split('T')[0];
    }
  }
  const valid = (y, mo, d) => {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d));
    return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +mo - 1 && dt.getUTCDate() === +d;
  };
  const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let m = s.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/);
  if (m) return valid(m[1], m[2], m[3]) ? iso(m[1], m[2], m[3]) : null;
  m = s.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    // Indian convention is day first; fall back to month first (e.g. 11-16-2026) when that's the only valid reading.
    if (valid(year, m[2], m[1])) return iso(year, m[2], m[1]);
    if (Number(m[2]) > 12 && valid(year, m[1], m[2])) return iso(year, m[1], m[2]);
    return null;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  return null; // unparseable
}

function normalizePhone(raw) {
  let s = clean(raw);
  if (!s) return '';
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) s = Number(s).toFixed(0); // 9.19E+11 from Excel
  s = s.replace(/\.0$/, '');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && !s.startsWith('+')) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return s;
}

function isActiveStatus(raw) {
  const s = normalizeHeader(raw);
  if (!s) return true;
  return !['inactive', 'terminated', 'resigned', 'left', 'exited', 'no', 'false', '0', 'relieved'].includes(s);
}

/**
 * Convert raw spreadsheet rows (array of {header: value}) into validated employee records.
 * Returns { records, errors, mapping, unmapped } without touching the database.
 */
function parseRows(rows) {
  const headers = [...new Set(rows.flatMap(row => row && typeof row === 'object' ? Object.keys(row) : []))]
    .filter(header => header !== '__row__');
  const { mapping, unmapped } = mapHeaders(headers);
  const records = [];
  const errors = [];
  let totalRows = 0;

  rows.forEach((row, idx) => {
    const rowNumber = Number(row?.__row__) || idx + 2;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({ row: rowNumber, errors: ['Invalid employee row'] });
      totalRows += 1;
      return;
    }
    const rec = {};
    const extra = Object.create(null);
    for (const [header, value] of Object.entries(row)) {
      if (header === '__row__') continue;
      const field = mapping[header];
      if (field) rec[field] = value;
      else if (clean(value) !== '' && !mapHeaders([header]).mapping[header]) extra[header] = clean(value);
    }

    // Skip fully blank rows.
    if (Object.values(rec).every((v) => clean(v) === '') && Object.keys(extra).length === 0) return;
    totalRows += 1;

    const rowErrors = [];
    let firstName = String(clean(rec.firstName));
    let lastName = String(clean(rec.lastName));
    const fullName = String(clean(rec.name)) || [firstName, lastName].filter(Boolean).join(' ');
    if (!firstName && clean(rec.name)) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    if (!fullName) rowErrors.push('Missing name');
    if (!clean(rec.email)) rowErrors.push('Missing email');

    const joinDate = parseDate(rec.joinDate);
    if (joinDate === null) rowErrors.push('Unrecognised join date');
    const dateOfBirth = parseDate(rec.dateOfBirth);
    if (dateOfBirth === null) rowErrors.push('Unrecognised date of birth');
    const phone = normalizePhone(rec.phone);
    let department = normalizeDepartment(String(clean(rec.department)));
    const team = String(clean(rec.team));
    if (!department && DEPARTMENTS.includes(normalizeDepartment(team))) department = normalizeDepartment(team);
    const { fields, errors: validationErrors } = validateEmployeeFields({
      firstName, lastName, email: String(clean(rec.email)), phone, department,
      designation: String(clean(rec.designation)), role: normalizeRole(String(clean(rec.role))),
      joinDate: joinDate || '', dateOfBirth: dateOfBirth || ''
    });
    const email = fields.email || String(clean(rec.email)).toLowerCase();
    rowErrors.push(...validationErrors);
    const record = {
      ...fields,
      rowNumber,
      employeeId: String(clean(rec.employeeId)).toUpperCase(),
      fullName: [fields.firstName, fields.lastName].filter(Boolean).join(' '),
      phone,
      team,
      manager: String(clean(rec.manager)),
      ...(clean(rec.status) !== '' ? { isActive: isActiveStatus(rec.status) } : {}),
      ...(clean(rec.role) === '' ? { preserveExistingRole: true } : {})
    };

    const optional = {
      personalEmail: String(clean(rec.personalEmail)).toLowerCase(),
      dateOfBirth: dateOfBirth || '',
      gender: clean(rec.gender),
      bloodGroup: clean(rec.bloodGroup),
      workLocation: clean(rec.workLocation),
      employmentType: clean(rec.employmentType)
    };
    Object.entries(optional).forEach(([k, v]) => { if (v) record[k] = v; });

    if (clean(rec.address)) record.address = { street: clean(rec.address) };
    if (clean(rec.emergencyContactName) || clean(rec.emergencyContactPhone)) {
      record.emergencyContact = {
        name: clean(rec.emergencyContactName),
        phone: normalizePhone(rec.emergencyContactPhone)
      };
    }
    if (clean(rec.college) || clean(rec.degree)) {
      record.education = { college: clean(rec.college), degree: clean(rec.degree) };
    }
    if (Object.keys(extra).length) record.additionalInfo = extra; // keep unmapped columns, don't lose data

    if (rowErrors.length) errors.push({ row: rowNumber, name: fullName, email, errors: rowErrors });
    else records.push(record);
  });

  // Duplicates inside the sheet itself.
  const seen = { email: new Map(), employeeId: new Map() };
  const deduped = [];
  for (const rec of records) {
    const dupEmail = seen.email.get(rec.email);
    const dupId = rec.employeeId && seen.employeeId.get(rec.employeeId);
    if (dupEmail || dupId) {
      errors.push({
        row: rec.rowNumber,
        name: rec.fullName,
        email: rec.email,
        errors: [dupEmail ? `Duplicate email (also on row ${dupEmail})` : `Duplicate employee ID ${rec.employeeId} (also on row ${dupId})`]
      });
      continue;
    }
    seen.email.set(rec.email, rec.rowNumber);
    if (rec.employeeId) seen.employeeId.set(rec.employeeId, rec.rowNumber);
    deduped.push(rec);
  }

  return { records: deduped, errors, mapping, unmapped, totalRows };
}

function referenceEntries(user) {
  return [user.id, user.employeeId, user.sourceEmployeeId, user.email, user.fullName]
    .filter(Boolean).map(value => String(value).trim().toLowerCase());
}

function addUserReferences(index, user) {
  for (const reference of referenceEntries(user)) {
    if (!index.has(reference)) index.set(reference, user);
    else if (index.get(reference)?.id !== user.id) index.set(reference, null);
  }
}

async function importEmployees(rows, { dryRun = true, updateExisting = false, importer = null } = {}) {
  if (!rows.length || rows.length > 2000) throw Object.assign(new Error('Import requires 1–2,000 employee rows.'), { status: 400 });
  const parsed = parseRows(rows);
  if (!parsed.totalRows) throw Object.assign(new Error('No rows to import'), { status: 400 });

  async function apply(client) {
    const { records, errors, mapping, unmapped, totalRows } = parsed;
    const { rows: existingRows } = await client.query('SELECT id, data FROM users');
    const existingUsers = existingRows.map(row => ({ ...row.data, id: row.id }));
    const byEmail = new Map();
    const byEmployeeId = new Map();
    for (const user of existingUsers) {
      for (const [index, keys] of [[byEmail, [user.email]], [byEmployeeId, [user.employeeId, user.sourceEmployeeId]]]) {
        for (const key of keys.filter(Boolean).map(value => String(value).trim().toLowerCase())) {
          if (!index.has(key)) index.set(key, user);
          else if (index.get(key)?.id !== user.id) index.set(key, null);
        }
      }
    }
    const allowRole = role => !importer || canAssignEmployeeRole(importer.role, role);
    const sheetError = (row, message) =>
      errors.push({ row: row.rowNumber, name: row.fullName, email: row.email, errors: [message] });
    const newRows = [];
    const editedRows = [];
    const skipped = [];
    const updatedUsers = new Set();
    const now = new Date().toISOString();
    const importedBy = importer?.name || importer?.employeeId || 'bulk-import';

    for (const row of records) {
      const { rowNumber, employeeId, preserveExistingRole, ...fields } = row;
      const codeMatch = byEmployeeId.get(employeeId.toLowerCase());
      const emailMatch = byEmail.get(fields.email);
      if (codeMatch === null || emailMatch === null) {
        sheetError(row, 'Employee ID or email matches more than one account. Correct the existing accounts before importing.');
        continue;
      }
      const existing = codeMatch || emailMatch;
      if (!existing) {
        if (!allowRole(fields.role)) {
          sheetError(row, `You are not allowed to create a ${roleLabel(fields.role)}`);
          continue;
        }
        newRows.push({ row, fields: { ...fields, sourceEmployeeId: employeeId || undefined } });
        continue;
      }

      if (emailMatch && emailMatch.id !== existing.id) {
        sheetError(row, `Email already used by ${emailMatch.employeeId}`);
        continue;
      }
      if (!updateExisting) {
        skipped.push({ row: rowNumber, employeeId: existing.employeeId, name: fields.fullName, reason: 'Already exists' });
        continue;
      }
      if (updatedUsers.has(existing.id)) {
        sheetError(row, 'Another row already updates this employee');
        continue;
      }

      const changes = Object.fromEntries(Object.entries(fields).filter(([_key, value]) => value !== ''));
      if (preserveExistingRole) delete changes.role;
      const targetRole = effectiveRole(existing);
      const nextRole = effectiveRole({ ...existing, ...changes });
      if (importer && (!canTerminateUser(importer, existing) ||
          (targetRole !== nextRole && !canChangeEmployeeRole(importer, existing, nextRole)))) {
        sheetError(row, `You are not allowed to modify a ${roleLabel(targetRole)}`);
        continue;
      }
      if (changes.isActive === false) {
        changes.isOnline = false;
        if (existing.isActive !== false) changes.passwordVersion = randomUUID();
      }
      updatedUsers.add(existing.id);
      editedRows.push({ row, existing, changes: { ...changes, updatedAt: now, updatedBy: importedBy } });
    }

    const allocations = new Map();
    if (!dryRun) {
      const byRole = Object.groupBy(newRows, ({ fields }) => fields.role);
      for (const [role, group] of Object.entries(byRole)) {
        allocations.set(role, await allocateEmployeeIds(role, group.length, client));
      }
    }

    const createdRows = newRows.map(({ row, fields }) => ({
      row,
      user: newEmployee({ isActive: true, ...fields, createdByName: importedBy, importedAt: now },
        allocations.get(fields.role)?.shift())
    }));
    const references = new Map();
    for (const user of existingUsers.filter(user => !updatedUsers.has(user.id))) addUserReferences(references, user);
    for (const { existing, changes } of editedRows) addUserReferences(references, { ...existing, ...changes });
    for (const { user } of createdRows) addUserReferences(references, user);

    const managerWarnings = [];
    const linkManager = (record, row, fallback = record) => {
      const key = record.manager?.trim().toLowerCase();
      if (!key) return;
      const manager = references.get(key);
      if (manager && manager.id !== fallback.id) {
        record.managerId = manager.id;
        record.manager = manager.fullName;
      } else {
        record.managerId = '';
        managerWarnings.push({ row: row.rowNumber, employeeId: fallback.employeeId, manager: record.manager, warning: 'Manager not found uniquely in the system; kept as text.' });
      }
    };
    createdRows.forEach(({ row, user }) => linkManager(user, row));
    editedRows.forEach(({ row, existing, changes }) => linkManager(changes, row, existing));

    if (!dryRun) {
      await insertEmployees(client, createdRows.map(({ user }) => user));
      await updateEmployees(client, editedRows.map(({ existing, changes }) => ({ ...changes, userIdForUpdate: existing.id })));
    }

    const describe = (row, user) => ({
      row: row.rowNumber, id: dryRun ? undefined : user.id, employeeId: user.employeeId,
      name: user.fullName, email: user.email, role: effectiveRole(user), department: user.department,
      setupEmailStatus: dryRun ? undefined : user.setupEmailStatus
    });
    const created = createdRows.map(({ row, user }) => describe(row, user));
    const updated = editedRows.map(({ row, existing, changes }) => describe(row, { ...existing, ...changes }));
    return {
      dryRun,
      summary: { totalRows, toCreate: created.length, toUpdate: updated.length, skipped: skipped.length, errors: errors.length },
      columnMapping: mapping, unmappedColumns: unmapped, created, updated, skipped,
      errors: errors.sort((a, b) => a.row - b.row), managerWarnings
    };
  }

  return dryRun ? apply({ query }) : withEmployeeIdentityLock(apply);
}

module.exports = { importEmployees, parseRows, mapHeaders, normalizeRole, parseDate, normalizePhone, HEADER_ALIASES, VALID_ROLES };
