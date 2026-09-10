function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getServiceComboMultiplier(streak: number): number {
  const safeStreak = Math.max(0, Math.floor(streak));
  if (safeStreak <= 2) {
    return 1.0;
  }
  if (safeStreak <= 5) {
    return 1.06;
  }
  if (safeStreak <= 9) {
    return 1.12;
  }
  if (safeStreak <= 14) {
    return 1.2;
  }
  return 1.28;
}

export function getServiceComboReputationBonus(streak: number): number {
  const safeStreak = Math.max(0, Math.floor(streak));
  if (safeStreak >= 6) {
    return 1;
  }
  return 0;
}

export function getServiceComboTier(streak: number): number {
  const safeStreak = Math.max(0, Math.floor(streak));
  if (safeStreak >= 15) {
    return 4;
  }
  if (safeStreak >= 10) {
    return 3;
  }
  if (safeStreak >= 6) {
    return 2;
  }
  if (safeStreak >= 3) {
    return 1;
  }
  return 0;
}

export function applyServiceComboToRewards(
  rewards: {
    gold: number;
    tip: number;
    reputation: number;
    maidExperience: number;
  },
  streak: number
) {
  const comboMultiplier = getServiceComboMultiplier(streak);
  const tipMultiplier = 1 + (comboMultiplier - 1) * 1.5;
  return {
    gold: Math.max(0, Math.round(rewards.gold * comboMultiplier)),
    tip: Math.max(0, Math.round(rewards.tip * tipMultiplier)),
    reputation: rewards.reputation + getServiceComboReputationBonus(streak),
    maidExperience: Math.max(0, rewards.maidExperience),
    comboMultiplier: clamp(comboMultiplier, 1, 2),
  };
}
