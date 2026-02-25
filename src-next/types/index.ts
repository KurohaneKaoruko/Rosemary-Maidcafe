// ==================== 女仆相关类型 ====================

export interface MaidStats {
  charm: number;    // 影响小费和顾客满意度 (1-100)
  skill: number;    // 影响服务速度和质量 (1-100)
  stamina: number;  // 最大体力值 (1-100)
  speed: number;    // 移动和服务速度 (1-100)
}

export type MaidRole = 'greeter' | 'server' | 'barista' | 'entertainer';

export type MaidPersonality = 'cheerful' | 'cool' | 'shy' | 'energetic' | 'elegant';

export type ShiftType = 'morning' | 'peak' | 'evening';
export type MaidSkillKey = 'service' | 'guestCare' | 'emergency';

export interface MaidSkills {
  service: number;
  guestCare: number;
  emergency: number;
}

export interface MaidStatus {
  isWorking: boolean;
  isResting: boolean;  // 是否在休息
  currentTask: string | null;
  servingCustomerId: string | null;
}

export interface Maid {
  id: string;
  name: string;
  avatar: string;
  personality: MaidPersonality;
  stats: MaidStats;
  experience: number;
  level: number;
  role: MaidRole;
  status: MaidStatus;
  mood: number;     // 0-100
  stamina: number;  // 0-100
  fatigue: number;  // 0-100
  consecutiveWorkDays: number;
  preferredShift: ShiftType;
  skillPoints: number;
  skills: MaidSkills;
  hireDate: number;
}

// ==================== 顾客相关类型 ====================

export type CustomerType = 'regular' | 'vip' | 'critic' | 'group';

export type CustomerStatus = 
  | 'waiting_seat' 
  | 'seated' 
  | 'ordering' 
  | 'waiting_order' 
  | 'eating' 
  | 'paying' 
  | 'leaving';

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  prepared: boolean;
}

export interface Order {
  items: OrderItem[];
  totalPrice: number;
  preparedItems: string[];
}

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  avatar: string;
  order: Order;
  patience: number;     // 0-100, 每秒减少
  satisfaction: number; // 0-100
  status: CustomerStatus;
  arrivalTime: number;
  seatId: string;
  serviceProgress?: number; // 服务进度 0-100
  serviceStartTime?: number; // 服务开始时间
  servingMaidId?: string; // 正在服务的女仆ID
}

// ==================== 菜单相关类型 ====================

export type MenuCategory = 'drinks' | 'desserts' | 'main' | 'special';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface MenuItem {
  id: string;
  name: string;
  nameEn: string;
  category: MenuCategory;
  basePrice: number;
  currentPrice: number;
  unlocked: boolean;
  unlockCost: number;
  popularity: number;
  prepTime: number;       // 秒
  season: Season | null;  // null表示全年可用
  icon: string;
}


// ==================== 设施相关类型 ====================

export interface Decoration {
  id: string;
  name: string;
  satisfactionBonus: number;
  cost: number;
  purchased: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  effect: string;
  upgradeCost: number;
}

export type Area = 'main' | 'outdoor' | 'vip_room' | 'stage';

export interface Facility {
  cafeLevel: number;
  maxSeats: number;
  decorations: Decoration[];
  equipment: Equipment[];
  unlockedAreas: Area[];
}

// ==================== 事件相关类型 ====================

export type EventType = 'positive' | 'negative' | 'seasonal';

export type EventEffectTarget = 'revenue' | 'customers' | 'satisfaction' | 'reputation';

export interface EventEffect {
  target: EventEffectTarget;
  modifier: number;       // 乘数或加数
  isMultiplier: boolean;
}

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  effects: EventEffect[];
  duration: number;       // 游戏内分钟
  icon: string;
}

