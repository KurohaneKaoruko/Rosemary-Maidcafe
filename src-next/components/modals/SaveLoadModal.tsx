'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { GameState } from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { deleteSave, getSaveInfo, saveGame, StorageResult } from '@/utils/storage';
import { formatDay, formatTimestamp } from '@/utils/formatters';

type TabType = 'save' | 'new';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onNewGame: () => void;
}

interface SaveInfoState {
  version: string;
  timestamp: number;
  day: number;
}

export function SaveLoadModal({
  isOpen,
  onClose,
  gameState,
  onNewGame,
}: SaveLoadModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('save');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveInfo, setSaveInfo] = useState<StorageResult<SaveInfoState>>({
    success: false,
    error: '没有找到存档',
  });

  const refreshSaveInfo = useCallback(async () => {
    const info = await getSaveInfo();
    setSaveInfo(info);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void refreshSaveInfo();
  }, [isOpen, refreshSaveInfo]);

  const clearMessage = () => setMessage(null);

  const handleSave = async () => {
    setIsLoading(true);
    const result = await saveGame(gameState);
    setIsLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: '游戏已保存到本机安全存档。' });
      await refreshSaveInfo();
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' });
    }
  };

  const handleNewGame = () => {
    setShowNewGameConfirm(true);
  };

  const confirmNewGame = async () => {
    await deleteSave();
    onNewGame();
    setShowNewGameConfirm(false);
    onClose();
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'save', label: '保存', icon: '💾' },
    { id: 'new', label: '新游戏', icon: '🆕' },
  ];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="💾 存档管理"
        size="lg"
      >
        <div className="flex border-b border-gray-100 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                clearMessage();
              }}
              className={`
                flex-1 py-2 px-4 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`
            p-3 rounded-xl mb-4 text-sm
            ${message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
            }
          `}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        <div className="min-h-[220px]">
          {activeTab === 'save' && (
            <SaveTab
              gameState={gameState}
              saveInfo={saveInfo}
              isLoading={isLoading}
              onSave={handleSave}
            />
          )}
          {activeTab === 'new' && (
            <NewGameTab onNewGame={handleNewGame} />
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showNewGameConfirm}
        onClose={() => setShowNewGameConfirm(false)}
        onConfirm={() => void confirmNewGame()}
        title="确认开始新游戏"
        message="开始新游戏将删除当前本机存档，此操作无法撤销。确定要继续吗？"
        confirmText="确认"
        cancelText="取消"
        variant="danger"
      />
    </>
  );
}

interface SaveTabProps {
  gameState: GameState;
  saveInfo: StorageResult<SaveInfoState>;
  isLoading: boolean;
  onSave: () => void;
}

function SaveTab({ gameState, saveInfo, isLoading, onSave }: SaveTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          当前游戏进度
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">天数:</span>
            <span className="ml-2 font-medium">{formatDay(gameState.day)}</span>
          </div>
          <div>
            <span className="text-gray-500">金币:</span>
            <span className="ml-2 font-medium">💰 {gameState.finance.gold.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">女仆数:</span>
            <span className="ml-2 font-medium">{gameState.maids.length} 名</span>
          </div>
          <div>
            <span className="text-gray-500">声望:</span>
            <span className="ml-2 font-medium">⭐ {gameState.reputation}</span>
          </div>
        </div>
      </div>

      {saveInfo.success && saveInfo.data && (
        <div className="bg-blue-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-blue-700 mb-2">
            上次保存
          </h4>
          <div className="text-sm text-blue-600">
            <div>时间: {formatTimestamp(saveInfo.data.timestamp)}</div>
            <div>进度: {formatDay(saveInfo.data.day)}</div>
            <div>版本: {saveInfo.data.version}</div>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 rounded-xl p-4 text-sm text-yellow-700">
        当前版本仅支持本机本地存档，已禁用导入/导出与跨设备传档。
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={onSave}
        isLoading={isLoading}
        className="w-full"
      >
        💾 保存游戏
      </Button>

      <p className="text-xs text-gray-500 text-center">
        游戏会自动保存，你也可以手动保存以确保进度安全
      </p>
    </div>
  );
}

interface NewGameTabProps {
  onNewGame: () => void;
}

function NewGameTab({ onNewGame }: NewGameTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-red-700 mb-2">
          ⚠️ 警告
        </h4>
        <p className="text-sm text-red-600">
          开始新游戏将删除所有当前进度，包括女仆、金币、成就等。此操作无法撤销。
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          新游戏
        </h4>
        <p className="text-sm text-gray-500">
          从头开始体验全新的咖啡厅经营旅程。
        </p>
      </div>

      <Button
        variant="danger"
        size="lg"
        onClick={onNewGame}
        className="w-full"
      >
        🆕 开始新游戏
      </Button>
    </div>
  );
}

export default SaveLoadModal;
