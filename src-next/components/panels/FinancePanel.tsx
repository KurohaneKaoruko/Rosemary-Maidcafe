'use client';

import React from 'react';
import { DailyFinance } from '@/types';
import { useGame } from '@/components/game/GameProvider';
import { Card, CardHeader, CardBody, StatCard } from '@/components/ui/Card';
import { calculateDailyOperatingCost } from '@/systems/financeSystem';

export function FinancePanel() {
  const { state } = useGame();
  const { finance, day, maids, facility } = state;

  const dailyOperatingCost = calculateDailyOperatingCost(maids, facility);
  const rent = 100 * facility.cafeLevel;
  const utilities = 50 + facility.maxSeats * 5;
  const dailyWages = maids.reduce((total, maid) => total + 30 + (maid.level - 1) * 5, 0);
  const equipmentMaintenance = facility.equipment.reduce((total, eq) => total + eq.level * 5, 0);

  const todayExpenses = finance.dailyExpenses + dailyOperatingCost;
  const todayProfit = finance.dailyRevenue - todayExpenses;

  // Normalize history for charting: keep latest record per day, then sort by day.
  const historyByDay = new Map<number, DailyFinance>();
  for (const entry of finance.history) {
    if (!Number.isFinite(entry.day)) {
      continue;
    }
    historyByDay.set(entry.day, entry);
  }
  const normalizedHistory = [...historyByDay.values()].sort((a, b) => a.day - b.day);
  const recentHistory = normalizedHistory.slice(-7);
  const totalRevenue = recentHistory.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = recentHistory.reduce((sum, d) => sum + d.expenses, 0);
  const totalProfit = recentHistory.reduce((sum, d) => sum + d.profit, 0);

  // Only use visible historical points for scaling, avoid mixing in current-day partial values.
  const maxValue = recentHistory.length > 0
    ? Math.max(...recentHistory.map((d) => Math.max(d.revenue, d.expenses)), 1)
    : 1;

  return (
    <div className="min-h-full flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">💰 财务管理</h2>
        <div className="text-sm text-gray-500">第 {day} 天</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="当前金币"
          value={`💰 ${finance.gold}`}
          icon={<span className="text-xl">🏦</span>}
        />
        <StatCard
          label="今日收入"
          value={`+${finance.dailyRevenue}`}
          icon={<span className="text-xl">📈</span>}
          trend="up"
        />
        <StatCard
          label="今日支出"
          value={`-${todayExpenses}`}
          icon={<span className="text-xl">📉</span>}
          trend="down"
        />
        <StatCard
          label="今日利润"
          value={todayProfit >= 0 ? `+${todayProfit}` : `${todayProfit}`}
          icon={<span className="text-xl">💵</span>}
          trend={todayProfit >= 0 ? 'up' : 'down'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        <Card>
          <CardHeader>7天收支趋势</CardHeader>
          <CardBody>
            {recentHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <p>还没有历史数据</p>
                <p className="text-sm">完成第一天营业后将显示数据</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-48 flex items-end gap-2">
                  {recentHistory.map((dayData, index) => (
                    <DayBar
                      key={`${dayData.day}-${index}`}
                      data={dayData}
                      maxValue={maxValue}
                      isLatest={index === recentHistory.length - 1}
                    />
                  ))}
                </div>

                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    <span className="text-gray-600">收入</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span className="text-gray-600">支出</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">总收入</div>
                    <div className="font-bold text-green-600">+{totalRevenue}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">总支出</div>
                    <div className="font-bold text-red-600">-{totalExpenses}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">总利润</div>
                    <div className={`font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalProfit >= 0 ? '+' : ''}{totalProfit}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>收支明细</CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">今日明细</h4>
                <div className="space-y-2">
                  <ExpenseItem
                    label="顾客消费"
                    amount={finance.dailyRevenue}
                    type="income"
                    icon="🍽️"
                  />
                  <ExpenseItem
                    label="女仆工资"
                    amount={dailyWages}
                    type="expense"
                    icon="👧"
                    note={`${maids.length} 名女仆（含等级加成）`}
                  />
                  <ExpenseItem
                    label="租金"
                    amount={rent}
                    type="expense"
                    icon="🏠"
                    note={`Lv.${facility.cafeLevel} × 100`}
                  />
                  <ExpenseItem
                    label="水电费"
                    amount={utilities}
                    type="expense"
                    icon="💡"
                    note={`${facility.maxSeats} 座 × 5 + 50`}
                  />
                  <ExpenseItem
                    label="设备维护"
                    amount={equipmentMaintenance}
                    type="expense"
                    icon="🔧"
                  />
                  <ExpenseItem
                    label="其他支出"
                    amount={finance.dailyExpenses}
                    type="expense"
                    icon="📦"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100" />

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">每日固定开支</h4>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-600">每日总开支</span>
                    <span className="text-red-600">-{dailyOperatingCost}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-pink-50 rounded-xl">
                <div className="text-sm font-medium text-pink-700 mb-1">💡 经营小贴士</div>
                <div className="text-xs text-pink-600">
                  {todayProfit < 0
                    ? '今日亏损！考虑提高菜品价格或减少开支。'
                    : todayProfit < 100
                    ? '利润较低，尝试吸引更多顾客或提升服务质量。'
                    : '经营状况良好！继续保持！'}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {recentHistory.length > 0 && (
        <Card>
          <CardHeader>历史记录</CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500">日期</th>
                    <th className="text-right py-2 px-3 text-gray-500">收入</th>
                    <th className="text-right py-2 px-3 text-gray-500">支出</th>
                    <th className="text-right py-2 px-3 text-gray-500">利润</th>
                  </tr>
                </thead>
                <tbody>
                  {[...recentHistory].reverse().map((dayData, index) => (
                    <tr key={`${dayData.day}-${index}`} className="border-b border-gray-50">
                      <td className="py-2 px-3 text-gray-800">第 {dayData.day} 天</td>
                      <td className="py-2 px-3 text-right text-green-600">+{dayData.revenue}</td>
                      <td className="py-2 px-3 text-right text-red-600">-{dayData.expenses}</td>
                      <td className={`py-2 px-3 text-right font-medium ${dayData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dayData.profit >= 0 ? '+' : ''}{dayData.profit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

interface DayBarProps {
  data: DailyFinance;
  maxValue: number;
  isLatest: boolean;
}

function DayBar({ data, maxValue, isLatest }: DayBarProps) {
  const safeMaxValue = maxValue > 0 ? maxValue : 1;
  const revenueHeight = Math.max(0, Math.min(100, (data.revenue / safeMaxValue) * 100));
  const expenseHeight = Math.max(0, Math.min(100, (data.expenses / safeMaxValue) * 100));

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="flex-1 w-full flex items-end gap-1">
        <div
          className={`flex-1 rounded-t transition-all duration-300 ${isLatest ? 'bg-green-500' : 'bg-green-400'}`}
          style={{ height: `${revenueHeight}%`, minHeight: data.revenue > 0 ? '4px' : '0px' }}
          title={`收入: ${data.revenue}`}
        />
        <div
          className={`flex-1 rounded-t transition-all duration-300 ${isLatest ? 'bg-red-500' : 'bg-red-400'}`}
          style={{ height: `${expenseHeight}%`, minHeight: data.expenses > 0 ? '4px' : '0px' }}
          title={`支出: ${data.expenses}`}
        />
      </div>
      <div className={`text-xs mt-1 ${isLatest ? 'font-bold text-pink-600' : 'text-gray-500'}`}>{data.day}</div>
    </div>
  );
}

interface ExpenseItemProps {
  label: string;
  amount: number;
  type: 'income' | 'expense';
  icon: string;
  note?: string;
}

function ExpenseItem({ label, amount, type, icon, note }: ExpenseItemProps) {
  if (amount === 0) return null;

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-gray-700">{label}</span>
        {note && <span className="text-xs text-gray-500">({note})</span>}
      </div>
      <span className={`font-medium ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
        {type === 'income' ? '+' : '-'}{amount}
      </span>
    </div>
  );
}

export default FinancePanel;
