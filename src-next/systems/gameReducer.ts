import {
  GameState,
  GameAction,
  DailyFinance,
  Season,
  FloatingWindowId,
} from '@/types';
import { initialGameState, GAME_CONSTANTS } from '@/data/initialState';
import {
  normalizeMaidState,
  startService,
  updateMaidMood,
  updateMaidStamina,
  updateServiceProgress as updateMaidServiceProgress,
} from '@/systems/maidSystem';
import { checkAchievements } from '@/systems/achievementSystem';
import { calculateRewards, calculateSatisfaction, completeService, generateCustomer, generateOrder, getSpawnInterval, handlePatienceTimeout, shouldCustomerLeave, startCustomerService, updateCustomerServiceProgress, updatePatience } from '@/systems/customerSystem';
import { calculateDailyOperatingCost } from '@/systems/financeSystem';
import { applyTaskEvent, claimTaskReward, refreshDailyTasks } from '@/systems/taskSystem';
import { getAreaUnlockCost, getCafeUpgradeCost, getEquipmentUpgradeCost } from '@/systems/facilitySystem';
import {
  applyServiceComboToRewards,
  getServiceComboTier,
} from '@/systems/comboSystem';
import {
  applyAutoRestPolicy,
  applyFatigueTick,
  getCurrentShift,
  getMaidSatisfactionBonus,
  getServiceProgressMultiplier,
  getSpawnIntervalWithStaffing,
  normalizeRolePriority,
  normalizeStaffingState,
  rollOperationalIncident,
  sortMaidsForService,
  tickStaffingBoost,
} from '@/systems/staffingSystem';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isCustomerStatus(value: unknown): value is GameState['customers'][number]['status'] {
  return (
    value === 'waiting_seat' ||
    value === 'seated' ||
    value === 'ordering' ||
    value === 'waiting_order' ||
    value === 'eating' ||
    value === 'paying' ||
    value === 'leaving'
  );
}

function getComboTierLabel(tier: number): string {
  switch (tier) {
    case 4:
      return '神速连击';
    case 3:
      return '大师连击';
    case 2:
      return '高阶连击';
    case 1:
      return '连击';
    default:
      return '连击';
  }
}

/**
 * 计算下一个季节
 */
function getNextSeason(currentSeason: Season): Season {
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
  const currentIndex = seasons.indexOf(currentSeason);
  return seasons[(currentIndex + 1) % 4];
}

/**
 * 计算咖啡厅升级成本
 */
function getTopFocusableWindowId(state: GameState): FloatingWindowId | null {
  const focusableWindows = Object.values(state.desktopUI.floatingWindows)
    .filter((windowState) => windowState.open && !windowState.minimized)
    .sort((a, b) => b.zIndex - a.zIndex);

  return focusableWindows.length > 0 ? focusableWindows[0].id : null;
}

/**
 * 计算区域解锁成本
 */


