const Task = require('../models/Task');
const { randomBytes } = require('node:crypto');
const { query: queryDatabase } = require('../config/db');
const User = require('../models/User');
const { formatResponse } = require('../utils/helpers');
const { notifyTaskAssigned } = require('../utils/notificationDispatcher');
const { businessDate } = require('../utils/businessTime');
const { normalizeDepartment } = require('../config/departments');

const companyTaskRoles = new Set(['CEO', 'COO', 'Manager']);
const teamTaskRoles = new Set(['Team Lead', 'CO Head', 'Co-Head']);
const defaultDepartment = 'Core Systems';

function canManageTask(user, department) {
  return companyTaskRoles.has(user.role) || (teamTaskRoles.has(user.role) && user.department &&
    normalizeDepartment(user.department) === normalizeDepartment(department));
}

function canUpdateProgress(user, task) {
  if (canManageTask(user, task.department)) return true;
  if (task.assignedTo) return [user.id, user.employeeId].includes(String(task.assignedTo));
  return Boolean(task.assignedToName && [getUserName(user), user.employeeId].includes(task.assignedToName));
}

function taskDueDate(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const date = input.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      !new Date(date).toISOString().startsWith(date)) return null;
  if (input === date) return date;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input) ||
      !Number.isFinite(Date.parse(input))) return null;
  return businessDate(new Date(input));
}

function dueDateError(date) {
  if (date === null) return 'Enter a valid task due date.';
  if (date && date < businessDate()) return 'Task due dates must be today or later (India time).';
  return null;
}

async function assigneeFields(assignedTo, fallback = {}) {
  const assignee = assignedTo ? await User.findById(assignedTo) : null;
  if (!assignee) {
    return {
      assignedTo: assignedTo || '',
      assignedToName: fallback.assignedToName || '',
      assignedToInitials: fallback.assignedToInitials || ''
    };
  }
  const name = getUserName(assignee);
  return {
    assignedTo: assignee.id,
    assignedToName: name,
    assignedToInitials: name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase()
  };
}

const getUserName = (user) =>
  user?.name || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

const getAssignedUserQuery = (user) => {
  const query = [{ assignedTo: user.id }];
  const name = getUserName(user);

  if (name) query.push({ assignedToName: name });
  if (user.employeeId) query.push({ assignedToName: user.employeeId });

  return { $or: query };
};

// GET /api/tasks?department=&status=&search=
exports.getTasks = async (req, res) => {
  try {
    const { department, status, search } = req.query;

    const query = {};
    if (department) query.department = department;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { assignedToName: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query).sort({ dueDate: 1, createdAt: -1 });

    res.json(formatResponse(true, 'Tasks fetched successfully', {
      tasks
    }));
  } catch (err) {
    res.status(500).json(formatResponse(false, err.message));
  }
};

// POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      assignedToName,
      assignedToInitials,
      department,
      priority,
      dueDate,
      estimatedHours,
      progress,
      status
    } = req.body || {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json(formatResponse(false, 'Task title is required.'));
    }

    const targetDepartment = department || req.user.department || defaultDepartment;
    if (!canManageTask(req.user, targetDepartment)) {
      return res.status(403).json(formatResponse(false, 'You cannot create tasks for this department.'));
    }
    const date = taskDueDate(dueDate);
    const dateError = dueDateError(date);
    if (dateError) return res.status(400).json(formatResponse(false, dateError));

    const coercedEstimatedHours = estimatedHours === undefined || estimatedHours === null || estimatedHours === ''
      ? 0
      : Number(estimatedHours);

    if (Number.isNaN(coercedEstimatedHours)) {
      return res.status(400).json(formatResponse(false, 'estimatedHours must be a number'));
    }

    const coercedProgress = progress === undefined || progress === null || progress === ''
      ? 0
      : Number(progress);

    if (Number.isNaN(coercedProgress) || coercedProgress < 0 || coercedProgress > 100) {
      return res.status(400).json(formatResponse(false, 'progress must be a number between 0 and 100'));
    }

    const assignment = await assigneeFields(assignedTo, { assignedToName, assignedToInitials });
    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      ...assignment,
      department: targetDepartment,
      priority: priority || 'medium',
      dueDate: date,
      estimatedHours: Math.max(0, coercedEstimatedHours),
      progress: coercedProgress,
      status: status || 'Pending',
      createdBy: req.user.id
    });

    if (req.user?.role === 'Team Lead') {
      await notifyTaskAssigned(task).catch(error => console.error('Task notification failed:', error.message));
    }

    res.status(201).json(formatResponse(true, 'Task created successfully', task));
  } catch (err) {
    console.error('createTask failed:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to create task',
      error: err
    });
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));

    const body = req.body || {};
    if (!canManageTask(req.user, task.department) ||
        (Object.hasOwn(body, 'department') && !canManageTask(req.user, body.department))) {
      return res.status(403).json(formatResponse(false, 'You cannot edit this task.'));
    }

    const fields = ['title', 'description', 'department', 'priority', 'estimatedHours', 'status', 'progress'];
    const updates = Object.fromEntries(fields.filter(field => Object.hasOwn(body, field))
      .map(field => [field, body[field]]));
    if (Object.hasOwn(body, 'title')) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return res.status(400).json(formatResponse(false, 'Task title is required.'));
      }
      updates.title = body.title.trim();
    }
    if (Object.hasOwn(body, 'dueDate') && body.dueDate !== task.dueDate) {
      const date = taskDueDate(body.dueDate);
      const dateError = dueDateError(date);
      if (dateError) return res.status(400).json(formatResponse(false, dateError));
      updates.dueDate = date;
    }
    if (Object.hasOwn(body, 'assignedTo') && String(body.assignedTo || '') !== String(task.assignedTo || '')) {
      Object.assign(updates, await assigneeFields(body.assignedTo));
    }

    Object.assign(task, updates);
    await task.save();
    res.json(formatResponse(true, 'Task updated successfully', task));
  } catch (err) {
    res.status(500).json(formatResponse(false, err.message));
  }
};

