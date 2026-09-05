export type UserRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'CREATOR' | 'owner' | 'super_admin' | 'admin' | 'user' | 'creator';
export type UserPlan = 'FREE' | 'STARTER' | 'CREATOR' | 'PRO' | 'ULTRA' | 'ENTERPRISE' | 'free' | 'starter' | 'creator' | 'pro' | 'ultra' | 'enterprise';
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
  updated_at?: string;
  projects_count?: number;
  assets_count?: number;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email: string;
  role: string;
  action: string;
  resource: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface PlanConfig {
  id: string;
  name: string;
  code: string;
  price_monthly: number;
  currency: string;
  points_monthly: number;
  max_resolution: string;
  features: string;
  is_active: number;
  sort_order: number;
}

export interface PointsPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  bonus_points: number;
  is_active: number;
  is_popular: number;
  sort_order: number;
}

export interface ToolConfig {
  id: string;
  name: string;
  enabled: boolean;
  points_cost: number;
  provider: string;
  model: string;
  priority: number;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: number;
  updated_at: string;
  updated_by?: string;
}

export interface TemplateItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  thumbnail?: string;
  aspect_ratio: string;
  data: string;
  is_active: number;
  created_at: string;
  updated_at: string;
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
