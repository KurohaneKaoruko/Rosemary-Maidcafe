import {
  Area,
  DesktopUIState,
  FloatingWindowId,
  GameSpeed,
  GameState,
  GameStatistics,
  Maid,
  StaffingState,
} from '@/types';
import { initialGameState, GAME_CONSTANTS } from '@/data/initialState';
import { defaultAchievements } from '@/data/achievements';
import { defaultDecorations } from '@/data/decorations';
import { createInitialDesktopUIState, FLOATING_WINDOW_IDS } from '@/data/desktopUI';
import { defaultEquipment } from '@/data/equipment';
import { getRandomMaidImage, maidImagePool, normalizeMaidAvatarPath } from '@/data/maidImages';
import { defaultMenuItems } from '@/data/menuItems';
import { createInitialTasks } from '@/data/tasks';
import { DEFAULT_STAFFING_STATE } from '@/data/staffing';
import { isTauriDesktop } from '@/utils/platform';
import { normalizeReputation } from '@/utils/formatters';
import { createDefaultMaidSkills, normalizeMaidState } from '@/systems/maidSystem';
import { normalizeStaffingState } from '@/systems/staffingSystem';

const COMPACT_SCHEMA_VERSION = 2;
const LOCAL_COMPACT_SAVE_KEY = `${GAME_CONSTANTS.SAVE_KEY}-compact-v2`;

const RUNTIME_DEFAULTS = {
  customerSpawnMs: 0,
  customerStatusTicks: {},
  customersServedToday: 0,
  customerStreak: 0,
  operationCooldowns: {
    attractCustomersMs: 0,
    comfortGuestsMs: 0,
    serviceRushMs: 0,
    superviseServiceMs: 0,
    motivateMaidMs: 0,
  },
  nativeStaffingPrimed: false,
  nativeStaffingFrame: null,
};

const KNOWN_AREAS: ReadonlySet<Area> = new Set<Area>(['main', 'outdoor', 'vip_room', 'stage']);
const maidImagePoolSet = new Set(maidImagePool);

type TauriInvoke = <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeLoader: Promise<TauriInvoke | null> | null = null;

// Legacy storage structure kept for compatibility with old localStorage saves.
export interface SaveData {
  version: string;
  timestamp: number;
  gameState: GameState;
  checksum: string;
}

interface CompactMaid {
  id: string;
  name: string;
  avatarId: string;
  personality: Maid['personality'];
  stats: Maid['stats'];
  experience: number;
  level: number;
  role: Maid['role'];
  status: Maid['status'];
  mood: number;
  stamina: number;
  fatigue: number;
  consecutiveWorkDays: number;
  preferredShift: Maid['preferredShift'];
  skillPoints: number;
  skills: Maid['skills'];
  hireDate: number;
}

interface CompactMenuItemState {
  id: string;
  currentPrice: number;
  unlocked: boolean;
  popularity: number;
}

interface CompactFacilityState {
  cafeLevel: number;
  maxSeats: number;
  decorationIds: string[];
  equipmentLevels: Record<string, number>;
  unlockedAreas: Area[];
}

interface CompactTaskState {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  dayAssigned: number;
}

interface CompactAchievementState {
  id: string;
  unlocked: boolean;
  unlockedDate: number | null;
}

interface CompactSaveData {
  schema: number;
  version: string;
  timestamp: number;
  day: number;
  time: number;
  season: GameState['season'];
  isPaused: boolean;
  isBusinessHours: boolean;
  gameSpeed: GameSpeed;
  maids: CompactMaid[];
  menuItems: CompactMenuItemState[];
  facility: CompactFacilityState;
  finance: GameState['finance'];
  tasks: CompactTaskState[];
  achievements: CompactAchievementState[];
  statistics: GameState['statistics'];
  reputation: number;
  staffing: StaffingState;
}

interface SaveInfoData {
  version: string;
  timestamp: number;
  day: number;
}

// Storage result type
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LocalLoadResult {
  type: 'compact' | 'legacy';
  state: GameState;
}

export function compareVersion(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i += 1) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