export interface IncidentOption {
  id: string;
  label: string;
  description: string;
  reputationDelta?: number;
  goldDelta?: number;
  moodDelta?: number;
  fatigueDelta?: number;
  spawnRateMultiplier?: number;
  serviceEfficiencyMultiplier?: number;
  satisfactionBonus?: number;
  durationMinutes?: number;
}

export interface IncidentState {
  id: string;
  icon: string;
  title: string;
  description: string;
  remainingMinutes: number;
  options: IncidentOption[];
}

// ==================== 财务相关类型 ====================

export interface DailyFinance {
  day: number;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface Finance {
  gold: number;
  dailyRevenue: number;
  dailyExpenses: number;
  history: DailyFinance[];
}


// ==================== 成就相关类型 ====================

export interface AchievementCondition {
  type: string;
  target: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedDate: number | null;
  reward: number;
  condition: AchievementCondition;
}

// ==================== 任务相关类型 ====================

export type TaskType = 'daily' | 'growth';

export type TaskConditionType =
  | 'serve_customers'
  | 'serve_vip'
  | 'earn_gold'
  | 'earn_tips'
  | 'hire_maids'
  | 'unlock_menu_items'
  | 'upgrade_cafe'
  | 'maintain_satisfaction'
  | 'total_revenue'
  | 'total_customers';

export interface TaskCondition {
  type: TaskConditionType;
  target: number;
}

export interface TaskReward {
  gold: number;
  reputation: number;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  condition: TaskCondition;
  reward: TaskReward;
  progress: number;
  completed: boolean;
  claimed: boolean;
  dayAssigned: number;
}

// ==================== 统计相关类型 ====================

export interface GameStatistics {
  totalCustomersServed: number;
  totalRevenue: number;
  totalDaysPlayed: number;
  totalTipsEarned: number;
  perfectServicesCount: number;
  maidsHired: number;
}

// ==================== 通知相关类型 ====================

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'achievement';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
}

// ==================== 游戏状态类型 ====================

export type PanelType = 'cafe' | 'maids' | 'menu' | 'facility' | 'finance' | 'tasks' | 'achievements' | 'settings';
export type FloatingWindowId =
  | 'finance'
  | 'tasks'
  | 'achievements'
  | 'settings'
  | 'maidDetail'
  | 'customerDetail';

export type GameSpeed = 0.5 | 1 | 2 | 4;

export interface GameRuntime {
  customerSpawnMs: number;
  customerStatusTicks: Record<string, number>;
  customersServedToday?: number;
  customerStreak?: number;
  nativeStaffingPrimed?: boolean;
  nativeStaffingFrame?: NativeStaffingFrame | null;
}

export interface StaffingShiftConfig {
  rolePriority: MaidRole[];
  allowCrossRole: boolean;
}

export interface StaffingAutoRestConfig {
  enabled: boolean;
  staminaThreshold: number;
  moodThreshold: number;
  fatigueThreshold: number;
}

export interface StaffingBoostState {
  source: string;
  remainingMinutes: number;
  spawnRateMultiplier: number;
  serviceEfficiencyMultiplier: number;
  satisfactionBonus: number;
}

export interface StaffingState {
  shifts: Record<ShiftType, StaffingShiftConfig>;
  autoRest: StaffingAutoRestConfig;
  activeBoost: StaffingBoostState | null;
}

export interface NativeMaidProfile {
  baseServiceProgressDelta: number;
  serviceProgressMultiplier: number;
  satisfactionBonus: number;
  serviceScore: number;
  roleAllowed: boolean;
}

export interface NativeCustomerProfile {
  nextPatience: number;
  shouldLeave: boolean;
  reputationPenalty: number;
}

export interface NativeServiceOutcomeProfile {
  satisfaction: number;
  gold: number;
  tip: number;
  reputation: number;
  maidExperience: number;
  comboMultiplier: number;
}

export interface NativeServiceProgressUpdate {
  nextProgress: number;
  completed: boolean;
}

export interface NativeServiceMetrics {
  completedCount: number;
  completedVipCount: number;
  goldTotal: number;
  tipTotal: number;
  reputationTotal: number;
  maxSatisfaction: number;
}

