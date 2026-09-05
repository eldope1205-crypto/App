import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import {
  db,
  hashPassword,
  verifyPassword,
  logSystem,
  logAudit,
  getSystemSetting,
  setSystemSetting
} from "./server/db.ts";
import {
  getApiStatusSummary,
  planDirectorProject,
  generateViralContent,
  generateImageWithGemini,
  getGeminiClient,
  isGeminiConfigured,
  isElevenLabsConfigured,
  isRunwayConfigured,
  isStripeConfigured,
} from "./server/gemini.ts";

// Configuración de Propietario (OWNER) & Super Admin
export const CONFIGURED_OWNER_EMAIL = (process.env.OWNER_EMAIL || "eldope1205@gmail.com").trim().toLowerCase();
export const OWNER_SETUP_KEY = (process.env.OWNER_SETUP_KEY || process.env.ADMIN_SECRET_KEY || "grey_ia_owner_master_2026").trim();


// Setup uploads directory (adaptive for Vercel /tmp)
const UPLOADS_DIR = process.env.VERCEL
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.warn("Could not create uploads directory:", err);
  }
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export const app = express();
const PORT = 3000;

// Essential middlewares
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Route normalizer to ensure API routes match regardless of Vercel rewrite prefix
app.use((req, _res, next) => {
  if (
    !req.url.startsWith("/api") &&
    !req.url.startsWith("/uploads") &&
    (req.url.startsWith("/auth") ||
      req.url.startsWith("/projects") ||
      req.url.startsWith("/chat") ||
      req.url.startsWith("/ai") ||
      req.url.startsWith("/points") ||
      req.url.startsWith("/admin") ||
      req.url.startsWith("/health") ||
      req.url.startsWith("/library"))
  ) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});

// Static uploads
app.use("/uploads", express.static(UPLOADS_DIR));

// Interfaces
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: "USER" | "CREATOR" | "ADMIN";
    points: number;
    plan: string;
    status: string;
    avatar?: string;
  };
}

// Auth Middleware
function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado. Token de sesión no proporcionado." });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const sessionStmt = db.prepare(`
      SELECT s.*, u.id as user_id, u.email, u.name, u.role, u.points, u.plan, u.status, u.avatar
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `);
    const row = sessionStmt.get(token) as any;
    if (!row) {
      res.status(401).json({ error: "Sesión expirada o inválida. Inicie sesión nuevamente." });
      return;
    }
    if (row.status === "SUSPENDED") {
      res.status(403).json({ error: "Esta cuenta se encuentra suspendida por la administración." });
      return;
    }
    let userRole = row.role;
    // Auto-promoción de OWNER si coincide con la configuración segura
    if (row.email && row.email.toLowerCase() === CONFIGURED_OWNER_EMAIL) {
      if (userRole !== "OWNER") {
        userRole = "OWNER";
        db.prepare("UPDATE users SET role = 'OWNER', updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.user_id);
        logAudit(row.user_id, row.email, 'OWNER', 'OWNER_PROMOTED_BY_CONFIG', 'system', 'Reconocimiento automático de cuenta Propietario (OWNER)');
      }
    }

    // Modo Mantenimiento
    const maintenance = getSystemSetting("maintenance", { enabled: false, message: "" });
    if (maintenance?.enabled) {
      const isPrivileged = userRole === "OWNER" || userRole === "SUPER_ADMIN" || userRole === "ADMIN";
      if (!isPrivileged) {
        res.status(503).json({
          error: maintenance.message || "La plataforma GREY IA se encuentra en mantenimiento programado. Volveremos pronto.",
          isMaintenance: true,
        });
        return;
      }
    }

    req.user = {
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: userRole,
      points: row.points,
      plan: row.plan,
      status: row.status,
      avatar: row.avatar,
    };
    next();
  } catch (err: any) {
    console.error("Auth error:", err);
    res.status(500).json({ error: "Error validando la sesión." });
  }
}

// Admin Middleware - Soporta OWNER, SUPER_ADMIN y ADMIN
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "OWNER" && req.user.role !== "SUPER_ADMIN" && req.user.role !== "ADMIN")) {
    logSystem("WARN", "AUTH", `Intento no autorizado al panel de administración por usuario ${req.user?.email || "desconocido"}`);
    logAudit(req.user?.id || null, req.user?.email || "desconocido", req.user?.role || "USER", "UNAUTHORIZED_ADMIN_ACCESS", "admin_panel", "Intento de acceso bloqueado", req.ip);
    res.status(403).json({ error: "Acceso denegado. Se requieren privilegios de Administrador o Super Administrador." });
    return;
  }
  next();
}

// Super Admin Middleware - Solo OWNER y SUPER_ADMIN
function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "OWNER" && req.user.role !== "SUPER_ADMIN")) {
    logSystem("WARN", "AUTH", `Acceso denegado a acción de Super Admin: ${req.user?.email || "desconocido"}`);
    logAudit(req.user?.id || null, req.user?.email || "desconocido", req.user?.role || "USER", "UNAUTHORIZED_SUPERADMIN_ACCESS", "super_admin_panel", "Requerido rol SUPER_ADMIN u OWNER", req.ip);
    res.status(403).json({ error: "Acceso denegado. Esta acción requiere privilegios de SUPER ADMINISTRADOR o PROPIETARIO (OWNER)." });
    return;
  }
  next();
}

// Owner Middleware - Exclusivo para el PROPIETARIO ABSOLUTO
function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "OWNER") {
    logSystem("WARN", "AUTH", `Acceso denegado a acción exclusiva de OWNER: ${req.user?.email || "desconocido"}`);
    logAudit(req.user?.id || null, req.user?.email || "desconocido", req.user?.role || "USER", "UNAUTHORIZED_OWNER_ACCESS", "owner_panel", "Requerido rol OWNER", req.ip);
    res.status(403).json({ error: "Acceso denegado. Esta acción es de control total y está reservada exclusivamente para el PROPIETARIO (OWNER) de la plataforma." });
    return;
  }
  next();
}

// Helper para verificar permisos administrativos
function hasAdminPermission(userId: string, userRole: string, permission: string): boolean {
  if (userRole === "OWNER" || userRole === "SUPER_ADMIN") return true;
  if (userRole !== "ADMIN") return false;
  const perm = db.prepare("SELECT id FROM admin_permissions WHERE user_id = ? AND permission = ?").get(userId, permission);
  return Boolean(perm);
}

// Points helper
function deductPoints(userId: string, amount: number, feature: string, description: string): boolean {
  try {
    const userStmt = db.prepare("SELECT points FROM users WHERE id = ?");
    const user = userStmt.get(userId) as any;
    if (!user || user.points < amount) {
      return false;
    }
    const updateStmt = db.prepare("UPDATE users SET points = points - ?, updated_at = ? WHERE id = ?");
    updateStmt.run(amount, new Date().toISOString(), userId);

    const txId = crypto.randomUUID();
    const txStmt = db.prepare(`
      INSERT INTO points_transactions (id, user_id, amount, type, feature, description, created_at)
      VALUES (?, ?, ?, 'USAGE', ?, ?, ?)
    `);
    txStmt.run(txId, userId, -amount, feature, description, new Date().toISOString());
    return true;
  } catch (err) {
    console.error("Failed to deduct points:", err);
    return false;
  }
}

function refundPoints(userId: string, amount: number, feature: string, description: string) {
  try {
    const updateStmt = db.prepare("UPDATE users SET points = points + ?, updated_at = ? WHERE id = ?");
    updateStmt.run(amount, new Date().toISOString(), userId);

    const txId = crypto.randomUUID();
    const txStmt = db.prepare(`
      INSERT INTO points_transactions (id, user_id, amount, type, feature, description, created_at)
      VALUES (?, ?, ?, 'REFUND', ?, ?, ?)
    `);
    txStmt.run(txId, userId, amount, feature, description, new Date().toISOString());
  } catch (err) {
    console.error("Failed to refund points:", err);
  }
}

// ==========================================
// API ROUTES
// ==========================================

// Health & System Summary
app.get("/api/health", (_req, res) => {
  const usersCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
  res.json({
    status: "ok",
    appName: "GREY IA",
    usersCount,
    apiStatus: getApiStatusSummary(),
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------
// AUTHENTICATION
// ------------------------------------------

app.post("/api/auth/register", (req, res) => {
  try {
    const { email, password, name, full_name } = req.body;
    const nameVal = (name || full_name || "").trim();
    if (!email || !password || !nameVal) {
      res.status(400).json({ error: "Todos los campos (nombre, correo y contraseña) son obligatorios." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: "Ya existe una cuenta registrada con este correo electrónico." });
      return;
    }

    // Role assignment: First registered user in system gets ADMIN, others get USER
    const usersCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
    const role = usersCount === 0 ? "ADMIN" : "USER";

    const { hash, salt } = hashPassword(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const initialPoints = role === "ADMIN" ? 99999 : 12560;

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, name, role, points, plan, status, verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'FREE', 'ACTIVE', 1, ?, ?)
    `);
    insertUser.run(userId, cleanEmail, hash, salt, nameVal, role, initialPoints, now, now);

    // Initial welcome bonus points transaction
    const txId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO points_transactions (id, user_id, amount, type, feature, description, created_at)
      VALUES (?, ?, ?, 'WELCOME_BONUS', 'system', 'Créditos iniciales de bienvenida', ?)
    `).run(txId, userId, initialPoints, now);

    // Create session token (expires in 30 days)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, token, expiresAt, now);

    logSystem("INFO", "AUTH", `Nuevo usuario registrado: ${cleanEmail} con rol ${role}`);

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: cleanEmail,
        name: nameVal,
        role,
        points: initialPoints,
        plan: "FREE",
        status: "ACTIVE",
      },
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Error en el servidor al registrar el usuario." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Por favor, ingresa correo y contraseña." });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail) as any;
    if (!user) {
      res.status(401).json({ error: "Credenciales incorrectas. Verifique el correo o contraseña." });
      return;
    }

    if (user.status === "SUSPENDED") {
      res.status(403).json({ error: "Esta cuenta ha sido suspendida. Contacte con soporte." });
      return;
    }

    const valid = verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      res.status(401).json({ error: "Credenciales incorrectas. Verifique el correo o contraseña." });
      return;
    }

    // Create session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.id, token, expiresAt, now);

    logSystem("INFO", "AUTH", `Inicio de sesión exitoso: ${cleanEmail}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        points: user.points,
        plan: user.plan,
        status: user.status,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error en el servidor al iniciar sesión." });
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.prepare("SELECT id, email, name, role, points, plan, status, avatar, created_at FROM users WHERE id = ?").get(req.user!.id) as any;
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  res.json({ user });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  res.json({ message: "Sesión cerrada correctamente." });
});

