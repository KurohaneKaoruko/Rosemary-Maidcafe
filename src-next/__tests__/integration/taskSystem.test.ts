import { describe, it, expect } from 'vitest';
import { gameReducer } from '@/systems/gameReducer';
import { initialGameState } from '@/data/initialState';
import { GameState, Task } from '@/types';

describe('Task System Integration Tests', () => {
  it('should claim task reward and mark claimed', () => {
    const completedTask: Task = {
      id: 'test_task',
      name: 'Test',
      description: 'Test',
      type: 'daily',
      condition: { type: 'serve_customers', target: 1 },
      reward: { gold: 123, reputation: 2 },
      progress: 1,
      completed: true,
      claimed: false,
      dayAssigned: 1,
    };

    const state: GameState = {
      ...initialGameState,
      tasks: [completedTask],
    };

    const next = gameReducer(state, { type: 'CLAIM_TASK_REWARD', taskId: 'test_task' });
    expect(next.finance.gold).toBe(state.finance.gold + 123);
    expect(next.reputation).toBe(state.reputation + 2);
    expect(next.tasks[0].claimed).toBe(true);
    expect(next.notifications.length).toBe(state.notifications.length + 1);
  });
});

