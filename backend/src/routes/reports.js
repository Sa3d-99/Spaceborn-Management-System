// routes/reports.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  submitReport, 
  getTodayReport, 
  getUserReports, 
  getDepartmentReports, 
  getAllReports, 
  updateReport, 
  deleteReport,
  getComplianceReport 
} = require('../controllers/reportController');

router.use(protect);
router.post('/', submitReport);
router.get('/user/:userId/today', getTodayReport);
router.get('/user/:userId', getUserReports);
router.get('/department/:department', getDepartmentReports);
router.get('/compliance', getComplianceReport);
router.get('/', getAllReports);
router.put('/:id', updateReport);
router.delete('/:id', deleteReport);

module.exports = router;