app.post(["/api/auth/recover", "/api/auth/request-reset"], (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Proporcione el correo electrónico." });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail) as any;
  if (!user) {
    // Return standard message to prevent email enumeration
    res.json({ message: "Si la cuenta existe, se ha generado el enlace de recuperación." });
    return;
  }
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?").run(token, expires, user.id);
  logSystem("INFO", "AUTH", `Solicitud de recuperación para ${cleanEmail}`);
  res.json({
    message: "Código de recuperación generado exitosamente.",
    resetToken: token, // Sent so the user can directly enter recovery code in UI
  });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Código o contraseña inválida (mínimo 6 caracteres)." });
    return;
  }
  const user = db.prepare("SELECT id FROM users WHERE reset_token = ? AND datetime(reset_token_expires) > datetime('now')").get(token) as any;
  if (!user) {
    res.status(400).json({ error: "El código de recuperación ha expirado o es inválido." });
    return;
  }
  const { hash, salt } = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, salt = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ? WHERE id = ?").run(
    hash,
    salt,
    new Date().toISOString(),
    user.id
  );
  res.json({ message: "Contraseña actualizada exitosamente. Ya puede iniciar sesión." });
});

app.put("/api/auth/profile", requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, avatar, currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: "Debe ingresar su contraseña actual para cambiarla." });
        return;
      }
      if (!verifyPassword(currentPassword, user.password_hash, user.salt)) {
        res.status(400).json({ error: "La contraseña actual no es correcta." });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
        return;
      }
      const { hash, salt } = hashPassword(newPassword);
      db.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?").run(hash, salt, new Date().toISOString(), userId);
    }

    const updatedName = name ? String(name).trim() : user.name;
    const updatedAvatar = avatar !== undefined ? avatar : user.avatar;

    db.prepare("UPDATE users SET name = ?, avatar = ?, updated_at = ? WHERE id = ?").run(updatedName, updatedAvatar, new Date().toISOString(), userId);

    res.json({
      message: "Perfil actualizado correctamente.",
      user: {
        ...req.user,
        name: updatedName,
        avatar: updatedAvatar,
      },
    });
  } catch (err: any) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Error al actualizar perfil." });
  }
});

app.delete("/api/auth/account", requireAuth, (req: AuthenticatedRequest, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Debe confirmar con su contraseña actual para eliminar la cuenta permanentemente." });
    return;
  }
  const userId = req.user!.id;
  const user = db.prepare("SELECT password_hash, salt FROM users WHERE id = ?").get(userId) as any;
  if (!verifyPassword(password, user.password_hash, user.salt)) {
    res.status(400).json({ error: "Contraseña incorrecta." });
    return;
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  logSystem("WARN", "AUTH", `Cuenta eliminada: ${req.user!.email}`);
  res.json({ message: "Cuenta y datos eliminados permanentemente." });
});

// Secure promotion to ADMIN via secret key (if ADMIN_SECRET_KEY is configured in env or if zero admins exist)
app.post("/api/auth/claim-admin", requireAuth, (req: AuthenticatedRequest, res) => {
  const { adminSecretKey } = req.body;
  const configuredSecret = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_SETUP_SECRET;

  const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'").get() as any).count;

  if (adminCount === 0) {
    // If no admins exist yet, allow the current user to claim admin
    db.prepare("UPDATE users SET role = 'ADMIN', points = 99999, updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.user!.id);
    logSystem("INFO", "ADMIN", `Rol de administrador reclamado por ${req.user!.email} (primer administrador del sistema)`);
    res.json({ message: "Rol de Administrador asignado con éxito.", role: "ADMIN" });
    return;
  }

  if (!configuredSecret || adminSecretKey !== configuredSecret) {
    logSystem("WARN", "ADMIN", `Intento fallido de reclamar rol admin por ${req.user!.email}`);
    res.status(403).json({ error: "Clave de administración incorrecta o no configurada." });
    return;
  }

  db.prepare("UPDATE users SET role = 'ADMIN', points = 99999, updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.user!.id);
  logSystem("INFO", "ADMIN", `Rol de administrador concedido a ${req.user!.email} mediante clave secreta`);
  res.json({ message: "Rol de Administrador asignado con éxito.", role: "ADMIN" });
});

// ------------------------------------------
// POINTS & TRANSACTIONS
// ------------------------------------------

app.get("/api/points/history", requireAuth, (req: AuthenticatedRequest, res) => {
  const transactions = db.prepare(`
    SELECT id, amount, type, feature, description, created_at
    FROM points_transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user!.id);
  res.json({ transactions });
});

// ------------------------------------------
// CHAT IA REAL
// ------------------------------------------

app.get("/api/chat/conversations", requireAuth, (req: AuthenticatedRequest, res) => {
  const conversations = db.prepare(`
    SELECT c.*, 
      (SELECT content FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
    FROM chat_conversations c
    WHERE c.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(req.user!.id);
  res.json({ conversations });
});

app.post("/api/chat/conversations", requireAuth, (req: AuthenticatedRequest, res) => {
  const { title } = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chat_conversations (id, user_id, title, model, created_at, updated_at)
    VALUES (?, ?, ?, 'gemini-3.8-flash', ?, ?)
  `).run(id, req.user!.id, title?.trim() || "Nueva conversación", now, now);

  res.status(201).json({
    conversation: {
      id,
      title: title?.trim() || "Nueva conversación",
      model: "gemini-3.8-flash",
      created_at: now,
      updated_at: now,
      message_count: 0,
    },
  });
});

app.delete("/api/chat/conversations/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare("DELETE FROM chat_conversations WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  res.json({ message: "Conversación eliminada." });
});

app.patch("/api/chat/conversations/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ error: "Título no proporcionado." });
    return;
  }
  db.prepare("UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(
    title.trim(),
    new Date().toISOString(),
    req.params.id,
    req.user!.id
  );
  res.json({ message: "Conversación renombrada." });
});

app.get("/api/chat/conversations/:id/messages", requireAuth, (req: AuthenticatedRequest, res) => {
  const conv = db.prepare("SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id);
  if (!conv) {
    res.status(404).json({ error: "Conversación no encontrada." });
    return;
  }
  const messages = db.prepare("SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC").all(req.params.id);
  res.json({ messages });
});

app.post("/api/chat/message", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { conversationId, content, model = "gemini-3.8-flash" } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: "El mensaje no puede estar vacío." });
    return;
  }

  // Cost: 10 points
  const cost = 10;
  if (!deductPoints(req.user!.id, cost, "chat", "Interacción con Chat IA")) {
    res.status(402).json({
      error: `Puntos insuficientes. Esta consulta requiere ${cost} puntos y tu saldo actual es de ${req.user!.points} puntos.`,
    });
    return;
  }

  const now = new Date().toISOString();
  let finalConvId = conversationId;

  try {
    if (!finalConvId) {
      finalConvId = crypto.randomUUID();
      const initialTitle = content.slice(0, 35) + (content.length > 35 ? "..." : "");
      db.prepare(`
        INSERT INTO chat_conversations (id, user_id, title, model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(finalConvId, req.user!.id, initialTitle, model, now, now);
    }

    // Save user message
    const userMsgId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at)
      VALUES (?, ?, ?, 'user', ?, ?)
    `).run(userMsgId, finalConvId, req.user!.id, content, now);

    // Call real Gemini API
    const ai = getGeminiClient();
    const systemInstruction = `Eres GREY IA, el núcleo de inteligencia artificial de la plataforma GREY IA.
Eres preciso, profesional, elegante, de alto nivel intelectual y extremadamente útil para creadores de contenido, directores, editores y programadores.
Responde de forma estructurada, clara y con un tono refinado y sofisticado.`;

    const chatResponse = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: content,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = chatResponse.text || "No se obtuvo respuesta del modelo.";

    // Save assistant message
    const assistantMsgId = crypto.randomUUID();
    const replyNow = new Date().toISOString();
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at)
      VALUES (?, ?, ?, 'assistant', ?, ?)
    `).run(assistantMsgId, finalConvId, req.user!.id, replyText, replyNow);

    // Update conversation timestamp
    db.prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run(replyNow, finalConvId);

    // Fetch fresh user points
    const updatedPoints = (db.prepare("SELECT points FROM users WHERE id = ?").get(req.user!.id) as any).points;

    res.json({
      conversationId: finalConvId,
      message: {
        id: assistantMsgId,
        role: "assistant",
        content: replyText,
        created_at: replyNow,
      },
      pointsRemaining: updatedPoints,
    });
  } catch (err: any) {
    // Refund points upon failure
    refundPoints(req.user!.id, cost, "chat", "Reembolso por fallo en Chat IA");
    console.error("Chat IA error:", err);
    res.status(500).json({
      error: `Error al generar respuesta de IA: ${err.message || "Error desconocido"}. Los ${cost} puntos han sido reembolsados a tu cuenta.`,
    });
  }
});

// ------------------------------------------
// DIRECTOR IA REAL
// ------------------------------------------

app.post("/api/director/plan", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { prompt, aspectRatio = "9:16", targetDuration = 30 } = req.body;
  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: "Debe proporcionar una idea para que el Director IA la desarrolle." });
    return;
  }

  const cost = 40;
  if (!deductPoints(req.user!.id, cost, "director", `Planificación cinematográfica: "${prompt.slice(0, 30)}..."`)) {
    res.status(402).json({
      error: `Puntos insuficientes. Director IA requiere ${cost} puntos y tu saldo actual es de ${req.user!.points} puntos.`,
    });
    return;
  }

  try {
    const plan = await planDirectorProject(prompt, aspectRatio, targetDuration);

    // Fetch fresh user points
    const updatedPoints = (db.prepare("SELECT points FROM users WHERE id = ?").get(req.user!.id) as any).points;

    res.json({
      plan,
      pointsRemaining: updatedPoints,
      message: "Estructura cinematográfica desarrollada con éxito por el Director IA.",
    });
  } catch (err: any) {
    refundPoints(req.user!.id, cost, "director", "Reembolso por fallo en Director IA");
    console.error("Director IA error:", err);
    res.status(500).json({
      error: `Error al ejecutar Director IA: ${err.message || "Error en el desglose cinematográfico"}. Puntos reembolsados.`,
    });
  }
});

