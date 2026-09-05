import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'grey_ia_data') : path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

const DB_PATH = path.join(DATA_DIR, 'grey_ia.db');

if (IS_VERCEL) {
  const seedDbPath = path.join(process.cwd(), 'data', 'grey_ia.db');
  if (fs.existsSync(seedDbPath) && !fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(seedDbPath, DB_PATH);
    } catch (err) {
      console.warn('Could not copy seed database to /tmp:', err);
    }
  }
}

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for high concurrency and resilience
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'USER',
    points INTEGER NOT NULL DEFAULT 250,
    plan TEXT NOT NULL DEFAULT 'FREE',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    verified INTEGER NOT NULL DEFAULT 1,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS points_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    feature TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    aspect_ratio TEXT NOT NULL DEFAULT '9:16',
    duration INTEGER NOT NULL DEFAULT 15,
    data TEXT NOT NULL,
    thumbnail TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS library_assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    aspect_ratio TEXT,
    duration REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    progress INTEGER NOT NULL DEFAULT 0,
    input_payload TEXT NOT NULL,
    result_payload TEXT,
    error_message TEXT,
    points_cost INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    plan TEXT NOT NULL DEFAULT 'CREATOR',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    current_period_start TEXT NOT NULL,
    current_period_end TEXT NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'eur',
    status TEXT NOT NULL DEFAULT 'SUCCEEDED',
    points_credited INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL DEFAULT 'INFO',
    category TEXT NOT NULL DEFAULT 'GENERAL',
    message TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS content_pages (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    aspect_ratio TEXT NOT NULL DEFAULT '9:16',
    data TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS points_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    points INTEGER NOT NULL,
    price INTEGER NOT NULL,
    bonus_points INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_popular INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS plans_config (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    price_monthly INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    points_monthly INTEGER NOT NULL,
    max_resolution TEXT NOT NULL DEFAULT '1080p',
    features TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

// Password utilities
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

// System logging helper
export function logSystem(level: 'INFO' | 'WARN' | 'ERROR', category: string, message: string, metadata?: Record<string, unknown>) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO system_logs (id, level, category, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, level, category, message, metadata ? JSON.stringify(metadata) : null, now);
  } catch (err) {
    console.error('Failed to write system log:', err);
  }
}

// Audit logging helper
export function logAudit(
  userId: string | null,
  userEmail: string,
  role: string,
  action: string,
  resource: string,
  details?: Record<string, unknown> | string,
  ipAddress?: string
) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_email, role, action, resource, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      userId,
      userEmail,
      role,
      action,
      resource,
      typeof details === 'object' ? JSON.stringify(details) : details || null,
      ipAddress || '127.0.0.1',
      now
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// System setting helpers
export function getSystemSetting<T>(key: string, defaultValue: T): T {
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as any;
    if (!row) return defaultValue;
    return JSON.parse(row.value) as T;
  } catch {
    return defaultValue;
  }
}

