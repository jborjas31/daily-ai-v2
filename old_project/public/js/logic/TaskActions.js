/**
 * Task Actions Module
 * 
 * Contains functions for task manipulation (edit, duplicate, toggle completion)
 * that were previously global functions in app.js
 */

import { state } from '../state.js';
import { taskTemplateManager, taskInstanceManager } from '../taskLogic.js';
import { SimpleErrorHandler } from '../utils/SimpleErrorHandler.js';
import { taskModal } from '../app.js';

export const editTask = (taskId) => {
  const taskTemplates = state.getTaskTemplates();
  const task = taskTemplates.find(t => t.id === taskId);
  
  if (task) {
    taskModal.showEdit(task, (savedTask) => {
      console.log('Task updated:', savedTask);
      // UI will update automatically via state listeners
    });
  }
};

export const duplicateTask = async (taskId) => {
  try {
    const uid = state.getUser()?.uid;
    if (!uid) {
      SimpleErrorHandler.showError('Please sign in to duplicate tasks.');
      return;
    }
    await taskTemplateManager.duplicate(uid, taskId);
    SimpleErrorHandler.showSuccess('Task duplicated successfully!');
  } catch (error) {
    console.error('Error duplicating task:', error);
    SimpleErrorHandler.showError('Failed to duplicate task. Please try again.', error);
  }
};

export const toggleTaskCompletion = async (taskId) => {
  try {
    const currentDate = state.getCurrentDate();
    await taskInstanceManager.toggleByTemplateAndDate(taskId, currentDate);
    SimpleErrorHandler.showSuccess('Task status updated!');
  } catch (error) {
    console.error('Error toggling task completion:', error);
    SimpleErrorHandler.showError('Failed to update task status. Please try again.', error);
  }
};

export const skipTask = async (taskId) => {
  try {
    const currentDate = state.getCurrentDate();
    await taskInstanceManager.skipByTemplateAndDate(taskId, currentDate, 'Skipped by user');
    SimpleErrorHandler.showSuccess('Task skipped for today.');
  } catch (error) {
    console.error('Error skipping task:', error);
    SimpleErrorHandler.showError('Failed to skip task. Please try again.', error);
  }
};

export const postponeTask = async (taskId, minutes = 30) => {
  try {
    const currentDate = state.getCurrentDate();
    await taskInstanceManager.postponeByTemplateAndDate(taskId, currentDate, minutes);
    SimpleErrorHandler.showSuccess(`Task postponed by ${minutes} minutes.`);
  } catch (error) {
    console.error('Error postponing task:', error);
    SimpleErrorHandler.showError('Failed to postpone task. Please try again.', error);
  }
};

export const softDeleteTask = async (taskId) => {
  try {
    await taskTemplateManager.delete(taskId);
    SimpleErrorHandler.showSuccess('Task deleted.');
  } catch (error) {
    console.error('Error deleting task:', error);
    SimpleErrorHandler.showError('Failed to delete task. Please try again.', error);
  }
};