export function isVersionCompatible(version: string): boolean {
  const currentVersion = GAME_CONSTANTS.SAVE_VERSION;
  const minVersion = GAME_CONSTANTS.MIN_SUPPORTED_VERSION ?? '0.1.0';

  if (compareVersion(version, currentVersion) >= 0) {
    return true;
  }

  return compareVersion(version, minVersion) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getNumber(value: unknown, fallback: number, minimum?: number, maximum?: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  let number = Number(value);

  if (minimum !== undefined) {
    number = Math.max(minimum, number);
  }

  if (maximum !== undefined) {
    number = Math.min(maximum, number);
  }

  return number;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function isSeason(value: unknown): value is GameState['season'] {
  return value === 'spring' || value === 'summer' || value === 'autumn' || value === 'winter';
}

function isGameSpeed(value: unknown): value is GameSpeed {
  return value === 0.5 || value === 1 || value === 2 || value === 4;
}

function avatarPathToId(avatar: string): string {
  const normalized = normalizeMaidAvatarPath(avatar);
  const source = normalized || avatar.trim().toLowerCase();
  const fileName = source.split('/').pop() ?? '';
  return fileName.replace(/\.[^.]+$/, '').trim().toLowerCase();
}

function avatarIdToPath(avatarId: string): string {
  const normalized = avatarId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return normalized ? `/maid-image/${normalized}.jpg` : '';
}

function isFloatingWindowId(value: unknown): value is FloatingWindowId {
  return typeof value === 'string' && FLOATING_WINDOW_IDS.includes(value as FloatingWindowId);
}

function normalizeDesktopUI(state: Partial<GameState>): DesktopUIState {
  const fallback = createInitialDesktopUIState();
  const candidate = state.desktopUI;

  if (!candidate || typeof candidate !== 'object') {
    return fallback;
  }

  const normalizedWindows = { ...fallback.floatingWindows };

  for (const windowId of FLOATING_WINDOW_IDS) {
    const defaultWindow = fallback.floatingWindows[windowId];
    const loadedWindow = candidate.floatingWindows?.[windowId];

    if (!loadedWindow || typeof loadedWindow !== 'object') {
      continue;
    }

    const loadedMinWidth = Number.isFinite(loadedWindow.minWidth)
      ? Math.max(loadedWindow.minWidth, defaultWindow.minWidth)
      : defaultWindow.minWidth;
    const loadedMinHeight = Number.isFinite(loadedWindow.minHeight)
      ? Math.max(loadedWindow.minHeight, defaultWindow.minHeight)
      : defaultWindow.minHeight;
    const loadedWidth = Number.isFinite(loadedWindow.width)
      ? Math.max(loadedWindow.width, loadedMinWidth)
      : Math.max(defaultWindow.width, loadedMinWidth);
    const loadedHeight = Number.isFinite(loadedWindow.height)
      ? Math.max(loadedWindow.height, loadedMinHeight)
      : Math.max(defaultWindow.height, loadedMinHeight);

    normalizedWindows[windowId] = {
      ...defaultWindow,
      id: windowId,
      title: defaultWindow.title,
      open: Boolean(loadedWindow.open),
      minimized: Boolean(loadedWindow.minimized),
      x: Number.isFinite(loadedWindow.x) ? loadedWindow.x : defaultWindow.x,
      y: Number.isFinite(loadedWindow.y) ? loadedWindow.y : defaultWindow.y,
      width: loadedWidth,
      height: loadedHeight,
      minWidth: loadedMinWidth,
      minHeight: loadedMinHeight,
      zIndex: Number.isFinite(loadedWindow.zIndex) ? loadedWindow.zIndex : defaultWindow.zIndex,
    };
  }

  const maxZIndex = Math.max(
    ...FLOATING_WINDOW_IDS.map((windowId) => normalizedWindows[windowId].zIndex),
    fallback.nextZIndex
  );

  const nextZIndex = Number.isFinite(candidate.nextZIndex)
    ? Math.max(candidate.nextZIndex, maxZIndex + 1)
    : maxZIndex + 1;

  const activeWindowId =
    isFloatingWindowId(candidate.activeWindowId) &&
    normalizedWindows[candidate.activeWindowId].open &&
    !normalizedWindows[candidate.activeWindowId].minimized
      ? candidate.activeWindowId
      : null;

  return {
    floatingWindows: normalizedWindows,
    activeWindowId,
    nextZIndex,
  };
}

function normalizeLoadedState(state: GameState): GameState {
  const normalizedStaffing = normalizeStaffingState(state.staffing ?? DEFAULT_STAFFING_STATE);
  const operationCooldowns = state.runtime?.operationCooldowns;

  return {
    ...state,
    runtime: state.runtime
      ? {
          customerSpawnMs: state.runtime.customerSpawnMs ?? 0,
          customerStatusTicks: state.runtime.customerStatusTicks ?? {},
          customersServedToday: state.runtime.customersServedToday ?? 0,
          customerStreak: state.runtime.customerStreak ?? 0,
          operationCooldowns: {
            attractCustomersMs:
              typeof operationCooldowns?.attractCustomersMs === 'number' && Number.isFinite(operationCooldowns.attractCustomersMs)
                ? Math.max(0, operationCooldowns.attractCustomersMs)
                : 0,
            comfortGuestsMs:
              typeof operationCooldowns?.comfortGuestsMs === 'number' && Number.isFinite(operationCooldowns.comfortGuestsMs)
                ? Math.max(0, operationCooldowns.comfortGuestsMs)
                : 0,
            serviceRushMs:
              typeof operationCooldowns?.serviceRushMs === 'number' && Number.isFinite(operationCooldowns.serviceRushMs)
                ? Math.max(0, operationCooldowns.serviceRushMs)
                : 0,
            superviseServiceMs:
              typeof operationCooldowns?.superviseServiceMs === 'number' && Number.isFinite(operationCooldowns.superviseServiceMs)
                ? Math.max(0, operationCooldowns.superviseServiceMs)
                : 0,
            motivateMaidMs:
              typeof operationCooldowns?.motivateMaidMs === 'number' && Number.isFinite(operationCooldowns.motivateMaidMs)
                ? Math.max(0, operationCooldowns.motivateMaidMs)
                : 0,
          },
          nativeStaffingPrimed: false,
          nativeStaffingFrame: null,
        }
      : { ...RUNTIME_DEFAULTS },
    tasks: Array.isArray(state.tasks)
      ? state.tasks.filter((task) => task.type === 'growth')
      : initialGameState.tasks,
    maids: Array.isArray(state.maids)
      ? state.maids.map((maid) => {
          const normalized = normalizeMaidState({
            ...maid,
            fatigue: Number.isFinite(maid.fatigue) ? maid.fatigue : 0,
            consecutiveWorkDays: Number.isFinite(maid.consecutiveWorkDays) ? maid.consecutiveWorkDays : 0,
            preferredShift:
              maid.preferredShift === 'morning' || maid.preferredShift === 'peak' || maid.preferredShift === 'evening'
                ? maid.preferredShift
                : 'peak',
            skillPoints: Number.isFinite(maid.skillPoints) ? maid.skillPoints : 0,
            skills: maid.skills ?? createDefaultMaidSkills(),
          });
          return normalized;
        })
      : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : [],
    reputation: normalizeReputation(state.reputation),
    selectedMaidId: state.selectedMaidId ?? null,
    selectedCustomerId: state.selectedCustomerId ?? null,
    desktopUI: normalizeDesktopUI(state),
    staffing: normalizedStaffing,
    activeIncident: null,
    incidentHistory: Array.isArray(state.incidentHistory) ? state.incidentHistory.slice(-20) : [],
    dailySummaryOpen: false,
  };
}

function prepareStateForSave(state: GameState): GameState {
  return {
    ...state,
    reputation: normalizeReputation(state.reputation),
    runtime: { ...RUNTIME_DEFAULTS },
    notifications: [],
    selectedMaidId: null,
    selectedCustomerId: null,
    activeIncident: null,
    dailySummaryOpen: false,
  };
}

function deflateMaids(maids: Maid[]): CompactMaid[] {
  return maids.map((maid) => ({
    id: maid.id,
    name: maid.name,
    avatarId: avatarPathToId(maid.avatar),
    personality: maid.personality,
    stats: maid.stats,
    experience: maid.experience,
    level: maid.level,
    role: maid.role,
    status: maid.status,
    mood: maid.mood,
    stamina: maid.stamina,
    fatigue: maid.fatigue,
    consecutiveWorkDays: maid.consecutiveWorkDays,
    preferredShift: maid.preferredShift,
    skillPoints: maid.skillPoints,
    skills: maid.skills,
    hireDate: maid.hireDate,
  }));
}

function inflateMaids(compactMaids: CompactMaid[]): Maid[] {
  const usedImages: string[] = [];

  return compactMaids.map((maid) => {
    const defaultAvatarPath = avatarIdToPath(maid.avatarId);
    const normalized = normalizeMaidAvatarPath(defaultAvatarPath);
    const avatar =
      normalized && maidImagePoolSet.has(normalized)
        ? normalized
        : getRandomMaidImage(usedImages);

    usedImages.push(avatar);

    return {
      id: maid.id,
      name: maid.name,
      avatar,
      personality: maid.personality,
      stats: maid.stats,
      experience: getNumber(maid.experience, 0, 0),
      level: getNumber(maid.level, 1, 1),
      role: maid.role,
      status: maid.status,
      mood: getNumber(maid.mood, 100, 0, 100),
      stamina: getNumber(maid.stamina, 100, 0, 100),
      fatigue: getNumber(maid.fatigue, 0, 0, 100),
      consecutiveWorkDays: getNumber(maid.consecutiveWorkDays, 0, 0),
      preferredShift:
        maid.preferredShift === 'morning' || maid.preferredShift === 'peak' || maid.preferredShift === 'evening'
          ? maid.preferredShift
          : 'peak',
      skillPoints: getNumber(maid.skillPoints, 0, 0),
      skills: {
        service: getNumber(maid.skills?.service, 0, 0, 10),
        guestCare: getNumber(maid.skills?.guestCare, 0, 0, 10),
        emergency: getNumber(maid.skills?.emergency, 0, 0, 10),
      },
      hireDate: getNumber(maid.hireDate, Date.now(), 0),
    };
  });
}

function deflateMenuItems(state: GameState): CompactMenuItemState[] {
  return state.menuItems.map((item) => ({
    id: item.id,
    currentPrice: item.currentPrice,
    unlocked: item.unlocked,
    popularity: item.popularity,
  }));
}

function inflateMenuItems(menuStates: CompactMenuItemState[]) {
  const byId = new Map(menuStates.map((item) => [item.id, item]));

  return defaultMenuItems.map((item) => {
    const compact = byId.get(item.id);
    if (!compact) {
      return { ...item };
    }

    return {
      ...item,
      currentPrice: getNumber(compact.currentPrice, item.currentPrice, 1),
      unlocked: normalizeBoolean(compact.unlocked, item.unlocked),
      popularity: getNumber(compact.popularity, item.popularity, 0, 100),
    };
  });
}

function deflateFacility(state: GameState): CompactFacilityState {
  return {
    cafeLevel: state.facility.cafeLevel,
    maxSeats: state.facility.maxSeats,
    decorationIds: state.facility.decorations.filter((item) => item.purchased).map((item) => item.id),
    equipmentLevels: Object.fromEntries(state.facility.equipment.map((item) => [item.id, item.level])),
    unlockedAreas: state.facility.unlockedAreas,
  };
}

function inflateFacility(compact: CompactFacilityState): GameState['facility'] {
  const decorationSet = new Set(
    Array.isArray(compact.decorationIds) ? compact.decorationIds.filter((id): id is string => typeof id === 'string') : []
  );
  const equipmentLevels = isRecord(compact.equipmentLevels) ? compact.equipmentLevels : {};
  const unlockedAreas = Array.isArray(compact.unlockedAreas)
    ? compact.unlockedAreas.filter((area): area is Area => KNOWN_AREAS.has(area as Area))
    : [];

  const normalizedAreas: Area[] = unlockedAreas.includes('main') ? unlockedAreas : ['main', ...unlockedAreas];

  return {
    cafeLevel: getNumber(compact.cafeLevel, initialGameState.facility.cafeLevel, 1, GAME_CONSTANTS.MAX_CAFE_LEVEL),
    maxSeats: getNumber(compact.maxSeats, initialGameState.facility.maxSeats, GAME_CONSTANTS.BASE_SEATS),
    decorations: defaultDecorations.map((item) => ({
      ...item,
      purchased: decorationSet.has(item.id),
    })),
    equipment: defaultEquipment.map((item) => ({
      ...item,
      level: getNumber(equipmentLevels[item.id], item.level, 1, item.maxLevel),
    })),
    unlockedAreas: normalizedAreas,
  };
}

function deflateTasks(state: GameState): CompactTaskState[] {
  return state.tasks.map((task) => ({
    id: task.id,
    progress: task.progress,
    completed: task.completed,
    claimed: task.claimed,
    dayAssigned: task.dayAssigned,
  }));
}

function inflateTasks(taskStates: CompactTaskState[], day: number): GameState['tasks'] {
  const byId = new Map(taskStates.map((task) => [task.id, task]));

  return createInitialTasks(day).map((task) => {
    const compact = byId.get(task.id);
    if (!compact) {
      return task;
    }

    return {
      ...task,
      progress: getNumber(compact.progress, task.progress, 0),
      completed: normalizeBoolean(compact.completed, task.completed),
      claimed: normalizeBoolean(compact.claimed, task.claimed),
      dayAssigned: getNumber(compact.dayAssigned, task.dayAssigned, 1),
    };
  });
}

function deflateAchievements(state: GameState): CompactAchievementState[] {
  return state.achievements.map((achievement) => ({
    id: achievement.id,
    unlocked: achievement.unlocked,
    unlockedDate: achievement.unlockedDate,
  }));
}

function inflateAchievements(achievementStates: CompactAchievementState[]): GameState['achievements'] {
  const byId = new Map(achievementStates.map((achievement) => [achievement.id, achievement]));

  return defaultAchievements.map((achievement) => {
    const compact = byId.get(achievement.id);
    if (!compact) {
      return { ...achievement };
    }

    return {
      ...achievement,
      unlocked: normalizeBoolean(compact.unlocked, achievement.unlocked),
      unlockedDate:
        typeof compact.unlockedDate === 'number' || compact.unlockedDate === null
          ? compact.unlockedDate
          : achievement.unlockedDate,
    };
  });
}

function sanitizeFinance(finance: GameState['finance']): GameState['finance'] {
  const history = Array.isArray(finance.history)
    ? finance.history
        .filter((item) => isRecord(item))
        .map((item) => ({
          day: getNumber(item.day, 1, 1),
          revenue: getNumber(item.revenue, 0, 0),
          expenses: getNumber(item.expenses, 0, 0),
          profit: getNumber(item.profit, 0),
        }))
        .slice(-365)
    : [];

  return {
    gold: getNumber(finance.gold, initialGameState.finance.gold, 0),
    dailyRevenue: getNumber(finance.dailyRevenue, 0, 0),
    dailyExpenses: getNumber(finance.dailyExpenses, 0, 0),
    history,
  };
}

function sanitizeStatistics(statistics: GameStatistics): GameStatistics {
  return {
    totalCustomersServed: getNumber(statistics.totalCustomersServed, 0, 0),
    totalRevenue: getNumber(statistics.totalRevenue, 0, 0),
    totalDaysPlayed: getNumber(statistics.totalDaysPlayed, 0, 0),
    totalTipsEarned: getNumber(statistics.totalTipsEarned, 0, 0),
    perfectServicesCount: getNumber(statistics.perfectServicesCount, 0, 0),
    maidsHired: getNumber(statistics.maidsHired, 0, 0),
  };
}

function buildCompactSaveData(state: GameState): CompactSaveData {
  const prepared = prepareStateForSave(state);

  return {
    schema: COMPACT_SCHEMA_VERSION,
    version: GAME_CONSTANTS.SAVE_VERSION,
    timestamp: Date.now(),
    day: prepared.day,
    time: prepared.time,
    season: prepared.season,
    isPaused: prepared.isPaused,
    isBusinessHours: prepared.isBusinessHours,
    gameSpeed: prepared.gameSpeed,
    maids: deflateMaids(prepared.maids),
    menuItems: deflateMenuItems(prepared),
    facility: deflateFacility(prepared),
    finance: sanitizeFinance(prepared.finance),
    tasks: deflateTasks(prepared),
    achievements: deflateAchievements(prepared),
    statistics: sanitizeStatistics(prepared.statistics),
    reputation: normalizeReputation(getNumber(prepared.reputation, initialGameState.reputation, 0)),
    staffing: normalizeStaffingState(prepared.staffing),
  };
}

function parseCompactSaveData(data: unknown): StorageResult<CompactSaveData> {
  if (!isRecord(data)) {
    return { success: false, error: '存档数据格式无效' };
  }

  const schema = getNumber(data.schema, -1);
  if (schema !== COMPACT_SCHEMA_VERSION) {
    return { success: false, error: '存档版本不受支持' };
  }

  if (typeof data.version !== 'string' || !isVersionCompatible(data.version)) {
    return { success: false, error: '存档版本不受支持' };
  }

  if (!Number.isFinite(data.timestamp)) {
    return { success: false, error: '存档缺少时间戳' };
  }

  if (!Array.isArray(data.maids) || !Array.isArray(data.menuItems) || !Array.isArray(data.tasks)) {
    return { success: false, error: '存档核心字段缺失' };
  }

  if (!Array.isArray(data.achievements) || !isRecord(data.facility) || !isRecord(data.finance)) {
    return { success: false, error: '存档核心字段缺失' };
  }

  if (!isRecord(data.statistics) || !isSeason(data.season) || !isGameSpeed(data.gameSpeed)) {
    return { success: false, error: '存档内容损坏' };
  }

  return {
    success: true,
    data: data as unknown as CompactSaveData,
  };
}

function inflateCompactSaveData(compact: CompactSaveData): GameState {
  const fallback = getInitialState();
  const day = getNumber(compact.day, fallback.day, 1);

  const rebuilt: GameState = {
    ...fallback,
    day,
    time: getNumber(compact.time, fallback.time, 0),
    season: compact.season,
    isPaused: normalizeBoolean(compact.isPaused, true),
    isBusinessHours: normalizeBoolean(compact.isBusinessHours, true),
    gameSpeed: compact.gameSpeed,
    runtime: { ...RUNTIME_DEFAULTS },
    maids: inflateMaids(Array.isArray(compact.maids) ? compact.maids : []),
    customers: [],
    menuItems: inflateMenuItems(Array.isArray(compact.menuItems) ? compact.menuItems : []),
    facility: inflateFacility(compact.facility),
    finance: sanitizeFinance(compact.finance),
    activeEvents: [],
    eventHistory: [],
    activeIncident: null,
    incidentHistory: [],
    staffing: normalizeStaffingState(compact.staffing ?? DEFAULT_STAFFING_STATE),
    achievements: inflateAchievements(Array.isArray(compact.achievements) ? compact.achievements : []),
    statistics: sanitizeStatistics(compact.statistics),
    tasks: inflateTasks(Array.isArray(compact.tasks) ? compact.tasks : [], day),
    reputation: normalizeReputation(getNumber(compact.reputation, fallback.reputation, 0)),
    selectedMaidId: null,
    selectedCustomerId: null,
    activePanel: 'cafe',
    desktopUI: createInitialDesktopUIState(),
    notifications: [],
    dailySummaryOpen: false,
  };

  return normalizeLoadedState(migrateMaidAvatars(rebuilt));
}

/**
 * Legacy checksum used only for old localStorage migration.
 */
export function generateChecksum(state: GameState): string {
  const stateString = JSON.stringify(state);
  let hash = 0;
  for (let i = 0; i < stateString.length; i += 1) {
    const char = stateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function validateGameState(state: GameState): boolean {
  const requiredFields: (keyof GameState)[] = [
    'day', 'time', 'season', 'isPaused', 'isBusinessHours',
    'maids', 'customers', 'menuItems', 'facility', 'finance',
    'activeEvents', 'eventHistory', 'achievements', 'statistics',
    'reputation', 'activePanel', 'notifications', 'gameSpeed', 'tasks', 'runtime',
    'staffing', 'incidentHistory',
  ];

  for (const field of requiredFields) {
    if (state[field] === undefined) {
      return false;
    }
  }

  if (typeof state.day !== 'number' || state.day < 1) return false;
  if (typeof state.time !== 'number' || state.time < 0) return false;
  if (typeof state.reputation !== 'number') return false;
  if (typeof state.gameSpeed !== 'number') return false;
  if (!Array.isArray(state.maids) || !Array.isArray(state.customers) || !Array.isArray(state.menuItems)) return false;
  if (!Array.isArray(state.achievements) || !Array.isArray(state.notifications) || !Array.isArray(state.tasks)) return false;
  if (!Array.isArray(state.incidentHistory)) return false;
  if (!state.facility || typeof state.facility !== 'object') return false;
  if (!state.finance || typeof state.finance !== 'object') return false;
  if (!state.statistics || typeof state.statistics !== 'object') return false;
  if (!state.runtime || typeof state.runtime !== 'object') return false;
  if (!state.staffing || typeof state.staffing !== 'object') return false;

  return true;
}

/**
 * Legacy save validation used for migration from old localStorage format.
 */
export function validateSaveData(data: unknown): StorageResult<SaveData> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '存档数据格式无效' };
  }

  const saveData = data as Record<string, unknown>;

  if (!saveData.version || typeof saveData.version !== 'string') {
    saveData.version = '0.0.0';
  }

  if (!isVersionCompatible(String(saveData.version))) {
    return {
      success: false,
      error: `存档版本 ${saveData.version} 不受支持。当前版本: ${GAME_CONSTANTS.SAVE_VERSION}，最低支持: ${GAME_CONSTANTS.MIN_SUPPORTED_VERSION ?? '0.1.0'}`,
    };
  }

  if (!saveData.timestamp || typeof saveData.timestamp !== 'number') {
    return { success: false, error: '存档时间戳缺失' };
  }

  if (!saveData.gameState || typeof saveData.gameState !== 'object') {
    return { success: false, error: '游戏状态数据缺失' };
  }

  if (!saveData.checksum || typeof saveData.checksum !== 'string') {
    return { success: false, error: '校验和缺失' };
  }

  const gameState = saveData.gameState as GameState;
  const expectedChecksum = generateChecksum(gameState);
  if (saveData.checksum !== expectedChecksum) {
    return { success: false, error: '存档数据已损坏（校验和不匹配）' };
  }

  if (!validateGameState(gameState)) {
    return { success: false, error: '游戏状态数据不完整' };
  }

  return {
    success: true,
    data: saveData as unknown as SaveData,
  };
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function clearLegacyLocalKeys(): void {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.removeItem(LOCAL_COMPACT_SAVE_KEY);
  localStorage.removeItem(GAME_CONSTANTS.SAVE_KEY);
}

function loadLocalCompactState(): StorageResult<LocalLoadResult> {
  if (!hasLocalStorage()) {
    return { success: false, error: 'localStorage 不可用' };
  }

  const compactRaw = localStorage.getItem(LOCAL_COMPACT_SAVE_KEY);
  if (!compactRaw) {
    return { success: false, error: '没有找到存档' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(compactRaw);
  } catch {
    return { success: false, error: '存档数据解析失败' };
  }

  const validation = parseCompactSaveData(parsed);
  if (!validation.success || !validation.data) {
    return { success: false, error: validation.error };
  }

  return {
    success: true,
    data: {
      type: 'compact',
      state: inflateCompactSaveData(validation.data),
    },
  };
}

function loadLegacyLocalState(): StorageResult<LocalLoadResult> {
  if (!hasLocalStorage()) {
    return { success: false, error: 'localStorage 不可用' };
  }

  const legacyRaw = localStorage.getItem(GAME_CONSTANTS.SAVE_KEY);
  if (!legacyRaw) {
    return { success: false, error: '没有找到存档' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(legacyRaw);
  } catch {
    return { success: false, error: '存档数据解析失败' };
  }

  const validation = validateSaveData(parsed);
  if (!validation.success || !validation.data) {
    return { success: false, error: validation.error };
  }

  const migratedState = migrateMaidAvatars(validation.data.gameState);
  return {
    success: true,
    data: {
      type: 'legacy',
      state: normalizeLoadedState(migratedState),
    },
  };
}

function loadLocalStateForWeb(): StorageResult<GameState> {
  const compact = loadLocalCompactState();
  if (compact.success && compact.data) {
    return { success: true, data: compact.data.state };
  }
  if (compact.error && compact.error !== '没有找到存档') {
    return { success: false, error: compact.error };
  }

  const legacy = loadLegacyLocalState();
  if (legacy.success && legacy.data) {
    return { success: true, data: legacy.data.state };
  }
  if (legacy.error && legacy.error !== '没有找到存档') {
    return { success: false, error: legacy.error };
  }

  return { success: false, error: '没有找到存档' };
}

function saveCompactToLocalStorage(data: CompactSaveData): StorageResult<void> {
  if (!hasLocalStorage()) {
    return { success: false, error: 'localStorage 不可用' };
  }

  try {
    localStorage.setItem(LOCAL_COMPACT_SAVE_KEY, JSON.stringify(data));
    localStorage.removeItem(GAME_CONSTANTS.SAVE_KEY);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return { success: false, error: `保存失败: ${message}` };
  }
}

async function getTauriInvoke(): Promise<TauriInvoke | null> {
  if (!isTauriDesktop()) {
    return null;
  }

  if (!invokeLoader) {
    invokeLoader = import('@tauri-apps/api/core')
      .then((module) => module.invoke as TauriInvoke)
      .catch(() => null);
  }

  return invokeLoader;
}

async function saveSecure(compact: CompactSaveData): Promise<StorageResult<void>> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return { success: false, error: '桌面存档接口不可用' };
  }

  try {
    await invoke('save_secure_state', { payload: JSON.stringify(compact) });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `保存失败: ${message}` };
  }
}

async function loadSecure(): Promise<StorageResult<CompactSaveData | null>> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return { success: false, error: '桌面存档接口不可用' };
  }

  try {
    const payload = await invoke<string | null>('load_secure_state');
    if (!payload) {
      return { success: true, data: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return { success: false, error: '存档内容解析失败' };
    }

    const validation = parseCompactSaveData(parsed);
    if (!validation.success || !validation.data) {
      return { success: false, error: validation.error };
    }

    return { success: true, data: validation.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `加载失败: ${message}` };
  }
}

