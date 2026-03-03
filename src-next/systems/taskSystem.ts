import { Task, TaskConditionType, TaskReward } from '@/types';
import { createInitialTasks } from '@/data/tasks';

export type TaskEvent =
  | { type: 'serve_customers'; amount: number }
  | { type: 'serve_vip'; amount: number }
  | { type: 'earn_gold'; amount: number }
  | { type: 'earn_tips'; amount: number }
  | { type: 'hire_maids'; amount: number }
  | { type: 'unlock_menu_items'; amount: number }
  | { type: 'upgrade_cafe'; level: number }
  | { type: 'maintain_satisfaction'; value: number }
  | { type: 'total_revenue'; amount: number }
  | { type: 'total_customers'; amount: number };

export function removeDailyTasks(tasks: Task[]): Task[] {
  if (!tasks.some((task) => task.type === 'daily')) {
    return tasks;
  }
  return tasks.filter((task) => task.type === 'growth');
}

export function refreshDailyTasks(existing: Task[], day: number): Task[] {
  const growthTasks = removeDailyTasks(existing);
  if (growthTasks.length > 0) {
    return growthTasks;
  }
  return createInitialTasks(day).filter((task) => task.type === 'growth');
}

export function applyTaskEvent(tasks: Task[], event: TaskEvent): Task[] {
  return tasks.map(task => {
    if (task.completed) {
      return task;
    }

    if (!checkEventMatch(task.condition.type, event.type)) {
      return task;
    }

    let nextProgress = task.progress;
    switch (event.type) {
      case 'upgrade_cafe':
        nextProgress = Math.max(nextProgress, event.level);
        break;
      case 'maintain_satisfaction':
        nextProgress = Math.max(nextProgress, event.value);
        break;
      case 'total_revenue':
      case 'total_customers':
        nextProgress = Math.max(nextProgress, event.amount);
        break;
      default:
        nextProgress = task.progress + event.amount;
    }

    const clamped = Math.min(nextProgress, task.condition.target);
    const completed = clamped >= task.condition.target;
    return {
      ...task,
      progress: clamped,
      completed,
    };
  });
}

function checkEventMatch(
  conditionType: TaskConditionType,
  eventType: TaskEvent['type'],
): boolean {
  if (conditionType === eventType) {
    return true;
  }

  // Compatibility mappings for cumulative goals fed by incremental events.
  const mappings: Partial<Record<TaskConditionType, TaskEvent['type'][]>> = {
    total_revenue: ['earn_gold'],
    total_customers: ['serve_customers'],
  };

  return mappings[conditionType]?.includes(eventType) ?? false;
}

export function claimTaskReward(tasks: Task[], taskId: string): { tasks: Task[]; reward: TaskReward | null } {
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.type === 'daily' || !task.completed || task.claimed) {
    return { tasks, reward: null };
  }

  const nextTasks = tasks.map(t => t.id === taskId ? { ...t, claimed: true } : t);
  return { tasks: nextTasks, reward: task.reward };
}

