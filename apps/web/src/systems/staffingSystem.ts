import {
  IncidentState,
  Maid,
  MaidRole,
  ShiftType,
  StaffingState,
} from '@/types';
import {
  DEFAULT_STAFFING_STATE,
  INCIDENT_TEMPLATES,
  SHIFT_ORDER,
  SHIFT_WINDOWS,
} from '@/data/staffing';
import { calculateEfficiency } from '@/systems/maidSystem';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRolePriority(priority: MaidRole[]): MaidRole[] {
  const unique: MaidRole[] = [];
  for (const role of priority) {
    if (!unique.includes(role)) {
      unique.push(role);
    }
  }

  for (const role of ['server', 'barista', 'greeter', 'entertainer'] as MaidRole[]) {
    if (!unique.includes(role)) {
      unique.push(role);
    }
  }

  return unique.slice(0, 4);
}

export function normalizeStaffingState(candidate?: Partial<StaffingState> | null): StaffingState {
  const fallback = DEFAULT_STAFFING_STATE;
  if (!candidate) {
    return {
      shifts: {
        morning: { ...fallback.shifts.morning, rolePriority: [...fallback.shifts.morning.rolePriority] },
        peak: { ...fallback.shifts.peak, rolePriority: [...fallback.shifts.peak.rolePriority] },
        evening: { ...fallback.shifts.evening, rolePriority: [...fallback.shifts.evening.rolePriority] },
      },
      autoRest: { ...fallback.autoRest },
      activeBoost: null,
    };
  }

  const shifts = candidate.shifts ?? fallback.shifts;
  const autoRest = candidate.autoRest ?? fallback.autoRest;

  return {
    shifts: {
      morning: {
        rolePriority: normalizeRolePriority(shifts.morning?.rolePriority ?? fallback.shifts.morning.rolePriority),
        allowCrossRole: shifts.morning?.allowCrossRole ?? fallback.shifts.morning.allowCrossRole,
      },
      peak: {
        rolePriority: normalizeRolePriority(shifts.peak?.rolePriority ?? fallback.shifts.peak.rolePriority),
        allowCrossRole: shifts.peak?.allowCrossRole ?? fallback.shifts.peak.allowCrossRole,
      },
      evening: {
        rolePriority: normalizeRolePriority(shifts.evening?.rolePriority ?? fallback.shifts.evening.rolePriority),
        allowCrossRole: shifts.evening?.allowCrossRole ?? fallback.shifts.evening.allowCrossRole,
      },
    },
    autoRest: {
      enabled: autoRest.enabled ?? fallback.autoRest.enabled,
      staminaThreshold: clamp(autoRest.staminaThreshold ?? fallback.autoRest.staminaThreshold, 10, 80),
      moodThreshold: clamp(autoRest.moodThreshold ?? fallback.autoRest.moodThreshold, 10, 80),
      fatigueThreshold: clamp(autoRest.fatigueThreshold ?? fallback.autoRest.fatigueThreshold, 20, 95),
    },
    activeBoost: candidate.activeBoost
      ? {
          source: candidate.activeBoost.source ?? '临时调度',
          remainingMinutes: clamp(candidate.activeBoost.remainingMinutes ?? 0, 0, 240),
          spawnRateMultiplier: clamp(candidate.activeBoost.spawnRateMultiplier ?? 1, 0.7, 1.6),
          serviceEfficiencyMultiplier: clamp(candidate.activeBoost.serviceEfficiencyMultiplier ?? 1, 0.7, 1.6),
          satisfactionBonus: clamp(candidate.activeBoost.satisfactionBonus ?? 0, -20, 20),
        }
      : null,
  };
}

export function getCurrentShift(time: number): ShiftType {
  const clampedTime = clamp(time, SHIFT_WINDOWS.morning.start, SHIFT_WINDOWS.evening.end);
  if (clampedTime < SHIFT_WINDOWS.peak.start) {
    return 'morning';
  }
  if (clampedTime < SHIFT_WINDOWS.evening.start) {
    return 'peak';
  }
  return 'evening';
}

