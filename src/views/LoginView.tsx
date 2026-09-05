import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/images/grey_ia_hero_1788625124525.jpg';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  Rocket,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  User,
} from 'lucide-react';

interface LoginViewProps {
  onNavigate: (view: 'login' | 'register' | 'recover' | string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNavigate }) => {
  const { login, register } = useAuth();

  // Mode: 'login' | 'register' | 'recover'
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Legal Modals
  const [modalType, setModalType] = useState<'terms' | 'privacy' | 'oauth' | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (mode === 'recover') {
      if (!email.trim()) {
        setError('Por favor, ingresa tu correo electrónico.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/auth/request-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al solicitar recuperación.');
        setSuccessMessage('Si el correo existe en el sistema, recibirás un enlace de restablecimiento.');
      } catch (err: any) {
        setError(err.message || 'Error al procesar la solicitud.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!name.trim() || !email.trim() || !password) {
        setError('Por favor, completa todos los campos para registrar tu cuenta.');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      setLoading(true);
      try {
        await register(email.trim(), password, name.trim());
      } catch (err: any) {
        setError(err.message || 'Error al registrar la cuenta.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Default: Login
    if (!email.trim() || !password) {
      setError('Por favor, ingresa tu correo electrónico y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas. Comprueba tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = (provider: 'Google' | 'Apple') => {
    setOauthProvider(provider);
    setModalType('oauth');
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-start overflow-x-hidden font-sans selection:bg-white selection:text-black">
      {/* Container matching mobile reference width with fluid responsive scaling */}
      <div className="w-full max-w-[430px] flex flex-col items-center px-4 sm:px-6 pt-4 pb-10">

        {/* HERO VISUAL SECTION */}
        <div className="relative w-full aspect-[9/10] sm:aspect-[4/5] rounded-3xl overflow-hidden mb-6 flex flex-col justify-end p-6 text-center select-none shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10">
          {/* Background Cinematic Graphic */}
          <img
            src={heroImage}
            alt="GREY IA - Glowing Triangle with G in dramatic space clouds"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
            referrerPolicy="no-referrer"
          />

          {/* Subtle gradient overlays for seamless text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />

          {/* Central Typography directly over graphic */}
          <div className="relative z-10 flex flex-col items-center mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-3xl sm:text-4xl font-black tracking-widest text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.7)]">
                GREY
              </span>
              <span className="text-3xl sm:text-4xl font-light tracking-widest text-white/90">
                IA
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-white/80 font-semibold mt-1.5 drop-shadow-md max-w-[280px]">
              TU HERRAMIENTA DEFINITIVA DE INTELIGENCIA ARTIFICIAL
            </p>
          </div>
        </div>

        {/* 3 FEATURE CARDS (RÁPIDO - SEGURO - POTENTE) */}
        <div className="w-full grid grid-cols-3 gap-2.5 mb-6">
          {/* Card 1: RÁPIDO */}
          <div className="bg-[#0b0b0e] border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center mb-2 text-white">
              <Zap className="w-4 h-4 text-white fill-white/20" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              RÁPIDO
            </span>
            <span className="text-[9px] text-white/50 leading-tight mt-1">
              Resultados en segundos
            </span>
          </div>

          {/* Card 2: SEGURO */}
          <div className="bg-[#0b0b0e] border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center mb-2 text-white">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              SEGURO
            </span>
            <span className="text-[9px] text-white/50 leading-tight mt-1">
              Tus datos siempre protegidos
            </span>
          </div>

          {/* Card 3: POTENTE */}
          <div className="bg-[#0b0b0e] border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center mb-2 text-white">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              POTENTE
            </span>
            <span className="text-[9px] text-white/50 leading-tight mt-1">
              Tecnología de IA de última generación
            </span>
          </div>
        </div>

        {/* FEEDBACK NOTICES */}
        {error && (
          <div className="w-full mb-4 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 flex items-start gap-2.5 text-red-200 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="w-full mb-4 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-start gap-2.5 text-emerald-200 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* AUTH FORM */}
        <form onSubmit={handleSubmit} className="w-full space-y-3">
          {/* Name field only in Register mode */}
          {mode === 'register' && (
            <div className="relative">
              <User className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full pl-12 pr-4 py-3.5 bg-black/60 border border-white/20 hover:border-white/40 focus:border-white rounded-2xl text-sm text-white placeholder-white/40 outline-none transition-colors"
                id="input-register-name"
              />
            </div>
          )}

          {/* Email Field */}
          <div className="relative">
            <Mail className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="w-full pl-12 pr-4 py-3.5 bg-black/60 border border-white/20 hover:border-white/40 focus:border-white rounded-2xl text-sm text-white placeholder-white/40 outline-none transition-colors"
              id="input-login-email"
            />
          </div>

          {/* Password Field (hidden in recover mode) */}
          {mode !== 'recover' && (
            <div className="relative">
              <Lock className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full pl-12 pr-12 py-3.5 bg-black/60 border border-white/20 hover:border-white/40 focus:border-white rounded-2xl text-sm text-white placeholder-white/40 outline-none transition-colors"
                id="input-login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors focus:outline-none p-1"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                id="btn-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Forgot Password Link (Only in login mode) */}
          {mode === 'login' && (
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode('recover');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-white/60 hover:text-white underline underline-offset-4 transition-colors font-medium"
                id="btn-forgot-password"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 rounded-2xl bg-white hover:bg-zinc-200 active:scale-[0.99] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 disabled:opacity-50"
            id="btn-submit-auth"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-black" />
            ) : (
              <span>
                {mode === 'login'
                  ? 'Iniciar sesión'
                  : mode === 'register'
                  ? 'Crear cuenta'
                  : 'Recuperar contraseña'}
              </span>
            )}
          </button>
        </form>

        {/* SEPARATOR: "o continúa con" */}
        {mode !== 'recover' && (
          <>
            <div className="relative w-full my-5 flex items-center justify-center">
              <div className="w-full border-t border-white/15" />
              <span className="absolute bg-black px-4 text-xs text-white/40 font-medium lowercase">
                o continúa con
              </span>
            </div>

            {/* SOCIAL AUTH BUTTONS */}
            <div className="w-full space-y-2.5">
              {/* Continuar con Google */}
              <button
                type="button"
                onClick={() => handleOAuthClick('Google')}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#0c0c0f] border border-white/15 hover:border-white/30 text-white font-medium text-xs flex items-center justify-center gap-3 transition-colors active:scale-[0.99]"
                id="btn-auth-google"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>

              {/* Continuar con Apple */}
              <button
                type="button"
                onClick={() => handleOAuthClick('Apple')}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#0c0c0f] border border-white/15 hover:border-white/30 text-white font-medium text-xs flex items-center justify-center gap-3 transition-colors active:scale-[0.99]"
                id="btn-auth-apple"
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.67-.82 1.13-1.96 1-3.11-1 .04-2.17.67-2.85 1.47-.6.69-1.12 1.83-.98 2.94 1.11.09 2.16-.48 2.83-1.3" />
                </svg>
                <span>Continuar con Apple</span>
              </button>
            </div>
          </>
        )}

        {/* TOGGLE REGISTER / LOGIN */}
        <div className="mt-6 text-center text-xs text-white/50">
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-white font-bold hover:underline ml-1"
                id="btn-switch-register"
              >
                Regístrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes una cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-white font-bold hover:underline ml-1"
                id="btn-switch-login"
              >
                Inicia sesión
              </button>
            </>
          )}
        </div>

        {/* LEGAL DISCLAIMER */}
        <p className="mt-4 text-center text-[10px] text-white/40 leading-relaxed max-w-[340px]">
          Al continuar, aceptas nuestros{' '}
          <button
            type="button"
            onClick={() => setModalType('terms')}
            className="underline hover:text-white/80 transition-colors"
          >
            Términos de uso
          </button>{' '}
          y nuestra{' '}
          <button
            type="button"
            onClick={() => setModalType('privacy')}
            className="underline hover:text-white/80 transition-colors"
          >
            Política de privacidad
          </button>
          .
        </p>

        {/* YOUTUBE ICON AT BOTTOM */}
        <div className="mt-6 flex justify-center">
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-xl bg-[#0c0c0f] border border-white/10 hover:border-white/30 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-sm group"
            title="Canal oficial YouTube GREY IA"
            id="link-footer-youtube"
          >
            <svg
              className="w-4 h-4 fill-current group-hover:scale-110 transition-transform"
              viewBox="0 0 24 24"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
        </div>
      </div>

      {/* MODAL: Términos de uso / Política de privacidad / OAuth */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalType(null)}
        >
          <div
            className="w-full max-w-lg bg-zinc-950 border border-white/20 rounded-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalType(null)}
              className="absolute top-4 right-4 p-1 text-white/50 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            {modalType === 'terms' && (
              <div>
                <h3 className="text-base font-bold text-white mb-3">Términos de Uso — GREY IA</h3>
                <div className="text-xs text-white/70 space-y-2.5 leading-relaxed">
                  <p>
                    1. <strong>Uso Autorizado:</strong> GREY IA es una plataforma tecnológica de creación asistida por inteligencia artificial. Los usuarios retienen la titularidad de los proyectos generados cumpliendo con las políticas de uso aceptable.
                  </p>
                  <p>
                    2. <strong>Consumo de Puntos:</strong> Cada generación (chat, imágenes, vídeo, audio) descuenta puntos calculados de forma real en el servidor.
                  </p>
                  <p>
                    3. <strong>Seguridad de Datos:</strong> Todas las credenciales están cifradas mediante algoritmos de derivación de claves PBKDF2 y sesiones protegidas con tokens criptográficos.
                  </p>
                </div>
              </div>
            )}

            {modalType === 'privacy' && (
              <div>
                <h3 className="text-base font-bold text-white mb-3">Política de Privacidad — GREY IA</h3>
                <div className="text-xs text-white/70 space-y-2.5 leading-relaxed">
                  <p>
                    1. <strong>Información Recopilada:</strong> Únicamente se almacenan datos esenciales para la autenticación y la gestión de proyectos (correo electrónico, nombre de perfil y claves hash).
                  </p>
                  <p>
                    2. <strong>Protección:</strong> No compartimos información personal con terceros para fines comerciales. Las peticiones a proveedores de IA (Gemini, Runway, ElevenLabs) se procesan estrictamente a través de proxies seguros en el servidor.
                  </p>
                </div>
              </div>
            )}

            {modalType === 'oauth' && (
              <div>
                <h3 className="text-base font-bold text-white mb-3">
                  Autenticación con {oauthProvider}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed mb-4">
                  Para autenticarse mediante {oauthProvider} en un entorno de producción, las credenciales del cliente OAuth deben ser provistas en las variables de entorno del servidor.
                </p>
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white/80">
                  <p className="font-semibold text-white mb-1">Registro con Correo Electrónico:</p>
                  <p>
                    Puedes registrar tu cuenta real directamente utilizando el formulario con tu correo electrónico y contraseña.
                  </p>
                </div>
                <button
                  onClick={() => setModalType(null)}
                  className="w-full mt-5 py-3 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
