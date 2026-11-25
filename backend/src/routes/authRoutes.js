const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { protect, authorize } = require('../middleware/authMiddleware');
const { register, login, logout, getMe, requestPasswordReset, validatePasswordReset, resetPassword, changePassword, updatePreferences } = require('../controllers/authController');

const signup = require('../controllers/signupController');
const router = express.Router();
const authRateLimit = (limit, skipSuccessfulRequests = false) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' }
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/register', protect, authorize('CEO', 'COO', 'Manager'), register);
router.post('/login', authRateLimit(50, true), login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.get('/verify', protect, getMe);
router.patch('/preferences', protect, updatePreferences);
router.post('/signup', authRateLimit(10), signup.signup);
router.get('/signup-requests', protect, authorize('CEO'), signup.list);
router.post('/signup-requests/:id/approve', protect, authorize('CEO'), signup.approve);
router.post('/signup-requests/:id/reject', protect, authorize('CEO'), signup.reject);
router.post('/signup-requests/:id/resend', protect, authorize('CEO'), signup.resend);
router.delete('/signup-requests/:id', protect, authorize('CEO'), signup.remove);
router.post('/change-password', protect, authRateLimit(20, true), changePassword);

router.post(
  ['/forgot-password', '/request-password-reset', '/forgot-password/immediate'],
  authRateLimit(12),
  requestPasswordReset
);
router.post('/reset-password/validate', authRateLimit(30), validatePasswordReset);
router.post('/reset-password', authRateLimit(20), resetPassword);

module.exports = router;
