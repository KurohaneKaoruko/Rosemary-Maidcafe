'use client';

import React, { useMemo } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { Button } from '@/components/ui/Button';
import { calculateEfficiency } from '@/systems/maidSystem';
import { Customer, CustomerStatus, CustomerType, MenuItem } from '@/types';

const customerTypeLabels: Record<CustomerType, string> = {
  regular: '普通',
  vip: 'VIP',
  critic: '评论家',
  group: '团体',
};

const customerStatusLabels: Record<CustomerStatus, string> = {
  waiting_seat: '等待入座',
  seated: '已入座',
  ordering: '点餐中',
  waiting_order: '等待上餐',
  eating: '用餐中',
  paying: '结账中',
  leaving: '离开中',
};

export function CustomerDetailPanel({ customer }: { customer: Customer }) {
  const { state, dispatch } = useGame();

  const menuById = useMemo(() => {
    const map = new Map<string, MenuItem>();
    state.menuItems.forEach(item => map.set(item.id, item));
    return map;
  }, [state.menuItems]);

  const orderLines = useMemo(() => {
    return customer.order.items.map(line => {
      const item = menuById.get(line.menuItemId);
      return {
        id: line.menuItemId,
        name: item?.name ?? line.menuItemId,
        quantity: line.quantity,
      };
    });
  }, [customer.order.items, menuById]);

  const availableMaids = useMemo(() => {
    return state.maids
      .filter(m => !m.status.isResting && !m.status.isWorking && m.status.servingCustomerId === null && m.stamina >= 10)
      .sort((a, b) => calculateEfficiency(b) - calculateEfficiency(a));
  }, [state.maids]);

  const canServeNow = customer.status === 'seated' && availableMaids.length > 0;

  return (
    <div className="space-y-4 min-w-0">
      <div className="rounded-xl border border-pink-100 bg-white/90 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="shrink-0 text-3xl leading-none">{customer.avatar}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-800">{customer.name}</div>
            <div className="truncate text-xs text-gray-500">
              {customerTypeLabels[customer.type]} · {customerStatusLabels[customer.status]}
            </div>
          </div>
          <span className="ml-auto shrink-0 whitespace-nowrap text-xs font-medium text-pink-600">
            满意度 {Math.round(customer.satisfaction)}%
          </span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3">
        <div className="text-sm text-gray-600">订单内容</div>
        {orderLines.length === 0 ? (
          <div className="text-sm text-gray-400 mt-2">暂无订单</div>
        ) : (
          <div className="mt-2 space-y-1 text-sm">
            {orderLines.map(line => (
              <div key={line.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-gray-700 truncate">{line.name}</span>
                <span className="text-gray-500">×{line.quantity}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-gray-500">合计</span>
              <span className="font-semibold text-pink-600">¥{customer.order.totalPrice}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <Button
          variant={canServeNow ? 'primary' : 'secondary'}
          disabled={!canServeNow}
          className="w-full"
          onClick={() => {
            if (!canServeNow) return;
            const maid = availableMaids[0];
            dispatch({ type: 'START_SERVICE', maidId: maid.id, customerId: customer.id });
          }}
        >
          {availableMaids.length === 0 ? '暂无空闲女仆' : customer.status === 'seated' ? '立即安排服务' : '当前不可服务'}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => dispatch({ type: 'SELECT_CUSTOMER', customerId: null })}
        >
          取消选择
        </Button>
      </div>
    </div>
  );
}

export default CustomerDetailPanel;