// PATCH /api/tasks/:id/progress
exports.updateTaskProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, status } = req.body;

    if (progress === undefined || progress === null) {
      return res.status(400).json(formatResponse(false, 'progress is required'));
    }

    const coercedProgress = Number(progress);
    if (Number.isNaN(coercedProgress) || coercedProgress < 0 || coercedProgress > 100) {
      return res.status(400).json(formatResponse(false, 'progress must be a number between 0 and 100'));
    }

    const finalStatus = status || (coercedProgress >= 100 ? 'Completed' : coercedProgress > 0 ? 'In progress' : 'Pending');

    const existing = await Task.findById(id);
    if (!existing) return res.status(404).json(formatResponse(false, 'Task not found'));
    if (!canUpdateProgress(req.user, existing)) {
      return res.status(403).json(formatResponse(false, 'You cannot update this task.'));
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { progress: coercedProgress, status: finalStatus },
      { new: true }
    );

    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));

    res.json(formatResponse(true, 'Task progress updated', task));
  } catch (err) {
    res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/my-tasks
// Tasks assigned to the authenticated user
exports.getMyTasks = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json(formatResponse(false, 'Unauthorized'));

    const tasks = await Task.find(getAssignedUserQuery(req.user)).sort({ dueDate: 1, createdAt: -1 });
    return res.json(formatResponse(true, 'My tasks fetched successfully', { tasks }));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/department-tasks
// Tasks visible to roles that operate by department (Team Lead/Manager/CEO)
exports.getDepartmentTasks = async (req, res) => {
  try {
    const { department } = req.query;
    const effectiveDepartment = (department || req.user?.department || '').trim();

    if (!effectiveDepartment) {
      return res.status(400).json(formatResponse(false, 'department is required'));
    }

    const tasks = await Task.find({ department: effectiveDepartment }).sort({ dueDate: 1, createdAt: -1 });
    return res.json(formatResponse(true, 'Department tasks fetched successfully', { tasks }));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/completed
// Completed tasks assigned to the authenticated user
exports.getCompletedTasks = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json(formatResponse(false, 'Unauthorized'));

    const tasks = await Task.find({
      ...getAssignedUserQuery(req.user),
      status: 'Completed'
    }).sort({ updatedAt: -1, dueDate: 1 });
    return res.json(formatResponse(true, 'Completed tasks fetched successfully', { tasks }));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/daily-logs
// Flatten logs from tasks assigned to the authenticated user
exports.getDailyLogsList = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json(formatResponse(false, 'Unauthorized'));

    const tasks = await Task.find(getAssignedUserQuery(req.user)).select('title logs assignedTo');
    const logs = tasks
      .filter(task => !task.assignedTo || [req.user.id, req.user.employeeId].includes(String(task.assignedTo)))
      .flatMap(task => (Array.isArray(task.logs) ? task.logs : []).filter(log => log &&
        (!log.userId || String(log.userId) === String(req.user.id))).map(log => ({
        ...log,
        taskId: task._id,
        taskName: log.taskName || task.title,
      })))
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

    return res.json(formatResponse(true, 'Daily logs fetched successfully', { logs }));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// POST /api/tasks/daily-logs
// Add a daily log to one of the authenticated user's assigned tasks
exports.createDailyLogEntry = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json(formatResponse(false, 'Unauthorized'));

    const { taskId, progress, notes, content, date, hoursSpent } = req.body || {};
    if (typeof taskId !== 'string' || !taskId.trim()) return res.status(400).json(formatResponse(false, 'Select a task.'));

    const task = await Task.findOne({
      _id: taskId,
      ...getAssignedUserQuery(req.user)
    });
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    if (task.assignedTo && ![req.user.id, req.user.employeeId].includes(String(task.assignedTo))) {
      return res.status(403).json(formatResponse(false, 'Only the assigned employee can log work on this task.'));
    }

    const coercedProgress = progress === undefined || progress === null || progress === ''
      ? task.progress || 0
      : Number(progress);

    if (!Number.isInteger(coercedProgress) || coercedProgress < 0 || coercedProgress > 100) {
      return res.status(400).json(formatResponse(false, 'Progress must be a whole number from 0 to 100.'));
    }

    const duration = Number(hoursSpent);
    if ((typeof hoursSpent !== 'number' && typeof hoursSpent !== 'string') || !Number.isFinite(duration) || duration <= 0 || duration > 16) {
      return res.status(400).json(formatResponse(false, 'Hours worked must be greater than 0 and at most 16.'));
    }
    const logDate = taskDueDate(date ?? businessDate());
    if (!logDate || logDate > businessDate()) {
      return res.status(400).json(formatResponse(false, 'Select a valid log date up to today in IST.'));
    }
    const description = notes ?? content ?? '';
    if (typeof description !== 'string' || description.length > 2000) {
      return res.status(400).json(formatResponse(false, 'Notes must be text up to 2,000 characters.'));
    }
    const log = {
      id: randomBytes(12).toString('hex'),
      taskName: task.title,
      progress: coercedProgress,
      notes: description,
      content: description,
      date: logDate,
      hoursSpent: duration,
      userId,
      createdAt: new Date().toISOString(),
    };

    const status = coercedProgress === 100 ? 'Completed' : coercedProgress > 0 ? 'In progress' : 'Pending';
    const updated = await queryDatabase(`
      UPDATE tasks SET data = data || jsonb_build_object(
        'logs', (CASE WHEN jsonb_typeof(data->'logs') = 'array' THEN data->'logs' ELSE '[]'::jsonb END)
          || jsonb_build_array($2::jsonb),
        'progress', $3::int, 'status', $4::text, 'updatedAt', NOW()
      ), updated_at = NOW()
      WHERE id = $1 AND data->>'assignedTo' IS NOT DISTINCT FROM $5::text
        AND data->>'assignedToName' IS NOT DISTINCT FROM $6::text
      RETURNING id
    `, [task.id, JSON.stringify(log), coercedProgress, status, task.assignedTo ?? null, task.assignedToName ?? null]);
    if (!updated.rows.length) return res.status(409).json(formatResponse(false, 'The task changed. Refresh it before logging work.'));
    return res.status(201).json(formatResponse(true, 'Daily log submitted successfully', {
      ...log,
      taskId: task.id
    }));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// PUT /api/tasks/:id/complete
exports.completeTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Task.findById(id);
    if (!existing) return res.status(404).json(formatResponse(false, 'Task not found'));
    if (!canUpdateProgress(req.user, existing)) {
      return res.status(403).json(formatResponse(false, 'You cannot update this task.'));
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { status: 'Completed', progress: 100 },
      { new: true }
    );

    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    return res.json(formatResponse(true, 'Task completed successfully', task));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// ==================== Compatibility endpoints for src/services/taskService.js ====================

// GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    return res.json(formatResponse(true, 'Task fetched successfully', task));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    if (!canManageTask(req.user, task.department)) {
      return res.status(403).json(formatResponse(false, 'You cannot delete this task.'));
    }
    await Task.findByIdAndDelete(id);
    return res.json(formatResponse(true, 'Task deleted successfully', task));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// PATCH /api/tasks/:id/status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json(formatResponse(false, 'status is required'));

    const validStatuses = ['Pending', 'In progress', 'Completed', 'Overdue', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(formatResponse(false, `Invalid status. Must be one of: ${validStatuses.join(', ')}`));
    }

    const existing = await Task.findById(id);
    if (!existing) return res.status(404).json(formatResponse(false, 'Task not found'));
    if (!canUpdateProgress(req.user, existing)) {
      return res.status(403).json(formatResponse(false, 'You cannot update this task.'));
    }

    const task = await Task.findByIdAndUpdate(
      id,
      {
        status,
        // keep progress consistent when status changes
        ...(status === 'Completed' ? { progress: 100 } : {})
      },
      { new: true }
    );

    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    return res.json(formatResponse(true, 'Task status updated', task));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/assignee/:assigneeId
exports.getTasksByAssignee = async (req, res) => {
  try {
    const { assigneeId } = req.params;
    if (!assigneeId) return res.status(400).json(formatResponse(false, 'assigneeId is required'));

    const tasks = await Task.find({ assignedTo: assigneeId }).sort({ dueDate: 1, createdAt: -1 });
    return res.json(formatResponse(true, 'Tasks fetched successfully', tasks));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/department/:department
exports.getTasksByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    if (!department) return res.status(400).json(formatResponse(false, 'department is required'));

    const tasks = await Task.find({ department }).sort({ dueDate: 1, createdAt: -1 });
    return res.json(formatResponse(true, 'Department tasks fetched successfully', tasks));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/creator/:creatorId
exports.getTasksByCreator = async (req, res) => {
  try {
    const { creatorId } = req.params;
    if (!creatorId) return res.status(400).json(formatResponse(false, 'creatorId is required'));

    const tasks = await Task.find({ createdBy: creatorId }).sort({ dueDate: 1, createdAt: -1 });
    return res.json(formatResponse(true, 'Created tasks fetched successfully', tasks));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/stats
exports.getTaskStats = async (req, res) => {
  try {
    const tasks = await Task.find({});
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'In progress').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const today = businessDate();
    const overdue = tasks.filter(task => {
      const dueDate = taskDueDate(task.dueDate);
      return task.status === 'Overdue' || (task.status !== 'Completed' && dueDate && dueDate < today);
    }).length;

    const highPriority = tasks.filter(t => t.priority === 'high' || t.priority === 'High').length;
    const mediumPriority = tasks.filter(t => t.priority === 'medium' || t.priority === 'Medium').length;
    const lowPriority = tasks.filter(t => t.priority === 'low' || t.priority === 'Low').length;

    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const averageProgress = total ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / total) : 0;

    return res.json(formatResponse(true, 'Task stats fetched successfully', {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      highPriority,
      mediumPriority,
      lowPriority,
      completionRate,
      averageProgress
    }));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// POST /api/tasks/:taskId/logs
exports.addDailyLog = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content, createdAt } = req.body;

    if (!content) return res.status(400).json(formatResponse(false, 'Log content is required'));

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));

    // Store logs in-memory fields if present in schema; otherwise keep as placeholders.
    if (!task.logs) task.logs = [];
    task.logs.push({ content, createdAt: createdAt || new Date().toISOString() });
    await task.save();

    return res.status(201).json(formatResponse(true, 'Log added successfully', task));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/:taskId/logs
exports.getDailyLogs = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId).select('logs');
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    return res.json(formatResponse(true, 'Logs fetched successfully', task.logs || []));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// POST /api/tasks/:taskId/comments
exports.addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment, author, authorId, timestamp } = req.body;

    if (!comment) return res.status(400).json(formatResponse(false, 'Comment is required'));

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));

    if (!task.comments) task.comments = [];
    task.comments.push({ comment, author, authorId, timestamp: timestamp || new Date().toISOString() });
    await task.save();

    return res.status(201).json(formatResponse(true, 'Comment added successfully', task));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/:taskId/comments
