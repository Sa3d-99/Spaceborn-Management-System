// src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { 
  autoMarkAttendance,
  clockOut,
  getAttendance, 
  getStats, 
  getDepartmentStats, 
  markAttendance,
  markLeaveAbsent,
  getRosterAttendance
} = require('../controllers/attendanceController');

// Auto-mark on login (called from frontend on successful login)
router.post('/auto-mark', protect, autoMarkAttendance);
router.post('/clock-out', protect, clockOut);

// Get attendance records
router.get('/', protect, getAttendance);

// Get stats
router.get('/stats', protect, getStats);

// Get department stats
router.get('/by-department', protect, getDepartmentStats);

// Mark attendance manually
router.post('/mark', protect, authorize('CEO', 'COO', 'Manager'), markAttendance);

// Mark leave as absent
router.post('/mark-leave-absent', protect, authorize('CEO', 'COO', 'Manager'), markLeaveAbsent);

// Roster attendance for management and team leads (including approved leave).
router.get('/roster', protect, authorize('CEO', 'COO', 'Manager', 'HR', 'Coordinator', 'Team Lead', 'CO Head', 'Co-Head'), getRosterAttendance);


module.exports = router;