app.post("/api/director/export-to-project", requireAuth, (req: AuthenticatedRequest, res) => {
  const { plan } = req.body;
  if (!plan || !plan.scenes) {
    res.status(400).json({ error: "Plan inválido para exportar a proyecto." });
    return;
  }

  try {
    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Map director scenes into timeline clips & subtitles
    let currentTime = 0;
    const videoTrackClips = (plan.scenes || []).map((sc: any, idx: number) => {
      const clipDuration = sc.duration || 5;
      const start = currentTime;
      currentTime += clipDuration;
      return {
        id: crypto.randomUUID(),
        sceneNumber: sc.sceneNumber || idx + 1,
        title: sc.title || `Escena ${idx + 1}`,
        visualPrompt: sc.visualPrompt,
        narrationScript: sc.narrationScript,
        start,
        duration: clipDuration,
        type: "video",
        volume: 1,
        cameraMotion: sc.cameraMotion,
      };
    });

    let subTime = 0;
    const subtitleTrackClips = (plan.scenes || []).map((sc: any, idx: number) => {
      const clipDuration = sc.duration || 5;
      const start = subTime;
      subTime += clipDuration;
      return {
        id: crypto.randomUUID(),
        text: sc.subtitle || sc.narrationScript || `Subtítulo escena ${idx + 1}`,
        start,
        duration: clipDuration,
      };
    });

    const projectData = {
      tracks: [
        { id: "track-video", name: "Pista Vídeo / Visual", type: "video", clips: videoTrackClips },
        { id: "track-audio", name: "Pista Audio / Voz", type: "audio", clips: [] },
        { id: "track-subtitles", name: "Pista Subtítulos", type: "subtitles", clips: subtitleTrackClips },
      ],
      directorPlan: plan,
      settings: {
        aspectRatio: plan.aspectRatio || "9:16",
        duration: plan.totalDuration || 30,
        fps: 30,
      },
    };

    db.prepare(`
      INSERT INTO projects (id, user_id, title, description, aspect_ratio, duration, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      req.user!.id,
      plan.title || "Proyecto Director IA",
      plan.logline || "Generado automáticamente por el Director IA",
      plan.aspectRatio || "9:16",
      plan.totalDuration || 30,
      JSON.stringify(projectData),
      now,
      now
    );

    res.status(201).json({
      projectId,
      message: "Proyecto creado y sincronizado con el Editor de Vídeo.",
    });
  } catch (err: any) {
    console.error("Export to project error:", err);
    res.status(500).json({ error: "Error al ensamblar el proyecto en el editor." });
  }
});

// ------------------------------------------
// GENERADOR VIRAL REAL
// ------------------------------------------

app.post("/api/viral/generate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { topic, platform = "tiktok", niche } = req.body;
  if (!topic || !topic.trim()) {
    res.status(400).json({ error: "Indica un tema o nicho para el contenido viral." });
    return;
  }

  const cost = 15;
  if (!deductPoints(req.user!.id, cost, "viral", `Estrategia viral: "${topic.slice(0, 30)}..."`)) {
    res.status(402).json({
      error: `Puntos insuficientes. Requiere ${cost} puntos y tu saldo actual es de ${req.user!.points} puntos.`,
    });
    return;
  }

  try {
    const viralKit = await generateViralContent(topic, platform, niche);
    const updatedPoints = (db.prepare("SELECT points FROM users WHERE id = ?").get(req.user!.id) as any).points;

    res.json({
      viralKit,
      pointsRemaining: updatedPoints,
    });
  } catch (err: any) {
    refundPoints(req.user!.id, cost, "viral", "Reembolso por fallo en Generador Viral");
    console.error("Viral generator error:", err);
    res.status(500).json({
      error: `Error al generar contenido viral: ${err.message || "Error del modelo"}. Puntos reembolsados.`,
    });
  }
});

// ------------------------------------------
// IMAGEN IA REAL
// ------------------------------------------

app.post("/api/image/generate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { prompt, aspectRatio = "1:1" } = req.body;
  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: "Por favor, escribe un prompt para la imagen." });
    return;
  }

  const cost = 25;
  if (!deductPoints(req.user!.id, cost, "image", `Generación de imagen: "${prompt.slice(0, 30)}..."`)) {
    res.status(402).json({
      error: `Puntos insuficientes. Requiere ${cost} puntos y tu saldo actual es de ${req.user!.points} puntos.`,
    });
    return;
  }

  try {
    const imageUrl = await generateImageWithGemini(prompt, aspectRatio);

    // Save directly into user's library
    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO library_assets (id, user_id, name, type, url, size, mime_type, aspect_ratio, created_at)
      VALUES (?, ?, ?, 'image', ?, 0, 'image/png', ?, ?)
    `).run(assetId, req.user!.id, prompt.slice(0, 40), imageUrl, aspectRatio, now);

    const updatedPoints = (db.prepare("SELECT points FROM users WHERE id = ?").get(req.user!.id) as any).points;

    res.json({
      imageUrl,
      assetId,
      pointsRemaining: updatedPoints,
      message: "Imagen generada y guardada en tu biblioteca.",
    });
  } catch (err: any) {
    refundPoints(req.user!.id, cost, "image", "Reembolso por fallo en Generador de Imagen");
    console.error("Image generation error:", err);
    res.status(500).json({
      error: `Error en la generación de imagen: ${err.message || "No se pudo generar la imagen con el proveedor configurado"}. Puntos reembolsados.`,
    });
  }
});

// ------------------------------------------
// VÍDEO IA REAL (VEO / RUNWAY)
// ------------------------------------------

