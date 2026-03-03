'use client';

import React, { useMemo } from 'react';
import { useGame } from '@/components/game/GameProvider';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Task } from '@/types';

export function TaskPanel() {
  const { state, dispatch } = useGame();
  const { tasks } = state;

  const growthTasks = useMemo(
    () => tasks.filter((task) => task.type === 'growth'),
    [tasks]
  );
  const completedCount = growthTasks.filter((task) => task.completed).length;
  const totalCount = growthTasks.length;

  const claim = (taskId: string) => {
    dispatch({ type: 'CLAIM_TASK_REWARD', taskId });
  };

  return (
    <div className="min-h-full flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">🎯 成长任务</h2>
        <div className="text-sm text-gray-500">
          已完成 {completedCount} / {totalCount}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="text-4xl">🌱</div>
            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-1">成长进度</div>
              {totalCount > 0 ? (
                <ProgressBar value={completedCount} max={totalCount} color="pink" size="lg" showLabel />
              ) : (
                <div className="text-sm text-gray-500">当前没有可用的成长任务</div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        <TaskSection title="🌱 成长任务" tasks={growthTasks} onClaim={claim} />
      </div>
    </div>
  );
}

function TaskSection({ title, tasks, onClaim }: { title: string; tasks: Task[]; onClaim: (taskId: string) => void }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClaim={onClaim} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function TaskCard({ task, onClaim }: { task: Task; onClaim: (taskId: string) => void }) {
  const canClaim = task.completed && !task.claimed;
  const progressLabel = `${task.progress} / ${task.condition.target}`;

  return (
    <div
      className={`
        p-4 rounded-xl border transition-all
        ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">{task.name}</div>
          <div className="text-sm text-gray-600 mt-1">{task.description}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-medium text-yellow-600">💰 {task.reward.gold}</div>
          <div className="text-xs text-purple-600">⭐ +{task.reward.reputation}</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <ProgressBar
          value={task.progress}
          max={task.condition.target}
          color={task.completed ? 'green' : 'pink'}
          size="md"
          showLabel
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">{progressLabel}</div>
          {task.claimed ? (
            <span className="text-xs font-medium text-gray-400">已领取</span>
          ) : (
            <Button
              size="sm"
              variant={canClaim ? 'primary' : 'secondary'}
              disabled={!canClaim}
              onClick={() => onClaim(task.id)}
            >
              {canClaim ? '领取奖励' : task.completed ? '可领取' : '未完成'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskPanel;
