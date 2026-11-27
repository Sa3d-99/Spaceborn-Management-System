const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const { getJwtSecret } = require('./utils/jwtSecret');

getJwtSecret();
const app = express();
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);

app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (process.env.NODE_ENV !== 'production' || !origin) return next();
  const appOrigin = URL.canParse(process.env.APP_URL) ? new URL(process.env.APP_URL).origin : null;
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin === appOrigin || origin === sameOrigin) return next();
  return res.status(403).json({ success: false, message: 'This origin is not allowed to access the CRM API.' });
});

app.use('/api', cors({
  origin: true,
  credentials: true
}));

// Accept legacy JSON import clients alongside multipart uploads.
const defaultJson = express.json();
const importJson = express.json({ limit: '5mb' });
app.use((req, res, next) => (req.path === '/api/employees/import' ? importJson : defaultJson)(req, res, next));
app.use(express.urlencoded({ extended: true }));

// Initialize once per warm serverless instance before handling API requests.
let databaseReady;
app.use('/api', async (req, res, next) => {
  try {
    if (!databaseReady) databaseReady = connectDB();
    await databaseReady;
    next();
  } catch (error) {
    databaseReady = null;
    console.error('API database initialization failed:', error);
    res.status(503).json({
      success: false,
      status: 'ERROR',
      message: 'The API database is unavailable. Check DATABASE_URL and database connectivity.'
    });
  }
});

// ======================
// API Route registrations
// ======================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/config', require('./routes/configRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api', require('./routes/teamMembersRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/manager', require('./routes/managerRoutes'));
app.use('/api/team-lead', require('./routes/teamLeadDashboardRoutes'));
app.use('/api/member', require('./routes/memberDashboardRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/risks', require('./routes/riskRoutes'));
app.use('/api/strategic-metrics', require('./routes/strategicMetricsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/company-health', require('./routes/companyHealthRoutes'));
app.use('/api/executive-decisions', require('./routes/executiveDecisionRoutes'));
app.use('/api/roadmaps', require('./routes/roadmapRoutes'));
app.use('/api/leaves', require('./routes/leaveRoutes'));
app.use('/api/holidays', require('./routes/holidayRoutes'));
app.use('/api/hour-breaks', require('./routes/hourBreakRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));
app.use('/api/reports', require('./routes/reports'));

// ======================
// Health Check Route
// ======================
app.get('/api/health', async (_req, res) => {
  try {
    await connectDB.query('SELECT 1');
    res.json({ success: true, status: 'OK', message: 'Spaceborn API is healthy.' });
  } catch {
    res.status(503).json({ success: false, status: 'ERROR', message: 'The API database is unavailable.' });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

app.use('/api', (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    const limit = req.path === '/employees/import' ? 5 : 10;
    return res.status(413).json({ success: false, message: `File size must be ${limit} MB or less.` });
  }
  if (error.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'The request body exceeds the upload limit.' });
  }
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error('API request failed:', error.message);
  return res.status(status).json({ success: false, message: status === 500 ? 'Request failed.' : 'Invalid request.' });
});

// ======================
// Unified Frontend Serving (Approach A)
// ======================
const frontendBuildPath = path.resolve(__dirname, '../../frontend/build');

if (fs.existsSync(frontendBuildPath)) {
  console.log('📦 Serving compiled React frontend from:', frontendBuildPath);
  app.use(express.static(frontendBuildPath));

  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Space Born API Running (Frontend build not found)' });
  });
}

module.exports = app;
