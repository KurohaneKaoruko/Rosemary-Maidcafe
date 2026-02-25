/**
 * Integration Tests for Storage System
 * Tests save/load functionality, migration compatibility, and data validation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSave,
  exportSave,
  generateChecksum,
  getInitialState,
  getSaveInfo,
  hasSave,
  loadGame,
  saveGame,
  validateSaveData,
} from '@/utils/storage';
import { GAME_CONSTANTS, initialGameState } from '@/data/initialState';
import { GameState } from '@/types';

describe('Storage System Integration Tests', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};

    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Force web fallback path in tests.
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = undefined;
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Checksum Generation', () => {
    it('should generate consistent checksum for same state', () => {
      const checksum1 = generateChecksum(initialGameState);
      const checksum2 = generateChecksum(initialGameState);

      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksum for different states', () => {
      const modifiedState: GameState = {
        ...initialGameState,
        day: 10,
      };

      const checksum1 = generateChecksum(initialGameState);
      const checksum2 = generateChecksum(modifiedState);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('Save and Load', () => {
    it('should save game successfully', async () => {
      const result = await saveGame(initialGameState);

      expect(result.success).toBe(true);
      expect(Object.keys(mockStorage).length).toBeGreaterThan(0);
    });

    it('should load saved game successfully', async () => {
      await saveGame(initialGameState);
      const result = await loadGame();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.day).toBe(initialGameState.day);
    });

    it('should return error when no save exists', async () => {
      const result = await loadGame();

      expect(result.success).toBe(false);
      expect(result.error).toContain('没有找到存档');
    });

    it('should preserve key game state fields after save/load', async () => {
      const modifiedState: GameState = {
        ...initialGameState,
        day: 15,
        finance: {
          ...initialGameState.finance,
          gold: 5000,
          dailyRevenue: 300,
        },
        reputation: 75,
        statistics: {
          ...initialGameState.statistics,
          totalCustomersServed: 50,
          totalRevenue: 2500,
        },
      };

      await saveGame(modifiedState);
      const result = await loadGame();

      expect(result.success).toBe(true);
      expect(result.data?.day).toBe(15);
      expect(result.data?.finance.gold).toBe(5000);
      expect(result.data?.reputation).toBe(75);
      expect(result.data?.statistics.totalCustomersServed).toBe(50);
    });
  });

  describe('Save Data Validation', () => {
    it('should validate correct legacy save data', () => {
      const saveData = {
        version: GAME_CONSTANTS.SAVE_VERSION,
        timestamp: Date.now(),
        gameState: initialGameState,
        checksum: generateChecksum(initialGameState),
      };

      const result = validateSaveData(saveData);

      expect(result.success).toBe(true);
    });

    it('should reject save data with invalid checksum', () => {
      const saveData = {
        version: GAME_CONSTANTS.SAVE_VERSION,
        timestamp: Date.now(),
        gameState: initialGameState,
        checksum: 'invalid-checksum',
      };

      const result = validateSaveData(saveData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('校验和');
    });
  });

  describe('Export/Import policy', () => {
    it('should disable export', () => {
      const result = exportSave(initialGameState);

      expect(result.success).toBe(false);
      expect(result.error).toContain('禁用');
    });
  });

  describe('Utility Functions', () => {
    it('should delete save', async () => {
      await saveGame(initialGameState);
      expect(Object.keys(mockStorage).length).toBeGreaterThan(0);

      const result = await deleteSave();

      expect(result.success).toBe(true);
      expect(Object.keys(mockStorage).length).toBe(0);
    });

    it('should check if save exists', async () => {
      expect(await hasSave()).toBe(false);

      await saveGame(initialGameState);

      expect(await hasSave()).toBe(true);
    });

    it('should get save info', async () => {
      await saveGame(initialGameState);

      const result = await getSaveInfo();

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe(GAME_CONSTANTS.SAVE_VERSION);
      expect(result.data?.day).toBe(initialGameState.day);
    });

    it('should return initial state', () => {
      const state = getInitialState();

      expect(state.day).toBe(initialGameState.day);
      expect(state.finance.gold).toBe(initialGameState.finance.gold);
    });
  });

  describe('Edge Cases', () => {
    it('should handle corrupted legacy JSON in localStorage', async () => {
      mockStorage[GAME_CONSTANTS.SAVE_KEY] = 'not valid json';

      const result = await loadGame();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing gameState in legacy save data', async () => {
      const invalidSave = {
        version: GAME_CONSTANTS.SAVE_VERSION,
        timestamp: Date.now(),
        checksum: 'some-checksum',
      };
      mockStorage[GAME_CONSTANTS.SAVE_KEY] = JSON.stringify(invalidSave);

      const result = await loadGame();

      expect(result.success).toBe(false);
    });
  });
});
