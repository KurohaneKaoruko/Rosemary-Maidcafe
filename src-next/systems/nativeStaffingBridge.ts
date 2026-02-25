import { getSpawnInterval } from '@/systems/customerSystem';
import { GameState, NativeStaffingPatch } from '@/types';
import { isTauriDesktop } from '@/utils/platform';

type TauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
) => Promise<T>;

let invokeLoader: Promise<TauriInvoke | null> | null = null;
let warnedNativeBridge = false;

interface NativeStaffingInput {
  day: number;
  time: number;
  deltaMinutes: number;
  waitingCount: number;
  baseSpawnIntervalMs: number;
  customerSpawnMs: number;
  customerStatusTicks: GameState['runtime']['customerStatusTicks'];
  customerStreak: number;
  maxSeats: number;
  occupiedSeatCount: number;
  occupiedSeatIds: string[];
  reputation: number;
  season: GameState['season'];
  menuItems: GameState['menuItems'];
  maids: GameState['maids'];
  customers: GameState['customers'];
  staffing: GameState['staffing'];
  activeIncident: GameState['activeIncident'];
  incidentHistory: GameState['incidentHistory'];
  nowMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isNativeStaffingPatch(value: unknown): value is NativeStaffingPatch {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.maids) &&
    isRecord(value.staffing) &&
    Array.isArray(value.incidentHistory) &&
    Array.isArray(value.notifications) &&
    isRecord(value.frame)
  );
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

function buildNativeInput(state: GameState, deltaMinutes: number): NativeStaffingInput {
  const waitingCount = state.customers.filter(
    (customer) => customer.status === 'seated' || customer.status === 'waiting_order'
  ).length;
  const occupiedSeatCount = state.customers.filter(
    (customer) => customer.status !== 'waiting_seat' && Boolean(customer.seatId)
  ).length;
  const occupiedSeatIds = state.customers
    .filter((customer) => customer.status !== 'waiting_seat' && Boolean(customer.seatId))
    .map((customer) => customer.seatId);

  return {
    day: state.day,
    time: state.time,
    deltaMinutes,
    waitingCount,
    baseSpawnIntervalMs: getSpawnInterval(state.reputation, state.facility.cafeLevel),
    customerSpawnMs: state.runtime.customerSpawnMs ?? 0,
    customerStatusTicks: state.runtime.customerStatusTicks ?? {},
    customerStreak: state.runtime.customerStreak ?? 0,
    maxSeats: state.facility.maxSeats,
    occupiedSeatCount,
    occupiedSeatIds,
    reputation: state.reputation,
    season: state.season,
    menuItems: state.menuItems,
    maids: state.maids,
    customers: state.customers,
    staffing: state.staffing,
    activeIncident: state.activeIncident,
    incidentHistory: state.incidentHistory,
    nowMs: Date.now(),
  };
}

export async function requestNativeStaffingPatch(
  state: GameState,
  deltaMinutes: number
): Promise<NativeStaffingPatch | null> {
  const invoke = await getTauriInvoke();
  if (!invoke) {
    return null;
  }

  try {
    const patch = await invoke<unknown>('simulate_staffing_tick', {
      input: buildNativeInput(state, deltaMinutes),
    });
    if (!isNativeStaffingPatch(patch)) {
      return null;
    }
    return patch;
  } catch (error) {
    if (!warnedNativeBridge) {
      warnedNativeBridge = true;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[native-staffing] fallback to TS simulation:', message);
    }
    return null;
  }
}
