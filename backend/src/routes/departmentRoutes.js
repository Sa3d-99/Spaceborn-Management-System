const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Task = require('../models/Task');
const { protect } = require('../middleware/authMiddleware');
const { DEPARTMENTS, normalizeDepartment } = require('../config/departments');

router.get('/', protect, async (req, res) => {
  try {
    const [userDepartments, taskDepartments] = await Promise.all([
      User.distinct('department', {}),
      Task.distinct('department', {})
    ]);

    const rawDepartments = [...userDepartments, ...taskDepartments].map(normalizeDepartment);
    const departments = DEPARTMENTS
      .concat(rawDepartments.filter((department) => department && !DEPARTMENTS.includes(department)))
      .filter(Boolean)
      .filter((department, index, list) => list.indexOf(department) === index);

    res.json(departments);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch departments' });
  }
});

module.exports = router;