export interface NativeSpawnOrderItem {
  menuItemId: string;
  quantity: number;
  prepared: boolean;
}

export interface NativeSpawnOrder {
  items: NativeSpawnOrderItem[];
  totalPrice: number;
  preparedItems: string[];
}

export interface NativeSpawnCandidate {
  id: string;
  type: CustomerType;
  name: string;
  avatar: string;
  patience: number;
  satisfaction: number;
  arrivalTime: number;
  seatId?: string;
  order: NativeSpawnOrder;
}

export interface NativeSpawnPlan {
  spawnCount: number;
  nextSpawnMs: number;
}

export interface NativeServiceAssignment {
  maidId: string;
  customerId: string;
}

export interface NativeStaffingFrame {
  shift: ShiftType;
  waitingCount: number;
  spawnIntervalMs: number;
  maidProfiles: Record<string, NativeMaidProfile>;
  customerProfiles: Record<string, NativeCustomerProfile>;
  serviceOutcomes: Record<string, NativeServiceOutcomeProfile>;
  serviceProgressUpdates: Record<string, NativeServiceProgressUpdate>;
  serviceMetrics: NativeServiceMetrics;
  customerStatusTicks: Record<string, number>;
  customerStatusUpdates: Record<string, CustomerStatus>;
  removedCustomerIds: string[];
  serviceAssignments: NativeServiceAssignment[];
  spawnPlan: NativeSpawnPlan;
  spawnCandidates: NativeSpawnCandidate[];
}

export interface FloatingWindowState {
  id: FloatingWindowId;
  title: string;
  open: boolean;
  minimized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
}

export interface DesktopUIState {
  floatingWindows: Record<FloatingWindowId, FloatingWindowState>;
  activeWindowId: FloatingWindowId | null;
  nextZIndex: number;
}

export interface GameState {
  // 时间
  day: number;
  time: number;           // 分钟，从0开始，540=9:00AM
  season: Season;
  isPaused: boolean;
  isBusinessHours: boolean;
  gameSpeed: GameSpeed;   // 游戏速度倍率

  runtime: GameRuntime;
  
  // 核心数据
  maids: Maid[];
  customers: Customer[];
  menuItems: MenuItem[];
  facility: Facility;
  finance: Finance;
  
  // 事件
  activeEvents: GameEvent[];
  eventHistory: GameEvent[];
  activeIncident: IncidentState | null;
  incidentHistory: IncidentState[];

  // 调度
  staffing: StaffingState;
  
  // 成就
  achievements: Achievement[];
  statistics: GameStatistics;

  // 任务
  tasks: Task[];
  
  // 声望
  reputation: number;
  
  // UI状态
  selectedMaidId: string | null;
  selectedCustomerId: string | null;
  activePanel: PanelType;
  desktopUI: DesktopUIState;
  notifications: Notification[];
  dailySummaryOpen: boolean;
}

export interface NativeStaffingPatch {
  maids: Maid[];
  staffing: StaffingState;
  activeIncident: IncidentState | null;
  incidentHistory: IncidentState[];
  notifications: Notification[];
  frame: NativeStaffingFrame;
}


// ==================== 游戏动作类型 ====================

