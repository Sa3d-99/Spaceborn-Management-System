const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const Roadmap = require('../models/Roadmap');
const { protect } = require('../middleware/authMiddleware');
const { notifyMvpSubmitted } = require('../utils/notificationDispatcher');

const initials = (name = 'U') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const uploadDir = path.join(__dirname, '../../uploads/roadmap-attachments');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 + 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.pptx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    const error = new Error('Upload a PDF, PNG, JPG, DOCX, XLSX, or PPTX file.');
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(error);
  }
});

const toDto = (roadmap) => ({
  id: String(roadmap._id),
  _id: roadmap._id,
  title: roadmap.title,
  version: roadmap.version,
  description: roadmap.description,
  department: roadmap.department,
  startDate: roadmap.startDate,
  targetDate: roadmap.targetDate,
  lastUpdated: roadmap.updatedAt,
  status: roadmap.status,
  sharedWith: roadmap.sharedWith || [],
  sharedAt: roadmap.sharedAt,
  sharedBy: roadmap.sharedBy,
  overallProgress: roadmap.overallProgress || 0,
  milestones: roadmap.milestones || [],
  features: roadmap.features || [],
  risks: roadmap.risks || [],
  weeklyUpdates: roadmap.weeklyUpdates || [],
  attachments: roadmap.attachments || [],
  blockers: roadmap.blockers || [],
  createdAt: roadmap.createdAt
});

router.use(protect);

router.get('/shared', async (req, res) => {
  try {
    const canViewAll = ['CEO', 'COO'].includes(req.user.role);
    const department = req.query.department || (canViewAll ? '' : req.user.department || '');
    const roadmaps = await Roadmap.find({
      ...(department ? { department } : {}),
      status: { $in: ['shared', 'active'] }
    }).sort({ updatedAt: -1 });

    res.json(roadmaps.map(toDto));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch roadmaps' });
  }
});

router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.department) query.department = req.query.department;
    if (req.query.status) query.status = req.query.status;

    const roadmaps = await Roadmap.find(query).sort({ updatedAt: -1 });
    res.json({ success: true, data: roadmaps.map(toDto) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch roadmaps' });
  }
});

router.post('/', async (req, res) => {
  try {
    const roadmap = await Roadmap.create({
      ...req.body,
      department: req.body.department || req.user.department || 'Core Systems',
      sharedBy: {
        id: String(req.user._id),
        name: req.user.name,
        role: req.user.role,
        email: req.user.email,
        avatar: initials(req.user.name)
      },
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, data: toDto(roadmap) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create roadmap' });
  }
});

router.post('/:id/share', async (req, res) => {
  try {
    const roadmap = await Roadmap.findByIdAndUpdate(
      req.params.id,
      { status: 'shared', sharedWith: ['CEO', 'COO', 'Manager'], sharedAt: new Date() },
      { new: true }
    );
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    await notifyMvpSubmitted(roadmap, req.user);
    res.json({ success: true, data: toDto(roadmap) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to share roadmap' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id, _id, createdAt, updatedAt, ...updates } = req.body;
    const roadmap = await Roadmap.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    res.json({ success: true, data: toDto(roadmap) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update roadmap' });
  }
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    if (req.file.size > 10 * 1024 ** 2) {
      await fs.promises.unlink(req.file.path);
      return res.status(413).json({ success: false, message: 'File size must be 10 MB or less.' });
    }

    const attachment = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      name: req.file.originalname,
      fileName: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      type: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: {
        id: String(req.user._id),
        name: req.user.name,
        role: req.user.role
      }
    };

    const roadmap = await Roadmap.findByIdAndUpdate(
      req.params.id,
      { $push: { attachments: attachment } },
      { new: true }
    );

    if (!roadmap) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'Roadmap not found' });
    }

    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload attachment' });
  }
});

router.get('/:id/attachments/:attachmentId/download', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' });

    const attachment = (roadmap.attachments || []).find((item) => String(item.id) === String(req.params.attachmentId));
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' });

    const filePath = attachment.path || path.join(uploadDir, attachment.fileName || '');
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Attachment file not found' });
    }

    res.download(filePath, attachment.name || attachment.fileName);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to download attachment' });
  }
});

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' });

    const attachment = (roadmap.attachments || []).find((item) => String(item.id) === String(req.params.attachmentId));
    roadmap.attachments = (roadmap.attachments || []).filter((item) => String(item.id) !== String(req.params.attachmentId));
    await roadmap.save();

    if (attachment?.path) fs.unlink(attachment.path, () => {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete attachment' });
  }
});

module.exports = router;