exports.getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId).select('comments');
    if (!task) return res.status(404).json(formatResponse(false, 'Task not found'));
    return res.json(formatResponse(true, 'Comments fetched successfully', task.comments || []));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// PATCH /api/tasks/bulk/status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { taskIds, status } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) return res.status(400).json(formatResponse(false, 'taskIds is required'));
    if (!status) return res.status(400).json(formatResponse(false, 'status is required'));

    const validStatuses = ['Pending', 'In progress', 'Completed', 'Overdue', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(formatResponse(false, `Invalid status. Must be one of: ${validStatuses.join(', ')}`));
    }

    const tasks = await Task.find({ _id: { $in: taskIds } });
    if (tasks.some(task => !canUpdateProgress(req.user, task))) {
      return res.status(403).json(formatResponse(false, 'You do not have permission for all selected tasks.'));
    }
    const result = await Task.updateMany({ _id: { $in: taskIds } }, {
      status,
      ...(status === 'Completed' ? { progress: 100 } : {})
    });

    return res.json(formatResponse(true, 'Bulk status update completed', result));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// DELETE /api/tasks/bulk
exports.bulkDeleteTasks = async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) return res.status(400).json(formatResponse(false, 'taskIds is required'));

    const tasks = await Task.find({ _id: { $in: taskIds } });
    if (tasks.some(task => !canManageTask(req.user, task.department))) {
      return res.status(403).json(formatResponse(false, 'You do not have permission for all selected tasks.'));
    }
    const result = await Task.deleteMany({ _id: { $in: taskIds } });
    return res.json(formatResponse(true, 'Bulk delete completed', result));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};

// GET /api/tasks/search?q=...
exports.searchTasks = async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json(formatResponse(true, 'Search completed', []));

    const tasks = await Task.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { assignedToName: { $regex: q, $options: 'i' } }
      ]
    }).sort({ dueDate: 1, createdAt: -1 });

    return res.json(formatResponse(true, 'Search completed', tasks));
  } catch (err) {
    return res.status(500).json(formatResponse(false, err.message));
  }
};



