const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const { getActivity, getLoginManagement, getMyAttendance } = require('../controllers/systemDashboardController');
const {
  getCeoDashboard,
  getManagerDashboard,
  getTeamLeadDashboard,
  getMemberDashboard,
  getDashboardStats,
} = require('../controllers/dashboardController');

router.get('/ceo', protect, authorize('CEO'), getCeoDashboard);
router.get('/manager', protect, authorize('CEO', 'COO', 'Manager'), getManagerDashboard);
router.get('/team-lead', protect, authorize('CEO', 'COO', 'Manager', 'Team Lead', 'CO Head', 'Co-Head'), getTeamLeadDashboard);
router.get('/member', protect, authorize('CEO', 'COO', 'Manager', 'Team Lead', 'Member'), getMemberDashboard);
router.get('/stats', protect, getDashboardStats);
router.get('/activity', protect, authorize('CEO', 'COO', 'Manager'), getActivity);
router.get('/login-management', protect, authorize('CEO', 'COO', 'Manager'), getLoginManagement);
router.get('/my-attendance', protect, getMyAttendance);

module.exports = router;
