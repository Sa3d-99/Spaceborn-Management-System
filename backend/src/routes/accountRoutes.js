const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAllAccounts, getAccountStats } = require('../controllers/accountController');

const router = express.Router();
router.use(protect, authorize('CEO', 'COO', 'Manager', 'HR'));
router.get('/all', getAllAccounts);
router.get('/stats', getAccountStats);

module.exports = router;
