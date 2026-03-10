import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'player';

export interface Season {
  id: string;
  name: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  currentItemKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyMission {
  id: string;
  dateKey: string;
  questionId: string;
  storyEpisodeId: string;
  baseXp: number;
  bonusCorrectXp: number;
  bonusStreakXp: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryEpisode {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAnswer {
  missionId: string;
  dateKey: string;
  selectedIndex: number;
  comment?: string;
  createdAt: string;
}

export interface UserAnswerByDate {
  dateKey: string;
  missionId: string;
  selectedIndex: number;
  comment?: string;
  createdAt: Timestamp;
}

export interface XpLedger {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  refType?: string;
  refId?: string;
  createdAt: string;
}

export interface UserStats {
  userId: string;
  role: UserRole;
  displayName: string;
  photoURL: string;
  totalXp: number;
  streak: number;
  lastAnswerDateKey?: string;
  updatedAt: string;
}

export interface UserArmorItem {
  itemKey: string;
  level: number;
  xp: number;
  updatedAt?: string;
}

export interface ArmorItemProgress {
  id: string;
  userId: string;
  itemKey: string;
  itemName: string;
  tier: number;
  progress: number;
  progressRequired: number;
  unlocked: boolean;
  updatedAt: string;
}

export interface RulesSectionConfig {
  title: string;
  icon?: string;
  paragraphs: string[];
  bullets: string[];
}

export interface GameRulesConfig {
  updatedAt: string | Timestamp;
  sections: RulesSectionConfig[];
}