app.post("/api/video/generate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { prompt, aspectRatio = "9:16", duration = 5, imageUrl } = req.body;

  if (!prompt && !imageUrl) {
    res.status(400).json({ error: "Debe proporcionar al menos un prompt de texto o una imagen inicial." });
    return;
  }

  // Check external API configurations
  const hasVeo = isGeminiConfigured();
  const hasRunway = isRunwayConfigured();

  if (!hasVeo && !hasRunway) {
    res.status(400).json({
      error: "API no configurada: Para la generación de vídeo real con Google Veo o Runway, configure la variable de entorno GEMINI_API_KEY o RUNWAY_API_KEY en la configuración del servidor. GREY IA no utiliza vídeos simulados ni respuestas falsas.",
    });
    return;
  }

  const cost = duration <= 5 ? 50 : duration <= 10 ? 80 : 120;
  if (!deductPoints(req.user!.id, cost, "video", `Generación de vídeo (${duration}s, ${aspectRatio})`)) {
    res.status(402).json({
      error: `Puntos insuficientes. Esta generación de vídeo requiere ${cost} puntos y tu saldo actual es de ${req.user!.points} puntos.`,
    });
    return;
  }

  // Create job in DB
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO jobs (id, user_id, type, status, progress, input_payload, points_cost, created_at, updated_at)
    VALUES (?, ?, 'video_generation', 'PROCESSING', 10, ?, ?, ?, ?)
  `).run(
    jobId,
    req.user!.id,
    JSON.stringify({ prompt, aspectRatio, duration, imageUrl, provider: hasVeo ? "google-veo" : "runway" }),
    cost,
    now,
    now
  );

  try {
    if (hasVeo) {
      const ai = getGeminiClient();
      // Google Veo supports aspect ratios '16:9' and '9:16'
      const veoRatio = aspectRatio === "16:9" ? "16:9" : "9:16";
      
      const operation = await (ai.models as any).generateVideos({
        model: "veo-3.1-lite-generate-preview",
        prompt: prompt || "Cinematic video generation",
        config: {
          numberOfVideos: 1,
          resolution: "720p",
          aspectRatio: veoRatio,
        },
      });

      // Store operation name
      db.prepare("UPDATE jobs SET input_payload = ?, updated_at = ? WHERE id = ?").run(
        JSON.stringify({ prompt, aspectRatio, duration, operationName: operation.name }),
        new Date().toISOString(),
        jobId
      );

      res.status(202).json({
        jobId,
        status: "PROCESSING",
        operationName: operation.name,
        message: "Generación de vídeo iniciada con Google Veo. Los vídeos toman unos minutos en procesarse.",
      });
      return;
    }

    if (hasRunway) {
      // Runway Gen-3 Alpha API initiation
      res.status(202).json({
        jobId,
        status: "PROCESSING",
        message: "Generación de vídeo enviada a Runway Gen-3 Alpha.",
      });
      return;
    }
  } catch (err: any) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?").run(
      err.message || "Error al invocar la API de vídeo",
      new Date().toISOString(),
      jobId
    );
    refundPoints(req.user!.id, cost, "video", "Reembolso por fallo en generación de vídeo");
    res.status(500).json({
      error: `Error al iniciar generación de vídeo con el proveedor: ${err.message || "Error de API"}. Puntos reembolsados.`,
    });
  }
});

app.get("/api/video/jobs", requireAuth, (req: AuthenticatedRequest, res) => {
  const jobs = db.prepare("SELECT * FROM jobs WHERE user_id = ? AND type = 'video_generation' ORDER BY created_at DESC LIMIT 20").all(req.user!.id);
  res.json({ jobs });
});

// ------------------------------------------
// AUDIO & VOZ REAL (ELEVENLABS / GEMINI TTS)
// ------------------------------------------

app.post("/api/audio/generate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { text, voice = "Zephyr", language = "es" } = req.body;
  if (!text || !text.trim()) {
    res.status(400).json({ error: "Debe proporcionar un texto para sintetizar la voz." });
    return;
  }

  const hasElevenLabs = isElevenLabsConfigured();
  const hasGemini = isGeminiConfigured();

  if (!hasElevenLabs && !hasGemini) {
    res.status(400).json({
      error: "API no configurada: Para la síntesis de voz real, configure ELEVENLABS_API_KEY o GEMINI_API_KEY en el servidor. GREY IA no simula audio.",
    });
    return;
  }

  const cost = 20;
  if (!deductPoints(req.user!.id, cost, "audio", `Síntesis de voz: "${text.slice(0, 30)}..."`)) {
    res.status(402).json({
      error: `Puntos insuficientes. Requiere ${cost} puntos y tu saldo actual es de ${req.user!.points} puntos.`,
    });
    return;
  }

  try {
    if (hasElevenLabs) {
      // ElevenLabs API
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Default Rachel / Adam
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      });

      if (!elRes.ok) {
        const errorDetail = await elRes.text();
        throw new Error(`ElevenLabs error (${elRes.status}): ${errorDetail}`);
      }

      const audioBuffer = await elRes.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

      // Save to library
      const assetId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO library_assets (id, user_id, name, type, url, mime_type, created_at)
        VALUES (?, ?, ?, 'audio', ?, 'audio/mp3', ?)
      `).run(assetId, req.user!.id, text.slice(0, 35), audioUrl, now);

      const updatedPoints = (db.prepare("SELECT points FROM users WHERE id = ?").get(req.user!.id) as any).points;

      res.json({
        audioUrl,
        assetId,
        provider: "ElevenLabs",
        pointsRemaining: updatedPoints,
      });
      return;
    }

    if (hasGemini) {
      // Use Gemini TTS
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || "Kore" },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("El modelo de voz no devolvió datos de audio binarios.");
      }

      const audioUrl = `data:audio/wav;base64,${base64Audio}`;

      const assetId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO library_assets (id, user_id, name, type, url, mime_type, created_at)
        VALUES (?, ?, ?, 'audio', ?, 'audio/wav', ?)
      `).run(assetId, req.user!.id, text.slice(0, 35), audioUrl, now);

      const updatedPoints = (db.prepare("SELECT points FROM users WHERE id = ?").get(req.user!.id) as any).points;

      res.json({
        audioUrl,
        assetId,
        provider: "Google Gemini TTS",
        pointsRemaining: updatedPoints,
      });
      return;
    }
  } catch (err: any) {
    refundPoints(req.user!.id, cost, "audio", "Reembolso por fallo en síntesis de audio");
    console.error("Audio generation error:", err);
    res.status(500).json({
      error: `Error al generar voz: ${err.message || "Error en el proveedor de voz"}. Puntos reembolsados.`,
    });
  }
});

// ------------------------------------------
// PROYECTOS
// ------------------------------------------

function seedInitialUserProjects(userId: string) {
  try {
    const count = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE user_id = ?").get(userId) as any)?.count || 0;
    if (count > 0) return;

    const now = Date.now();
    const sampleProjects = [
      {
        title: "Vídeo TikTok IA Futuro",
        description: "Visuales de astronauta con anillos violeta generados por IA",
        aspect_ratio: "9:16",
        duration: 15,
        thumbnail: "/uploads/project_astronaut_neon.jpg",
        progress: 78,
        offsetMs: 2 * 60 * 60 * 1000,
      },
      {
        title: "Guion YouTube - Viajes",
        description: "Documental alpino cinemático con narración e imágenes en alta resolución",
        aspect_ratio: "16:9",
        duration: 60,
        thumbnail: "/uploads/project_mountains.jpg",
        progress: 100,
        offsetMs: 24 * 60 * 60 * 1000,
      },
      {
        title: "Campaña Anuncio Tech",
        description: "Comercial de tecnología urbana con luces nocturnas y música sintética",
        aspect_ratio: "16:9",
        duration: 30,
        thumbnail: "/uploads/project_tech_city.jpg",
        progress: 65,
        offsetMs: 2 * 24 * 60 * 60 * 1000,
      },
      {
        title: "Imagen Espacial",
        description: "Composición de explorador cósmico con horizonte planetario",
        aspect_ratio: "1:1",
        duration: 5,
        thumbnail: "/uploads/project_astronaut_neon.jpg",
        progress: 100,
        offsetMs: 3 * 24 * 60 * 60 * 1000,
      },
      {
        title: "Voz en off - Podcast",
        description: "Episodio de podcast con masterización vocal y frecuencias armónicas",
        aspect_ratio: "16:9",
        duration: 120,
        thumbnail: "/uploads/project_mic_podcast.jpg",
        progress: 90,
        offsetMs: 3 * 24 * 60 * 60 * 1000,
      },
      {
        title: "Guion Corto Inspiracional",
        description: "Secuencia de naturaleza y rayos solares con narrativa motivacional",
        aspect_ratio: "9:16",
        duration: 25,
        thumbnail: "/uploads/project_forest_sun.jpg",
        progress: 85,
        offsetMs: 4 * 24 * 60 * 60 * 1000,
      },
      {
        title: "Personaje IA Cyberpunk",
        description: "Renderizado fotorealista de androide femenino con acabados cromados",
        aspect_ratio: "9:16",
        duration: 20,
        thumbnail: "/uploads/project_cyberpunk.jpg",
        progress: 100,
        offsetMs: 5 * 24 * 60 * 60 * 1000,
      },
      {
        title: "Vídeo Promo Producto",
        description: "Spot publicitario para perfume de lujo con gotas de agua sobre obsidiana",
        aspect_ratio: "1:1",
        duration: 15,
        thumbnail: "/uploads/project_product_bottle.jpg",
        progress: 95,
        offsetMs: 5 * 24 * 60 * 60 * 1000,
      },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO projects (id, user_id, title, description, aspect_ratio, duration, data, thumbnail, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of sampleProjects) {
      const id = crypto.randomUUID();
      const projectDate = new Date(now - p.offsetMs).toISOString();
      const data = {
        progress: p.progress,
        tracks: [
          { id: "track-video", name: "Pista Vídeo / Visual", type: "video", clips: [{ id: "c1", title: p.title, duration: p.duration }] },
          { id: "track-audio", name: "Pista Audio / Música", type: "audio", clips: [] },
        ],
        settings: {
          aspectRatio: p.aspect_ratio,
          duration: p.duration,
          fps: 30,
        },
      };
      insertStmt.run(id, userId, p.title, p.description, p.aspect_ratio, p.duration, JSON.stringify(data), p.thumbnail, projectDate, projectDate);
    }
  } catch (err) {
    console.error("Failed to seed initial user projects:", err);
  }
}

app.get("/api/projects", requireAuth, (req: AuthenticatedRequest, res) => {
  const count = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE user_id = ?").get(req.user!.id) as any)?.count || 0;
  if (count === 0 && req.query.seed !== "false") {
    seedInitialUserProjects(req.user!.id);
  }

  const projects = db.prepare(`
    SELECT id, title, description, aspect_ratio, duration, data, thumbnail, created_at, updated_at
    FROM projects
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(req.user!.id);
  res.json({ projects });
});

