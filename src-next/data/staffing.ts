import {
  IncidentOption,
  MaidRole,
  ShiftType,
  StaffingState,
} from '@/types';

export const SHIFT_ORDER: ShiftType[] = ['morning', 'peak', 'evening'];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: '早班',
  peak: '高峰班',
  evening: '晚班',
};

export const SHIFT_WINDOWS: Record<ShiftType, { start: number; end: number }> = {
  morning: { start: 540, end: 720 },   // 09:00 - 12:00
  peak: { start: 720, end: 1080 },     // 12:00 - 18:00
  evening: { start: 1080, end: 1260 }, // 18:00 - 21:00
};

const SERVICE_FIRST_PRIORITY: MaidRole[] = ['server', 'barista', 'greeter', 'entertainer'];
const GREETING_FIRST_PRIORITY: MaidRole[] = ['greeter', 'server', 'barista', 'entertainer'];
const SHOW_FIRST_PRIORITY: MaidRole[] = ['entertainer', 'server', 'barista', 'greeter'];

export const SHIFT_PRIORITY_PRESETS: Record<'service' | 'greeting' | 'show', MaidRole[]> = {
  service: SERVICE_FIRST_PRIORITY,
  greeting: GREETING_FIRST_PRIORITY,
  show: SHOW_FIRST_PRIORITY,
};

export const DEFAULT_STAFFING_STATE: StaffingState = {
  shifts: {
    morning: {
      rolePriority: [...GREETING_FIRST_PRIORITY],
      allowCrossRole: true,
    },
    peak: {
      rolePriority: [...SERVICE_FIRST_PRIORITY],
      allowCrossRole: true,
    },
    evening: {
      rolePriority: [...SHOW_FIRST_PRIORITY],
      allowCrossRole: true,
    },
  },
  autoRest: {
    enabled: true,
    staminaThreshold: 35,
    moodThreshold: 40,
    fatigueThreshold: 72,
  },
  activeBoost: null,
};

interface IncidentTemplate {
  id: string;
  icon: string;
  title: string;
  description: string;
  durationMinutes: number;
  options: IncidentOption[];
}

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  {
    id: 'rush-order',
    icon: '🚨',
    title: '突发团客订单',
    description: '附近活动散场，短时间内出现密集客流，需要立即调整策略。',
    durationMinutes: 60,
    options: [
      {
        id: 'rush-order-stabilize',
        label: '稳态接待',
        description: '优先稳定服务质量，减少排队流失。',
        reputationDelta: 2,
        moodDelta: -4,
        fatigueDelta: 6,
        serviceEfficiencyMultiplier: 1.1,
        spawnRateMultiplier: 1.05,
        satisfactionBonus: 4,
        durationMinutes: 50,
      },
      {
        id: 'rush-order-push',
        label: '冲刺接单',
        description: '短时拉高吞吐，风险是员工压力和评价波动。',
        goldDelta: 180,
        reputationDelta: -1,
        moodDelta: -8,
        fatigueDelta: 12,
        spawnRateMultiplier: 1.2,
        serviceEfficiencyMultiplier: 1.15,
        satisfactionBonus: -2,
        durationMinutes: 45,
      },
      {
        id: 'rush-order-conservative',
        label: '限流保守',
        description: '主动降载，减少损耗但会损失部分收入。',
        reputationDelta: 1,
        goldDelta: -120,
        moodDelta: 2,
        fatigueDelta: -4,
        spawnRateMultiplier: 0.85,
        serviceEfficiencyMultiplier: 1.05,
        satisfactionBonus: 6,
        durationMinutes: 40,
      },
    ],
  },
  {
    id: 'equipment-warning',
    icon: '🛠️',
    title: '设备预警',
    description: '关键设备出现异常，继续满负荷运行可能影响出品稳定性。',
    durationMinutes: 70,
    options: [
      {
        id: 'equipment-warning-maintain',
        label: '立即保养',
        description: '花钱换稳定，短期收益下降。',
        goldDelta: -220,
        reputationDelta: 1,
        moodDelta: 1,
        fatigueDelta: -5,
        serviceEfficiencyMultiplier: 0.95,
        satisfactionBonus: 5,
        durationMinutes: 55,
      },
      {
        id: 'equipment-warning-run',
        label: '继续运行',
        description: '维持产出但有波动风险。',
        goldDelta: 120,
        reputationDelta: -2,
        moodDelta: -3,
        fatigueDelta: 5,
        serviceEfficiencyMultiplier: 1.05,
        satisfactionBonus: -4,
        durationMinutes: 50,
      },
    ],
  },
  {
    id: 'vip-wave',
    icon: '🌟',
    title: 'VIP 预约高峰',
    description: '高消费客人集中到店，服务节奏需要更精细。',
    durationMinutes: 80,
    options: [
      {
        id: 'vip-wave-premium',
        label: '高规格接待',
        description: '投入更多精力提升口碑，回报更稳。',
        goldDelta: 150,
        reputationDelta: 3,
        moodDelta: -6,
        fatigueDelta: 8,
        serviceEfficiencyMultiplier: 1.05,
        satisfactionBonus: 8,
        durationMinutes: 65,
      },
      {
        id: 'vip-wave-balanced',
        label: '均衡接待',
        description: '控制成本，保持常规运营节奏。',
        goldDelta: 80,
        reputationDelta: 1,
        moodDelta: -2,
        fatigueDelta: 3,
        spawnRateMultiplier: 1.1,
        serviceEfficiencyMultiplier: 1.0,
        satisfactionBonus: 2,
        durationMinutes: 60,
      },
    ],
  },
];
