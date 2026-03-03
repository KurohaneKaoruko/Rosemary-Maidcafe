import { Task } from '@/types';

const taskTemplates: Omit<Task, 'progress' | 'completed' | 'claimed' | 'dayAssigned'>[] = [
  // 成长任务
  {
    id: 'growth_hire_3',
    name: '扩充团队',
    description: '累计雇佣 3 名女仆',
    type: 'growth',
    condition: { type: 'hire_maids', target: 3 },
    reward: { gold: 420, reputation: 2 },
  },
  {
    id: 'growth_hire_5',
    name: '女仆军团',
    description: '累计雇佣 5 名女仆',
    type: 'growth',
    condition: { type: 'hire_maids', target: 5 },
    reward: { gold: 850, reputation: 4 },
  },
  // 成长任务 - 菜单解锁
  {
    id: 'growth_unlock_5',
    name: '丰富菜单',
    description: '累计解锁 5 个菜单项',
    type: 'growth',
    condition: { type: 'unlock_menu_items', target: 5 },
    reward: { gold: 560, reputation: 3 },
  },
  {
    id: 'growth_unlock_10',
    name: 'Menu Master',
    description: '累计解锁 10 个菜单项',
    type: 'growth',
    condition: { type: 'unlock_menu_items', target: 10 },
    reward: { gold: 1050, reputation: 5 },
  },
  // 成长任务 - 店铺升级
  {
    id: 'growth_upgrade_3',
    name: '升级店铺',
    description: '将咖啡厅升级到 3 级',
    type: 'growth',
    condition: { type: 'upgrade_cafe', target: 3 },
    reward: { gold: 900, reputation: 4 },
  },
  {
    id: 'growth_upgrade_5',
    name: '知名咖啡厅',
    description: '将咖啡厅升级到 5 级',
    type: 'growth',
    condition: { type: 'upgrade_cafe', target: 5 },
    reward: { gold: 1750, reputation: 6 },
  },
  // 成长任务 - 累计收入
  {
    id: 'growth_total_revenue_10000',
    name: '万元户',
    description: '累计收入达到 10000 金币',
    type: 'growth',
    condition: { type: 'total_revenue', target: 10000 },
    reward: { gold: 1400, reputation: 5 },
  },
  // 成长任务 - 累计顾客
  {
    id: 'growth_total_customers_50',
    name: '人气咖啡厅',
    description: '累计服务 50 位顾客',
    type: 'growth',
    condition: { type: 'total_customers', target: 50 },
    reward: { gold: 1050, reputation: 4 },
  },
];

export function createInitialTasks(day: number): Task[] {
  return taskTemplates.map(t => ({
    ...t,
    progress: 0,
    completed: false,
    claimed: false,
    dayAssigned: day,
  }));
}

export const defaultTasks = createInitialTasks(1);
