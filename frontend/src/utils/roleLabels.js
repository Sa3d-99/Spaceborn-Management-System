// What each internal role code is called at Spaceborn.
// Permissions still use the codes (CEO, COO, Manager, Team Lead, HR, Member);
// only the text shown on screen changes.
//   CEO  > Directors > Team Lead / Co-Lead > Project Manager > Intern, with HR reporting to the CEO.
export const ROLE_LABELS = {
  CEO: 'CEO',
  COO: 'Director',
  Manager: 'Project Manager',
  'Team Lead': 'Team Lead',
  'CO Head': 'Co-Lead',
  'Co-Head': 'Co-Lead',
  HR: 'HR',
  Member: 'Intern'
};

export const roleLabel = (role) => ROLE_LABELS[role] || role || '';

export default roleLabel;
