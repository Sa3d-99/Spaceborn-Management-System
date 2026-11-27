const { DEPARTMENTS, normalizeDepartment } = require('../config/departments');
const { businessDate } = require('./businessTime');
const { effectiveRole, ROLE_HIERARCHY } = require('./terminationPermissions');

const namePattern = /^[\p{L}\p{M}][\p{L}\p{M} '\u2019-]*$/u;
const emailPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const phonePattern = /^\+?\d{10,15}$/;
const cleanText = value => typeof value === 'string' ? value.trim() : '';
const length = value => [...value].length;
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
const employeeRoleAliases = {
  director: 'COO', 'project manager': 'Manager', intern: 'Member', 'co-lead': 'CO Head'
};

function validateEmployeeFields(input, existing = null) {
  let source = input;
  if ('name' in input && !('firstName' in input) && !('lastName' in input)) {
    const [firstName, ...rest] = cleanText(input.name).split(/\s+/);
    source = { ...input, firstName, lastName: rest.join(' ') };
  }

  const changed = field => !existing || Object.hasOwn(source, field);
  const fields = {};
  const errors = [];
  if (!existing && (!cleanText(source.firstName) || !cleanText(source.lastName) || !cleanText(source.email))) {
    return { fields, errors: ['Name and email are required'] };
  }
  for (const [field, label, minimum] of [['firstName', 'First name', 2], ['lastName', 'Last name', 1]]) {
    if (!changed(field)) continue;
    fields[field] = cleanText(source[field]);
    if (!namePattern.test(fields[field]) || length(fields[field]) < minimum || length(fields[field]) > 30) {
      errors.push(`${label} must be ${minimum}–30 characters and use only letters, spaces, hyphens or apostrophes.`);
    }
  }
  if (changed('email')) {
    fields.email = cleanText(source.email).toLowerCase();
    if (fields.email.length > 100 || !emailPattern.test(fields.email)) errors.push('Enter a valid email address with up to 100 characters.');
  }
  if (changed('phone')) {
    fields.phone = cleanText(source.phone).replace(/^\+91 (\d{5}) (\d{5})$/, '+91$1$2');
    if ((source.phone != null && typeof source.phone !== 'string') || (fields.phone && !phonePattern.test(fields.phone))) {
      errors.push('Phone must have 10–15 digits and may start with +.');
    }
  }
  if (changed('role')) {
    const requested = cleanText(source.role) || 'Member';
    fields.role = effectiveRole({ role: employeeRoleAliases[requested.toLowerCase()] || requested });
    if (!Object.hasOwn(ROLE_HIERARCHY, fields.role)) errors.push('Select a valid role.');
  }
  if (changed('department')) {
    fields.department = normalizeDepartment(cleanText(source.department));
    if (!DEPARTMENTS.includes(fields.department)) errors.push('Select one of the listed departments.');
  }
  if (changed('designation')) {
    fields.designation = cleanText(source.designation);
    if (fields.designation && (length(fields.designation) < 2 || length(fields.designation) > 60)) {
      errors.push('Designation must be 2–60 characters.');
    }
  }
  const joinDate = changed('joinDate') ? cleanText(source.joinDate) : existing.joinDate;
  if (changed('joinDate')) {
    fields.joinDate = joinDate;
    const latest = new Date(Date.parse(businessDate()) + 180 * 86400000).toISOString().slice(0, 10);
    if (!isDate(joinDate) || joinDate < '2020-01-01' || joinDate > latest) {
      errors.push(`Join date must be a valid date between 2020-01-01 and ${latest}.`);
    }
  }
  const dateOfBirth = changed('dateOfBirth') ? cleanText(source.dateOfBirth) : existing.dateOfBirth;
  if (changed('dateOfBirth')) fields.dateOfBirth = dateOfBirth;
  if (dateOfBirth && (changed('dateOfBirth') || changed('joinDate'))) {
    const age = Number(joinDate?.slice(0, 4)) - Number(dateOfBirth.slice(0, 4)) -
      Number(joinDate?.slice(5) < dateOfBirth.slice(5));
    if (!isDate(dateOfBirth) || !isDate(joinDate) || age < 16 || age > 70) {
      errors.push('Age at the join date must be between 16 and 70.');
    }
  }
  return { fields, errors };
}

module.exports = { validateEmployeeFields, cleanText };
