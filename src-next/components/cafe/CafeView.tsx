'use client';

import { useGame } from '@/components/game/GameProvider';
import { useLandscapeMode } from '@/hooks/useLandscapeMode';
import { useDesktopFloatingMode } from '@/hooks/useDesktopFloatingMode';
import { SeatGrid } from './Seat';
import { MaidCard } from './MaidCard';
import { MaidDetailPanel } from './MaidDetailPanel';
import { CustomerCard } from './CustomerCard';
import { CustomerDetailPanel } from './CustomerDetailPanel';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { CollapsibleCard } from '@/components/ui/CollapsibleCard';
import { CafeOperationType, MaidRole } from '@/types';
import { getServiceComboMultiplier } from '@/systems/comboSystem';

export function CafeView() {
  const { state, dispatch } = useGame();
  const isLandscape = useLandscapeMode();
  const desktopFloatingMode = useDesktopFloatingMode();
  const { 
    customers, 
    maids, 
    facility, 
    selectedCustomerId, 
    selectedMaidId,
    isPaused,
    isBusinessHours,
  } = state;

  // Handle customer selection
  const handleCustomerClick = (customerId: string) => {
    const nextCustomerId = selectedCustomerId === customerId ? null : customerId;
    dispatch({
      type: 'SELECT_CUSTOMER',
      customerId: nextCustomerId,
    });

    if (desktopFloatingMode) {
      if (nextCustomerId) {
        dispatch({ type: 'OPEN_FLOATING_WINDOW', windowId: 'customerDetail' });
      } else {
        dispatch({ type: 'CLOSE_FLOATING_WINDOW', windowId: 'customerDetail' });
      }
    }
  };

  // Handle maid selection
  const handleMaidClick = (maidId: string) => {
    const nextMaidId = selectedMaidId === maidId ? null : maidId;
    dispatch({
      type: 'SELECT_MAID',
      maidId: nextMaidId,
    });

    if (desktopFloatingMode) {
      if (nextMaidId) {
        dispatch({ type: 'OPEN_FLOATING_WINDOW', windowId: 'maidDetail' });
      } else {
        dispatch({ type: 'CLOSE_FLOATING_WINDOW', windowId: 'maidDetail' });
      }
    }
  };

  // Handle maid role change
  const handleRoleChange = (maidId: string, role: MaidRole) => {
    dispatch({
      type: 'ASSIGN_ROLE',
      maidId,
      role,
    });
  };

  // Handle maid rest toggle
  const handleToggleRest = (maidId: string) => {
    dispatch({
      type: 'TOGGLE_MAID_REST',
      maidId,
    });
  };

  // Get waiting customers (not yet seated)
  const waitingCustomers = customers.filter(c => c.status === 'waiting_seat');
  
  // Get active maids (not resting)
  const activeMaids = maids.filter(m => !m.status.isResting);
  const restingMaids = maids.filter(m => m.status.isResting);

  // Get selected customer and maid details
  const selectedCustomer = selectedCustomerId 
    ? customers.find(c => c.id === selectedCustomerId) 
    : null;
  const selectedMaid = selectedMaidId 
    ? maids.find(m => m.id === selectedMaidId) 
    : null;
  const serviceComboMultiplier = getServiceComboMultiplier(state.runtime.customerStreak ?? 0);
  const operationCooldowns = state.runtime.operationCooldowns ?? {
    attractCustomersMs: 0,
    comfortGuestsMs: 0,
    serviceRushMs: 0,
    superviseServiceMs: 0,
    motivateMaidMs: 0,
  };
  const occupiedSeatCount = customers.filter((customer) => customer.status !== 'waiting_seat' && Boolean(customer.seatId)).length;
  const servicePressureCount = customers.filter(
    (customer) => customer.status === 'seated' || customer.status === 'waiting_order'
  ).length;
  const hasFreeSeat = occupiedSeatCount < facility.maxSeats;
  const hasComfortTarget =
    customers.some((customer) =>
      customer.status === 'seated' ||
      customer.status === 'ordering' ||
      customer.status === 'waiting_order' ||
      customer.status === 'waiting_seat'
    );
  const hasWorkingMaid = activeMaids.length > 0;
  const operationCards: Array<{
    id: CafeOperationType;
    icon: string;
    name: string;
    description: string;
    cost: number;
    cooldownMs: number;
    blockedReason: string | null;
  }> = [
    {
      id: 'attract_customers',
      icon: '📣',
      name: '街头揽客',
      description: '立即吸引 1 位顾客入座',
      cost: 120,
      cooldownMs: operationCooldowns.attractCustomersMs,
      blockedReason: hasFreeSeat ? null : '座位已满',
    },
    {
      id: 'comfort_guests',
      icon: '🍀',
      name: '安抚客席',
      description: '恢复顾客耐心并小幅提满意',
      cost: 80,
      cooldownMs: operationCooldowns.comfortGuestsMs,
      blockedReason: hasComfortTarget ? null : '暂无可安抚顾客',
    },
    {
      id: 'service_rush',
      icon: '⚡',
      name: '服务冲刺',
      description: '20 分钟效率提升，士气有损',
      cost: 100,
      cooldownMs: operationCooldowns.serviceRushMs,
      blockedReason: hasWorkingMaid ? null : '暂无在岗女仆',
    },
  ];

  const formatCooldown = (cooldownMs: number) => `${Math.max(1, Math.ceil(cooldownMs / 1000))}s`;

  const getOperationHint = (operation: (typeof operationCards)[number]): string => {
    if (!isBusinessHours) {
      return '非营业时段';
    }
    if (isPaused) {
      return '已暂停';
    }
    if (operation.cooldownMs > 0) {
      return `${formatCooldown(operation.cooldownMs)} 冷却`;
    }
    if (state.finance.gold < operation.cost) {
      return '金币不足';
    }
    if (operation.blockedReason) {
      return operation.blockedReason;
    }
    return '可执行';
  };

  const canUseOperation = (operation: (typeof operationCards)[number]): boolean => (
    isBusinessHours &&
    !isPaused &&
    operation.cooldownMs <= 0 &&
    state.finance.gold >= operation.cost &&
    !operation.blockedReason
  );

  const handleUseOperation = (operation: CafeOperationType) => {
    dispatch({
      type: 'USE_CAFE_OPERATION',
      operation,
    });
  };

  const fallbackDispatchMaid = activeMaids.find(
    (maid) => !maid.status.isWorking && maid.status.servingCustomerId === null && maid.stamina >= 10
  ) ?? null;
  const fallbackDispatchCustomer = customers.find((customer) => customer.status === 'seated') ?? null;
  const dispatchMaid = selectedMaid && !selectedMaid.status.isResting ? selectedMaid : fallbackDispatchMaid;
  const dispatchCustomer = selectedCustomer && selectedCustomer.status === 'seated' ? selectedCustomer : fallbackDispatchCustomer;
  const superviseTarget =
    selectedCustomer &&
    selectedCustomer.status === 'waiting_order' &&
    selectedCustomer.serviceProgress !== undefined
      ? selectedCustomer
      : (customers.find(
          (customer) => customer.status === 'waiting_order' && customer.serviceProgress !== undefined
        ) ?? null);
  const motivateTarget =
    selectedMaid && !selectedMaid.status.isResting
      ? selectedMaid
      : (activeMaids.find((maid) => !maid.status.isResting) ?? null);
  const canManualAssignFinal = Boolean(
    isBusinessHours &&
      !isPaused &&
      dispatchMaid &&
      dispatchCustomer &&
      dispatchCustomer.status === 'seated' &&
      !dispatchMaid.status.isResting &&
      !dispatchMaid.status.isWorking &&
      dispatchMaid.status.servingCustomerId === null &&
      dispatchMaid.stamina >= 10
  );
  const canSuperviseService = Boolean(
    isBusinessHours &&
      !isPaused &&
      superviseTarget &&
      operationCooldowns.superviseServiceMs <= 0 &&
      state.finance.gold >= 35
  );
  const canMotivateMaid = Boolean(
    isBusinessHours &&
      !isPaused &&
      motivateTarget &&
      operationCooldowns.motivateMaidMs <= 0 &&
      state.finance.gold >= 55
  );

  const manualAssignHint = (() => {
    if (!dispatchMaid || !dispatchCustomer) {
      return '需至少 1 名空闲女仆与 1 位已入座顾客';
    }
    if (!isBusinessHours) {
      return '非营业时段';
    }
    if (isPaused) {
      return '已暂停';
    }
    if (dispatchCustomer.status !== 'seated') {
      return '顾客需处于已入座状态';
    }
    if (dispatchMaid.status.isResting || dispatchMaid.status.isWorking || dispatchMaid.stamina < 10) {
      return '女仆当前不可派单';
    }
    if (selectedMaid && selectedCustomer) {
      return '可立即派单';
    }
    return `自动派单：${dispatchMaid.name} → ${dispatchCustomer.name}`;
  })();

  const superviseHint = (() => {
    if (!superviseTarget) {
      return '暂无可督导的等待上餐顾客';
    }
    if (!isBusinessHours) {
      return '非营业时段';
    }
    if (isPaused) {
      return '已暂停';
    }
    if (operationCooldowns.superviseServiceMs > 0) {
      return `${formatCooldown(operationCooldowns.superviseServiceMs)} 冷却`;
    }
    if (state.finance.gold < 35) {
      return '金币不足';
    }
    if (selectedCustomer && selectedCustomer.id === superviseTarget.id) {
      return '推进服务 +30%';
    }
    return `自动督导：${superviseTarget.name} +30%`;
  })();

  const motivateHint = (() => {
    if (!motivateTarget) {
      return '暂无可鼓舞女仆';
    }
    if (!isBusinessHours) {
      return '非营业时段';
    }
    if (isPaused) {
      return '已暂停';
    }
    if (operationCooldowns.motivateMaidMs > 0) {
      return `${formatCooldown(operationCooldowns.motivateMaidMs)} 冷却`;
    }
    if (state.finance.gold < 55) {
      return '金币不足';
    }
    if (selectedMaid && selectedMaid.id === motivateTarget.id) {
      return '恢复状态并提速当前服务';
    }
    return `自动鼓舞：${motivateTarget.name}`;
  })();

  const handleManualAssign = () => {
    if (!dispatchMaid || !dispatchCustomer) {
      return;
    }
    dispatch({
      type: 'MANUAL_ASSIGN_SERVICE',
      maidId: dispatchMaid.id,
      customerId: dispatchCustomer.id,
    });
  };

  const handleSuperviseService = () => {
    if (!superviseTarget) {
      return;
    }
    dispatch({
      type: 'SUPERVISE_SERVICE',
      customerId: superviseTarget.id,
    });
  };

  const handleMotivateMaid = () => {
    if (!motivateTarget) {
      return;
    }
    dispatch({
      type: 'MOTIVATE_MAID',
      maidId: motivateTarget.id,
    });
  };

  return (
    <div className={`flex flex-col gap-4 p-4 min-h-full ${isLandscape ? 'p-2 gap-2' : ''}`}>
      {/* Status Banner */}
      {!isBusinessHours && (
        <div className={`bg-gray-50 rounded-xl p-3 text-center ${isLandscape ? 'p-2 text-sm' : ''}`}>
          <span className="text-gray-600">
            🌙 营业时间已结束 (9:00 - 21:00)
          </span>
        </div>
      )}
      
      {isPaused && isBusinessHours && (
        <div className="flex justify-center sm:justify-start">
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 text-yellow-700 ${
              isLandscape ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
            }`}
          >
            <span aria-hidden>⏸</span>
            <span>已暂停</span>
          </span>
        </div>
      )}

      <Card className={isLandscape ? 'card-landscape-compact' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>🎮</span>
              <span className={isLandscape ? 'text-sm' : ''}>运营指令</span>
            </div>
            <span className={`text-gray-500 ${isLandscape ? 'text-[10px]' : 'text-xs'}`}>
              压力 {servicePressureCount} / 座位 {occupiedSeatCount}/{facility.maxSeats}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <div className={`grid gap-2 ${isLandscape ? 'grid-cols-1 gap-1.5' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {operationCards.map((operation) => {
              const available = canUseOperation(operation);
              const hint = getOperationHint(operation);
              return (
                <button
                  key={operation.id}
                  type="button"
                  className={`rounded-xl border text-left transition p-2.5 ${
                    available
                      ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 active:bg-emerald-100'
                      : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={() => handleUseOperation(operation.id)}
                  disabled={!available}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span>{operation.icon}</span>
                      <span className={`font-medium ${isLandscape ? 'text-xs' : 'text-sm'}`}>{operation.name}</span>
                    </div>
                    <span className={`text-[11px] ${state.finance.gold >= operation.cost ? 'text-amber-600' : 'text-red-500'}`}>
                      -{operation.cost}
                    </span>
                  </div>
                  <p className={`mt-1 ${isLandscape ? 'text-[10px]' : 'text-xs'} text-gray-500`}>
                    {operation.description}
                  </p>
                  <p className={`mt-1 font-medium ${isLandscape ? 'text-[10px]' : 'text-xs'} ${available ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {hint}
                  </p>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className={isLandscape ? 'card-landscape-compact' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>🧠</span>
              <span className={isLandscape ? 'text-sm' : ''}>手动调度</span>
            </div>
            <span className={`text-gray-500 ${isLandscape ? 'text-[10px]' : 'text-xs'}`}>
              女仆：{selectedMaid?.name ?? '未选'} / 顾客：{selectedCustomer?.name ?? '未选'}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <div className={`grid gap-2 ${isLandscape ? 'grid-cols-1 gap-1.5' : 'grid-cols-1 sm:grid-cols-3'}`}>
            <button
              type="button"
              onClick={handleManualAssign}
              disabled={!canManualAssignFinal}
              className={`rounded-xl border text-left p-2.5 transition ${
                canManualAssignFinal
                  ? 'border-sky-200 bg-sky-50/50 hover:bg-sky-50 active:bg-sky-100'
                  : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium ${isLandscape ? 'text-xs' : 'text-sm'}`}>🎯 立即派单</span>
                <span className="text-[11px] text-sky-600">免费</span>
              </div>
              <p className={`mt-1 text-gray-500 ${isLandscape ? 'text-[10px]' : 'text-xs'}`}>
                指定女仆优先服务指定顾客
              </p>
              <p className={`mt-1 font-medium ${isLandscape ? 'text-[10px]' : 'text-xs'} ${canManualAssignFinal ? 'text-sky-700' : 'text-gray-500'}`}>
                {manualAssignHint}
              </p>
            </button>

            <button
              type="button"
              onClick={handleSuperviseService}
              disabled={!canSuperviseService}
              className={`rounded-xl border text-left p-2.5 transition ${
                canSuperviseService
                  ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 active:bg-amber-100'
                  : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium ${isLandscape ? 'text-xs' : 'text-sm'}`}>🧭 现场督导</span>
                <span className={`text-[11px] ${state.finance.gold >= 35 ? 'text-amber-600' : 'text-red-500'}`}>-35</span>
              </div>
              <p className={`mt-1 text-gray-500 ${isLandscape ? 'text-[10px]' : 'text-xs'}`}>
                推进当前服务进度并稳定耐心
              </p>
              <p className={`mt-1 font-medium ${isLandscape ? 'text-[10px]' : 'text-xs'} ${canSuperviseService ? 'text-amber-700' : 'text-gray-500'}`}>
                {superviseHint}
              </p>
            </button>

            <button
              type="button"
              onClick={handleMotivateMaid}
              disabled={!canMotivateMaid}
              className={`rounded-xl border text-left p-2.5 transition ${
                canMotivateMaid
                  ? 'border-violet-200 bg-violet-50/50 hover:bg-violet-50 active:bg-violet-100'
                  : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium ${isLandscape ? 'text-xs' : 'text-sm'}`}>📣 鼓舞女仆</span>
                <span className={`text-[11px] ${state.finance.gold >= 55 ? 'text-violet-600' : 'text-red-500'}`}>-55</span>
              </div>
              <p className={`mt-1 text-gray-500 ${isLandscape ? 'text-[10px]' : 'text-xs'}`}>
                恢复状态，若在服务中则额外提速
              </p>
              <p className={`mt-1 font-medium ${isLandscape ? 'text-[10px]' : 'text-xs'} ${canMotivateMaid ? 'text-violet-700' : 'text-gray-500'}`}>
                {motivateHint}
              </p>
            </button>
          </div>
        </CardBody>
      </Card>
      
      {/* Main Layout: 
          - Landscape mode: Two columns (main + sidebar) - Requirements: 8.2
          - Mobile (<1024px): Single column vertical layout
          - Desktop (>=1024px): Two columns with sidebar
      */}
      <div className={`flex-1 ${
        isLandscape 
          ? 'flex flex-row gap-2 overflow-hidden' 
          : 'flex flex-col lg:grid lg:grid-cols-3 gap-4'
      }`}>
        {/* Main Cafe Area - Seats */}
        <div className={isLandscape ? 'flex-1 overflow-auto' : 'lg:col-span-2'}>
          <Card className={`h-full ${isLandscape ? 'card-landscape-compact' : ''}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span>🏠</span>
                <span className={isLandscape ? 'text-sm' : ''}>咖啡厅大厅</span>
                <span className={`text-gray-500 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                  (等级 {facility.cafeLevel})
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <SeatGrid
                maxSeats={facility.maxSeats}
                customers={customers}
                onCustomerClick={handleCustomerClick}
                selectedCustomerId={selectedCustomerId}
                isLandscape={isLandscape}
              />
              
              {/* Empty state */}
              {customers.length === 0 && (
                <div className={`text-center py-8 text-gray-500 ${isLandscape ? 'py-4' : ''}`}>
                  <div className={`mb-2 ${isLandscape ? 'text-2xl' : 'text-4xl'}`}>🍵</div>
                  <p className={isLandscape ? 'text-sm' : ''}>还没有顾客光临</p>
                  <p className={`${isLandscape ? 'text-xs' : 'text-sm'}`}>开始营业后顾客会陆续到来</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Side Panel - Landscape: always visible sidebar, Mobile: collapsible, Desktop: regular cards */}
        <div className={`flex flex-col gap-4 ${
          isLandscape ? 'w-48 flex-shrink-0 overflow-auto gap-2' : ''
        }`}>
          {/* Waiting Customers */}
          {waitingCustomers.length > 0 && (
            <>
              {/* Landscape: Compact Card */}
              {isLandscape ? (
                <Card className="card-landscape-compact">
                  <CardHeader>
                    <div className="flex items-center gap-1 text-xs">
                      <span>🚶</span>
                      <span>等待</span>
                      <span className="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full text-[10px]">
                        {waitingCustomers.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="flex flex-wrap gap-1">
                      {waitingCustomers.slice(0, 4).map(customer => (
                        <CustomerCard
                          key={customer.id}
                          customer={customer}
                          comboMultiplier={serviceComboMultiplier}
                          onClick={() => handleCustomerClick(customer.id)}
                          selected={selectedCustomerId === customer.id}
                          compact
                        />
                      ))}
                      {waitingCustomers.length > 4 && (
                        <span className="text-xs text-gray-400">+{waitingCustomers.length - 4}</span>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <>
                  {/* Mobile: CollapsibleCard */}
                  <div className="lg:hidden">
                    <CollapsibleCard
                      title="等待入座"
                      icon="🚶"
                      badge={waitingCustomers.length}
                      defaultExpanded={false}
                    >
                      <div className="flex flex-wrap gap-2">
                        {waitingCustomers.map(customer => (
                          <CustomerCard
                            key={customer.id}
                            customer={customer}
                            comboMultiplier={serviceComboMultiplier}
                            onClick={() => handleCustomerClick(customer.id)}
                            selected={selectedCustomerId === customer.id}
                            compact
                          />
                        ))}
                      </div>
                    </CollapsibleCard>
                  </div>
                  {/* Desktop: Regular Card */}
                  <div className="hidden lg:block">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <span>🚶</span>
                          <span>等待入座</span>
                          <span className="text-sm bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">
                            {waitingCustomers.length}
                          </span>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="flex flex-wrap gap-2">
                          {waitingCustomers.map(customer => (
                            <CustomerCard
                              key={customer.id}
                              customer={customer}
                              comboMultiplier={serviceComboMultiplier}
                              onClick={() => handleCustomerClick(customer.id)}
                              selected={selectedCustomerId === customer.id}
                              compact
                            />
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </>
              )}
            </>
          )}

          {/* Active Maids */}
          <>
            {/* Landscape: Compact Card */}
            {isLandscape ? (
              <Card className="card-landscape-compact">
                <CardHeader>
                  <div className="flex items-center gap-1 text-xs">
                    <span>👧</span>
                    <span>工作</span>
                    <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">
                      {activeMaids.length}
                    </span>
                  </div>
                </CardHeader>
                <CardBody>
                  {activeMaids.length > 0 ? (
                    <div className="space-y-1">
                      {activeMaids.slice(0, 3).map(maid => (
                        <MaidCard
                          key={maid.id}
                          maid={maid}
                          onClick={() => handleMaidClick(maid.id)}
                          selected={selectedMaidId === maid.id}
                          compact
                        />
                      ))}
                      {activeMaids.length > 3 && (
                        <span className="text-xs text-gray-400">+{activeMaids.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-gray-500">
                      <p className="text-xs">无女仆工作</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            ) : (
              <>
                {/* Mobile: CollapsibleCard */}
                <div className="lg:hidden">
                  <CollapsibleCard
                    title="工作中"
                    icon="👧"
                    badge={activeMaids.length}
                    defaultExpanded={false}
                  >
                    {activeMaids.length > 0 ? (
                      <div className="space-y-2">
                        {activeMaids.map(maid => (
                          <MaidCard
                            key={maid.id}
                            maid={maid}
                            onClick={() => handleMaidClick(maid.id)}
                            selected={selectedMaidId === maid.id}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <div className="text-2xl mb-1">👧</div>
                        <p className="text-sm">还没有女仆在工作</p>
                        <p className="text-xs">前往女仆管理雇佣女仆</p>
                      </div>
                    )}
                  </CollapsibleCard>
                </div>
                {/* Desktop: Regular Card */}
                <div className="hidden lg:block">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <span>👧</span>
                        <span>工作中的女仆</span>
                        <span className="text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                          {activeMaids.length}
                        </span>
                      </div>
                    </CardHeader>
                    <CardBody>
                      {activeMaids.length > 0 ? (
                        <div className="space-y-2">
                          {activeMaids.map(maid => (
                            <MaidCard
                              key={maid.id}
                              maid={maid}
                              onClick={() => handleMaidClick(maid.id)}
                              selected={selectedMaidId === maid.id}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <div className="text-2xl mb-1">👧</div>
                          <p className="text-sm">还没有女仆在工作</p>
                          <p className="text-xs">前往女仆管理雇佣女仆</p>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              </>
            )}
          </>

          {/* Resting Maids */}
          {restingMaids.length > 0 && (
            <>
              {/* Landscape: Compact Card */}
              {isLandscape ? (
                <Card className="card-landscape-compact">
                  <CardHeader>
                    <div className="flex items-center gap-1 text-xs">
                      <span>💤</span>
                      <span>休息</span>
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">
                        {restingMaids.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="flex flex-wrap gap-1">
                      {restingMaids.slice(0, 3).map(maid => (
                        <MaidCard
                          key={maid.id}
                          maid={maid}
                          onClick={() => handleMaidClick(maid.id)}
                          selected={selectedMaidId === maid.id}
                          compact
                        />
                      ))}
                      {restingMaids.length > 3 && (
                        <span className="text-xs text-gray-400">+{restingMaids.length - 3}</span>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <>
                  {/* Mobile: CollapsibleCard */}
                  <div className="lg:hidden">
                    <CollapsibleCard
                      title="休息中"
                      icon="💤"
                      badge={restingMaids.length}
                      defaultExpanded={false}
                    >
                      <div className="flex flex-wrap gap-2">
                        {restingMaids.map(maid => (
                          <MaidCard
                            key={maid.id}
                            maid={maid}
                            onClick={() => handleMaidClick(maid.id)}
                            selected={selectedMaidId === maid.id}
                            compact
                          />
                        ))}
                      </div>
                    </CollapsibleCard>
                  </div>
                  {/* Desktop: Regular Card */}
                  <div className="hidden lg:block">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <span>💤</span>
                          <span>休息中</span>
                          <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {restingMaids.length}
                          </span>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="flex flex-wrap gap-2">
                          {restingMaids.map(maid => (
                            <MaidCard
                              key={maid.id}
                              maid={maid}
                              onClick={() => handleMaidClick(maid.id)}
                              selected={selectedMaidId === maid.id}
                              compact
                            />
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selected Details Panel - Shows at bottom on all screen sizes, hidden in landscape to save space */}
      {(selectedCustomer || selectedMaid) && !isLandscape && !desktopFloatingMode && (
        <div className="border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Selected Customer Details */}
            {selectedCustomer && (
              <Card variant="outlined">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>👤</span>
                      <span>顾客详情</span>
                    </div>
                    {/* Close button for mobile */}
                    <button
                      onClick={() => dispatch({ type: 'SELECT_CUSTOMER', customerId: null })}
                      className="lg:hidden touch-target flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      aria-label="关闭详情"
                    >
                      <span className="text-gray-400">✕</span>
                    </button>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <CustomerCard
                      customer={selectedCustomer}
                      selected
                      comboMultiplier={serviceComboMultiplier}
                    />
                    <CustomerDetailPanel customer={selectedCustomer} />
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Selected Maid Details */}
            {selectedMaid && (
              <Card variant="outlined">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>👧</span>
                      <span>女仆详情</span>
                    </div>
                    {/* Close button for mobile */}
                    <button
                      onClick={() => dispatch({ type: 'SELECT_MAID', maidId: null })}
                      className="lg:hidden touch-target flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      aria-label="关闭详情"
                    >
                      <span className="text-gray-400">✕</span>
                    </button>
                  </div>
                </CardHeader>
                <CardBody>
                  <MaidDetailPanel
                    maid={selectedMaid}
                    onRoleChange={handleRoleChange}
                    onToggleRest={handleToggleRest}
                  />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CafeView;
