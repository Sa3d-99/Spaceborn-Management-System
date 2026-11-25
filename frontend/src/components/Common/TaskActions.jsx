import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2 } from './Icons';
import taskService from '../../services/taskService';
import { getTaskId, taskCalendarDate } from '../../utils/taskMapper';
import { businessDate } from '../../utils/timeZone';
import { DEPARTMENTS } from '../../utils/departments';

export default function TaskActions({ task, employees, canMoveDepartment, onChanged }) {
  const [mode, setMode] = useState(null);
  const [fields, setFields] = useState(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const dialog = useRef(null);
  const id = getTaskId(task);
  const originalDate = taskCalendarDate(task.dueDate);
  const today = businessDate();

  useEffect(() => {
    if (mode && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [mode]);

  function open(nextMode) {
    setFields({
      title: task.title,
      description: task.description || '',
      department: task.department || '',
      assignedTo: String(task.assignedTo || ''),
      priority: task.priority || 'medium',
      dueDate: originalDate,
      estimatedHours: task.estimatedHours ?? 0
    });
    setError('');
    setMode(nextMode);
  }

  function change(event) {
    const { name, value } = event.target;
    setFields(previous => ({ ...previous, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (mode === 'edit' && fields.dueDate && fields.dueDate !== originalDate && fields.dueDate < businessDate()) {
      setError('Choose today or a future date (India time).');
      return;
    }
    setError('');
    setWorking(true);
    try {
      if (mode === 'delete') {
        await taskService.deleteTask(id);
      } else {
        const { dueDate, department, assignedTo, estimatedHours, ...updates } = fields;
        await taskService.updateTask(id, {
          ...updates,
          estimatedHours: Number(estimatedHours),
          ...(canMoveDepartment && department !== task.department ? { department } : {}),
          ...(assignedTo !== String(task.assignedTo || '') ? { assignedTo } : {}),
          ...(dueDate !== originalDate ? { dueDate } : {})
        });
      }
      dialog.current?.close();
      await onChanged();
    } catch (err) {
      setError(err.message || 'The task could not be changed. Try again.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => open('edit')}>
        <Edit aria-hidden="true" /> Edit task
      </button>
      <button type="button" className="btn btn-sm btn-outline btn-error" onClick={() => open('delete')}>
        <Trash2 aria-hidden="true" /> Delete task
      </button>
      {mode && createPortal(
        <dialog className="modal" ref={dialog} aria-labelledby="task-action-title"
          onClose={() => setMode(null)} onCancel={event => { if (working) event.preventDefault(); }}>
          <form className="modal-box space-y-4" onSubmit={submit}>
            <h2 id="task-action-title" className="text-lg font-semibold">{mode === 'edit' ? 'Edit task' : 'Delete task'}</h2>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            {mode === 'delete' ? (
              <p>Delete <strong>{task.title}</strong>?</p>
            ) : (
              <>
                <label className="grid gap-1">
                  <span className="label">Task title</span>
                  <input className="input w-full" name="title" value={fields.title} onChange={change} required autoFocus />
                </label>
                <label className="grid gap-1">
                  <span className="label">Description</span>
                  <textarea className="textarea w-full" name="description" value={fields.description} onChange={change} />
                </label>
                {canMoveDepartment && (
                  <label className="grid gap-1">
                    <span className="label">Department</span>
                    <select className="select w-full" name="department" value={fields.department} onChange={change}>
                      <option value="">Select a department</option>
                      {[...new Set([...DEPARTMENTS, task.department].filter(Boolean))].map(department =>
                        <option key={department}>{department}</option>
                      )}
                    </select>
                  </label>
                )}
                <label className="grid gap-1">
                  <span className="label">Assignee</span>
                  <select className="select w-full" name="assignedTo" value={fields.assignedTo} onChange={change}>
                    <option value="">{!task.assignedTo && task.assignedToName ? task.assignedToName : 'Unassigned'}</option>
                    {task.assignedTo && !employees.some(employee => String(employee.id ?? employee._id) === String(task.assignedTo)) && (
                      <option value={task.assignedTo}>{task.assignedToName || task.assignedTo}</option>
                    )}
                    {employees.map(employee => (
                      <option key={employee.id ?? employee._id} value={employee.id ?? employee._id}>{employee.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="label">Priority</span>
                    <select className="select w-full" name="priority" value={fields.priority} onChange={change}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="label">Estimated hours</span>
                    <input className="input w-full" type="number" min="0" step="any" name="estimatedHours"
                      value={fields.estimatedHours} onChange={change} />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="label">Due date (India time)</span>
                  <input className="input w-full" type="date" name="dueDate" value={fields.dueDate} onChange={change}
                    min={originalDate && originalDate < today && fields.dueDate === originalDate ? undefined : today} />
                </label>
              </>
            )}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" disabled={working} onClick={() => dialog.current.close()}>Cancel</button>
              <button className={`btn ${mode === 'delete' ? 'btn-error' : 'btn-neutral'}`} type="submit" disabled={working}>
                {mode === 'edit' ? 'Save changes' : 'Delete task'}
              </button>
            </div>
          </form>
        </dialog>,
        document.body
      )}
    </div>
  );
}