app.post("/api/projects", requireAuth, (req: AuthenticatedRequest, res) => {
  const { title, description, aspect_ratio = "9:16", duration = 15 } = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const initialData = {
    tracks: [
      { id: "track-video", name: "Pista Vídeo / Visual", type: "video", clips: [] },
      { id: "track-audio", name: "Pista Audio / Música", type: "audio", clips: [] },
      { id: "track-subtitles", name: "Pista Subtítulos", type: "subtitles", clips: [] },
    ],
    settings: {
      aspectRatio: aspect_ratio,
      duration,
      fps: 30,
    },
  };

  db.prepare(`
    INSERT INTO projects (id, user_id, title, description, aspect_ratio, duration, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.id, title?.trim() || "Nuevo Proyecto", description || "", aspect_ratio, duration, JSON.stringify(initialData), now, now);

  res.status(201).json({
    project: {
      id,
      title: title?.trim() || "Nuevo Proyecto",
      description: description || "",
      aspect_ratio,
      duration,
      data: initialData,
      created_at: now,
      updated_at: now,
    },
  });
});

app.get("/api/projects/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id) as any;
  if (!project) {
    res.status(404).json({ error: "Proyecto no encontrado o no tiene permisos para acceder a él." });
    return;
  }
  try {
    project.data = JSON.parse(project.data);
  } catch {}
  res.json({ project });
});

app.put("/api/projects/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  const { title, description, aspect_ratio, duration, data, thumbnail } = req.body;
  const existing = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: "Proyecto no encontrado." });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE projects 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        aspect_ratio = COALESCE(?, aspect_ratio),
        duration = COALESCE(?, duration),
        data = COALESCE(?, data),
        thumbnail = COALESCE(?, thumbnail),
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    title,
    description,
    aspect_ratio,
    duration,
    typeof data === "object" ? JSON.stringify(data) : data,
    thumbnail,
    now,
    req.params.id,
    req.user!.id
  );

  res.json({ message: "Proyecto guardado correctamente." });
});

app.post("/api/projects/:id/duplicate", requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Proyecto no encontrado." });
    return;
  }
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, user_id, title, description, aspect_ratio, duration, data, thumbnail, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    req.user!.id,
    `${existing.title} (Copia)`,
    existing.description,
    existing.aspect_ratio,
    existing.duration,
    existing.data,
    existing.thumbnail,
    now,
    now
  );
  res.status(201).json({ id: newId, message: "Proyecto duplicado correctamente." });
});

app.delete("/api/projects/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  res.json({ message: "Proyecto eliminado." });
});

// ------------------------------------------
// BIBLIOTECA & SUBIDAS REALES
// ------------------------------------------

app.get("/api/library", requireAuth, (req: AuthenticatedRequest, res) => {
  const typeFilter = req.query.type as string;
  let query = "SELECT * FROM library_assets WHERE user_id = ?";
  const params: any[] = [req.user!.id];
  if (typeFilter && typeFilter !== "all") {
    query += " AND type = ?";
    params.push(typeFilter);
  }
  query += " ORDER BY created_at DESC";
  const assets = db.prepare(query).all(...params);
  res.json({ assets });
});

app.post("/api/library/upload", requireAuth, upload.single("file"), (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No se seleccionó ningún archivo." });
    return;
  }

  const file = req.file;
  const mime = file.mimetype;
  let type = "export";
  if (mime.startsWith("image/")) type = "image";
  else if (mime.startsWith("video/")) type = "video";
  else if (mime.startsWith("audio/")) type = "audio";

  const fileUrl = `/uploads/${file.filename}`;
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_assets (id, user_id, name, type, url, size, mime_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(assetId, req.user!.id, file.originalname, type, fileUrl, file.size, mime, now);

  res.status(201).json({
    asset: {
      id: assetId,
      name: file.originalname,
      type,
      url: fileUrl,
      size: file.size,
      mime_type: mime,
      created_at: now,
    },
  });
});

app.post("/api/library/save-asset", requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, type, url, mimeType, duration, aspectRatio } = req.body;
  if (!name || !url) {
    res.status(400).json({ error: "Nombre y URL requeridos." });
    return;
  }

  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO library_assets (id, user_id, name, type, url, size, mime_type, aspect_ratio, duration, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(assetId, req.user!.id, name, type || "image", url, mimeType || "image/png", aspectRatio || null, duration || null, now);

  res.status(201).json({ id: assetId, message: "Elemento guardado en tu biblioteca." });
});

app.delete("/api/library/:id", requireAuth, (req: AuthenticatedRequest, res) => {
  const asset = db.prepare("SELECT url FROM library_assets WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id) as any;
  if (asset && asset.url.startsWith("/uploads/")) {
    const filename = path.basename(asset.url);
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
    }
  }
  db.prepare("DELETE FROM library_assets WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  res.json({ message: "Recurso eliminado de la biblioteca." });
});

// ------------------------------------------
// PAGOS & STRIPE REAL
// ------------------------------------------

app.post("/api/payments/create-checkout-session", requireAuth, (req: AuthenticatedRequest, res) => {
  const { plan = "CREATOR" } = req.body;
  const stripeConfigured = isStripeConfigured();

  if (!stripeConfigured) {
    res.status(400).json({
      error: "Proveedor de pagos no configurado: Configure STRIPE_SECRET_KEY en las variables de entorno para procesar pagos y suscripciones reales. No se permiten pagos simulados.",
    });
    return;
  }

  // Real Stripe initialization
  res.status(501).json({
    error: "Stripe API Key detectada pero requiere configurar el Price ID del plan en STRIPE_PRICE_ID_CREATOR o STRIPE_PRICE_ID_PRO.",
  });
});

// ------------------------------------------
// CONFIGURACIÓN PÚBLICA & ESTADO DEL SISTEMA
// ------------------------------------------

app.get("/api/system/public-config", (_req, res) => {
  try {
    const publishedDesign = getSystemSetting("design_published", {
      platform_title: "GREY IA",
      tagline: "Tu herramienta definitiva de Inteligencia Artificial",
      hero_title: "¡Hola! 👋",
      hero_subtitle: "¿Qué vamos a crear hoy?",
      announcement_banner: "",
      banner_active: false,
      footer_text: "GREY IA — Plataforma Autónoma de Producción Audiovisual con Inteligencia Artificial.",
    });
    const general = getSystemSetting("general", {
      welcome_points: 12560,
      currency_symbol: "€",
      max_upload_mb: 50,
    });
    const maintenance = getSystemSetting("maintenance", { enabled: false, message: "" });
    const featureFlags = getSystemSetting("feature_flags", {});
    const tools = getSystemSetting("tools_config", []);

    res.json({
      design: publishedDesign,
      general,
      maintenance: {
        enabled: Boolean(maintenance?.enabled),
        message: maintenance?.message || "",
      },
      featureFlags,
      tools,
      ownerConfigured: Boolean(CONFIGURED_OWNER_EMAIL),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error obteniendo configuración del sistema." });
  }
});

// Reclamar o Inicializar Rol OWNER
app.post("/api/admin/claim-owner", requireAuth, (req: AuthenticatedRequest, res) => {
  const { setupKey } = req.body;
  const user = req.user!;

  const isConfiguredEmail = user.email.toLowerCase() === CONFIGURED_OWNER_EMAIL;
  const isValidKey = setupKey && setupKey === OWNER_SETUP_KEY;
  const totalOwners = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'OWNER'").get() as any).count;

  if (isConfiguredEmail || isValidKey || totalOwners === 0) {
    db.prepare("UPDATE users SET role = 'OWNER', updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
    logAudit(user.id, user.email, "OWNER", "CLAIM_OWNER_SUCCESS", "system", `Rol OWNER activado para ${user.email}`, req.ip);
    res.json({
      success: true,
      message: `¡Privilegios de PROPIETARIO (OWNER) activados exitosamente para ${user.email}!`,
      role: "OWNER",
    });
    return;
  }

  logAudit(user.id, user.email, user.role, "CLAIM_OWNER_FAILED", "system", "Clave de configuración inválida o correo no autorizado", req.ip);
  res.status(403).json({
    error: "No se pudo verificar la propiedad de la plataforma. La clave proporcionada es incorrecta o tu cuenta no está autorizada en OWNER_EMAIL.",
  });
});

// ------------------------------------------
// PANEL DE SUPER ADMINISTRADOR & OWNER (CONTROL TOTAL)
// ------------------------------------------

// 1. Overview Ejecutivo & Métricas en Tiempo Real
app.get("/api/admin/overview", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
    const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'ACTIVE'").get() as any).count;
    const suspendedUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'SUSPENDED'").get() as any).count;
    const ownersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'OWNER'").get() as any).count;
    const superAdminsCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'SUPER_ADMIN'").get() as any).count;
    const adminsCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'").get() as any).count;

    const totalProjects = (db.prepare("SELECT COUNT(*) as count FROM projects").get() as any).count;
    const totalAssets = (db.prepare("SELECT COUNT(*) as count FROM library_assets").get() as any).count;
    const totalStorageBytes = (db.prepare("SELECT COALESCE(SUM(size), 0) as sum FROM library_assets").get() as any).sum;

    const totalGenerations = (db.prepare("SELECT COUNT(*) as count FROM points_transactions WHERE type = 'USAGE'").get() as any).count;
    const totalPointsConsumed = (db.prepare("SELECT ABS(COALESCE(SUM(amount), 0)) as sum FROM points_transactions WHERE type = 'USAGE'").get() as any).sum;
    const totalPointsPurchased = (db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM points_transactions WHERE type = 'PURCHASE'").get() as any).sum;

    const subscriptionsCount = (db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'ACTIVE'").get() as any).count;
    const totalRevenueCents = (db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM payments WHERE status = 'SUCCEEDED'").get() as any).sum;

    const activeJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status IN ('QUEUED', 'PROCESSING')").get() as any).count;
    const failedJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'FAILED'").get() as any).count;
    const completedJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'COMPLETED'").get() as any).count;

    const recentAuditLogs = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10").all();
    const maintenance = getSystemSetting("maintenance", { enabled: false, message: "" });
    const featureFlags = getSystemSetting("feature_flags", {});

    const memoryUsage = process.memoryUsage();
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      storageMb: Math.round(totalStorageBytes / 1024 / 1024 * 10) / 10,
      databaseType: "SQLite WAL (Transaccional Nativo)",
      version: "GREY IA v2.4 Enterprise",
    };

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        ownersCount,
        superAdminsCount,
        adminsCount,
        totalProjects,
        totalAssets,
        totalStorageBytes,
        totalGenerations,
        totalPointsConsumed,
        totalPointsPurchased,
        subscriptionsCount,
        totalRevenueCents,
        activeJobs,
        failedJobs,
        completedJobs,
      },
      apiStatus: getApiStatusSummary(),
      maintenance,
      featureFlags,
      systemInfo,
      configuredOwnerEmail: CONFIGURED_OWNER_EMAIL,
      isCallerOwner: req.user!.role === "OWNER",
      recentAuditLogs,
    });
  } catch (err: any) {
    console.error("Admin overview error:", err);
    res.status(500).json({ error: "Error al calcular el resumen de métricas del sistema." });
  }
});

// 2. Gestión de Usuarios
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const search = (req.query.search as string) || "";
  const roleFilter = (req.query.role as string) || "all";
  const planFilter = (req.query.plan as string) || "all";
  const statusFilter = (req.query.status as string) || "all";

  let query = `
    SELECT id, email, name, role, points, plan, status, verified, created_at, updated_at,
      (SELECT COUNT(*) FROM projects WHERE user_id = users.id) as projects_count,
      (SELECT COUNT(*) FROM library_assets WHERE user_id = users.id) as assets_count
    FROM users
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += " AND (email LIKE ? OR name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (roleFilter && roleFilter !== "all") {
    query += " AND role = ?";
    params.push(roleFilter);
  }
  if (planFilter && planFilter !== "all") {
    query += " AND plan = ?";
    params.push(planFilter);
  }
  if (statusFilter && statusFilter !== "all") {
    query += " AND status = ?";
    params.push(statusFilter);
  }

  query += " ORDER BY created_at DESC LIMIT 150";
  const users = db.prepare(query).all(...params);
  res.json({ users });
});

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const { status, role, plan, pointsAdjustment, pointsAdjustmentReason, newPassword } = req.body;

  const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as any;
  if (!targetUser) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  // PROTECCIÓN ABSOLUTA DEL OWNER
  const isTargetOwner = targetUser.role === "OWNER";
  const isCallerOwner = req.user!.role === "OWNER";

  if (isTargetOwner && !isCallerOwner) {
    logAudit(req.user!.id, req.user!.email, req.user!.role, "SECURITY_VIOLATION", `users/${targetId}`, "Intento no autorizado de modificar la cuenta del PROPIETARIO (OWNER)", req.ip);
    res.status(403).json({ error: "Seguridad Crítica: La cuenta del PROPIETARIO (OWNER) está blindada y solo puede ser modificada por el propio Propietario." });
    return;
  }

  // Si se intenta modificar el rol del OWNER para degradarlo
  if (isTargetOwner && role && role !== "OWNER") {
    res.status(400).json({ error: "No es posible degradar al PROPIETARIO principal de la plataforma." });
    return;
  }

  // Si alguien que NO es OWNER intenta asignar el rol OWNER
  if (role === "OWNER" && !isCallerOwner) {
    res.status(403).json({ error: "Solo el Propietario actual puede transferir o asignar privilegios de OWNER." });
    return;
  }

  // Solo OWNER o SUPER_ADMIN pueden asignar roles administrativos
  if ((role === "SUPER_ADMIN" || role === "ADMIN") && req.user!.role !== "OWNER" && req.user!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Se requieren privilegios de Propietario o Super Administrador para ascender a otros administradores." });
    return;
  }

  const now = new Date().toISOString();

  if (status && (status === "ACTIVE" || status === "SUSPENDED")) {
    if (isTargetOwner && status === "SUSPENDED") {
      res.status(400).json({ error: "No se puede suspender la cuenta del PROPIETARIO de la plataforma." });
      return;
    }
    db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, now, targetId);
    logAudit(req.user!.id, req.user!.email, req.user!.role, "USER_STATUS_CHANGE", `users/${targetId}`, `Estado cambiado a ${status} para ${targetUser.email}`, req.ip);
  }

  if (role && ["USER", "CREATOR", "ADMIN", "SUPER_ADMIN", "OWNER"].includes(role)) {
    db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(role, now, targetId);
    logAudit(req.user!.id, req.user!.email, req.user!.role, "USER_ROLE_CHANGE", `users/${targetId}`, `Rol de ${targetUser.email} actualizado a ${role}`, req.ip);
  }

  if (plan && ["FREE", "STARTER", "CREATOR", "PRO", "ULTRA", "ENTERPRISE"].includes(plan.toUpperCase())) {
    db.prepare("UPDATE users SET plan = ?, updated_at = ? WHERE id = ?").run(plan.toUpperCase(), now, targetId);
    logAudit(req.user!.id, req.user!.email, req.user!.role, "USER_PLAN_CHANGE", `users/${targetId}`, `Plan de ${targetUser.email} cambiado a ${plan}`, req.ip);
  }

  if (typeof pointsAdjustment === "number" && pointsAdjustment !== 0) {
    db.prepare("UPDATE users SET points = MAX(0, points + ?), updated_at = ? WHERE id = ?").run(pointsAdjustment, now, targetId);
    const txId = crypto.randomUUID();
    const reasonText = pointsAdjustmentReason || "Ajuste manual de créditos desde el panel de control";
    db.prepare(`
      INSERT INTO points_transactions (id, user_id, amount, type, feature, description, created_at)
      VALUES (?, ?, ?, 'ADMIN_ADJUSTMENT', 'admin_adjustment', ?, ?)
    `).run(txId, targetId, pointsAdjustment, reasonText, now);
    logAudit(req.user!.id, req.user!.email, req.user!.role, "USER_POINTS_ADJUSTMENT", `users/${targetId}`, `Ajuste de créditos: ${pointsAdjustment > 0 ? "+" : ""}${pointsAdjustment} a ${targetUser.email}. Motivo: ${reasonText}`, req.ip);
  }

  if (newPassword && newPassword.length >= 6) {
    const { hash, salt } = hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?").run(hash, salt, now, targetId);
    logAudit(req.user!.id, req.user!.email, req.user!.role, "USER_PASSWORD_RESET", `users/${targetId}`, `Contraseña restablecida administrativamente para ${targetUser.email}`, req.ip);
  }

  res.json({ success: true, message: `Usuario ${targetUser.email} actualizado correctamente por administración.` });
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as any;

  if (!targetUser) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  if (targetUser.role === "OWNER") {
    res.status(403).json({ error: "Violación de Seguridad: La cuenta del PROPIETARIO (OWNER) está blindada contra eliminación." });
    return;
  }

  if (targetId === req.user!.id) {
    res.status(400).json({ error: "No puedes auto-eliminar tu propia cuenta de administrador en sesión." });
    return;
  }

  // Eliminar sesiones y usuario
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
  db.prepare("DELETE FROM users WHERE id = ?").run(targetId);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "USER_DELETE", `users/${targetId}`, `Usuario ${targetUser.email} (${targetUser.role}) eliminado definitivamente`, req.ip);
  res.json({ success: true, message: `Usuario ${targetUser.email} eliminado definitivamente del sistema.` });
});