async function migrateLegacyLocalStorageToSecure(): Promise<StorageResult<GameState>> {
  const compact = loadLocalCompactState();
  if (compact.success && compact.data) {
    const saveResult = await saveSecure(buildCompactSaveData(compact.data.state));
    if (saveResult.success) {
      clearLegacyLocalKeys();
    }
    return { success: true, data: compact.data.state };
  }

  const legacy = loadLegacyLocalState();
  if (!legacy.success || !legacy.data) {
    return { success: false, error: '没有找到存档' };
  }

  const saveResult = await saveSecure(buildCompactSaveData(legacy.data.state));
  if (saveResult.success) {
    clearLegacyLocalKeys();
  }

  return { success: true, data: legacy.data.state };
}

/**
 * Save game state.
 * Desktop: encrypted/signed secure save file in app data directory.
 * Web fallback: compact localStorage save.
 */
export async function saveGame(state: GameState): Promise<StorageResult<void>> {
  try {
    const compact = buildCompactSaveData(state);
    const invoke = await getTauriInvoke();

    if (invoke) {
      return saveSecure(compact);
    }

    return saveCompactToLocalStorage(compact);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return { success: false, error: `保存失败: ${message}` };
  }
}

/**
 * Load game state.
 * Desktop: secure save file first; migrates local legacy save automatically if needed.
 * Web fallback: loads compact local save, then legacy local save.
 */