export function setSystemSetting(key: string, value: any, category: string, updatedBy?: string) {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO system_settings (key, value, category, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `).run(key, JSON.stringify(value), category, now, updatedBy || 'system');
  } catch (err) {
    console.error(`Failed to set system setting ${key}:`, err);
  }
}

// Initialize seed data for admin, plans, packages, tools and content if empty
export function initializeAdminSeedData() {
  try {
    // 1. Initial General Settings
    if (!getSystemSetting('general', null)) {
      setSystemSetting('general', {
        platform_name: 'GREY IA',
        tagline: 'Plataforma definitiva de producción multimedia con Inteligencia Artificial',
        welcome_points: 12560,
        default_language: 'es',
        timezone: 'Europe/Madrid',
        currency: 'EUR',
        currency_symbol: '€',
        date_format: 'DD/MM/YYYY',
        max_upload_mb: 50,
      }, 'general');
    }

    // 2. Maintenance Mode
    if (!getSystemSetting('maintenance', null)) {
      setSystemSetting('maintenance', {
        enabled: false,
        message: 'GREY IA se encuentra en mantenimiento programado para actualización de infraestructura. Volveremos pronto.',
        allowed_roles: ['OWNER', 'SUPER_ADMIN', 'ADMIN'],
      }, 'system');
    }

    // 3. Feature Flags
    if (!getSystemSetting('feature_flags', null)) {
      setSystemSetting('feature_flags', {
        chat: true,
        director: true,
        image: true,
        video: true,
        audio: true,
        editor_video: true,
        editor_image: true,
        viral: true,
        templates: true,
        library: true,
        payments: true,
      }, 'features');
    }

    // 4. Tools Config
    if (!getSystemSetting('tools_config', null)) {
      setSystemSetting('tools_config', [
        { id: 'chat', name: 'Chat IA', enabled: true, points_cost: 5, provider: 'gemini', model: 'gemini-3.8-flash', priority: 1 },
        { id: 'director', name: 'Director IA', enabled: true, points_cost: 30, provider: 'gemini', model: 'gemini-3.8-flash', priority: 1 },
        { id: 'image', name: 'Imagen IA', enabled: true, points_cost: 25, provider: 'gemini', model: 'imagen-3.0-generate-002', priority: 1 },
        { id: 'video', name: 'Vídeo IA', enabled: true, points_cost: 80, provider: 'veo', model: 'veo-3.1-lite-generate-preview', priority: 1 },
        { id: 'audio', name: 'Audio IA', enabled: true, points_cost: 15, provider: 'gemini', model: 'gemini-3.8-flash', priority: 1 },
        { id: 'editor_video', name: 'Editor IA', enabled: true, points_cost: 10, provider: 'local', model: 'native', priority: 1 },
        { id: 'templates', name: 'Plantillas', enabled: true, points_cost: 0, provider: 'local', model: 'native', priority: 1 },
        { id: 'viral', name: 'Creador Viral', enabled: true, points_cost: 20, provider: 'gemini', model: 'gemini-3.8-flash', priority: 1 },
      ], 'ai');
    }

    // 5. AI Providers & Fallback
    if (!getSystemSetting('ai_providers', null)) {
      setSystemSetting('ai_providers', {
        fallback_enabled: true,
        chain: ['gemini', 'veo', 'runway', 'elevenlabs', 'openai'],
        gemini: { enabled: true, priority: 1, model: 'gemini-3.8-flash', temperature: 0.7, max_tokens: 4096 },
        veo: { enabled: true, priority: 2, model: 'veo-3.1-lite-generate-preview', max_duration: 10 },
        runway: { enabled: false, priority: 3, model: 'gen-3-alpha', max_duration: 10 },
        elevenlabs: { enabled: false, priority: 4, voice: 'Rachel', stability: 0.75 },
        openai: { enabled: false, priority: 5, model: 'gpt-4o', temperature: 0.7 },
      }, 'ai');
    }

    // 6. Visual Design Configuration & Draft
    const defaultDesign = {
      platform_title: 'GREY IA',
      tagline: 'Tu herramienta definitiva de Inteligencia Artificial',
      hero_title: '¡Hola, Alex! 👋',
      hero_subtitle: '¿Qué vamos a crear hoy?',
      announcement_banner: '',
      banner_active: false,
      footer_text: 'GREY IA — Plataforma Autónoma de Producción Audiovisual con Inteligencia Artificial.',
      login_header: 'Bienvenido al Núcleo',
      login_subtitle: 'Inicia sesión para acceder a tus proyectos y motores de IA',
      status: 'published',
    };
    if (!getSystemSetting('design_published', null)) {
      setSystemSetting('design_published', defaultDesign, 'design');
    }
    if (!getSystemSetting('design_draft', null)) {
      setSystemSetting('design_draft', defaultDesign, 'design');
    }

    // 7. Seed Plans if table is empty
    const planCount = (db.prepare('SELECT COUNT(*) as count FROM plans_config').get() as any).count;
    if (planCount === 0) {
      const defaultPlans = [
        { id: 'plan-free', name: 'Free', code: 'FREE', price: 0, points: 250, res: '720p', features: 'Acceso a Chat IA, Director IA básico, 250 créditos iniciales, exportación estándar', order: 1 },
        { id: 'plan-starter', name: 'Starter', code: 'STARTER', price: 12, points: 2500, res: '1080p', features: 'Chat IA ilimitado, 2.500 créditos/mes, vídeos en 1080p, sin marcas de agua', order: 2 },
        { id: 'plan-creator', name: 'Creator', code: 'CREATOR', price: 29, points: 8000, res: '1080p 60fps', features: '8.000 créditos/mes, modelos prioritarios Veo & Runway, exportación ultra rápida', order: 3 },
        { id: 'plan-pro', name: 'Pro', code: 'PRO', price: 59, points: 20000, res: '4K Ultra HD', features: '20.000 créditos/mes, voces clonadas ElevenLabs, soporte 24/7 dedicado, API access', order: 4 },
        { id: 'plan-ultra', name: 'Ultra', code: 'ULTRA', price: 129, points: 50000, res: '4K HDR Cinema', features: '50.000 créditos/mes, procesamiento ultra-prioritario, render ilimitado, SLA garantizado', order: 5 },
      ];
      for (const p of defaultPlans) {
        db.prepare(`
          INSERT OR IGNORE INTO plans_config (id, name, code, price_monthly, points_monthly, max_resolution, features, is_active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(p.id, p.name, p.code, p.price, p.points, p.res, p.features, p.order);
      }
    }

    // 8. Seed Points Packages if empty
    const packageCount = (db.prepare('SELECT COUNT(*) as count FROM points_packages').get() as any).count;
    if (packageCount === 0) {
      const defaultPackages = [
        { id: 'pkg-1', name: 'Paquete Impulso', points: 1000, price: 9, bonus: 100, popular: 0, order: 1 },
        { id: 'pkg-2', name: 'Paquete Producción', points: 5000, price: 39, bonus: 800, popular: 1, order: 2 },
        { id: 'pkg-3', name: 'Paquete Estudio', points: 15000, price: 99, bonus: 3500, popular: 0, order: 3 },
        { id: 'pkg-4', name: 'Paquete Enterprise', points: 40000, price: 229, bonus: 12000, popular: 0, order: 4 },
      ];
      for (const pkg of defaultPackages) {
        db.prepare(`
          INSERT OR IGNORE INTO points_packages (id, name, points, price, bonus_points, is_active, is_popular, sort_order)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(pkg.id, pkg.name, pkg.points, pkg.price, pkg.bonus, pkg.popular, pkg.order);
      }
    }

    // 9. Seed Templates if empty
    const templateCount = (db.prepare('SELECT COUNT(*) as count FROM templates').get() as any).count;
    if (templateCount === 0) {
      const defaultTemplates = [
        { id: 'tmpl-1', title: 'Vídeo TikTok IA Futuro', category: 'TikTok / Reels', desc: 'Plantilla de alto impacto para creadores con estilo cyberpunk futurista', thumb: '/uploads/project_astronaut_neon.jpg', ratio: '9:16' },
        { id: 'tmpl-2', title: 'Guion YouTube Viajes', category: 'YouTube', desc: 'Estructura cinematográfica para vlogs de viaje y expediciones', thumb: '/uploads/project_mountains.jpg', ratio: '16:9' },
        { id: 'tmpl-3', title: 'Campaña Anuncio Tech', category: 'Publicidad', desc: 'Spot publicitario de alta conversión para productos tecnológicos y apps', thumb: '/uploads/project_tech_city.jpg', ratio: '16:9' },
        { id: 'tmpl-4', title: 'Podcast Narrativo Pro', category: 'Audio / Podcast', desc: 'Intro y ambientación sonora para podcasts y audiolibros', thumb: '/uploads/project_mic_podcast.jpg', ratio: '16:9' },
      ];
      const now = new Date().toISOString();
      for (const t of defaultTemplates) {
        db.prepare(`
          INSERT OR IGNORE INTO templates (id, title, category, description, thumbnail, aspect_ratio, data, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, '{}', 1, ?, ?)
        `).run(t.id, t.title, t.category, t.desc, t.thumb, t.ratio, now, now);
      }
    }

    // 10. Seed Content Pages if empty
    const contentCount = (db.prepare('SELECT COUNT(*) as count FROM content_pages').get() as any).count;
    if (contentCount === 0) {
      const now = new Date().toISOString();
      const defaultPages = [
        { slug: 'terms', title: 'Términos y Condiciones del Servicio', content: '# Términos y Condiciones de GREY IA\n\nEl acceso y uso de la plataforma GREY IA implica la aceptación plena de las presentes condiciones de servicio...' },
        { slug: 'privacy', title: 'Política de Privacidad y Protección de Datos', content: '# Política de Privacidad\n\nEn GREY IA garantizamos la privacidad de tus creaciones, contenidos generados y credenciales de usuario...' },
        { slug: 'faq', title: 'Preguntas Frecuentes (FAQ)', content: '### ¿Cómo se calculan los créditos de generación?\nCada motor de IA consume créditos en función del tipo de renderizado y duración...\n\n### ¿Puedo utilizar los vídeos para fines comerciales?\nSí, con los planes Creator, Pro y Ultra tienes plenos derechos comerciales...' },
        { slug: 'announcement', title: 'Aviso del Sistema', content: 'Nueva versión GREY IA v2.4 Enterprise activa. Motores de IA Google Gemini y Veo conectados.' },
      ];
      for (const page of defaultPages) {
        db.prepare(`
          INSERT OR IGNORE INTO content_pages (id, slug, title, content, is_published, updated_at, updated_by)
          VALUES (?, ?, ?, ?, 1, ?, 'system')
        `).run(crypto.randomUUID(), page.slug, page.title, page.content, now);
      }
    }
  } catch (err) {
    console.error('Failed to initialize admin seed data:', err);
  }
}

// Call on module load
initializeAdminSeedData();

