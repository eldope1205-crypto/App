import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { db, hashPassword, verifyPassword, logSystem } from "./server/db.ts";
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

// Setup uploads directory
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

const app = express();
const PORT = 3000;

// Essential middlewares
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

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
    req.user = {
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
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

// Admin Middleware - Strict Server Verification
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "ADMIN") {
    logSystem("WARN", "AUTH", `Intento no autorizado al panel de administración por usuario ${req.user?.email || "desconocido"}`);
    res.status(403).json({ error: "Acceso denegado. Se requieren privilegios de Administrador del sistema." });
    return;
  }
  next();
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
    const initialPoints = role === "ADMIN" ? 99999 : 250;

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

app.post("/api/auth/recover", (req, res) => {
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
        title: "Video TikTok IA Futuro",
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
        thumbnail: "/uploads/grey_ia_hero.jpg",
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
        title: "Video Promo Producto",
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
// PANEL DE ADMINISTRACIÓN (PRIVADO & PROTEGIDO)
// ------------------------------------------

app.get("/api/admin/stats", requireAuth, requireAdmin, (_req, res) => {
  try {
    const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
    const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'ACTIVE'").get() as any).count;
    const suspendedUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'SUSPENDED'").get() as any).count;
    const totalProjects = (db.prepare("SELECT COUNT(*) as count FROM projects").get() as any).count;
    const totalGenerations = (db.prepare("SELECT COUNT(*) as count FROM points_transactions WHERE type = 'USAGE'").get() as any).count;
    const totalPointsConsumed = (db.prepare("SELECT ABS(COALESCE(SUM(amount), 0)) as sum FROM points_transactions WHERE type = 'USAGE'").get() as any).sum;
    const totalAssets = (db.prepare("SELECT COUNT(*) as count FROM library_assets").get() as any).count;
    const subscriptionsCount = (db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'ACTIVE'").get() as any).count;

    // Feature breakdown
    const featureBreakdown = db.prepare(`
      SELECT feature, COUNT(*) as count, ABS(SUM(amount)) as points_spent
      FROM points_transactions
      WHERE type = 'USAGE'
      GROUP BY feature
    `).all();

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalProjects,
        totalGenerations,
        totalPointsConsumed,
        totalAssets,
        subscriptionsCount,
      },
      featureBreakdown,
      apiStatus: getApiStatusSummary(),
    });
  } catch (err: any) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Error al calcular estadísticas del sistema." });
  }
});

app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const search = req.query.search as string;
  const roleFilter = req.query.role as string;
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
  query += " ORDER BY created_at DESC LIMIT 100";

  const users = db.prepare(query).all(...params);
  res.json({ users });
});

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { status, role, pointsAdjustment } = req.body;
  const targetId = req.params.id;

  const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as any;
  if (!targetUser) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  // Prevent admin from removing their own admin privileges by mistake
  if (targetId === req.user!.id && role && role !== "ADMIN") {
    res.status(400).json({ error: "No puedes revocar tu propio rol de administrador." });
    return;
  }

  const now = new Date().toISOString();
  if (status && (status === "ACTIVE" || status === "SUSPENDED")) {
    db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, now, targetId);
    logSystem("INFO", "ADMIN", `Estado de usuario ${targetUser.email} cambiado a ${status} por ${req.user!.email}`);
  }

  if (role && (role === "USER" || role === "CREATOR" || role === "ADMIN")) {
    db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(role, now, targetId);
    logSystem("INFO", "ADMIN", `Rol de usuario ${targetUser.email} cambiado a ${role} por ${req.user!.email}`);
  }

  if (typeof pointsAdjustment === "number" && pointsAdjustment !== 0) {
    db.prepare("UPDATE users SET points = MAX(0, points + ?), updated_at = ? WHERE id = ?").run(pointsAdjustment, now, targetId);
    const txId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO points_transactions (id, user_id, amount, type, feature, description, created_at)
      VALUES (?, ?, ?, 'ADMIN_ADJUSTMENT', 'admin', 'Ajuste manual de créditos por administración', ?)
    `).run(txId, targetId, pointsAdjustment, now);
    logSystem("INFO", "ADMIN", `Ajuste de puntos a ${targetUser.email}: ${pointsAdjustment > 0 ? "+" : ""}${pointsAdjustment}`);
  }

  res.json({ message: "Usuario actualizado por administración." });
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  if (targetId === req.user!.id) {
    res.status(400).json({ error: "No puedes eliminar tu propia cuenta de administrador desde este panel." });
    return;
  }
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(targetId) as any;
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
  logSystem("WARN", "ADMIN", `Usuario eliminado por administrador: ${user.email}`);
  res.json({ message: `Usuario ${user.email} eliminado definitivamente.` });
});

app.get("/api/admin/logs", requireAuth, requireAdmin, (_req, res) => {
  const logs = db.prepare("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100").all();
  res.json({ logs });
});

app.get("/api/admin/api-config", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    summary: getApiStatusSummary(),
    envVariables: [
      { name: "GEMINI_API_KEY", configured: isGeminiConfigured(), description: "Modelos Google Gemini 3.8 Flash, Veo y nano banana" },
      { name: "RUNWAY_API_KEY", configured: isRunwayConfigured(), description: "Motor de vídeo Runway Gen-3 Alpha" },
      { name: "ELEVENLABS_API_KEY", configured: isElevenLabsConfigured(), description: "Motor de síntesis vocal hiperrealista ElevenLabs" },
      { name: "OPENAI_API_KEY", configured: false, description: "Modelos multimodales OpenAI (Opcional)" },
      { name: "STRIPE_SECRET_KEY", configured: isStripeConfigured(), description: "Procesamiento de pagos y suscripciones bancarias reales" },
    ],
  });
});

// ==========================================
// VITE INTEGRATION / SPA FALLBACK
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GREY IA backend server online on http://0.0.0.0:${PORT}`);
  });
}

startServer();
