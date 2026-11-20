// Bulk employee import: turns spreadsheet rows into users.
// Used by the API (POST /api/employees/import) and the CLI (scripts/importEmployees.js).
const crypto = require('crypto');
const User = require('../models/User');
const { normalizeDepartment: officialDepartment } = require('../config/departments');


const VALID_ROLES = ['CEO', 'COO', 'Manager', 'Team Lead', 'CO Head', 'HR', 'Member'];

// Spreadsheet header (lowercased, punctuation stripped) -> user field.
const HEADER_ALIASES = {
  employeeId: ['employee id', 'emp id', 'empid', 'employee code', 'emp code', 'employee no', 'emp no', 'staff id', 'id'],
  name: ['name', 'full name', 'employee name', 'emp name', 'fullname'],
  firstName: ['first name', 'firstname', 'given name'],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'email id', 'email address', 'mail', 'mail id', 'official email', 'official email id', 'work email', 'company email'],
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
}, {});

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
  const mapping = {};
  const unmapped = [];
  headers.forEach((h) => {
    const field = ALIAS_LOOKUP[normalizeHeader(h)];
    if (field && !Object.values(mapping).includes(field)) mapping[h] = field;
    else if (String(h || '').trim()) unmapped.push(h);
  });
  return { mapping, unmapped };
}

function normalizeRole(raw, designation) {
  const r = normalizeHeader(raw || '');
  if (!r) {
    const d = normalizeHeader(designation || '');
    if (/\bchief executive\b|^ceo$/.test(d)) return 'CEO';
    if (/\bchief operating\b|^coo$/.test(d)) return 'COO';
    if (/\bteam lead\b|\btech lead\b/.test(d)) return 'Team Lead';
    // Job titles like "Product Manager" or "HR Executive" don't imply system access;
    // add a Role column to grant Manager/HR rights explicitly.
    return 'Member';
  }
  // Spaceborn titles -> internal permission codes (see frontend/src/utils/roleLabels.js):
  //   CEO -> CEO, Director -> COO, Team Lead / Co-Lead -> Team Lead, Project Manager -> Manager, Intern -> Member
  if (r === 'ceo' || r.includes('chief executive') || r.includes('founder & ceo') || r === 'founder') return 'CEO';
  if (r === 'coo' || r.includes('chief operating') || r.includes('director')) return 'COO';
  if (r.includes('project manager') || r === 'pm' || r === 'manager') return 'Manager';
  if (r.includes('team lead') || r === 'lead' || r === 'tl' || r.includes('tech lead') ||
      r.includes('co lead') || r.includes('colead') || r.includes('co head') || r === 'cohead') return 'Team Lead';
  if (r === 'hr' || r.includes('human resource')) return 'HR';
  return 'Member'; // employee, intern, engineer, member, etc.
}

function normalizeDepartment(raw) {
  return officialDepartment(clean(raw)) || '';
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
    if (valid(year, m[1], m[2])) return iso(year, m[1], m[2]);
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rolePrefix = (role) => (
  role === 'CEO' ? 'CEO' :
  role === 'COO' ? 'DIR' :        // Director
  role === 'Manager' ? 'PM' :     // Project Manager
  role === 'Team Lead' ? 'LD' :   // Team Lead / Co-Lead
  role === 'CO Head' ? 'COH' :
  role === 'HR' ? 'HR' : 'INT'
);

const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('') + '@1';
};

// Who may import which roles (mirrors the termination hierarchy).
function canAssignRole(importerRole, targetRole) {
  if (!importerRole || importerRole === 'CEO') return true; // CLI has no importer role
  if (importerRole === 'COO') return targetRole !== 'CEO';
  if (importerRole === 'Manager' || importerRole === 'HR') return !['CEO', 'COO'].includes(targetRole);
  return false;
}

/**
 * Convert raw spreadsheet rows (array of {header: value}) into validated employee records.
 * Returns { records, errors, mapping, unmapped } without touching the database.
 */