export type GameAction =
  // 时间控制
  | { type: 'TICK'; deltaTime: number }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'END_DAY' }
  | { type: 'START_NEW_DAY' }
  | { type: 'SET_GAME_SPEED'; speed: GameSpeed }
  
  // 女仆管理
  | { type: 'HIRE_MAID'; maid: Maid }
  | { type: 'FIRE_MAID'; maidId: string }
  | { type: 'ASSIGN_ROLE'; maidId: string; role: MaidRole }
  | { type: 'UPDATE_MAID'; maidId: string; updates: Partial<Maid> }
  | { type: 'TOGGLE_MAID_REST'; maidId: string }  // 切换休息状态
  | { type: 'SET_MAID_SHIFT'; maidId: string; shift: ShiftType }
  | { type: 'SET_SHIFT_ROLE_PRIORITY'; shift: ShiftType; rolePriority: MaidRole[] }
  | { type: 'TOGGLE_SHIFT_CROSS_ROLE'; shift: ShiftType }
  | { type: 'UPDATE_AUTO_REST_CONFIG'; config: Partial<StaffingAutoRestConfig> }
  | { type: 'ALLOCATE_MAID_SKILL_POINT'; maidId: string; skill: MaidSkillKey }
  
  // 顾客管理
  | { type: 'SPAWN_CUSTOMER'; customer: Customer }
  | { type: 'UPDATE_CUSTOMER'; customerId: string; updates: Partial<Customer> }
  | { type: 'REMOVE_CUSTOMER'; customerId: string }
  | { type: 'SERVE_CUSTOMER'; maidId: string; customerId: string }
  | { type: 'START_SERVICE'; maidId: string; customerId: string }
  | { type: 'UPDATE_SERVICE_PROGRESS'; maidId: string; customerId: string; progress: number }
  | { type: 'COMPLETE_SERVICE'; maidId: string; customerId: string }
  
  // 菜单管理
  | { type: 'UNLOCK_MENU_ITEM'; itemId: string }
  | { type: 'SET_ITEM_PRICE'; itemId: string; price: number }
  
  // 设施管理
  | { type: 'UPGRADE_CAFE' }
  | { type: 'BUY_DECORATION'; decorationId: string }
  | { type: 'UPGRADE_EQUIPMENT'; equipmentId: string }
  | { type: 'UNLOCK_AREA'; area: Area }
  
  // 财务
  | { type: 'ADD_REVENUE'; amount: number }
  | { type: 'ADD_EXPENSE'; amount: number }
  | { type: 'DEDUCT_GOLD'; amount: number }
  
  // 事件
  | { type: 'TRIGGER_EVENT'; event: GameEvent }
  | { type: 'END_EVENT'; eventId: string }
  | { type: 'TRIGGER_OPERATION_INCIDENT'; incident: IncidentState }
  | { type: 'RESOLVE_OPERATION_INCIDENT'; optionId: string }
  
  // 成就
  | { type: 'UNLOCK_ACHIEVEMENT'; achievementId: string }
  | { type: 'UPDATE_STATISTICS'; updates: Partial<GameStatistics> }

  // 任务
  | { type: 'CLAIM_TASK_REWARD'; taskId: string }
  
  // UI
  | { type: 'SET_ACTIVE_PANEL'; panel: PanelType }
  | { type: 'OPEN_FLOATING_WINDOW'; windowId: FloatingWindowId }
  | { type: 'CLOSE_FLOATING_WINDOW'; windowId: FloatingWindowId }
  | { type: 'FOCUS_FLOATING_WINDOW'; windowId: FloatingWindowId }
  | { type: 'MOVE_FLOATING_WINDOW'; windowId: FloatingWindowId; x: number; y: number }
  | { type: 'RESIZE_FLOATING_WINDOW'; windowId: FloatingWindowId; width: number; height: number }
  | { type: 'MINIMIZE_FLOATING_WINDOW'; windowId: FloatingWindowId }
  | { type: 'RESTORE_FLOATING_WINDOW'; windowId: FloatingWindowId }
  | { type: 'SELECT_MAID'; maidId: string | null }
  | { type: 'SELECT_CUSTOMER'; customerId: string | null }
  | { type: 'ADD_NOTIFICATION'; notification: Notification }
  | { type: 'REMOVE_NOTIFICATION'; notificationId: string }
  | { type: 'CLOSE_DAILY_SUMMARY' }
  | { type: 'APPLY_NATIVE_STAFFING_PATCH'; patch: NativeStaffingPatch }
  
  // 存储
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'RESET_GAME' };
