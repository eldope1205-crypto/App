export type UserRole = 'USER' | 'CREATOR' | 'ADMIN' | 'user' | 'creator' | 'admin';
export type UserPlan = 'FREE' | 'CREATOR' | 'PRO' | 'ENTERPRISE' | 'free' | 'creator' | 'pro' | 'studio';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'active' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  full_name?: string;
  role: UserRole;
  points: number;
  plan: UserPlan;
  status?: UserStatus;
  is_active?: number | boolean;
  avatar?: string;
  created_at?: string;
  projects_count?: number;
  assets_count?: number;
}

export interface PointsTransaction {
  id: string;
  amount: number;
  type: 'USAGE' | 'PURCHASE' | 'REFUND' | 'ADMIN_ADJUSTMENT' | 'WELCOME_BONUS';
  feature: string;
  description: string;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  model: string;
  last_message?: string;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface DirectorScene {
  sceneNumber: number;
  title: string;
  duration: number;
  visualPrompt: string;
  narrationScript: string;
  soundEffects: string;
  subtitle: string;
  cameraMotion: string;
}

export interface DirectorPlan {
  title: string;
  logline: string;
  genre: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  totalDuration: number;
  overallVoiceTone: string;
  scenes: DirectorScene[];
  soundtrackPrompt: string;
  recommendedTags: string[];
}

export interface TimelineClip {
  id: string;
  sceneNumber?: number;
  title?: string;
  visualPrompt?: string;
  narrationScript?: string;
  start: number;
  duration: number;
  type: 'video' | 'image' | 'audio' | 'text';
  mediaUrl?: string;
  volume?: number;
  muted?: boolean;
  speed?: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitles';
  clips: TimelineClip[];
}

export interface ProjectData {
  tracks: TimelineTrack[];
  directorPlan?: DirectorPlan;
  settings: {
    aspectRatio: '9:16' | '16:9' | '1:1';
    duration: number;
    fps: number;
  };
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  aspect_ratio: '9:16' | '16:9' | '1:1';
  duration: number;
  thumbnail?: string;
  data?: ProjectData;
  created_at: string;
  updated_at: string;
}

export interface LibraryAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'export';
  url: string;
  size: number;
  mime_type?: string;
  aspect_ratio?: string;
  duration?: number;
  created_at: string;
}

export interface ViralKit {
  topic: string;
  platform: 'tiktok' | 'shorts' | 'reels' | 'youtube';
  hooks: string[];
  fullScript: string;
  titles: string[];
  description: string;
  hashtags: string[];
  callToAction: string;
  visualTips: string;
}

export interface ApiStatusSummary {
  gemini: { configured: boolean; model: string; label: string };
  veo: { configured: boolean; model: string; label: string };
  elevenlabs: { configured: boolean; label: string };
  runway: { configured: boolean; label: string };
  openai: { configured: boolean; label: string };
  stripe: { configured: boolean; label: string };
}

export interface SystemLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  metadata?: string;
  created_at: string;
}
