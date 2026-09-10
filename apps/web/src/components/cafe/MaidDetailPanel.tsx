'use client';

import { Maid, MaidRole, MaidPersonality } from '@/types';
import { MaidAvatar } from '@/components/ui/MaidAvatar';
import { calculateEfficiency } from '@/systems/maidSystem';

interface MaidDetailPanelProps {
  maid: Maid;
  onRoleChange: (maidId: string, role: MaidRole) => void;
  onToggleRest: (maidId: string) => void;
}

const roleLabels: Record<MaidRole, string> = {
  greeter: '迎宾',
  server: '服务员',
  barista: '咖啡师',
  entertainer: '表演者',
};

const roleIcons: Record<MaidRole, string> = {
  greeter: '🎀',
  server: '🍽️',
  barista: '☕',
  entertainer: '🎤',
};

const personalityLabels: Record<MaidPersonality, string> = {
  cheerful: '开朗',
  cool: '冷酷',
  shy: '害羞',
  energetic: '活力',
  elegant: '优雅',
};

const personalityEmojis: Record<MaidPersonality, string> = {
  cheerful: '😊',
  cool: '😎',
  shy: '😳',
  energetic: '🤩',
  elegant: '🥰',
};

export function MaidDetailPanel({ maid, onRoleChange, onToggleRest }: MaidDetailPanelProps) {
  const efficiency = calculateEfficiency(maid);
  const isLowStamina = maid.stamina < 20;
  const isWorking = maid.status.isWorking;
  const isResting = maid.status.isResting;

  const availableRoles: MaidRole[] = ['server', 'greeter', 'barista', 'entertainer'];

  return (
    <div className="space-y-3 min-w-0">
      {/* Header: Avatar + Info */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-shrink-0">
          <MaidAvatar src={maid.avatar} name={maid.name} size="lg" />
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
            <span className="text-sm">{personalityEmojis[maid.personality]}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Name Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-800 text-lg">{maid.name}</span>
            <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
              Lv.{maid.level}
            </span>
          </div>
          
          {/* Status Row */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">
              {personalityLabels[maid.personality]}性格
            </span>
            <span className={`text-sm ${isResting ? 'text-gray-400' : 'text-pink-500'}`}>
              {isResting ? '💤 休息中' : `${roleIcons[maid.role]} ${roleLabels[maid.role]}`}
            </span>
          </div>

          {/* Bars */}
          <div className="mt-3 space-y-2">
            <ProgressRow 
              label="体力" 
              value={maid.stamina} 
              color="bg-gradient-to-r from-green-400 to-green-500"
              warning={isLowStamina}
            />
            <ProgressRow 
              label="心情" 
              value={maid.mood} 
              color="bg-gradient-to-r from-pink-400 to-pink-500"
            />
            <ProgressRow 
              label="经验" 
              value={(maid.experience / (maid.level * 100)) * 100} 
              color="bg-gradient-to-r from-purple-400 to-purple-500"
              showValue={`${maid.experience}/${maid.level * 100}`}
            />
          </div>
        </div>
      </div>

      {/* Stats: Compact 2-row grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
        <StatBadge icon="💕" label="魅力" value={maid.stats.charm} />
        <StatBadge icon="⭐" label="技能" value={maid.stats.skill} />
        <StatBadge icon="💪" label="体质" value={maid.stats.stamina} />
        <StatBadge icon="⚡" label="速度" value={maid.stats.speed} />
        <StatBadge 
          icon={isLowStamina ? "⚠️" : "📊"} 
          label="效率" 
          value={Math.round(efficiency)} 
          suffix="%" 
          warning={isLowStamina}
        />
        <StatBadge 
          icon={maid.mood >= 80 ? '😊' : maid.mood >= 50 ? '😐' : '😢'} 
          label="心情" 
          value={Math.round(maid.mood)} 
          suffix="%" 
        />
      </div>

      {/* Role Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">职位分配</span>
          {isWorking && (
            <span className="text-xs text-amber-500">⚠️ 工作中</span>
          )}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2">
          {availableRoles.map(role => (
            <button
              key={role}
              onClick={() => onRoleChange(maid.id, role)}
              disabled={isWorking || isResting}
              className={`
                py-2 rounded-lg transition-all text-center
                ${maid.role === role && !isResting
                  ? 'bg-pink-500 text-white shadow-sm' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                }
                ${(isWorking || isResting) ? 'opacity-40 cursor-not-allowed' : ''}
              `}
            >
              <div className="text-base">{roleIcons[role]}</div>
              <div className="text-xs mt-0.5">{roleLabels[role]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Rest Button */}
      <button
        onClick={() => onToggleRest(maid.id)}
        disabled={isWorking}
        className={`
          w-full py-2.5 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2
          ${isResting 
            ? 'bg-green-500 text-white hover:bg-green-600' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
          }
          ${isWorking ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        <span>{isResting ? '🌟' : '💤'}</span>
        <span>{isResting ? '结束休息' : '安排休息'}</span>
      </button>
    </div>
  );
}

// Compact Progress Row
function ProgressRow({ 
  label, 
  value, 
  color, 
  warning = false,
  showValue 
}: { 
  label: string; 
  value: number; 
  color: string;
  warning?: boolean;
  showValue?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`w-9 shrink-0 text-xs ${warning ? 'text-red-500' : 'text-gray-400'}`}>{label}</span>
      <div className="min-w-0 flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`w-14 shrink-0 truncate text-right text-xs ${warning ? 'text-red-500' : 'text-gray-400'}`}>
        {showValue || `${Math.round(value)}%`}
      </span>
    </div>
  );
}

// Compact Stat Badge
function StatBadge({ 
  icon, 
  label, 
  value, 
  suffix = '',
  warning = false
}: { 
  icon: string; 
  label: string; 
  value: number;
  suffix?: string;
  warning?: boolean;
}) {
  return (
    <div className={`text-center py-1.5 px-1 rounded-lg ${warning ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className="text-sm">{icon}</div>
      <div className={`text-xs font-bold ${warning ? 'text-red-600' : 'text-gray-700'}`}>
        {value}{suffix}
      </div>
    </div>
  );
}

export default MaidDetailPanel;
