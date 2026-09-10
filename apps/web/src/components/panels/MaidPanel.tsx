'use client';

import { useState, useEffect } from 'react';
import { Maid, MaidRole, MaidPersonality } from '@/types';
import { useGame } from '@/components/game/GameProvider';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MaidAvatar } from '@/components/ui/MaidAvatar';
import { StaminaBar, MoodBar, ExperienceBar } from '@/components/ui/ProgressBar';
import { BottomDrawer } from '@/components/ui/BottomDrawer';
import { generateRandomMaid, getMaxMaids, getExperienceForLevel } from '@/systems/maidSystem';
import { personalityDescriptions, hireCostByLevel } from '@/data/maidNames';
import { getAllUsedImages } from '@/data/maidImages';

const roleLabels: Record<MaidRole, string> = {
  greeter: '迎宾',
  server: '服务员',
  barista: '咖啡师',
  entertainer: '表演者',
};

const roleIcons: Record<MaidRole, string> = {
  greeter: '👋',
  server: '🍽️',
  barista: '☕',
  entertainer: '🎭',
};

const roleColors: Record<MaidRole, string> = {
  greeter: 'bg-pink-100 text-pink-700 border-pink-300',
  server: 'bg-blue-100 text-blue-700 border-blue-300',
  barista: 'bg-amber-100 text-amber-700 border-amber-300',
  entertainer: 'bg-purple-100 text-purple-700 border-purple-300',
};

const personalityEmojis: Record<MaidPersonality, string> = {
  cheerful: '😊',
  cool: '😎',
  shy: '😳',
  energetic: '⚡',
  elegant: '✨',
};

const personalityLabels: Record<MaidPersonality, string> = {
  cheerful: '开朗',
  cool: '冷静',
  shy: '害羞',
  energetic: '活力',
  elegant: '优雅',
};