function getRolePriorityWeight(role: MaidRole, rolePriority: MaidRole[]): number {
  const index = rolePriority.indexOf(role);
  if (index < 0) {
    return 0;
  }
  return Math.max(0, 4 - index);
}

function isRoleAllowedForShift(role: MaidRole, rolePriority: MaidRole[], allowCrossRole: boolean): boolean {
  if (allowCrossRole) {
    return true;
  }
  return rolePriority.slice(0, 2).includes(role);
}

export function applyFatigueTick(maid: Maid, deltaMinutes: number, staffing: StaffingState): Maid {
  const boost = staffing.activeBoost;
  const fatigueLoadFromBoost = boost
    ? Math.max(0, boost.serviceEfficiencyMultiplier - 1) * 0.9
    : 0;

  let nextFatigue = maid.fatigue;

  if (maid.status.isResting) {
    nextFatigue -= deltaMinutes * 0.95;
  } else if (maid.status.isWorking) {
    const streakLoad = maid.consecutiveWorkDays * 0.06;
    nextFatigue += deltaMinutes * (0.42 + streakLoad + fatigueLoadFromBoost);
  } else {
    nextFatigue -= deltaMinutes * 0.25;
  }

  return {
    ...maid,
    fatigue: clamp(nextFatigue, 0, 100),
  };
}

export function applyAutoRestPolicy(maid: Maid, staffing: StaffingState): Maid {
  const config = staffing.autoRest;
  if (!config.enabled) {
    return maid;
  }

  const needRest =
    maid.stamina <= config.staminaThreshold ||
    maid.mood <= config.moodThreshold ||
    maid.fatigue >= config.fatigueThreshold;

  if (!maid.status.isResting && needRest) {
    return {
      ...maid,
      status: {
        ...maid.status,
        isResting: true,
        isWorking: false,
        currentTask: null,
        servingCustomerId: null,
      },
    };
  }

  const readyToReturn =
    maid.stamina >= config.staminaThreshold + 25 &&
    maid.mood >= config.moodThreshold + 18 &&
    maid.fatigue <= config.fatigueThreshold - 18;

  if (maid.status.isResting && readyToReturn) {
    return {
      ...maid,
      status: {
        ...maid.status,
        isResting: false,
      },
    };
  }

  return maid;
}

export function tickStaffingBoost(staffing: StaffingState, deltaMinutes: number): StaffingState {
  const activeBoost = staffing.activeBoost;
  if (!activeBoost) {
    return staffing;
  }

  const remainingMinutes = activeBoost.remainingMinutes - deltaMinutes;
  if (remainingMinutes <= 0) {
    return {
      ...staffing,
      activeBoost: null,
    };
  }

  return {
    ...staffing,
    activeBoost: {
      ...activeBoost,
      remainingMinutes,
    },
  };
}

export function getShiftDifficultyMultiplier(day: number, shift: ShiftType): number {
  const dayPressure = Math.min(Math.max(day - 1, 0) * 0.018, 0.42);
  const shiftPressure = shift === 'peak' ? 0.18 : shift === 'evening' ? 0.09 : 0.03;
  return 1 + dayPressure + shiftPressure;
}

export function getSpawnIntervalWithStaffing(
  baseIntervalMs: number,
  day: number,
  shift: ShiftType,
  staffing: StaffingState
): number {
  const difficultyMultiplier = getShiftDifficultyMultiplier(day, shift);
  const boostMultiplier = staffing.activeBoost?.spawnRateMultiplier ?? 1;
  const combined = difficultyMultiplier * boostMultiplier;
  const adjusted = baseIntervalMs / combined;
  return Math.round(clamp(adjusted, 7000, 60000));
}