/**
 * 游戏状态 Reducer
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // ==================== 时间控制 ====================
    case 'TICK': {
      // 如果暂停，不推进时间
      if (state.isPaused) {
        return state;
      }

      // 如果不在营业时间，不推进时间
      if (!state.isBusinessHours) {
        return state;
      }

      const deltaMinutes = GAME_CONSTANTS.TIME_INCREMENT;
      const deltaMs = action.deltaTime;
      const currentShift = getCurrentShift(state.time);
      const useNativeStaffing = state.runtime.nativeStaffingPrimed === true;
      const nativeFrame = useNativeStaffing ? state.runtime.nativeStaffingFrame ?? null : null;

      const nextRuntime = {
        ...state.runtime,
        customerSpawnMs: (state.runtime.customerSpawnMs ?? 0) + deltaMs,
        customerStatusTicks: { ...(state.runtime.customerStatusTicks ?? {}) },
        customersServedToday: state.runtime.customersServedToday ?? 0,
        customerStreak: state.runtime.customerStreak ?? 0,
        nativeStaffingPrimed: false,
        nativeStaffingFrame: null,
      };

      const baseCustomers = state.customers;

      const notifications = [...state.notifications];
      let reputation = state.reputation;
      let tasks = state.tasks;
      let staffing = useNativeStaffing
        ? normalizeStaffingState(state.staffing)
        : tickStaffingBoost(normalizeStaffingState(state.staffing), deltaMinutes);
      let activeIncident = state.activeIncident;
      let incidentHistory = [...state.incidentHistory];

      if (activeIncident && !useNativeStaffing) {
        const remainingMinutes = activeIncident.remainingMinutes - deltaMinutes;
        if (remainingMinutes <= 0) {
          notifications.push({
            id: `incident_expired_${activeIncident.id}_${Date.now()}`,
            type: 'info',
            message: `${activeIncident.icon} ${activeIncident.title} 已结束`,
            timestamp: Date.now(),
          });
          activeIncident = null;
        } else {
          activeIncident = {
            ...activeIncident,
            remainingMinutes,
          };
        }
      }

      const maidsById = new Map(state.maids.map(m => [m.id, m] as const));
      const customersById = new Map(baseCustomers.map(c => [c.id, c] as const));

      if (
        nativeFrame &&
        nativeFrame.customerStatusTicks &&
        nativeFrame.customerStatusUpdates &&
        Array.isArray(nativeFrame.removedCustomerIds)
      ) {
        nextRuntime.customerStatusTicks = {};
        for (const [customerId, tick] of Object.entries(nativeFrame.customerStatusTicks)) {
          const safeTick = Number.isFinite(tick) ? Math.max(1, Math.min(8, Math.floor(tick))) : 1;
          nextRuntime.customerStatusTicks[customerId] = safeTick;
        }

        for (const [customerId, nextStatus] of Object.entries(nativeFrame.customerStatusUpdates)) {
          if (!isCustomerStatus(nextStatus)) {
            continue;
          }
          const customer = customersById.get(customerId);
          if (!customer) {
            continue;
          }
          customersById.set(customerId, { ...customer, status: nextStatus });
        }

        for (const customerId of nativeFrame.removedCustomerIds) {
          customersById.delete(customerId);
          delete nextRuntime.customerStatusTicks[customerId];
        }
      } else {
        for (const customer of [...customersById.values()]) {
          if (customer.status === 'eating' || customer.status === 'paying' || customer.status === 'leaving') {
            const defaultTicks = customer.status === 'eating' ? 2 : 1;
            const current = nextRuntime.customerStatusTicks[customer.id] ?? defaultTicks;
            const remaining = current - 1;

            if (remaining > 0) {
              nextRuntime.customerStatusTicks[customer.id] = remaining;
              continue;
            }

            if (customer.status === 'eating') {
              customersById.set(customer.id, { ...customer, status: 'paying' });
              nextRuntime.customerStatusTicks[customer.id] = 1;
              continue;
            }

            if (customer.status === 'paying') {
              customersById.set(customer.id, { ...customer, status: 'leaving' });
              nextRuntime.customerStatusTicks[customer.id] = 1;
              continue;
            }

            customersById.delete(customer.id);
            delete nextRuntime.customerStatusTicks[customer.id];
            continue;
          }

          delete nextRuntime.customerStatusTicks[customer.id];
        }
      }

      if (!useNativeStaffing) {
        for (const maid of maidsById.values()) {
        const wasResting = maid.status.isResting;
        const updatedStamina = updateMaidStamina(maid, deltaMinutes);
        const updatedMood = updateMaidMood(updatedStamina, deltaMinutes);
        const updatedFatigue = applyFatigueTick(updatedMood, deltaMinutes, staffing);
        const updated = applyAutoRestPolicy(updatedFatigue, staffing);

        if (updated.stamina <= 0 && !updated.status.isResting) {
          maidsById.set(maid.id, {
            ...updated,
            stamina: 0,
            status: {
              isWorking: false,
              isResting: true,
              currentTask: null,
              servingCustomerId: null,
            },
          });
          notifications.push({
            id: `maid_exhausted_${maid.id}_${Date.now()}`,
            type: 'warning',
            message: `${maid.name} 体力耗尽，已自动安排休息`,
            timestamp: Date.now(),
          });
          continue;
        }

        if (!wasResting && updated.status.isResting) {
          notifications.push({
            id: `maid_auto_rest_${maid.id}_${Date.now()}`,
            type: 'info',
            message: `${maid.name} 触发自动轮休`,
            timestamp: Date.now(),
          });
        }

        if (wasResting && !updated.status.isResting) {
          notifications.push({
            id: `maid_auto_resume_${maid.id}_${Date.now()}`,
            type: 'success',
            message: `${maid.name} 状态恢复，已可重新排班`,
            timestamp: Date.now(),
          });
        }

        if (
          updated.stamina !== maid.stamina ||
          updated.mood !== maid.mood ||
          updated.fatigue !== maid.fatigue ||
          updated.status.isResting !== maid.status.isResting ||
          updated.status.isWorking !== maid.status.isWorking
        ) {
          maidsById.set(maid.id, updated);
        }
        }
      }

      for (const customer of customersById.values()) {
        if (customer.status === 'leaving' || customer.status === 'paying' || customer.status === 'eating') {
          continue;
        }

        const nativeCustomerProfile = nativeFrame?.customerProfiles?.[customer.id];
        const updatedCustomer = nativeCustomerProfile
          ? {
              ...customer,
              patience: clamp(nativeCustomerProfile.nextPatience, 0, 100),
            }
          : updatePatience(customer, deltaMinutes);

        const shouldLeaveNow = nativeCustomerProfile?.shouldLeave ?? shouldCustomerLeave(updatedCustomer);
        if (shouldLeaveNow) {
          const fallbackTimeout = nativeCustomerProfile ? null : handlePatienceTimeout(updatedCustomer);
          const reputationPenalty = nativeCustomerProfile?.reputationPenalty ?? fallbackTimeout?.reputationPenalty ?? 0;
          const leavingCustomer = nativeCustomerProfile
            ? { ...updatedCustomer, satisfaction: 0, status: 'leaving' as const }
            : (fallbackTimeout?.customer ?? updatedCustomer);
          const previousStreak = nextRuntime.customerStreak ?? 0;
          const degradedStreak = Math.max(0, previousStreak - 3);
          reputation = Math.max(0, reputation - reputationPenalty);
          customersById.set(customer.id, leavingCustomer);
          nextRuntime.customerStatusTicks[customer.id] = 1;
          nextRuntime.customerStreak = degradedStreak;
          notifications.push({
            id: `patience_timeout_${customer.id}_${Date.now()}`,
            type: 'warning',
            message: `${customer.name} 因等待太久而离开了，声望 -${reputationPenalty}`,
            timestamp: Date.now(),
          });
          if (previousStreak >= 3 && degradedStreak < previousStreak) {
            notifications.push({
              id: `combo_drop_${customer.id}_${Date.now()}`,
              type: 'info',
              message: `连击中断：${previousStreak} -> ${degradedStreak}`,
              timestamp: Date.now(),
            });
          }
          continue;
        }

        if (updatedCustomer.patience !== customer.patience) {
          customersById.set(customer.id, updatedCustomer);
        }
      }

      let completedServiceCount = 0;
      let completedVipCount = 0;
      let completedGoldTotal = 0;
      let completedTipTotal = 0;
      let completedReputationTotal = 0;
      let maxCompletedSatisfaction = 0;

      const customersListForProgress = [...customersById.values()];
      for (const customer of customersListForProgress) {
        if (customer.status !== 'waiting_order' || !customer.servingMaidId) {
          continue;
        }

        const maid = maidsById.get(customer.servingMaidId);
        if (!maid) {
          continue;
        }

        const currentProgress = customer.serviceProgress ?? 0;
        const nativeProgressUpdate = nativeFrame?.serviceProgressUpdates?.[customer.id];
        const nativeProfile = nativeFrame?.maidProfiles?.[maid.id];
        const newProgress = nativeProgressUpdate
          ? clamp(
              Math.max(currentProgress, nativeProgressUpdate.nextProgress),
              0,
              100
            )
          : (() => {
              const progressMultiplier =
                nativeProfile?.serviceProgressMultiplier ??
                getServiceProgressMultiplier(
                  maid,
                  currentShift,
                  customersById.size,
                  staffing
                );
              const fallbackBaseDelta = Math.max(
                0,
                updateMaidServiceProgress(maid, currentProgress, deltaMinutes) - currentProgress
              );
              const baseDelta = nativeProfile?.baseServiceProgressDelta ?? fallbackBaseDelta;
              return Math.min(currentProgress + baseDelta * progressMultiplier, 100);
            })();
        const serviceCompleted = nativeProgressUpdate?.completed === true || newProgress >= 100;
        if (serviceCompleted) {
          const nativeOutcome = nativeFrame?.serviceOutcomes?.[customer.id];
          const waitTime = customer.serviceStartTime ? (Date.now() - customer.serviceStartTime) / 60000 : 0;
          const streakBefore = nextRuntime.customerStreak ?? 0;
          const comboTierBefore = getServiceComboTier(streakBefore);
          const satisfaction = nativeOutcome
            ? clamp(nativeOutcome.satisfaction, 0, 100)
            : clamp(
                calculateSatisfaction(maid, customer, waitTime) +
                  (nativeProfile?.satisfactionBonus ?? getMaidSatisfactionBonus(maid, staffing)),
                0,
                100
              );
          const rewards = nativeOutcome
            ? {
                gold: nativeOutcome.gold,
                tip: nativeOutcome.tip,
                reputation: nativeOutcome.reputation,
                maidExperience: nativeOutcome.maidExperience,
                comboMultiplier: nativeOutcome.comboMultiplier,
              }
            : applyServiceComboToRewards(calculateRewards(customer, maid), streakBefore);
          completedServiceCount += 1;
          if (customer.type === 'vip') {
            completedVipCount += 1;
          }
          completedGoldTotal += rewards.gold;
          completedTipTotal += rewards.tip;
          completedReputationTotal += rewards.reputation;
          maxCompletedSatisfaction = Math.max(maxCompletedSatisfaction, satisfaction);

          maidsById.set(maid.id, {
            ...maid,
            status: {
              ...maid.status,
              isWorking: false,
              currentTask: null,
              servingCustomerId: null,
            },
          });

          customersById.set(customer.id, completeService({ ...customer, satisfaction }));
          nextRuntime.customerStatusTicks[customer.id] = 2;
          nextRuntime.customersServedToday = (nextRuntime.customersServedToday ?? 0) + 1;
          nextRuntime.customerStreak = streakBefore + 1;
          const comboTierAfter = getServiceComboTier(nextRuntime.customerStreak);
          if (comboTierAfter > comboTierBefore) {
            notifications.push({
              id: `combo_up_${customer.id}_${Date.now()}`,
              type: 'success',
              message: `🔥 ${getComboTierLabel(comboTierAfter)}达成！当前连击 ${nextRuntime.customerStreak}`,
              timestamp: Date.now(),
            });
          }
        } else {
          customersById.set(customer.id, updateCustomerServiceProgress(customer, newProgress));
        }
      }

      const nativeServiceMetrics = nativeFrame?.serviceMetrics;
      if (useNativeStaffing && nativeServiceMetrics) {
        completedServiceCount = Math.max(
          0,
          Math.floor(nativeServiceMetrics.completedCount ?? completedServiceCount)
        );
        completedVipCount = Math.max(
          0,
          Math.floor(nativeServiceMetrics.completedVipCount ?? completedVipCount)
        );
        if (Number.isFinite(nativeServiceMetrics.goldTotal)) {
          completedGoldTotal = nativeServiceMetrics.goldTotal;
        }
        if (Number.isFinite(nativeServiceMetrics.tipTotal)) {
          completedTipTotal = nativeServiceMetrics.tipTotal;
        }
        if (Number.isFinite(nativeServiceMetrics.reputationTotal)) {
          completedReputationTotal = nativeServiceMetrics.reputationTotal;
        }
        if (Number.isFinite(nativeServiceMetrics.maxSatisfaction)) {
          maxCompletedSatisfaction = clamp(nativeServiceMetrics.maxSatisfaction, 0, 100);
        }
      }

      if (completedServiceCount > 0) {
        const revenueDelta = completedGoldTotal + completedTipTotal;
        const nextTotalCustomersServed = state.statistics.totalCustomersServed + completedServiceCount;
        const nextTotalRevenue = state.statistics.totalRevenue + revenueDelta;

        tasks = applyTaskEvent(tasks, { type: 'serve_customers', amount: completedServiceCount });
        if (completedVipCount > 0) {
          tasks = applyTaskEvent(tasks, { type: 'serve_vip', amount: completedVipCount });
        }
        tasks = applyTaskEvent(tasks, { type: 'earn_gold', amount: revenueDelta });
        if (completedTipTotal > 0) {
          tasks = applyTaskEvent(tasks, { type: 'earn_tips', amount: completedTipTotal });
        }
        tasks = applyTaskEvent(tasks, { type: 'maintain_satisfaction', value: maxCompletedSatisfaction });
        tasks = applyTaskEvent(tasks, { type: 'total_revenue', amount: nextTotalRevenue });
        tasks = applyTaskEvent(tasks, { type: 'total_customers', amount: nextTotalCustomersServed });

        state = {
          ...state,
          finance: {
            ...state.finance,
            gold: state.finance.gold + revenueDelta,
            dailyRevenue: state.finance.dailyRevenue + revenueDelta,
          },
          statistics: {
            ...state.statistics,
            totalCustomersServed: nextTotalCustomersServed,
            totalRevenue: nextTotalRevenue,
            totalTipsEarned: state.statistics.totalTipsEarned + completedTipTotal,
          },
        };

        reputation = Math.max(0, Math.min(100, reputation + completedReputationTotal));
      }

      const nativeAssignments = Array.isArray(nativeFrame?.serviceAssignments)
        ? nativeFrame.serviceAssignments
        : null;
      if (nativeAssignments) {
        const assignedMaidIds = new Set<string>();
        const assignedCustomerIds = new Set<string>();
        for (const assignment of nativeAssignments) {
          const maidId = typeof assignment?.maidId === 'string' ? assignment.maidId : '';
          const customerId = typeof assignment?.customerId === 'string' ? assignment.customerId : '';
          if (!maidId || !customerId) {
            continue;
          }
          if (assignedMaidIds.has(maidId) || assignedCustomerIds.has(customerId)) {
            continue;
          }

          const maid = maidsById.get(maidId);
          const customer = customersById.get(customerId);
          if (!maid || !customer || customer.status !== 'seated') {
            continue;
          }
          if (
            maid.status.isResting ||
            maid.status.isWorking ||
            maid.status.servingCustomerId !== null ||
            maid.stamina < 10
          ) {
            continue;
          }

          maidsById.set(maid.id, startService(maid, customer.id));
          customersById.set(customer.id, startCustomerService(customer, maid.id));
          assignedMaidIds.add(maidId);
          assignedCustomerIds.add(customerId);
        }
      } else {
        const waitingCustomers = [...customersById.values()].filter(c => c.status === 'seated');
        if (waitingCustomers.length > 0) {
          const availableMaids = [...maidsById.values()].filter(
            m =>
              !m.status.isResting &&
              !m.status.isWorking &&
              m.status.servingCustomerId === null &&
              m.stamina >= 10
          );

          if (availableMaids.length > 0) {
            const sortedMaids =
              nativeFrame && nativeFrame.maidProfiles
                ? [...availableMaids]
                    .filter((maid) => {
                      const profile = nativeFrame.maidProfiles[maid.id];
                      return profile ? profile.roleAllowed : true;
                    })
                    .sort((a, b) => {
                      const scoreA = nativeFrame.maidProfiles[a.id]?.serviceScore ?? Number.NEGATIVE_INFINITY;
                      const scoreB = nativeFrame.maidProfiles[b.id]?.serviceScore ?? Number.NEGATIVE_INFINITY;
                      return scoreB - scoreA;
                    })
                : sortMaidsForService(
                    availableMaids,
                    currentShift,
                    staffing,
                    waitingCustomers.length
                  );
            const sortedCustomers = [...waitingCustomers].sort((a, b) => a.patience - b.patience);
            const assignCount = Math.min(sortedMaids.length, sortedCustomers.length);

            for (let i = 0; i < assignCount; i++) {
              const maid = sortedMaids[i];
              const customer = sortedCustomers[i];
              maidsById.set(maid.id, startService(maid, customer.id));
              customersById.set(customer.id, startCustomerService(customer, maid.id));
            }
          }
        }
      }

      const activeCustomers = [...customersById.values()].filter(c => c.status !== 'waiting_seat' && c.seatId);
      const occupiedSeats = new Set(activeCustomers.map(c => c.seatId));

      const baseSpawnInterval = getSpawnInterval(reputation, state.facility.cafeLevel);
      const spawnIntervalMs =
        nativeFrame?.spawnIntervalMs ??
        getSpawnIntervalWithStaffing(
          baseSpawnInterval,
          state.day,
          currentShift,
          staffing
        );
      let spawnMs = nextRuntime.customerSpawnMs;
      const spawnFromNative = Boolean(nativeFrame?.spawnPlan);
      if (spawnFromNative) {
        const plannedSpawnCount = Math.max(0, Math.floor(nativeFrame?.spawnPlan.spawnCount ?? 0));
        const plannedCandidates = (nativeFrame?.spawnCandidates ?? []).slice(0, plannedSpawnCount);
        spawnMs = Math.max(0, nativeFrame?.spawnPlan.nextSpawnMs ?? spawnMs);

        for (const nativeSpawn of plannedCandidates) {
          if (occupiedSeats.size >= state.facility.maxSeats) {
            break;
          }

          let seatId: string | null =
            typeof nativeSpawn.seatId === 'string' && nativeSpawn.seatId.trim().length > 0
              ? nativeSpawn.seatId
              : null;

          if (seatId && occupiedSeats.has(seatId)) {
            seatId = null;
          }

          if (!seatId) {
            for (let i = 1; i <= state.facility.maxSeats; i++) {
              const candidate = `seat-${i}`;
              if (!occupiedSeats.has(candidate)) {
                seatId = candidate;
                break;
              }
            }
          }

          if (!seatId) {
            break;
          }

          const safeType =
            nativeSpawn.type === 'vip' ||
            nativeSpawn.type === 'critic' ||
            nativeSpawn.type === 'group' ||
            nativeSpawn.type === 'regular'
              ? nativeSpawn.type
              : 'regular';

          customersById.set(nativeSpawn.id, {
            id: nativeSpawn.id,
            type: safeType,
            name: nativeSpawn.name,
            avatar: nativeSpawn.avatar,
            order: {
              items: nativeSpawn.order.items.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: Math.max(1, Math.floor(item.quantity)),
                prepared: Boolean(item.prepared),
              })),
              totalPrice: Math.max(0, nativeSpawn.order.totalPrice),
              preparedItems: Array.isArray(nativeSpawn.order.preparedItems)
                ? [...nativeSpawn.order.preparedItems]
                : [],
            },
            patience: clamp(nativeSpawn.patience, 0, 100),
            satisfaction: clamp(nativeSpawn.satisfaction, 0, 100),
            status: 'seated',
            arrivalTime: nativeSpawn.arrivalTime || Date.now(),
            seatId,
          });
          occupiedSeats.add(seatId);
        }
      } else {
        let spawnCount = 0;
        while (spawnMs >= spawnIntervalMs && spawnCount < 3) {
          if (occupiedSeats.size >= state.facility.maxSeats) {
            break;
          }

          let seatId: string | null = null;
          for (let i = 1; i <= state.facility.maxSeats; i++) {
            const candidate = `seat-${i}`;
            if (!occupiedSeats.has(candidate)) {
              seatId = candidate;
              break;
            }
          }

          if (!seatId) {
            break;
          }

          const newCustomer = generateCustomer(reputation, state.season);
          const order = generateOrder(newCustomer, state.menuItems, state.season);

          customersById.set(newCustomer.id, {
            ...newCustomer,
            order,
            seatId,
            status: 'seated',
          });
          occupiedSeats.add(seatId);
          spawnMs -= spawnIntervalMs;
          spawnCount += 1;
        }
      }

      const finalCustomers = [...customersById.values()];
      const waitingCountForIncident = finalCustomers.filter(
        (customer) => customer.status === 'seated' || customer.status === 'waiting_order'
      ).length;

      if (!activeIncident && !useNativeStaffing) {
        const rolledIncident = rollOperationalIncident(
          state.day,
          currentShift,
          waitingCountForIncident,
          false
        );
        if (rolledIncident) {
          activeIncident = rolledIncident;
          incidentHistory = [...incidentHistory, rolledIncident].slice(-20);
          notifications.push({
            id: `incident_trigger_${rolledIncident.id}`,
            type: 'warning',
            message: `${rolledIncident.icon} ${rolledIncident.title}（请前往女仆管理处理）`,
            timestamp: Date.now(),
          });
        }
      }

      const unlockedIds = checkAchievements(state.statistics, state.achievements, state);
      let achievements = state.achievements;
      let achievementRewardGold = 0;
      for (const id of unlockedIds) {
        const achievement = achievements.find(a => a.id === id);
        if (!achievement || achievement.unlocked) {
          continue;
        }
        achievements = achievements.map(a => a.id === id ? { ...a, unlocked: true, unlockedDate: Date.now() } : a);
        achievementRewardGold += achievement.reward;
        notifications.push({
          id: `achievement_${id}_${Date.now()}`,
          type: 'achievement',
          message: `🏆 成就解锁：${achievement.name}！奖励 ${achievement.reward} 金币`,
          timestamp: Date.now(),
        });
      }

      const newTime = state.time + deltaMinutes;
      const time = Math.min(newTime, GAME_CONSTANTS.BUSINESS_END_TIME);
      const isClosingTick = time >= GAME_CONSTANTS.BUSINESS_END_TIME;

      const intermediateState: GameState = {
        ...state,
        time,
        isBusinessHours: !isClosingTick,
        runtime: {
          ...nextRuntime,
          customerSpawnMs: spawnMs,
        },
        maids: [...maidsById.values()],
        customers: finalCustomers,
        staffing,
        activeIncident,
        incidentHistory,
        achievements,
        tasks,
        finance: {
          ...state.finance,
          gold: state.finance.gold + achievementRewardGold,
        },
        reputation,
        notifications,
      };

      if (!isClosingTick) {
        return intermediateState;
      }

      const dailyOperatingCost = calculateDailyOperatingCost(intermediateState.maids, intermediateState.facility);
      const dailyFinance: DailyFinance = {
        day: intermediateState.day,
        revenue: intermediateState.finance.dailyRevenue,
        expenses: intermediateState.finance.dailyExpenses + dailyOperatingCost,
        profit: intermediateState.finance.dailyRevenue - (intermediateState.finance.dailyExpenses + dailyOperatingCost),
      };
      const newHistory = [...intermediateState.finance.history, dailyFinance].slice(-7);

      return {
        ...intermediateState,
        isPaused: true,
        isBusinessHours: false,
        dailySummaryOpen: true,
        time: GAME_CONSTANTS.BUSINESS_END_TIME,
        finance: {
          ...intermediateState.finance,
          gold: Math.max(0, intermediateState.finance.gold - dailyOperatingCost),
          history: newHistory,
        },
      };
    }

    case 'TOGGLE_PAUSE': {
      return {
        ...state,
        isPaused: !state.isPaused,
      };
    }

    case 'SET_GAME_SPEED': {
      return {
        ...state,
        gameSpeed: action.speed,
      };
    }

    case 'END_DAY': {
      // 计算日常运营成本
      const dailyOperatingCost = calculateDailyOperatingCost(state.maids, state.facility);
      
      // 记录当日财务到历史
      const dailyFinance: DailyFinance = {
        day: state.day,
        revenue: state.finance.dailyRevenue,
        expenses: state.finance.dailyExpenses + dailyOperatingCost,
        profit: state.finance.dailyRevenue - (state.finance.dailyExpenses + dailyOperatingCost),
      };
      
      // 保留最近7天的历史
      const newHistory = [...state.finance.history, dailyFinance].slice(-7);
      
      return {
        ...state,
        isPaused: true,
        isBusinessHours: false,
        dailySummaryOpen: true,
        finance: {
          ...state.finance,
          gold: Math.max(0, state.finance.gold - dailyOperatingCost),
          history: newHistory,
        },
      };
    }

    case 'START_NEW_DAY': {
      const newDay = state.day + 1;
      
      // 检查是否需要切换季节
      const newSeason = newDay % GAME_CONSTANTS.DAYS_PER_SEASON === 1 && newDay > 1
        ? getNextSeason(state.season)
        : state.season;

      return {
        ...state,
        day: newDay,
        time: GAME_CONSTANTS.BUSINESS_START_TIME,
        season: newSeason,
        isPaused: true,
        isBusinessHours: true,
        dailySummaryOpen: false,
        runtime: {
          ...state.runtime,
          customerSpawnMs: 0,
          customerStatusTicks: {},
          customersServedToday: 0,
          customerStreak: 0,
          nativeStaffingPrimed: false,
          nativeStaffingFrame: null,
        },
        customers: [], // 清空顾客
        tasks: refreshDailyTasks(state.tasks, newDay),
        activeIncident: null,
        staffing: {
          ...state.staffing,
          activeBoost: null,
        },
        finance: {
          ...state.finance,
          dailyRevenue: 0,
          dailyExpenses: 0,
        },
        statistics: {
          ...state.statistics,
          totalDaysPlayed: state.statistics.totalDaysPlayed + 1,
        },
        // 新的一天：状态重置，但保留疲劳体系带来的连续经营压力
        maids: state.maids.map((maid) => {
          const normalized = normalizeMaidState(maid);
          const fatigue = clamp(
            normalized.fatigue - (normalized.status.isResting ? 38 : 28),
            0,
            100
          );
          const consecutiveWorkDays =
            normalized.fatigue >= 55
              ? normalized.consecutiveWorkDays + 1
              : Math.max(0, normalized.consecutiveWorkDays - 1);

          return {
            ...normalized,
            fatigue,
            consecutiveWorkDays,
            stamina: clamp(normalized.stamina + 52 - normalized.fatigue * 0.35, 40, 100),
            mood: clamp(normalized.mood + 38 - normalized.fatigue * 0.2, 35, 100),
            status: {
              isWorking: false,
              isResting: false,
              currentTask: null,
              servingCustomerId: null,
            },
          };
        }),
      };
    }

    // ==================== 女仆管理 ====================
    case 'HIRE_MAID': {
      // 检查是否达到最大女仆数
      const maxMaids = state.facility.cafeLevel + 2; // 基础2 + 等级
      if (state.maids.length >= maxMaids) {
        return state;
      }

      return {
        ...state,
        maids: [...state.maids, normalizeMaidState(action.maid)],
        tasks: applyTaskEvent(state.tasks, { type: 'hire_maids', amount: 1 }),
        statistics: {
          ...state.statistics,
          maidsHired: state.statistics.maidsHired + 1,
        },
      };
    }

    case 'FIRE_MAID': {
      return {
        ...state,
        maids: state.maids.filter(maid => maid.id !== action.maidId),
        selectedMaidId: state.selectedMaidId === action.maidId ? null : state.selectedMaidId,
      };
    }

    case 'ASSIGN_ROLE': {
      return {
        ...state,
        maids: state.maids.map(maid =>
          maid.id === action.maidId
            ? { ...maid, role: action.role }
            : maid
        ),
      };
    }

    case 'UPDATE_MAID': {
      return {
        ...state,
        maids: state.maids.map(maid =>
          maid.id === action.maidId
            ? { ...maid, ...action.updates }
            : maid
        ),
      };
    }

    case 'TOGGLE_MAID_REST': {
      return {
        ...state,
        maids: state.maids.map(maid =>
          maid.id === action.maidId
            ? {
                ...maid,
                status: {
                  ...maid.status,
                  isResting: !maid.status.isResting,
                  isWorking: false,
                  currentTask: null,
                  servingCustomerId: null,
                },
              }
            : maid
        ),
      };
    }

    case 'SET_MAID_SHIFT': {
      return {
        ...state,
        maids: state.maids.map((maid) =>
          maid.id === action.maidId
            ? { ...maid, preferredShift: action.shift }
            : maid
        ),
      };
    }

    case 'SET_SHIFT_ROLE_PRIORITY': {
      const rolePriority = normalizeRolePriority(action.rolePriority);
      return {
        ...state,
        staffing: {
          ...state.staffing,
          shifts: {
            ...state.staffing.shifts,
            [action.shift]: {
              ...state.staffing.shifts[action.shift],
              rolePriority,
            },
          },
        },
      };
    }

    case 'TOGGLE_SHIFT_CROSS_ROLE': {
      return {
        ...state,
        staffing: {
          ...state.staffing,
          shifts: {
            ...state.staffing.shifts,
            [action.shift]: {
              ...state.staffing.shifts[action.shift],
              allowCrossRole: !state.staffing.shifts[action.shift].allowCrossRole,
            },
          },
        },
      };
    }

    case 'UPDATE_AUTO_REST_CONFIG': {
      const nextAutoRest = {
        ...state.staffing.autoRest,
        ...action.config,
      };
      return {
        ...state,
        staffing: {
          ...state.staffing,
          autoRest: {
            ...nextAutoRest,
            staminaThreshold: clamp(nextAutoRest.staminaThreshold, 10, 80),
            moodThreshold: clamp(nextAutoRest.moodThreshold, 10, 80),
            fatigueThreshold: clamp(nextAutoRest.fatigueThreshold, 20, 95),
          },
        },
      };
    }

    case 'ALLOCATE_MAID_SKILL_POINT': {
      return {
        ...state,
        maids: state.maids.map((maid) => {
          if (maid.id !== action.maidId || maid.skillPoints <= 0) {
            return maid;
          }

          const currentLevel = maid.skills[action.skill];
          if (currentLevel >= 10) {
            return maid;
          }

          return {
            ...maid,
            skillPoints: maid.skillPoints - 1,
            skills: {
              ...maid.skills,
              [action.skill]: currentLevel + 1,
            },
          };
        }),
      };
    }

    // ==================== 顾客管理 ====================
    case 'SPAWN_CUSTOMER': {
      return {
        ...state,
        customers: [...state.customers, action.customer],
      };
    }

    case 'UPDATE_CUSTOMER': {
      return {
        ...state,
        customers: state.customers.map(customer =>
          customer.id === action.customerId
            ? { ...customer, ...action.updates }
            : customer
        ),
      };
    }

    case 'REMOVE_CUSTOMER': {
      return {
        ...state,
        customers: state.customers.filter(customer => customer.id !== action.customerId),
        selectedCustomerId: state.selectedCustomerId === action.customerId ? null : state.selectedCustomerId,
      };
    }

    case 'SERVE_CUSTOMER': {
      // 更新女仆状态
      const updatedMaids = state.maids.map(maid =>
        maid.id === action.maidId
          ? {
              ...maid,
              status: {
                ...maid.status,
                isWorking: true,
                currentTask: 'serving',
                servingCustomerId: action.customerId,
              },
            }
          : maid
      );

      // 更新顾客状态
      const updatedCustomers = state.customers.map(customer =>
        customer.id === action.customerId
          ? { ...customer, status: 'waiting_order' as const }
          : customer
      );

      return {
        ...state,
        maids: updatedMaids,
        customers: updatedCustomers,
      };
    }

    case 'START_SERVICE': {
      const maid = state.maids.find(m => m.id === action.maidId);
      const customer = state.customers.find(c => c.id === action.customerId);
      
      if (!maid || !customer) {
        return state;
      }

      const updatedMaid = startService(maid, action.customerId);
      const updatedCustomer = startCustomerService(customer, action.maidId);

      return {
        ...state,
        maids: state.maids.map(m => m.id === action.maidId ? updatedMaid : m),
        customers: state.customers.map(c => c.id === action.customerId ? updatedCustomer : c),
      };
    }

    case 'UPDATE_SERVICE_PROGRESS': {
      const maid = state.maids.find(m => m.id === action.maidId);
      const customer = state.customers.find(c => c.id === action.customerId);
      
      if (!maid || !customer || customer.serviceProgress === undefined) {
        return state;
      }

      const newProgress = updateMaidServiceProgress(maid, customer.serviceProgress, GAME_CONSTANTS.TIME_INCREMENT);
      const updatedCustomer = updateCustomerServiceProgress(customer, newProgress);

      return {
        ...state,
        customers: state.customers.map(c => c.id === action.customerId ? updatedCustomer : c),
      };
    }

    case 'COMPLETE_SERVICE': {
      const maid = state.maids.find(m => m.id === action.maidId);
      const customer = state.customers.find(c => c.id === action.customerId);
      
      if (!maid || !customer) {
        return state;
      }

      // 计算等待时间
      const waitTime = customer.serviceStartTime
        ? (Date.now() - customer.serviceStartTime) / 60000
        : 0;
      const nativeOutcome = state.runtime.nativeStaffingFrame?.serviceOutcomes?.[customer.id];
      const streakBefore = state.runtime.customerStreak ?? 0;
      const comboTierBefore = getServiceComboTier(streakBefore);

      const satisfaction = nativeOutcome
        ? clamp(nativeOutcome.satisfaction, 0, 100)
        : calculateSatisfaction(maid, customer, waitTime);

      const rewards = nativeOutcome
        ? {
            gold: nativeOutcome.gold,
            tip: nativeOutcome.tip,
            reputation: nativeOutcome.reputation,
            maidExperience: nativeOutcome.maidExperience,
            comboMultiplier: nativeOutcome.comboMultiplier ?? 1,
          }
        : applyServiceComboToRewards(calculateRewards(customer, maid), streakBefore);
      const streakAfter = streakBefore + 1;
      const comboTierAfter = getServiceComboTier(streakAfter);
      const notifications =
        comboTierAfter > comboTierBefore
          ? [
              ...state.notifications,
              {
                id: `combo_up_manual_${customer.id}_${Date.now()}`,
                type: 'success' as const,
                message: `🔥 ${getComboTierLabel(comboTierAfter)}达成！当前连击 ${streakAfter}`,
                timestamp: Date.now(),
              },
            ]
          : state.notifications;
      const nextTotalCustomersServed = state.statistics.totalCustomersServed + 1;
      const nextTotalRevenue = state.statistics.totalRevenue + rewards.gold + rewards.tip;
      let nextTasks = applyTaskEvent(state.tasks, { type: 'serve_customers', amount: 1 });
      if (customer.type === 'vip') {
        nextTasks = applyTaskEvent(nextTasks, { type: 'serve_vip', amount: 1 });
      }
      nextTasks = applyTaskEvent(nextTasks, { type: 'earn_gold', amount: rewards.gold + rewards.tip });
      if (rewards.tip > 0) {
        nextTasks = applyTaskEvent(nextTasks, { type: 'earn_tips', amount: rewards.tip });
      }
      nextTasks = applyTaskEvent(nextTasks, { type: 'maintain_satisfaction', value: satisfaction });
      nextTasks = applyTaskEvent(nextTasks, { type: 'total_revenue', amount: nextTotalRevenue });
      nextTasks = applyTaskEvent(nextTasks, { type: 'total_customers', amount: nextTotalCustomersServed });
      
      // 更新女仆状态(释放)
      const updatedMaid = {
        ...maid,
        status: {
          ...maid.status,
          isWorking: false,
          currentTask: null,
          servingCustomerId: null,
        },
      };

      // 更新顾客状态
      const updatedCustomer = completeService({
        ...customer,
        satisfaction,
      });

      return {
        ...state,
        maids: state.maids.map(m => m.id === action.maidId ? updatedMaid : m),
        customers: state.customers.map(c => c.id === action.customerId ? updatedCustomer : c),
        runtime: {
          ...state.runtime,
          customersServedToday: (state.runtime.customersServedToday ?? 0) + 1,
          customerStreak: streakAfter,
        },
        tasks: nextTasks,
        notifications,
        finance: {
          ...state.finance,
          gold: state.finance.gold + rewards.gold + rewards.tip,
          dailyRevenue: state.finance.dailyRevenue + rewards.gold + rewards.tip,
        },
        reputation: Math.max(0, Math.min(100, state.reputation + rewards.reputation)),
        statistics: {
          ...state.statistics,
          totalCustomersServed: nextTotalCustomersServed,
          totalRevenue: nextTotalRevenue,
          totalTipsEarned: state.statistics.totalTipsEarned + rewards.tip,
        },
      };
    }

    // ==================== 菜单管理 ====================
    case 'UNLOCK_MENU_ITEM': {
      const menuItem = state.menuItems.find(item => item.id === action.itemId);
      if (!menuItem || menuItem.unlocked) {
        return state;
      }

      // 检查金币是否足够
      if (state.finance.gold < menuItem.unlockCost) {
        return state;
      }

      return {
        ...state,
        menuItems: state.menuItems.map(item =>
          item.id === action.itemId
            ? { ...item, unlocked: true }
            : item
        ),
        tasks: applyTaskEvent(state.tasks, { type: 'unlock_menu_items', amount: 1 }),
        finance: {
          ...state.finance,
          gold: state.finance.gold - menuItem.unlockCost,
        },
      };
    }

    case 'SET_ITEM_PRICE': {
      const menuItem = state.menuItems.find(item => item.id === action.itemId);
      if (!menuItem || !menuItem.unlocked) {
        return state;
      }

      // 限制价格范围
      const minPrice = menuItem.basePrice * GAME_CONSTANTS.MIN_PRICE_MULTIPLIER;
      const maxPrice = menuItem.basePrice * GAME_CONSTANTS.MAX_PRICE_MULTIPLIER;
      const clampedPrice = Math.max(minPrice, Math.min(maxPrice, action.price));

      return {
        ...state,
        menuItems: state.menuItems.map(item =>
          item.id === action.itemId
            ? { ...item, currentPrice: clampedPrice }
            : item
        ),
      };
    }

    // ==================== 设施管理 ====================
    case 'UPGRADE_CAFE': {
      const { cafeLevel } = state.facility;
      if (cafeLevel >= GAME_CONSTANTS.MAX_CAFE_LEVEL) {
        return state;
      }

      const upgradeCost = getCafeUpgradeCost(cafeLevel);
      if (state.finance.gold < upgradeCost) {
        return state;
      }

      const newLevel = cafeLevel + 1;
      const newMaxSeats = GAME_CONSTANTS.BASE_SEATS + (newLevel - 1) * GAME_CONSTANTS.SEATS_PER_LEVEL;

      return {
        ...state,
        facility: {
          ...state.facility,
          cafeLevel: newLevel,
          maxSeats: newMaxSeats,
        },
        tasks: applyTaskEvent(state.tasks, { type: 'upgrade_cafe', level: newLevel }),
        finance: {
          ...state.finance,
          gold: state.finance.gold - upgradeCost,
        },
      };
    }

    case 'BUY_DECORATION': {
      const decoration = state.facility.decorations.find(d => d.id === action.decorationId);
      if (!decoration || decoration.purchased) {
        return state;
      }

      if (state.finance.gold < decoration.cost) {
        return state;
      }

      return {
        ...state,
        facility: {
          ...state.facility,
          decorations: state.facility.decorations.map(d =>
            d.id === action.decorationId
              ? { ...d, purchased: true }
              : d
          ),
        },
        finance: {
          ...state.finance,
          gold: state.finance.gold - decoration.cost,
        },
      };
    }

    case 'UPGRADE_EQUIPMENT': {
      const equipment = state.facility.equipment.find(e => e.id === action.equipmentId);
      if (!equipment || equipment.level >= equipment.maxLevel) {
        return state;
      }

      // 计算升级成本（随等级增加）
      const upgradeCost = getEquipmentUpgradeCost(equipment);
      if (state.finance.gold < upgradeCost) {
        return state;
      }

      return {
        ...state,
        facility: {
          ...state.facility,
          equipment: state.facility.equipment.map(e =>
            e.id === action.equipmentId
              ? { ...e, level: e.level + 1 }
              : e
          ),
        },
        finance: {
          ...state.finance,
          gold: state.finance.gold - upgradeCost,
        },
      };
    }

    case 'UNLOCK_AREA': {
      if (state.facility.unlockedAreas.includes(action.area)) {
        return state;
      }

      const unlockCost = getAreaUnlockCost(action.area);
      if (state.finance.gold < unlockCost) {
        return state;
      }

      return {
        ...state,
        facility: {
          ...state.facility,
          unlockedAreas: [...state.facility.unlockedAreas, action.area],
        },
        finance: {
          ...state.finance,
          gold: state.finance.gold - unlockCost,
        },
      };
    }

    // ==================== 财务 ====================
    case 'ADD_REVENUE': {
      if (action.amount <= 0) {
        return state;
      }

      return {
        ...state,
        finance: {
          ...state.finance,
          gold: state.finance.gold + action.amount,
          dailyRevenue: state.finance.dailyRevenue + action.amount,
        },
        statistics: {
          ...state.statistics,
          totalRevenue: state.statistics.totalRevenue + action.amount,
        },
      };
    }

    case 'ADD_EXPENSE': {
      if (action.amount <= 0) {
        return state;
      }

      return {
        ...state,
        finance: {
          ...state.finance,
          dailyExpenses: state.finance.dailyExpenses + action.amount,
        },
      };
    }

    case 'DEDUCT_GOLD': {
      if (action.amount <= 0) {
        return state;
      }

      return {
        ...state,
        finance: {
          ...state.finance,
          gold: Math.max(0, state.finance.gold - action.amount),
        },
      };
    }

    // ==================== 事件 ====================
    case 'TRIGGER_EVENT': {
      return {
        ...state,
        activeEvents: [...state.activeEvents, action.event],
        eventHistory: [...state.eventHistory, action.event],
      };
    }

    case 'END_EVENT': {
      return {
        ...state,
        activeEvents: state.activeEvents.filter(event => event.id !== action.eventId),
      };
    }

    case 'TRIGGER_OPERATION_INCIDENT': {
      return {
        ...state,
        activeIncident: action.incident,
        incidentHistory: [...state.incidentHistory, action.incident].slice(-20),
      };
    }

    case 'RESOLVE_OPERATION_INCIDENT': {
      if (!state.activeIncident) {
        return state;
      }

      const option = state.activeIncident.options.find((item) => item.id === action.optionId);
      if (!option) {
        return state;
      }

      const moodDelta = option.moodDelta ?? 0;
      const fatigueDelta = option.fatigueDelta ?? 0;
      const serviceEfficiencyMultiplier = option.serviceEfficiencyMultiplier ?? 1;
      const spawnRateMultiplier = option.spawnRateMultiplier ?? 1;
      const satisfactionBonus = option.satisfactionBonus ?? 0;
      const durationMinutes = option.durationMinutes ?? 0;

      const nextStaffing = {
        ...state.staffing,
        activeBoost:
          durationMinutes > 0
            ? {
                source: state.activeIncident.title,
                remainingMinutes: durationMinutes,
                serviceEfficiencyMultiplier: clamp(serviceEfficiencyMultiplier, 0.7, 1.6),
                spawnRateMultiplier: clamp(spawnRateMultiplier, 0.7, 1.6),
                satisfactionBonus: clamp(satisfactionBonus, -20, 20),
              }
            : null,
      };

      return {
        ...state,
        activeIncident: null,
        staffing: nextStaffing,
        reputation: clamp(state.reputation + (option.reputationDelta ?? 0), 0, 100),
        finance: {
          ...state.finance,
          gold: Math.max(0, state.finance.gold + (option.goldDelta ?? 0)),
        },
        maids: state.maids.map((maid) => ({
          ...maid,
          mood: clamp(maid.mood + moodDelta, 0, 100),
          fatigue: clamp(maid.fatigue + fatigueDelta, 0, 100),
        })),
        notifications: [
          ...state.notifications,
          {
            id: `incident_resolved_${action.optionId}_${Date.now()}`,
            type: 'info',
            message: `已执行应对策略：${option.label}`,
            timestamp: Date.now(),
          },
        ],
      };
    }

    // ==================== 成就 ====================
    case 'UNLOCK_ACHIEVEMENT': {
      const achievement = state.achievements.find(a => a.id === action.achievementId);
      if (!achievement || achievement.unlocked) {
        return state;
      }

      return {
        ...state,
        achievements: state.achievements.map(a =>
          a.id === action.achievementId
            ? { ...a, unlocked: true, unlockedDate: Date.now() }
            : a
        ),
        finance: {
          ...state.finance,
          gold: state.finance.gold + achievement.reward,
        },
      };
    }

    case 'UPDATE_STATISTICS': {
      return {
        ...state,
        statistics: {
          ...state.statistics,
          ...action.updates,
        },
      };
    }

    // ==================== 任务 ====================
    case 'CLAIM_TASK_REWARD': {
      const { tasks, reward } = claimTaskReward(state.tasks, action.taskId);
      if (!reward) {
        return state;
      }

      return {
        ...state,
        tasks,
        finance: {
          ...state.finance,
          gold: state.finance.gold + reward.gold,
          dailyRevenue: state.finance.dailyRevenue + reward.gold,
        },
        reputation: Math.max(0, Math.min(100, state.reputation + reward.reputation)),
        notifications: [
          ...state.notifications,
          {
            id: `task_reward_${action.taskId}_${Date.now()}`,
            type: 'success',
            message: `任务奖励已领取：+${reward.gold} 金币，声望 +${reward.reputation}`,
            timestamp: Date.now(),
          },
        ],
      };
    }

    // ==================== UI ====================
    case 'SET_ACTIVE_PANEL': {
      return {
        ...state,
        activePanel: action.panel,
      };
    }

    case 'OPEN_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      const zIndex = state.desktopUI.nextZIndex;

      return {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          activeWindowId: action.windowId,
          nextZIndex: zIndex + 1,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              open: true,
              minimized: false,
              zIndex,
            },
          },
        },
      };
    }

    case 'CLOSE_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      if (!windowState.open) {
        return state;
      }

      const nextState: GameState = {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              open: false,
              minimized: false,
            },
          },
        },
      };

      return {
        ...nextState,
        desktopUI: {
          ...nextState.desktopUI,
          activeWindowId:
            state.desktopUI.activeWindowId === action.windowId
              ? getTopFocusableWindowId(nextState)
              : state.desktopUI.activeWindowId,
        },
      };
    }

    case 'FOCUS_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      if (!windowState.open || windowState.minimized) {
        return state;
      }

      const zIndex = state.desktopUI.nextZIndex;
      return {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          activeWindowId: action.windowId,
          nextZIndex: zIndex + 1,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              zIndex,
            },
          },
        },
      };
    }

    case 'MOVE_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      if (!windowState.open) {
        return state;
      }

      const nextX = Number.isFinite(action.x) ? action.x : windowState.x;
      const nextY = Number.isFinite(action.y) ? action.y : windowState.y;
      if (nextX === windowState.x && nextY === windowState.y) {
        return state;
      }

      return {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              x: nextX,
              y: nextY,
            },
          },
        },
      };
    }

    case 'RESIZE_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      if (!windowState.open) {
        return state;
      }

      const nextWidth = Number.isFinite(action.width) ? action.width : windowState.width;
      const nextHeight = Number.isFinite(action.height) ? action.height : windowState.height;
      if (nextWidth === windowState.width && nextHeight === windowState.height) {
        return state;
      }

      return {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              width: nextWidth,
              height: nextHeight,
            },
          },
        },
      };
    }

    case 'MINIMIZE_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      if (!windowState.open || windowState.minimized) {
        return state;
      }

      const nextState: GameState = {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              minimized: true,
            },
          },
        },
      };

      return {
        ...nextState,
        desktopUI: {
          ...nextState.desktopUI,
          activeWindowId:
            state.desktopUI.activeWindowId === action.windowId
              ? getTopFocusableWindowId(nextState)
              : state.desktopUI.activeWindowId,
        },
      };
    }

    case 'RESTORE_FLOATING_WINDOW': {
      const windowState = state.desktopUI.floatingWindows[action.windowId];
      if (!windowState.open || !windowState.minimized) {
        return state;
      }

      const zIndex = state.desktopUI.nextZIndex;
      return {
        ...state,
        desktopUI: {
          ...state.desktopUI,
          activeWindowId: action.windowId,
          nextZIndex: zIndex + 1,
          floatingWindows: {
            ...state.desktopUI.floatingWindows,
            [action.windowId]: {
              ...windowState,
              minimized: false,
              zIndex,
            },
          },
        },
      };
    }

    case 'SELECT_MAID': {
      return {
        ...state,
        selectedMaidId: action.maidId,
      };
    }

    case 'SELECT_CUSTOMER': {
      return {
        ...state,
        selectedCustomerId: action.customerId,
      };
    }

    case 'CLOSE_DAILY_SUMMARY': {
      return {
        ...state,
        dailySummaryOpen: false,
      };
    }

    case 'APPLY_NATIVE_STAFFING_PATCH': {
      return {
        ...state,
        maids: action.patch.maids.map((maid) => normalizeMaidState(maid)),
        staffing: normalizeStaffingState(action.patch.staffing),
        activeIncident: action.patch.activeIncident,
        incidentHistory: action.patch.incidentHistory.slice(-20),
        notifications: [...state.notifications, ...action.patch.notifications].slice(-50),
        runtime: {
          ...state.runtime,
          nativeStaffingPrimed: true,
          nativeStaffingFrame: action.patch.frame,
        },
      };
    }

    case 'ADD_NOTIFICATION': {
      const maxNotifications = 50;
      return {
        ...state,
        notifications: [...state.notifications, action.notification].slice(-maxNotifications),
      };
    }

    case 'REMOVE_NOTIFICATION': {
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.notificationId),
      };
    }

    // ==================== 存储 ====================
    case 'LOAD_GAME': {
      return {
        ...action.state,
        runtime: action.state.runtime
          ? {
              customerSpawnMs: action.state.runtime.customerSpawnMs ?? 0,
              customerStatusTicks: action.state.runtime.customerStatusTicks ?? {},
              customersServedToday: action.state.runtime.customersServedToday ?? 0,
              customerStreak: action.state.runtime.customerStreak ?? 0,
              nativeStaffingPrimed: false,
              nativeStaffingFrame: null,
            }
          : {
              customerSpawnMs: 0,
              customerStatusTicks: {},
              customersServedToday: 0,
              customerStreak: 0,
              nativeStaffingPrimed: false,
              nativeStaffingFrame: null,
            },
        maids: Array.isArray(action.state.maids)
          ? action.state.maids.map((maid) => normalizeMaidState(maid))
          : initialGameState.maids,
        staffing: normalizeStaffingState(action.state.staffing ?? initialGameState.staffing),
        activeIncident: action.state.activeIncident ?? null,
        incidentHistory: Array.isArray(action.state.incidentHistory)
          ? action.state.incidentHistory.slice(-20)
          : [],
        tasks: Array.isArray(action.state.tasks) ? action.state.tasks : initialGameState.tasks,
        notifications: Array.isArray(action.state.notifications) ? action.state.notifications : [],
        selectedMaidId: action.state.selectedMaidId ?? null,
        selectedCustomerId: action.state.selectedCustomerId ?? null,
        activePanel: action.state.activePanel ?? 'cafe',
        activeEvents: action.state.activeEvents ?? [],
        eventHistory: action.state.eventHistory ?? [],
        desktopUI: action.state.desktopUI ?? initialGameState.desktopUI,
        dailySummaryOpen: false,
      };
    }

    case 'RESET_GAME': {
      return initialGameState;
    }

    default:
      return state;
  }
}

export default gameReducer;