export async function loadGame(): Promise<StorageResult<GameState>> {
  try {
    const invoke = await getTauriInvoke();

    if (invoke) {
      const secure = await loadSecure();
      if (!secure.success) {
        return { success: false, error: secure.error };
      }

      if (secure.data) {
        return { success: true, data: inflateCompactSaveData(secure.data) };
      }

      return migrateLegacyLocalStorageToSecure();
    }

    return loadLocalStateForWeb();
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return { success: false, error: `加载失败: ${message}` };
  }
}

/**
 * Export is intentionally disabled for local-only anti-tamper desktop mode.
 */
export function exportSave(_state: GameState): StorageResult<Blob> {
  return { success: false, error: '当前版本已禁用导出存档' };
}

/**
 * Download helper kept for API compatibility. Export is disabled.
 */
export function downloadSave(_blob: Blob, _filename?: string): void {
  // no-op: export is intentionally disabled
}

/**
 * Import is intentionally disabled for local-only anti-tamper desktop mode.
 */
export async function importSave(_file: File): Promise<StorageResult<GameState>> {
  return { success: false, error: '当前版本已禁用导入存档' };
}

export async function deleteSave(): Promise<StorageResult<void>> {
  try {
    const invoke = await getTauriInvoke();
    if (invoke) {
      await invoke('delete_secure_state');
      clearLegacyLocalKeys();
      return { success: true };
    }

    if (!hasLocalStorage()) {
      return { success: false, error: 'localStorage 不可用' };
    }

    clearLegacyLocalKeys();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return { success: false, error: `删除失败: ${message}` };
  }
}