function parseRows(rows) {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((h) => h !== '__row__');
  const { mapping, unmapped } = mapHeaders(headers);
  const records = [];
  const errors = [];
  let totalRows = 0;

  rows.forEach((row, idx) => {
    const rowNumber = Number(row.__row__) || idx + 2; // __row__ = real sheet row; else assume header on row 1
    const rec = {};
    const extra = {};
    for (const [header, value] of Object.entries(row)) {
      if (header === '__row__') continue;
      const field = mapping[header];
      if (field) rec[field] = value;
      else if (clean(value) !== '') extra[header] = clean(value);
    }

    // Skip fully blank rows.
    if (Object.values(rec).every((v) => clean(v) === '') && Object.keys(extra).length === 0) return;
    totalRows += 1;

    const rowErrors = [];
    let firstName = clean(rec.firstName);
    let lastName = clean(rec.lastName);
    const fullName = clean(rec.name) || [firstName, lastName].filter(Boolean).join(' ');
    if (!firstName && fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    if (!fullName) rowErrors.push('Missing name');

    const email = clean(rec.email).toLowerCase();
    if (!email) rowErrors.push('Missing email');
    else if (!EMAIL_RE.test(email)) rowErrors.push(`Invalid email "${email}"`);

    const joinDate = parseDate(rec.joinDate);
    if (joinDate === null) rowErrors.push(`Unrecognised join date "${clean(rec.joinDate)}"`);
    const dateOfBirth = parseDate(rec.dateOfBirth);

    const designation = clean(rec.designation);
    const role = normalizeRole(clean(rec.role), designation);

    const record = {
      rowNumber,
      employeeId: clean(rec.employeeId).toUpperCase(),
      firstName,
      lastName,
      fullName,
      email,
      phone: normalizePhone(rec.phone),
      role,
      designation: designation || role,
      department: normalizeDepartment(rec.department),
      team: clean(rec.team),
      manager: clean(rec.manager),
      joinDate: joinDate || '',
      isActive: isActiveStatus(rec.status),
      password: clean(rec.password)
    };

    const optional = {
      personalEmail: clean(rec.personalEmail).toLowerCase(),
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

/**
 * Import employees.
 * @param {Array<Object>} rows        raw rows keyed by spreadsheet header
 * @param {Object} opts
 * @param {boolean} opts.dryRun       validate and report only (default true)
 * @param {boolean} opts.updateExisting  update users that already exist (matched by employee ID, then email)
 * @param {Object}  opts.importer     req.user of whoever runs the import (omit for CLI)
 */
async function importEmployees(rows, opts = {}) {
  const { dryRun = true, updateExisting = false, importer = null } = opts;
  const { records, errors, mapping, unmapped, totalRows } = parseRows(rows);

  // Load everyone once: the model filters in JS, so per-row queries would be O(n²).
  const existingUsers = await User.find({});
  const byEmail = new Map(existingUsers.filter((u) => u.email).map((u) => [String(u.email).toLowerCase(), u]));
  const byEmpId = new Map(existingUsers.filter((u) => u.employeeId).map((u) => [String(u.employeeId).toUpperCase(), u]));

  // Next free number per prefix, based on the highest existing ID (not count, which collides after deletions).
  const counters = {};
  const bumpCounter = (id) => {
    const m = String(id || '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (m) counters[m[1]] = Math.max(counters[m[1]] || 0, Number(m[2]));
  };
  existingUsers.forEach((u) => bumpCounter(u.employeeId));
  records.forEach((r) => bumpCounter(r.employeeId));
  const nextId = (role) => {
    const p = rolePrefix(role);
    counters[p] = (counters[p] || 0) + 1;
    return `${p}${String(counters[p]).padStart(3, '0')}`;
  };

  const created = [];
  const updated = [];
  const skipped = [];
  const credentials = [];
  const importedBy = importer ? (importer.name || importer.employeeId) : 'bulk-import';

  for (const rec of records) {
    const { rowNumber, password, ...fields } = rec;

    if (!canAssignRole(importer?.role, fields.role)) {
      errors.push({ row: rowNumber, name: fields.fullName, email: fields.email, errors: [`You are not allowed to create a ${fields.role}`] });
      continue;
    }

    const existing = (fields.employeeId && byEmpId.get(fields.employeeId)) || byEmail.get(fields.email);

    if (existing) {
      // An email that belongs to someone else with a different employee ID is a conflict, not an update.
      const emailOwner = byEmail.get(fields.email);
      if (emailOwner && String(emailOwner._id) !== String(existing._id)) {
        errors.push({ row: rowNumber, name: fields.fullName, email: fields.email, errors: [`Email already used by ${emailOwner.employeeId}`] });
        continue;
      }
      if (!updateExisting) {
        skipped.push({ row: rowNumber, employeeId: existing.employeeId, name: fields.fullName, reason: 'Already exists' });
        continue;
      }
      if (!canAssignRole(importer?.role, existing.role)) {
        errors.push({ row: rowNumber, name: fields.fullName, email: fields.email, errors: [`You are not allowed to modify a ${existing.role}`] });
        continue;
      }
      const changes = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== '' && k !== 'employeeId'));
      if (!dryRun) await User.findByIdAndUpdate(existing._id, { $set: { ...changes, updatedBy: importedBy } });
      updated.push({ row: rowNumber, employeeId: existing.employeeId, name: fields.fullName, email: fields.email, role: fields.role });
      continue;
    }

    const employeeId = fields.employeeId || nextId(fields.role);
    const initialPassword = password || generatePassword();
    const doc = {
      ...fields,
      employeeId,
      password: initialPassword,
      joinDate: fields.joinDate || new Date().toISOString().split('T')[0],
      createdByName: importedBy,
      importedAt: new Date().toISOString(),
      leaveBalance: { Sick: 12, Casual: 10, Annual: 15, Emergency: 5, Other: 3 }
    };

    if (!dryRun) {
      const user = await User.create(doc);
      byEmail.set(fields.email, user);
      byEmpId.set(employeeId, user);
      existingUsers.push(user);
    } else {
      // Reserve so later rows in the same dry run see it.
      byEmail.set(fields.email, { _id: `dry-${rowNumber}`, employeeId, email: fields.email });
      byEmpId.set(employeeId, { _id: `dry-${rowNumber}`, employeeId, email: fields.email });
    }
    created.push({ row: rowNumber, employeeId, name: fields.fullName, email: fields.email, role: fields.role, department: fields.department });
    credentials.push({ employeeId, name: fields.fullName, email: fields.email, password: dryRun ? '(generated on import)' : initialPassword });
  }

  // Second pass: link managers (by name, employee ID or email) so "Reporting Manager" becomes managerId.
  const managerWarnings = [];
  if (!dryRun) {
    const all = await User.find({});
    const find = (ref) => {
      const key = String(ref || '').trim().toLowerCase();
      if (!key) return null;
      return all.find((u) => String(u.employeeId || '').toLowerCase() === key ||
        String(u.email || '').toLowerCase() === key ||
        String(u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).trim().toLowerCase() === key);
    };
    const touched = new Set([...created, ...updated].map((c) => c.employeeId));
    for (const u of all) {
      if (!touched.has(u.employeeId) || !u.manager) continue;
      const mgr = find(u.manager);
      if (mgr && String(mgr._id) !== String(u._id)) {
        const mgrName = mgr.fullName || `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim();
        if (u.managerId !== String(mgr._id) || u.manager !== mgrName) {
          await User.findByIdAndUpdate(u._id, { $set: { managerId: String(mgr._id), manager: mgrName } });
        }
      } else if (!mgr) {
        managerWarnings.push({ employeeId: u.employeeId, manager: u.manager, warning: 'Manager not found in system; kept as text' });
      }
    }
  }

  return {
    dryRun,
    summary: {
      totalRows,
      toCreate: created.length,
      toUpdate: updated.length,
      skipped: skipped.length,
      errors: errors.length
    },
    columnMapping: mapping,
    unmappedColumns: unmapped,
    created,
    updated,
    skipped,
    errors: errors.sort((a, b) => a.row - b.row),
    managerWarnings,
    credentials: dryRun ? [] : credentials
  };
}

module.exports = { importEmployees, parseRows, mapHeaders, normalizeRole, parseDate, normalizePhone, HEADER_ALIASES, VALID_ROLES };