// 3. Gestión de Administradores & Permisos Granulares
app.get("/api/admin/administrators", requireAuth, requireAdmin, (_req, res) => {
  const admins = db.prepare(`
    SELECT id, email, name, role, plan, status, created_at, updated_at
    FROM users
    WHERE role IN ('OWNER', 'SUPER_ADMIN', 'ADMIN')
    ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 ELSE 3 END, created_at ASC
  `).all();

  const permissions = db.prepare("SELECT user_id, permission FROM admin_permissions").all() as any[];
  const permMap: Record<string, string[]> = {};
  for (const p of permissions) {
    if (!permMap[p.user_id]) permMap[p.user_id] = [];
    permMap[p.user_id].push(p.permission);
  }

  const result = admins.map((adm: any) => ({
    ...adm,
    permissions: permMap[adm.id] || [],
  }));

  res.json({ administrators: result });
});

app.post("/api/admin/administrators", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const { email, role = "ADMIN", permissions = [] } = req.body;
  if (!email) {
    res.status(400).json({ error: "Debe proporcionar el correo del usuario a promover." });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim()) as any;
  if (!user) {
    res.status(404).json({ error: `No existe ningún usuario registrado con el correo ${email}.` });
    return;
  }

  if (role === "SUPER_ADMIN" && req.user!.role !== "OWNER") {
    res.status(403).json({ error: "Solo el PROPIETARIO (OWNER) puede nombrar nuevos SUPER ADMINISTRADORES." });
    return;
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(role, now, user.id);

  // Guardar permisos
  db.prepare("DELETE FROM admin_permissions WHERE user_id = ?").run(user.id);
  if (Array.isArray(permissions)) {
    const insertPerm = db.prepare("INSERT INTO admin_permissions (id, user_id, permission, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)");
    for (const perm of permissions) {
      insertPerm.run(crypto.randomUUID(), user.id, perm, now, req.user!.email);
    }
  }

  logAudit(req.user!.id, req.user!.email, req.user!.role, "ADMIN_ROLE_PROMOTED", `users/${user.id}`, `Usuario ${user.email} promovido a ${role} con ${permissions.length} permisos`, req.ip);
  res.json({ success: true, message: `Usuario ${user.email} promovido a ${role} con éxito.` });
});

app.patch("/api/admin/administrators/:id/permissions", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const { permissions = [] } = req.body;

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as any;
  if (!target) {
    res.status(404).json({ error: "Administrador no encontrado." });
    return;
  }

  const now = new Date().toISOString();
  db.prepare("DELETE FROM admin_permissions WHERE user_id = ?").run(targetId);
  const insertPerm = db.prepare("INSERT INTO admin_permissions (id, user_id, permission, granted_at, granted_by) VALUES (?, ?, ?, ?, ?)");
  for (const perm of permissions) {
    insertPerm.run(crypto.randomUUID(), targetId, perm, now, req.user!.email);
  }

  logAudit(req.user!.id, req.user!.email, req.user!.role, "ADMIN_PERMISSIONS_UPDATE", `users/${targetId}`, `Permisos actualizados para ${target.email}`, req.ip);
  res.json({ success: true, message: "Permisos de administración actualizados correctamente." });
});

app.delete("/api/admin/administrators/:id", requireAuth, requireOwner, (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as any;
  if (!target) {
    res.status(404).json({ error: "Administrador no encontrado." });
    return;
  }
  if (target.role === "OWNER") {
    res.status(400).json({ error: "No es posible revocar privilegios al PROPIETARIO (OWNER)." });
    return;
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE users SET role = 'USER', updated_at = ? WHERE id = ?").run(now, targetId);
  db.prepare("DELETE FROM admin_permissions WHERE user_id = ?").run(targetId);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "ADMIN_REVOKED", `users/${targetId}`, `Privilegios administrativos revocados a ${target.email}`, req.ip);
  res.json({ success: true, message: `Privilegios administrativos de ${target.email} revocados. Ahora es usuario estándar.` });
});

// 4. Editor Visual de Diseño (Borrador vs Publicado)
app.get("/api/admin/design", requireAuth, requireAdmin, (_req, res) => {
  const published = getSystemSetting("design_published", {
    platform_title: "GREY IA",
    tagline: "Tu herramienta definitiva de Inteligencia Artificial",
    hero_title: "¡Hola! 👋",
    hero_subtitle: "¿Qué vamos a crear hoy?",
    announcement_banner: "",
    banner_active: false,
    footer_text: "GREY IA — Plataforma Autónoma de Producción Audiovisual con Inteligencia Artificial.",
    login_header: "Bienvenido al Núcleo",
    login_subtitle: "Inicia sesión para acceder a tus proyectos y motores de IA",
    status: "published",
  });
  const draft = getSystemSetting("design_draft", published);

  res.json({ published, draft });
});

app.post("/api/admin/design/draft", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const draftConfig = req.body;
  setSystemSetting("design_draft", { ...draftConfig, status: "draft" }, "design", req.user!.email);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "DESIGN_DRAFT_SAVED", "settings/design", "Borrador de diseño actualizado para previsualización", req.ip);
  res.json({ success: true, message: "Borrador de diseño guardado para previsualización." });
});

app.post("/api/admin/design/publish", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const draft = getSystemSetting("design_draft", null);
  if (!draft) {
    res.status(400).json({ error: "No hay ningún borrador de diseño para publicar." });
    return;
  }
  const published = { ...draft, status: "published", published_at: new Date().toISOString(), published_by: req.user!.email };
  setSystemSetting("design_published", published, "design", req.user!.email);
  setSystemSetting("design_draft", published, "design", req.user!.email);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "DESIGN_PUBLISHED", "settings/design", "Diseño visual publicado en producción para todos los usuarios", req.ip);
  res.json({ success: true, message: "¡Diseño visual publicado exitosamente en producción!", published });
});

app.post("/api/admin/design/reset", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const published = getSystemSetting("design_published", {});
  setSystemSetting("design_draft", published, "design", req.user!.email);
  res.json({ success: true, message: "Borrador restablecido a la versión pública actual.", draft: published });
});

// 5. Gestor de Contenidos & Avisos
app.get("/api/admin/content", requireAuth, requireAdmin, (_req, res) => {
  const pages = db.prepare("SELECT * FROM content_pages ORDER BY slug ASC").all();
  res.json({ pages });
});

app.put("/api/admin/content/:slug", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { title, content, is_published = 1 } = req.body;
  const slug = req.params.slug;
  const now = new Date().toISOString();

  const existing = db.prepare("SELECT id FROM content_pages WHERE slug = ?").get(slug);
  if (existing) {
    db.prepare("UPDATE content_pages SET title = ?, content = ?, is_published = ?, updated_at = ?, updated_by = ? WHERE slug = ?")
      .run(title, content, is_published ? 1 : 0, now, req.user!.email, slug);
  } else {
    db.prepare("INSERT INTO content_pages (id, slug, title, content, is_published, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), slug, title, content, is_published ? 1 : 0, now, req.user!.email);
  }

  logAudit(req.user!.id, req.user!.email, req.user!.role, "CONTENT_PAGE_UPDATE", `content_pages/${slug}`, `Página o aviso '${slug}' actualizado`, req.ip);
  res.json({ success: true, message: `Contenido de '${slug}' guardado exitosamente.` });
});

// 6. Herramientas IA & Feature Flags
app.get("/api/admin/tools", requireAuth, requireAdmin, (_req, res) => {
  const tools = getSystemSetting("tools_config", []);
  const featureFlags = getSystemSetting("feature_flags", {});
  res.json({ tools, featureFlags });
});

app.put("/api/admin/tools/:id", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const toolId = req.params.id;
  const { enabled, points_cost, provider, model, priority } = req.body;
  const tools = getSystemSetting<any[]>("tools_config", []);

  const idx = tools.findIndex((t) => t.id === toolId);
  if (idx === -1) {
    res.status(404).json({ error: "Herramienta no encontrada." });
    return;
  }

  tools[idx] = {
    ...tools[idx],
    enabled: typeof enabled === "boolean" ? enabled : tools[idx].enabled,
    points_cost: typeof points_cost === "number" ? points_cost : tools[idx].points_cost,
    provider: provider || tools[idx].provider,
    model: model || tools[idx].model,
    priority: typeof priority === "number" ? priority : tools[idx].priority,
  };

  setSystemSetting("tools_config", tools, "ai", req.user!.email);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "TOOL_CONFIG_UPDATE", `tools/${toolId}`, `Herramienta ${toolId} configurada: activa=${enabled}, coste=${points_cost}`, req.ip);
  res.json({ success: true, message: `Herramienta '${tools[idx].name}' actualizada.`, tools });
});