export async function hasSave(): Promise<boolean> {
  try {
    const invoke = await getTauriInvoke();
    if (invoke) {
      return await invoke<boolean>('has_secure_state');
    }

    if (!hasLocalStorage()) {
      return false;
    }

    return Boolean(localStorage.getItem(LOCAL_COMPACT_SAVE_KEY) || localStorage.getItem(GAME_CONSTANTS.SAVE_KEY));
  } catch {
    return false;
  }
}

export async function getSaveInfo(): Promise<StorageResult<SaveInfoData>> {
  try {
    const invoke = await getTauriInvoke();
    if (invoke) {
      const info = await invoke<SaveInfoData | null>('get_secure_state_info');
      if (!info) {
        return { success: false, error: '没有找到存档' };
      }
      return { success: true, data: info };
    }

    if (!hasLocalStorage()) {
      return { success: false, error: 'localStorage 不可用' };
    }

    const compactRaw = localStorage.getItem(LOCAL_COMPACT_SAVE_KEY);
    if (compactRaw) {
      const parsed = JSON.parse(compactRaw) as unknown;
      const validation = parseCompactSaveData(parsed);
      if (!validation.success || !validation.data) {
        return { success: false, error: validation.error };
      }

      return {
        success: true,
        data: {
          version: validation.data.version,
          timestamp: validation.data.timestamp,
          day: validation.data.day,
        },
      };
    }

    const legacyRaw = localStorage.getItem(GAME_CONSTANTS.SAVE_KEY);
    if (!legacyRaw) {
      return { success: false, error: '没有找到存档' };
    }

    const parsed = JSON.parse(legacyRaw) as unknown;
    const legacyValidation = validateSaveData(parsed);
    if (!legacyValidation.success || !legacyValidation.data) {
      return { success: false, error: legacyValidation.error };
    }

    return {
      success: true,
      data: {
        version: legacyValidation.data.version,
        timestamp: legacyValidation.data.timestamp,
        day: legacyValidation.data.gameState.day,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return { success: false, error: `获取存档信息失败: ${message}` };
  }
}

/**
 * Get a clean initial state.
 */
export function getInitialState(): GameState {
  return {
    ...initialGameState,
    desktopUI: createInitialDesktopUIState(),
  };
}

/**
 * Migrate maid avatars to known image paths.
 */
export function migrateMaidAvatars(state: GameState): GameState {
  const usedImages: string[] = [];

  const migratedMaids: Maid[] = state.maids.map((maid) => {
    const normalizedAvatar = maid.avatar ? normalizeMaidAvatarPath(maid.avatar) : '';

    if (normalizedAvatar && maidImagePoolSet.has(normalizedAvatar)) {
      usedImages.push(normalizedAvatar);
      return {
        ...maid,
        avatar: normalizedAvatar,
      };
    }

    const fromAvatarId = avatarIdToPath(avatarPathToId(maid.avatar));
    const normalizedFromId = normalizeMaidAvatarPath(fromAvatarId);
    if (normalizedFromId && maidImagePoolSet.has(normalizedFromId)) {
      usedImages.push(normalizedFromId);
      return {
        ...maid,
        avatar: normalizedFromId,
      };
    }

    const newAvatar = getRandomMaidImage(usedImages);
    usedImages.push(newAvatar);

    return {
      ...maid,
      avatar: newAvatar,
    };
  });

  return {
    ...state,
    maids: migratedMaids,
  };
}
