const express = require('express');
const multer = require('multer');
const router = express.Router();
const { extname } = require('node:path');

const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  getEmployeeByEmail,
  getEmployeeByEmployeeId,
  updateEmployee,
  deleteEmployee,
  getEmployeesByDepartment,
  getEmployeesByRole,
  getEmployeesByManager,
  getEmployeeDepartments,
  getEmployeeStats,
  getLeaveBalance,
  updateLeaveBalance,
  searchEmployees,
  uploadEmployeeDocument,
  importEmployees,
} = require('../controllers/userController');

const oneFile = (field, limit, extensions, sizeMessage, typeMessage) => {
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: limit + 1 } }).single(field);
  return (req, res, next) => upload(req, res, error => {
    if (error?.code === 'LIMIT_FILE_SIZE' || req.file?.size > limit) {
      return res.status(413).json({ success: false, message: sizeMessage });
    }
    if (error) return res.status(400).json({ success: false, message: 'Upload one file using the selected file field.' });
    if (req.file && !extensions.includes(extname(req.file.originalname).toLowerCase())) {
      return res.status(400).json({ success: false, message: typeMessage });
    }
    return next();
  });
};
const manage = authorize('CEO', 'COO', 'Manager', 'HR');
const view = authorize('CEO', 'COO', 'Manager', 'HR', 'Team Lead', 'CO Head');
const importUpload = oneFile('file', 5 * 1024 ** 2, ['.xlsx', '.csv'],
  'File size must be 5 MB or less.', 'Choose an .xlsx or .csv file.');
const documentUpload = oneFile('document', 10 * 1024 ** 2, ['.pdf', '.jpg', '.jpeg', '.png', '.docx'],
  'File size must be less than 10MB.', 'Choose a PDF, JPG, PNG or DOCX document.');

router.use(protect);

router.post('/import', manage, importUpload, importEmployees);
router.get('/departments', view, getEmployeeDepartments);
router.get('/stats', manage, getEmployeeStats);
router.get('/search', view, searchEmployees);
router.get('/email/:email', view, getEmployeeByEmail);
router.get('/employee-id/:employeeId', view, getEmployeeByEmployeeId);
router.get('/department/:department', view, getEmployeesByDepartment);
router.get('/role/:role', manage, getEmployeesByRole);
router.get('/manager/:managerId', view, getEmployeesByManager);
router.post('/:id/documents', manage, documentUpload, uploadEmployeeDocument);
router.get('/:id/leave-balance', getLeaveBalance);
router.patch('/:id/leave-balance', manage, updateLeaveBalance);
router.get('/:id', view, getEmployeeById);
router.put('/:id', manage, updateEmployee);
router.delete('/:id', manage, deleteEmployee);
router.get('/', view, getEmployees);
router.post('/', manage, createEmployee);

module.exports = router;