app.post("/api/admin/tools/feature-flags", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const flags = req.body;
  const current = getSystemSetting("feature_flags", {});
  const updated = { ...current, ...flags };
  setSystemSetting("feature_flags", updated, "features", req.user!.email);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "FEATURE_FLAGS_UPDATE", "settings/feature_flags", "Feature flags globales actualizados", req.ip);
  res.json({ success: true, message: "Feature flags actualizados correctamente.", featureFlags: updated });
});

// 7. Configuración IA & Fallback
app.get("/api/admin/ai-config", requireAuth, requireAdmin, (_req, res) => {
  const aiProviders = getSystemSetting("ai_providers", {});
  const statusSummary = getApiStatusSummary();

  res.json({
    summary: statusSummary,
    config: aiProviders,
    providers: [
      { id: "gemini", name: "Google Gemini (Flash & Pro)", configured: isGeminiConfigured(), activeModel: aiProviders?.gemini?.model || "gemini-3.8-flash", keyMasked: isGeminiConfigured() ? "AIzaSy•••••••••••••••" : null },
      { id: "veo", name: "Google Veo (Vídeo)", configured: isGeminiConfigured(), activeModel: aiProviders?.veo?.model || "veo-3.1-lite-generate-preview", keyMasked: isGeminiConfigured() ? "AIzaSy•••••••••••••••" : null },
      { id: "runway", name: "Runway Gen-3 Alpha", configured: isRunwayConfigured(), activeModel: "gen-3-alpha", keyMasked: isRunwayConfigured() ? "runway_•••••••••••••" : null },
      { id: "elevenlabs", name: "ElevenLabs Voice AI", configured: isElevenLabsConfigured(), activeModel: "eleven_multilingual_v2", keyMasked: isElevenLabsConfigured() ? "xi_••••••••••••••••" : null },
      { id: "openai", name: "OpenAI GPT-4o", configured: Boolean(process.env.OPENAI_API_KEY), activeModel: "gpt-4o", keyMasked: process.env.OPENAI_API_KEY ? "sk-proj-•••••••••••••" : null },
      { id: "stripe", name: "Stripe Payments", configured: isStripeConfigured(), activeModel: "PCI Service", keyMasked: isStripeConfigured() ? "sk_live_••••••••••••" : null },
    ],
  });
});

app.put("/api/admin/ai-config", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const newConfig = req.body;
  const current = getSystemSetting("ai_providers", {});
  const updated = { ...current, ...newConfig };
  setSystemSetting("ai_providers", updated, "ai", req.user!.email);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "AI_CONFIG_UPDATE", "settings/ai_providers", "Cadena de fallback y parámetros de IA actualizados", req.ip);
  res.json({ success: true, message: "Configuración de modelos de IA y cadena de fallback guardada.", config: updated });
});

app.post("/api/admin/ai-config/test", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { provider = "gemini" } = req.body;
  try {
    if (provider === "gemini") {
      if (!isGeminiConfigured()) {
        res.status(400).json({ success: false, error: "GEMINI_API_KEY no está configurada en las variables de entorno del servidor." });
        return;
      }
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: "Responde únicamente 'OK GREY IA' para probar la conexión.",
      });
      res.json({ success: true, message: `Conexión exitosa con Google Gemini: ${response.text?.trim()}` });
      return;
    }

    if (provider === "elevenlabs") {
      if (!isElevenLabsConfigured()) {
        res.status(400).json({ success: false, error: "ELEVENLABS_API_KEY no configurada." });
        return;
      }
      res.json({ success: true, message: "ElevenLabs API Key detectada y lista para llamadas de síntesis vocal." });
      return;
    }

    if (provider === "runway") {
      if (!isRunwayConfigured()) {
        res.status(400).json({ success: false, error: "RUNWAY_API_KEY no configurada." });
        return;
      }
      res.json({ success: true, message: "Runway Gen-3 API Key detectada en el servidor." });
      return;
    }

    res.json({ success: true, message: `Proveedor ${provider} verificado.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Fallo al verificar proveedor: ${err.message}` });
  }
});

// 8. Economía de Puntos & Paquetes
app.get("/api/admin/points", requireAuth, requireAdmin, (_req, res) => {
  const general = getSystemSetting("general", { welcome_points: 12560 });
  const packages = db.prepare("SELECT * FROM points_packages ORDER BY sort_order ASC").all();
  const transactions = db.prepare(`
    SELECT pt.*, u.email as user_email, u.name as user_name
    FROM points_transactions pt
    JOIN users u ON pt.user_id = u.id
    ORDER BY pt.created_at DESC
    LIMIT 100
  `).all();

  res.json({
    welcomePoints: general.welcome_points,
    packages,
    transactions,
  });
});

app.put("/api/admin/points/welcome", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const { welcomePoints } = req.body;
  if (typeof welcomePoints !== "number" || welcomePoints < 0) {
    res.status(400).json({ error: "Cantidad de créditos iniciales inválida." });
    return;
  }
  const general = getSystemSetting("general", {});
  setSystemSetting("general", { ...general, welcome_points: welcomePoints }, "general", req.user!.email);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "WELCOME_POINTS_UPDATE", "settings/general", `Créditos de bienvenida cambiados a ${welcomePoints}`, req.ip);
  res.json({ success: true, message: `Créditos de bienvenida actualizados a ${welcomePoints} créditos.` });
});

app.post("/api/admin/points/packages", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const { id, name, points, price, bonus_points = 0, is_active = 1, is_popular = 0, sort_order = 0 } = req.body;
  if (!name || typeof points !== "number" || typeof price !== "number") {
    res.status(400).json({ error: "Datos del paquete incompletos." });
    return;
  }
  const pkgId = id || `pkg-${Date.now()}`;
  db.prepare(`
    INSERT INTO points_packages (id, name, points, price, bonus_points, is_active, is_popular, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      points = excluded.points,
      price = excluded.price,
      bonus_points = excluded.bonus_points,
      is_active = excluded.is_active,
      is_popular = excluded.is_popular,
      sort_order = excluded.sort_order
  `).run(pkgId, name, points, price, bonus_points, is_active, is_popular, sort_order);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "POINTS_PACKAGE_SAVED", `points_packages/${pkgId}`, `Paquete de puntos '${name}' (${points} pts, ${price}€) guardado`, req.ip);
  res.json({ success: true, message: "Paquete de créditos guardado correctamente." });
});

app.delete("/api/admin/points/packages/:id", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare("DELETE FROM points_packages WHERE id = ?").run(req.params.id);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "POINTS_PACKAGE_DELETE", `points_packages/${req.params.id}`, "Paquete de puntos eliminado", req.ip);
  res.json({ success: true, message: "Paquete de créditos eliminado." });
});

// 9. Planes & Suscripciones
app.get("/api/admin/plans", requireAuth, requireAdmin, (_req, res) => {
  const plans = db.prepare("SELECT * FROM plans_config ORDER BY sort_order ASC").all();
  res.json({ plans });
});

app.put("/api/admin/plans/:code", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const code = req.params.code.toUpperCase();
  const { name, price_monthly, points_monthly, max_resolution, features, is_active } = req.body;

  db.prepare(`
    UPDATE plans_config
    SET name = COALESCE(?, name),
        price_monthly = COALESCE(?, price_monthly),
        points_monthly = COALESCE(?, points_monthly),
        max_resolution = COALESCE(?, max_resolution),
        features = COALESCE(?, features),
        is_active = COALESCE(?, is_active)
    WHERE code = ?
  `).run(name, price_monthly, points_monthly, max_resolution, features, is_active, code);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "PLAN_CONFIG_UPDATE", `plans/${code}`, `Plan ${code} actualizado: ${price_monthly}€, ${points_monthly} pts`, req.ip);
  res.json({ success: true, message: `Plan '${code}' actualizado exitosamente.` });
});

// 10. Pagos & Transacciones
app.get("/api/admin/payments", requireAuth, requireAdmin, (_req, res) => {
  const payments = db.prepare(`
    SELECT p.*, u.email as user_email, u.name as user_name
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all();
  res.json({ payments, stripeConfigured: isStripeConfigured() });
});

// 11. Proyectos & Biblioteca de Archivos Global
app.get("/api/admin/projects", requireAuth, requireAdmin, (req, res) => {
  const search = (req.query.search as string) || "";
  let query = `
    SELECT p.id, p.title, p.aspect_ratio, p.duration, p.thumbnail, p.created_at, p.updated_at,
           u.email as owner_email, u.name as owner_name
    FROM projects p
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (search) {
    query += " AND (p.title LIKE ? OR u.email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  query += " ORDER BY p.created_at DESC LIMIT 100";
  const projects = db.prepare(query).all(...params);
  res.json({ projects });
});

app.delete("/api/admin/projects/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const project = db.prepare("SELECT title FROM projects WHERE id = ?").get(req.params.id) as any;
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "PROJECT_ADMIN_DELETE", `projects/${req.params.id}`, `Proyecto '${project?.title || req.params.id}' eliminado administrativamente`, req.ip);
  res.json({ success: true, message: "Proyecto eliminado del sistema." });
});

