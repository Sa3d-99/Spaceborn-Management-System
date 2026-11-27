const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createEmployee, getAllEmployees, getEmployee, updateEmployee, deleteEmployee,
  resetPassword, resendSetupEmail, deactivateEmployee, activateEmployee, hasRole
} = require('../controllers/userController');

const router = express.Router();
const manage = authorize('CEO', 'COO', 'Manager', 'HR');
const view = authorize('CEO', 'COO', 'Manager', 'HR', 'Team Lead', 'CO Head');
router.use(protect);
router.post('/create', manage, createEmployee);
router.get('/', view, getAllEmployees);
router.get('/:id/has-role/:role', hasRole);
router.get('/:id', view, getEmployee);
router.put('/:id', manage, updateEmployee);
router.post('/:id/reset-password', manage, resetPassword);
router.post('/:id/setup-email', manage, resendSetupEmail);
router.post('/:id/deactivate', manage, deactivateEmployee);
router.post('/:id/activate', manage, activateEmployee);
router.delete('/:id', manage, deleteEmployee);
router.post('/:id/terminate', manage, deleteEmployee);

module.exports = router;
