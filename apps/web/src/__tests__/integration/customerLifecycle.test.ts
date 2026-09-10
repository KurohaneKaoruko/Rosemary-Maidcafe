import { describe, it, expect } from 'vitest';
import { gameReducer } from '@/systems/gameReducer';
import { initialGameState } from '@/data/initialState';
import { Customer, GameState } from '@/types';

describe('Customer Lifecycle Integration Tests', () => {
  it('should advance eating -> paying -> leaving -> removed', () => {
    const customer: Customer = {
      id: 'c1',
      type: 'regular',
      name: 'Test Customer',
      avatar: '👤',
      order: { items: [], totalPrice: 0, preparedItems: [] },
      patience: 100,
      satisfaction: 80,
      status: 'eating',
      arrivalTime: Date.now(),
      seatId: 'seat-1',
      serviceProgress: 100,
      serviceStartTime: Date.now(),
      servingMaidId: 'm1',
    };

    let state: GameState = {
      ...initialGameState,
      isPaused: false,
      isBusinessHours: true,
      customers: [customer],
      runtime: {
        ...initialGameState.runtime,
        customerSpawnMs: 0,
        customerStatusTicks: {
          c1: 1,
        },
      },
    };

    state = gameReducer(state, { type: 'TICK', deltaTime: 0 });
    expect(state.customers[0].status).toBe('paying');

    state = gameReducer(state, { type: 'TICK', deltaTime: 0 });
    expect(state.customers[0].status).toBe('leaving');

    state = gameReducer(state, { type: 'TICK', deltaTime: 0 });
    expect(state.customers.length).toBe(0);
  });
});