export function getServiceProgressMultiplier(
  maid: Maid,
  shift: ShiftType,
  waitingCount: number,
  staffing: StaffingState
): number {
  const waitingPressure = waitingCount > 0 ? Math.min(waitingCount * 0.02, 0.25) : 0;
  const shiftBonus = maid.preferredShift === shift ? 0.08 : -0.04;
  const serviceSkillBonus = maid.skills.service * 0.06;
  const emergencySkillBonus =
    shift === 'peak' || waitingCount >= 3 ? maid.skills.emergency * 0.05 : maid.skills.emergency * 0.02;
  const fatiguePenalty = maid.fatigue * 0.0035;
  const streakPenalty = maid.consecutiveWorkDays * 0.02;
  const boostMultiplier = staffing.activeBoost?.serviceEfficiencyMultiplier ?? 1;

  const multiplier =
    1 +
    waitingPressure +
    shiftBonus +
    serviceSkillBonus +
    emergencySkillBonus -
    fatiguePenalty -
    streakPenalty;

  return clamp(multiplier * boostMultiplier, 0.6, 1.8);
}

export function getMaidSatisfactionBonus(maid: Maid, staffing: StaffingState): number {
  const guestCareBonus = maid.skills.guestCare * 2;
  const boostBonus = staffing.activeBoost?.satisfactionBonus ?? 0;
  const fatiguePenalty = maid.fatigue >= 80 ? 6 : maid.fatigue >= 60 ? 3 : 0;
  return Math.round(guestCareBonus + boostBonus - fatiguePenalty);
}

export function sortMaidsForService(
  maids: Maid[],
  shift: ShiftType,
  staffing: StaffingState,
  waitingCount: number
): Maid[] {
  const shiftConfig = staffing.shifts[shift];
  const rolePriority = shiftConfig.rolePriority;

  return [...maids]
    .filter((maid) => isRoleAllowedForShift(maid.role, rolePriority, shiftConfig.allowCrossRole))
    .sort((a, b) => {
      const scoreA = scoreMaidForService(a, shift, waitingCount, rolePriority, staffing);
      const scoreB = scoreMaidForService(b, shift, waitingCount, rolePriority, staffing);
      return scoreB - scoreA;
    });
}

function scoreMaidForService(
  maid: Maid,
  shift: ShiftType,
  waitingCount: number,
  rolePriority: MaidRole[],
  staffing: StaffingState
): number {
  const baseEfficiency = calculateEfficiency(maid);
  const roleWeight = getRolePriorityWeight(maid.role, rolePriority) * 14;
  const shiftMatch = maid.preferredShift === shift ? 10 : -4;
  const skillWeight =
    maid.skills.service * 5 +
    maid.skills.guestCare * 2 +
    (shift === 'peak' || waitingCount >= 3 ? maid.skills.emergency * 5 : maid.skills.emergency * 2);
  const fatiguePenalty = maid.fatigue * 1.1;
  const streakPenalty = maid.consecutiveWorkDays * 2.5;
  const boost = staffing.activeBoost?.serviceEfficiencyMultiplier ?? 1;

  return (baseEfficiency * boost) + roleWeight + shiftMatch + skillWeight - fatiguePenalty - streakPenalty;
}

export function rollOperationalIncident(
  day: number,
  shift: ShiftType,
  waitingCount: number,
  hasActiveIncident: boolean
): IncidentState | null {
  if (hasActiveIncident || day < 6) {
    return null;
  }

  const baseChance = 0.004 + Math.min((day - 5) * 0.00035, 0.012);
  const shiftBonus = shift === 'peak' ? 0.003 : 0;
  const waitingBonus = Math.min(waitingCount * 0.0009, 0.01);
  const finalChance = baseChance + shiftBonus + waitingBonus;

  if (Math.random() > finalChance) {
    return null;
  }

  const template = INCIDENT_TEMPLATES[Math.floor(Math.random() * INCIDENT_TEMPLATES.length)];
  const uniqueId = `${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: uniqueId,
    icon: template.icon,
    title: template.title,
    description: template.description,
    remainingMinutes: template.durationMinutes,
    options: template.options.map((option) => ({ ...option })),
  };
}

export function sanitizeShift(value: unknown): ShiftType {
  return SHIFT_ORDER.includes(value as ShiftType) ? (value as ShiftType) : 'peak';
}

