// Spaceborn's departments: the single list the whole frontend uses.
// Keep in sync with backend/src/config/departments.js.
export const DEPARTMENTS = [
  'Founding Team',
  'Platform & DevOps AI',
  'Core Systems & Kernel',
  'Execution Runtime',
  'FSM & Control Logic',
  'Sensor Stack',
  'Hardware & Integration',
  'Robotics & Simulation',
  'Neural AI',
  'Physical AI',
  'DERYK',
  'ANSA',
  'Operations & Management',
  'Business & Partnerships',
  'Creative & Marketing'
];

// Spelling variants seen in the team sheet (and the old example departments) -> official name.
// Keys are compared after lowercasing, turning "&" into "and" and removing spaces/punctuation.
const ALIASES = {
  foundingteam: 'Founding Team',
  future: 'Founding Team',
  ceo: 'Founding Team',
  executive: 'Founding Team',

  platformanddevopsai: 'Platform & DevOps AI',
  platformanddevopai: 'Platform & DevOps AI',
  platformanddevops: 'Platform & DevOps AI',
  platformai: 'Platform & DevOps AI',
  platform: 'Platform & DevOps AI',
  devops: 'Platform & DevOps AI',

  coresystemsandkernel: 'Core Systems & Kernel',
  coresystemskernel: 'Core Systems & Kernel',
  coresystems: 'Core Systems & Kernel',
  kernel: 'Core Systems & Kernel',

  executionruntime: 'Execution Runtime',

  fsmandcontrollogic: 'FSM & Control Logic',
  fsmcontrollogic: 'FSM & Control Logic',
  controllogic: 'FSM & Control Logic',
  fsm: 'FSM & Control Logic',

  sensorstack: 'Sensor Stack',

  hardwareandintegration: 'Hardware & Integration',
  hardware: 'Hardware & Integration',

  roboticsandsimulation: 'Robotics & Simulation',
  roboticssimulation: 'Robotics & Simulation',
  roboticsandai: 'Robotics & Simulation',
  roboticsdepartment: 'Robotics & Simulation',
  robotics: 'Robotics & Simulation',

  neuralai: 'Neural AI',
  aillmandperception: 'Neural AI',

  physicalai: 'Physical AI',

  deryk: 'DERYK',
  ansa: 'ANSA',

  operationandmanagement: 'Operations & Management',
  operationsandmanagement: 'Operations & Management',
  management: 'Operations & Management',
  operations: 'Operations & Management',

  businessandpartnerships: 'Business & Partnerships',
  businessandpartnership: 'Business & Partnerships',
  buisnessandpartnership: 'Business & Partnerships',
  buisnessandpartnerships: 'Business & Partnerships',

  creativeandmarketing: 'Creative & Marketing',
  creativemarketing: 'Creative & Marketing',
  marketing: 'Creative & Marketing',
  creative: 'Creative & Marketing'
};

const keyOf = (value) => String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const ALIAS_KEYS_LONGEST_FIRST = Object.keys(ALIASES).sort((a, b) => b.length - a.length);

// "robotics and simulation " -> "Robotics & Simulation". Combined entries like
// "Robotics and Simulation & Platform and Devops AI" take the first department named.
export function normalizeDepartment(department) {
  if (!department) return department;
  const original = String(department).trim();
  const key = keyOf(original);
  if (!key || key === 'all' || key === 'alldepartments') return original;
  if (ALIASES[key]) return ALIASES[key];
  const prefix = ALIAS_KEYS_LONGEST_FIRST.find((alias) => key.startsWith(alias));
  return prefix ? ALIASES[prefix] : original;
}

export const normalizeDepartments = (departments = [], options = {}) => {
  const normalized = departments
    .map(normalizeDepartment)
    .filter(Boolean)
    .filter((department) => options.includeAll || !['All', 'all', 'All Departments'].includes(department));

  const ordered = options.onlyPresent
    ? DEPARTMENTS.filter((department) => normalized.includes(department))
    : DEPARTMENTS;
  const extras = normalized.filter((department) => !DEPARTMENTS.includes(department));
  const result = [...new Set([...ordered, ...extras])];

  return options.includeAll ? [...result, 'All'] : result;
};

export const normalizeDepartmentFields = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeDepartmentFields);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        key === 'department' || key === 'dept' ? normalizeDepartment(entry) : normalizeDepartmentFields(entry)
      ])
    );
  }

  return value;
};