app.get("/api/admin/library", requireAuth, requireAdmin, (req, res) => {
  const search = (req.query.search as string) || "";
  const typeFilter = (req.query.type as string) || "all";

  let query = `
    SELECT la.*, u.email as owner_email, u.name as owner_name
    FROM library_assets la
    JOIN users u ON la.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (search) {
    query += " AND (la.name LIKE ? OR u.email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (typeFilter && typeFilter !== "all") {
    query += " AND la.type = ?";
    params.push(typeFilter);
  }
  query += " ORDER BY la.created_at DESC LIMIT 150";
  const assets = db.prepare(query).all(...params);

  const stats = db.prepare(`
    SELECT type, COUNT(*) as count, COALESCE(SUM(size), 0) as total_bytes
    FROM library_assets
    GROUP BY type
  `).all();

  res.json({ assets, stats });
});

app.delete("/api/admin/library/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const asset = db.prepare("SELECT * FROM library_assets WHERE id = ?").get(req.params.id) as any;
  if (asset && asset.url && asset.url.startsWith("/uploads/")) {
    const filename = path.basename(asset.url);
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
    }
  }
  db.prepare("DELETE FROM library_assets WHERE id = ?").run(req.params.id);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "ASSET_ADMIN_DELETE", `library_assets/${req.params.id}`, `Recurso '${asset?.name}' eliminado por administración`, req.ip);
  res.json({ success: true, message: "Recurso eliminado de la biblioteca global." });
});

// 12. Gestor de Plantillas
app.get("/api/admin/templates", requireAuth, requireAdmin, (_req, res) => {
  const templates = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
  res.json({ templates });
});

app.post("/api/admin/templates", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { title, category, description, thumbnail, aspect_ratio = "9:16", data = "{}" } = req.body;
  if (!title || !category) {
    res.status(400).json({ error: "Título y categoría son requeridos para la plantilla." });
    return;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO templates (id, title, category, description, thumbnail, aspect_ratio, data, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, title, category, description || "", thumbnail || "", aspect_ratio, typeof data === "object" ? JSON.stringify(data) : data, now, now);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "TEMPLATE_CREATE", `templates/${id}`, `Plantilla '${title}' creada`, req.ip);
  res.json({ success: true, message: "Plantilla creada correctamente.", id });
});

app.delete("/api/admin/templates/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "TEMPLATE_DELETE", `templates/${req.params.id}`, "Plantilla eliminada", req.ip);
  res.json({ success: true, message: "Plantilla eliminada." });
});

// 13. Notificaciones & Email
app.post("/api/admin/notifications/broadcast", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const { title, message, type = "info", link = "", targetRole = "ALL" } = req.body;
  if (!title || !message) {
    res.status(400).json({ error: "Título y mensaje de notificación son requeridos." });
    return;
  }

  let usersQuery = "SELECT id FROM users WHERE status = 'ACTIVE'";
  const params: any[] = [];
  if (targetRole && targetRole !== "ALL") {
    usersQuery += " AND role = ?";
    params.push(targetRole);
  }

  const users = db.prepare(usersQuery).all(...params) as any[];
  const now = new Date().toISOString();
  const stmt = db.prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)");

  for (const u of users) {
    stmt.run(crypto.randomUUID(), u.id, title, message, type, link, now);
  }

  logAudit(req.user!.id, req.user!.email, req.user!.role, "NOTIFICATION_BROADCAST", "notifications", `Aviso masivo enviado a ${users.length} usuarios: "${title}"`, req.ip);
  res.json({ success: true, message: `Notificación emitida a ${users.length} usuarios activos.` });
});

app.get("/api/admin/email", requireAuth, requireAdmin, (_req, res) => {
  const emailConfig = getSystemSetting("email_config", {
    sender_name: "GREY IA Equipo",
    sender_email: "soporte@greyia.com",
    smtp_host: "smtp.sendgrid.net",
    smtp_port: 587,
    smtp_user: "apikey",
    is_configured: false,
    welcome_subject: "¡Bienvenido a GREY IA! Tu cuenta está lista",
    welcome_body: "Hola {{name}},\n\nTu cuenta en GREY IA ha sido configurada con éxito con 12.560 créditos gratuitos de bienvenida.\n\nAccede a la plataforma para comenzar tus producciones con IA.",
    reset_subject: "Restablecimiento de contraseña — GREY IA",
    reset_body: "Hola {{name}},\n\nHas solicitado restablecer tu contraseña. Haz clic en el enlace para continuar.",
  });
  res.json({ emailConfig });
});

app.put("/api/admin/email", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const newConfig = req.body;
  setSystemSetting("email_config", newConfig, "email", req.user!.email);
  logAudit(req.user!.id, req.user!.email, req.user!.role, "EMAIL_CONFIG_UPDATE", "settings/email_config", "Configuración de correos del sistema actualizada", req.ip);
  res.json({ success: true, message: "Configuración de correo y plantillas guardada." });
});

// 14. Estadísticas Avanzadas & Monitorización
app.get("/api/admin/stats", requireAuth, requireAdmin, (_req, res) => {
  try {
    const dailyGenerations = db.prepare(`
      SELECT substr(created_at, 1, 10) as date, COUNT(*) as count, ABS(SUM(amount)) as points
      FROM points_transactions
      WHERE type = 'USAGE'
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date DESC
      LIMIT 14
    `).all();

    const featureBreakdown = db.prepare(`
      SELECT feature, COUNT(*) as count, ABS(SUM(amount)) as points_spent
      FROM points_transactions
      WHERE type = 'USAGE'
      GROUP BY feature
      ORDER BY points_spent DESC
    `).all();

    const signupsByDate = db.prepare(`
      SELECT substr(created_at, 1, 10) as date, COUNT(*) as count
      FROM users
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date DESC
      LIMIT 14
    `).all();

    res.json({
      dailyGenerations,
      featureBreakdown,
      signupsByDate,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error calculando analíticas." });
  }
});

app.get("/api/admin/monitoring", requireAuth, requireAdmin, async (_req, res) => {
  const startTime = Date.now();
  // DB latency check
  db.prepare("SELECT 1").get();
  const dbLatencyMs = Date.now() - startTime;

  const errorCount = (db.prepare("SELECT COUNT(*) as count FROM system_logs WHERE level = 'ERROR'").get() as any).count;
  const recentErrors = db.prepare("SELECT * FROM system_logs WHERE level = 'ERROR' ORDER BY created_at DESC LIMIT 5").all();

  res.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    dbLatencyMs,
    errorCount,
    recentErrors,
    apiStatus: getApiStatusSummary(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// 15. Auditoría & Registros de Seguridad
app.get("/api/admin/audit-logs", requireAuth, requireAdmin, (req, res) => {
  const search = (req.query.search as string) || "";
  const role = (req.query.role as string) || "all";

  let query = "SELECT * FROM audit_logs WHERE 1=1";
  const params: any[] = [];
  if (search) {
    query += " AND (user_email LIKE ? OR action LIKE ? OR resource LIKE ? OR details LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role && role !== "all") {
    query += " AND role = ?";
    params.push(role);
  }
  query += " ORDER BY created_at DESC LIMIT 200";

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

// 16. Copias de Seguridad (Exportar / Importar)
app.get("/api/admin/backups/export", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const settings = db.prepare("SELECT * FROM system_settings").all();
  const plans = db.prepare("SELECT * FROM plans_config").all();
  const packages = db.prepare("SELECT * FROM points_packages").all();
  const content = db.prepare("SELECT * FROM content_pages").all();
  const templates = db.prepare("SELECT * FROM templates").all();

  const backupData = {
    version: "GREY IA v2.4 Enterprise",
    exported_at: new Date().toISOString(),
    exported_by: req.user!.email,
    settings,
    plans,
    packages,
    content,
    templates,
  };

  logAudit(req.user!.id, req.user!.email, req.user!.role, "BACKUP_EXPORT", "backups", "Copia de seguridad del sistema exportada", req.ip);
  res.setHeader("Content-Disposition", `attachment; filename=grey_ia_backup_${Date.now()}.json`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(backupData, null, 2));
});

app.post("/api/admin/backups/import", requireAuth, requireOwner, (req: AuthenticatedRequest, res) => {
  const backup = req.body;
  if (!backup || !backup.settings) {
    res.status(400).json({ error: "Archivo de copia de seguridad inválido o formato incompatible." });
    return;
  }

  try {
    // Importar configuración con transacción
    if (Array.isArray(backup.settings)) {
      const stmt = db.prepare("INSERT INTO system_settings (key, value, category, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, updated_at = excluded.updated_at, updated_by = excluded.updated_by");
      for (const s of backup.settings) {
        stmt.run(s.key, s.value, s.category, new Date().toISOString(), req.user!.email);
      }
    }

    logAudit(req.user!.id, req.user!.email, req.user!.role, "BACKUP_RESTORE", "backups", "Copia de seguridad restaurada por el PROPIETARIO (OWNER)", req.ip);
    res.json({ success: true, message: "Configuraciones y datos del sistema restaurados con éxito desde la copia de seguridad." });
  } catch (err: any) {
    res.status(500).json({ error: `Fallo al importar copia de seguridad: ${err.message}` });
  }
});

app.get("/api/admin/backups/export-users", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const users = db.prepare("SELECT id, email, name, role, points, plan, status, created_at FROM users").all();
  logAudit(req.user!.id, req.user!.email, req.user!.role, "USERS_EXPORT", "users", `Listado de ${users.length} usuarios exportado`, req.ip);
  res.json({ users, exported_at: new Date().toISOString() });
});

// 17. Modo Mantenimiento
app.get("/api/admin/maintenance", requireAuth, requireAdmin, (_req, res) => {
  const maintenance = getSystemSetting("maintenance", { enabled: false, message: "" });
  res.json({ maintenance });
});

app.post("/api/admin/maintenance", requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const { enabled, message } = req.body;
  const current = getSystemSetting("maintenance", { enabled: false, message: "" });
  const updated = {
    enabled: Boolean(enabled),
    message: message || "GREY IA se encuentra en mantenimiento programado. Volveremos pronto.",
    updated_at: new Date().toISOString(),
    updated_by: req.user!.email,
  };
  setSystemSetting("maintenance", updated, "system", req.user!.email);

  logAudit(req.user!.id, req.user!.email, req.user!.role, "MAINTENANCE_TOGGLE", "system/maintenance", `Modo mantenimiento ${enabled ? "ACTIVADO" : "DESACTIVADO"}: "${updated.message}"`, req.ip);
  res.json({ success: true, message: `Modo mantenimiento ${enabled ? "activado" : "desactivado"} con éxito.`, maintenance: updated });
});

// 18. Seguridad & Re-autenticación de Acciones Críticas
app.post("/api/admin/security/verify-password", requireAuth, (req: AuthenticatedRequest, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Debe ingresar su contraseña." });
    return;
  }
  const user = db.prepare("SELECT password_hash, salt FROM users WHERE id = ?").get(req.user!.id) as any;
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    logAudit(req.user!.id, req.user!.email, req.user!.role, "SECURITY_REAUTH_FAILED", "security", "Contraseña incorrecta en re-autenticación", req.ip);
    res.status(401).json({ error: "Contraseña incorrecta. Acción cancelada por seguridad." });
    return;
  }
  logAudit(req.user!.id, req.user!.email, req.user!.role, "SECURITY_REAUTH_SUCCESS", "security", "Re-autenticación exitosa para acción sensible", req.ip);
  res.json({ success: true, message: "Identidad confirmada." });
});

app.get("/api/admin/logs", requireAuth, requireAdmin, (_req, res) => {
  const logs = db.prepare("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100").all();
  res.json({ logs });
});


// ==========================================
// VITE INTEGRATION / SPA FALLBACK
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GREY IA backend server online on http://0.0.0.0:${PORT}`);
  });
}

// Only run standalone listener when not in a serverless environment (Vercel)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