export function MaidPanel() {
  const { state, dispatch } = useGame();
  const [selectedMaid, setSelectedMaid] = useState<Maid | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [candidates, setCandidates] = useState<Maid[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const maxMaids = getMaxMaids(state.facility.cafeLevel);
  const canHireMore = state.maids.length < maxMaids;
  const hireCost = hireCostByLevel[0]; // Base hire cost

  const handleSelectMaid = (maid: Maid) => {
    setSelectedMaid(maid);
    dispatch({ type: 'SELECT_MAID', maidId: maid.id });
    // On mobile, show the bottom drawer when selecting a maid
    if (isMobile) {
      setShowMobileDetail(true);
    }
  };

  const handleCloseMobileDetail = () => {
    setShowMobileDetail(false);
  };

  const handleAssignRole = (maidId: string, role: MaidRole) => {
    dispatch({ type: 'ASSIGN_ROLE', maidId, role });
    if (selectedMaid && selectedMaid.id === maidId) {
      setSelectedMaid({ ...selectedMaid, role });
    }
  };

  const handleOpenHireModal = () => {
    // Generate 3 random candidates with unique images
    const usedImages = getAllUsedImages(state.maids);
    const newCandidates: Maid[] = [];
    const candidateImages: string[] = [...usedImages];
    
    for (let i = 0; i < 3; i++) {
      const candidate = generateRandomMaid(candidateImages);
      newCandidates.push(candidate);
      candidateImages.push(candidate.avatar);
    }
    
    setCandidates(newCandidates);
    setShowHireModal(true);
  };

  const handleHireMaid = (maid: Maid) => {
    if (state.finance.gold >= hireCost) {
      dispatch({ type: 'HIRE_MAID', maid });
      dispatch({ type: 'DEDUCT_GOLD', amount: hireCost });
      dispatch({
        type: 'UPDATE_STATISTICS',
        updates: { maidsHired: state.statistics.maidsHired + 1 },
      });
      setShowHireModal(false);
    }
  };

  const handleFireMaid = (maidId: string) => {
    dispatch({ type: 'FIRE_MAID', maidId });
    if (selectedMaid?.id === maidId) {
      setSelectedMaid(null);
    }
  };

  const handleToggleRest = (maidId: string) => {
    dispatch({ type: 'TOGGLE_MAID_REST', maidId });
  };

  return (
    <div className="min-h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          👧 女仆管理
        </h2>
        <div className="text-sm text-gray-500">
          {state.maids.length} / {maxMaids} 名女仆
        </div>
      </div>

      {/* Hire Button */}
      <Button
        variant="primary"
        onClick={handleOpenHireModal}
        disabled={!canHireMore || state.finance.gold < hireCost}
        className="w-full"
      >
        {canHireMore
          ? `雇佣新女仆 (💰 ${hireCost})`
          : '已达到最大女仆数量'}
      </Button>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Maid List - Full width on mobile, flex-1 on desktop */}
        <div className="flex-1 min-h-0 overflow-auto w-full">
          <Card className="h-full">
            <CardHeader>已雇佣女仆</CardHeader>
            <CardBody>
              {state.maids.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">👧</div>
                  <p>还没有雇佣女仆</p>
                  <p className="text-sm">点击上方按钮雇佣第一位女仆吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {state.maids.map((maid) => (
                    <MaidListItem
                      key={maid.id}
                      maid={maid}
                      selected={selectedMaid?.id === maid.id}
                      onClick={() => handleSelectMaid(maid)}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Maid Details - Desktop only (side panel) */}
        {selectedMaid && !isMobile && (
          <div className="w-full lg:w-80">
            <MaidDetailCard
              maid={state.maids.find((m) => m.id === selectedMaid.id) || selectedMaid}
              onAssignRole={handleAssignRole}
              onFire={handleFireMaid}
              onToggleRest={handleToggleRest}
            />
          </div>
        )}
      </div>

      {/* Maid Details - Mobile only (Bottom Drawer) */}
      {isMobile && selectedMaid && (
        <BottomDrawer
          isOpen={showMobileDetail}
          onClose={handleCloseMobileDetail}
          title={`${selectedMaid.name} 详情`}
          height="auto"
        >
          <MaidDetailCard
            maid={state.maids.find((m) => m.id === selectedMaid.id) || selectedMaid}
            onAssignRole={handleAssignRole}
            onFire={handleFireMaid}
            onToggleRest={handleToggleRest}
            onClose={handleCloseMobileDetail}
            isMobile={true}
          />
        </BottomDrawer>
      )}

      {/* Hire Modal */}
      {showHireModal && (
        <HireMaidModal
          candidates={candidates}
          hireCost={hireCost}
          gold={state.finance.gold}
          onHire={handleHireMaid}
          onClose={() => setShowHireModal(false)}
          onRefresh={handleOpenHireModal}
        />
      )}
    </div>
  );
}


// Maid List Item Component
interface MaidListItemProps {
  maid: Maid;
  selected: boolean;
  onClick: () => void;
}

function MaidListItem({ maid, selected, onClick }: MaidListItemProps) {
  const isLowStamina = maid.stamina < 20;
  const isResting = maid.status.isResting;

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-xl cursor-pointer transition-all duration-200
        border-2
        ${selected
          ? 'border-pink-500 bg-pink-50'
          : 'border-gray-100 hover:border-pink-300'
        }
        ${isResting ? 'opacity-75' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <MaidAvatar src={maid.avatar} name={maid.name} size="md" />
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
            <span className="text-xs">{personalityEmojis[maid.personality]}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800 truncate">
              {maid.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
              Lv.{maid.level}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isResting ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border-gray-300">
                💤 休息中
              </span>
            ) : (
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[maid.role]}`}>
                {roleIcons[maid.role]} {roleLabels[maid.role]}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <StaminaBar value={maid.stamina} size="xs" />
      </div>
      {isLowStamina && !isResting && (
        <div className="mt-1 text-xs text-red-500">⚠️ 体力不足</div>
      )}
    </div>
  );
}

// Maid Detail Card Component
interface MaidDetailCardProps {
  maid: Maid;
  onAssignRole: (maidId: string, role: MaidRole) => void;
  onFire: (maidId: string) => void;
  onToggleRest: (maidId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

function MaidDetailCard({ maid, onAssignRole, onFire, onToggleRest, onClose, isMobile = false }: MaidDetailCardProps) {
  const [showFireConfirm, setShowFireConfirm] = useState(false);
  const expForNextLevel = getExperienceForLevel(maid.level);
  const expProgress = (maid.experience / expForNextLevel) * 100;

  const roles: MaidRole[] = ['greeter', 'server', 'barista', 'entertainer'];
  const isResting = maid.status.isResting;

  const handleFire = (maidId: string) => {
    onFire(maidId);
    // Close the drawer after firing on mobile
    if (isMobile && onClose) {
      onClose();
    }
  };

  // For mobile, render without Card wrapper since it's inside BottomDrawer
  const content = (
    <>
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <MaidAvatar src={maid.avatar} name={maid.name} size="xl" />
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
            <span className="text-lg">{personalityEmojis[maid.personality]}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-800">
              {maid.name}
            </h3>
            <span className="text-sm px-2 py-0.5 rounded bg-purple-100 text-purple-700">
              Lv.{maid.level}
            </span>
            {isResting && (
              <span className="text-sm px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                💤 休息中
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {personalityLabels[maid.personality]}性格 · {roleLabels[maid.role]}
          </div>
        </div>
      </div>

      {/* Personality Description */}
      <div className="text-sm text-gray-500 mb-4 p-2 bg-gray-50 rounded-xl">
        {personalityDescriptions[maid.personality]}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 bg-pink-50 rounded-xl text-center">
          <div className="text-pink-600">💕 魅力</div>
          <div className="text-lg font-bold text-gray-800">
            {maid.stats.charm}
          </div>
        </div>
        <div className="p-2 bg-blue-50 rounded-xl text-center">
          <div className="text-blue-600">⭐ 技能</div>
          <div className="text-lg font-bold text-gray-800">
            {maid.stats.skill}
          </div>
        </div>
        <div className="p-2 bg-green-50 rounded-xl text-center">
          <div className="text-green-600">💪 体质</div>
          <div className="text-lg font-bold text-gray-800">
            {maid.stats.stamina}
          </div>
        </div>
        <div className="p-2 bg-yellow-50 rounded-xl text-center">
          <div className="text-yellow-600">⚡ 速度</div>
          <div className="text-lg font-bold text-gray-800">
            {maid.stats.speed}
          </div>
        </div>
      </div>

      {/* Status Bars */}
      <div className="space-y-2 mb-4">
        <StaminaBar value={maid.stamina} showLabel size="sm" />
        <MoodBar value={maid.mood} showLabel size="sm" />
        <ExperienceBar value={expProgress} showLabel size="sm" />
      </div>

      {/* Role Assignment */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          分配角色
        </div>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => onAssignRole(maid.id, role)}
              disabled={isResting}
              className={`
                px-3 py-1.5 rounded-xl text-sm font-medium
                transition-all duration-200 border touch-target
                ${maid.role === role
                  ? roleColors[role] + ' border-current'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }
                ${isResting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {roleIcons[role]} {roleLabels[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Rest Toggle Button */}
      <div className="mb-4">
        <Button
          variant={isResting ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onToggleRest(maid.id)}
          className="w-full"
        >
          {isResting ? '🔔 结束休息' : '💤 安排休息'}
        </Button>
      </div>

      {/* Fire Button */}
      {!showFireConfirm ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFireConfirm(true)}
          className="w-full text-red-500 hover:bg-red-50"
        >
          解雇女仆
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleFire(maid.id)}
            className="flex-1"
          >
            确认解雇
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFireConfirm(false)}
            className="flex-1"
          >
            取消
          </Button>
        </div>
      )}
    </>
  );

  // On mobile, return content directly (it's inside BottomDrawer)
  if (isMobile) {
    return <div className="pb-4">{content}</div>;
  }

  // On desktop, wrap in Card
  return (
    <Card className="h-full">
      <CardBody>
        {content}
      </CardBody>
    </Card>
  );
}


// Hire Maid Modal Component
interface HireMaidModalProps {
  candidates: Maid[];
  hireCost: number;
  gold: number;
  onHire: (maid: Maid) => void;
  onClose: () => void;
  onRefresh: () => void;
}

function HireMaidModal({
  candidates,
  hireCost,
  gold,
  onHire,
  onClose,
  onRefresh,
}: HireMaidModalProps) {
  const canAfford = gold >= hireCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">
              👧 雇佣新女仆
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-500">
              雇佣费用: 💰 {hireCost}
            </span>
            <span className={`text-sm ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
              当前金币: 💰 {gold}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                maid={candidate}
                canAfford={canAfford}
                onHire={() => onHire(candidate)}
              />
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={onRefresh}>
              🔄 刷新候选人
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Candidate Card Component
interface CandidateCardProps {
  maid: Maid;
  canAfford: boolean;
  onHire: () => void;
}

function CandidateCard({ maid, canAfford, onHire }: CandidateCardProps) {
  return (
    <div className="p-4 border-2 border-gray-100 rounded-2xl hover:border-pink-300 transition-colors">
      {/* Avatar and Name */}
      <div className="flex flex-col items-center mb-3">
        <MaidAvatar src={maid.avatar} name={maid.name} size="xl" className="mb-2" />
        <div className="font-bold text-gray-800">
          {maid.name}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className="text-sm">{personalityEmojis[maid.personality]}</span>
          <span className="text-sm text-gray-500">
            {personalityLabels[maid.personality]}
          </span>
        </div>
      </div>

      {/* Personality Description */}
      <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded-xl text-center">
        {personalityDescriptions[maid.personality]}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="flex items-center justify-between p-1.5 bg-pink-50 rounded-lg">
          <span>💕 魅力</span>
          <span className="font-bold">{maid.stats.charm}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-blue-50 rounded-lg">
          <span>⭐ 技能</span>
          <span className="font-bold">{maid.stats.skill}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-green-50 rounded-lg">
          <span>💪 体质</span>
          <span className="font-bold">{maid.stats.stamina}</span>
        </div>
        <div className="flex items-center justify-between p-1.5 bg-yellow-50 rounded-lg">
          <span>⚡ 速度</span>
          <span className="font-bold">{maid.stats.speed}</span>
        </div>
      </div>

      {/* Hire Button */}
      <Button
        variant="primary"
        size="sm"
        onClick={onHire}
        disabled={!canAfford}
        className="w-full"
      >
        {canAfford ? '雇佣' : '金币不足'}
      </Button>
    </div>
  );
}

export default MaidPanel;
