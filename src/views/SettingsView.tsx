import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  Settings,
  User,
  Shield,
  CreditCard,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown,
  ExternalLink,
  Coins,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Profile
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Admin Claim
  const [adminSecret, setAdminSecret] = useState('');
  const [claimingAdmin, setClaimingAdmin] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Stripe Checkout
  const [stripeLoading, setStripeLoading] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileNotice(null);

    try {
      await apiRequest('/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName }),
      });
      await refreshUser();
      setProfileNotice('Nombre actualizado exitosamente.');
    } catch (err: any) {
      setProfileNotice(err.message || 'Error al actualizar perfil.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('Las nuevas contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setUpdatingPassword(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setPasswordNotice('Contraseña modificada exitosamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Error al actualizar la contraseña.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSecret.trim()) return;
    setClaimingAdmin(true);
    setAdminError(null);
    setAdminNotice(null);

    try {
      const res = await apiRequest<{ message: string; role: string }>('/auth/claim-admin', {
        method: 'POST',
        body: JSON.stringify({ secretKey: adminSecret }),
      });
      setAdminNotice(res.message);
      setAdminSecret('');
      await refreshUser();
    } catch (err: any) {
      setAdminError(err.message || 'Clave de administrador incorrecta.');
    } finally {
      setClaimingAdmin(false);
    }
  };

  const handleStripeCheckout = async (plan: 'pro' | 'studio') => {
    setStripeLoading(plan);
    setPaymentError(null);
    setPaymentNotice(null);

    try {
      const res = await apiRequest<{ url?: string; message?: string }>('/payments/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/?payment=success`,
          cancelUrl: `${window.location.origin}/?payment=cancelled`,
        }),
      });

      if (res.url) {
        window.location.href = res.url;
      } else {
        setPaymentNotice(res.message || 'Sesión de pago iniciada.');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Error con la pasarela de pagos Stripe.');
    } finally {
      setStripeLoading(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in">
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
          <Settings className="w-3.5 h-3.5 text-white" />
          <span>Configuración de Cuenta</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
          Ajustes y Suscripción
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Gestiona tus datos de acceso, cuota de créditos y estado de cuenta.
        </p>
      </div>

      {/* Subscription Plans Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
            <Crown className="w-5 h-5 text-zinc-300" /> Planes de Suscripción
          </h2>
          <span className="text-xs text-zinc-400">
            Plan actual: <strong className="text-white uppercase">{user?.plan}</strong> ({user?.points} pts disponibles)
          </span>
        </div>

        {paymentError && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div className="space-y-1">
              <span className="font-semibold text-red-200">Aviso de Stripe:</span>
              <p>{paymentError}</p>
            </div>
          </div>
        )}

        {paymentNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{paymentNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan Free */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gratuito</span>
              <h3 className="text-2xl font-bold text-white font-['Space_Grotesk']">0€</h3>
              <p className="text-xs text-zinc-400">Para probar la plataforma y herramientas básicas.</p>
              <ul className="text-xs text-zinc-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> 100 puntos iniciales
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Chat IA ilimitado
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Editor de imagen y vídeo
                </li>
              </ul>
            </div>
            <button
              disabled
              className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-500 cursor-not-allowed"
            >
              {user?.plan === 'free' ? 'Plan Actual' : 'Básico'}
            </button>
          </div>

          {/* Plan Pro */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-700 space-y-4 flex flex-col justify-between relative shadow-xl">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">Profesional</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-white text-black font-extrabold uppercase">
                  Popular
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white font-['Space_Grotesk']">
                29€ <span className="text-xs text-zinc-400 font-normal">/ mes</span>
              </h3>
              <p className="text-xs text-zinc-400">Para creadores y realizadores de contenido diario.</p>
              <ul className="text-xs text-zinc-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> 1,000 puntos mensuales
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Renderizado prioritario de vídeo
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Sin marcas de agua
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleStripeCheckout('pro')}
              disabled={stripeLoading !== null}
              className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/10"
            >
              {stripeLoading === 'pro' ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Suscribirse Pro (Stripe)</span>
                </>
              )}
            </button>
          </div>

          {/* Plan Studio */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Studio / Agencia</span>
              <h3 className="text-2xl font-bold text-white font-['Space_Grotesk']">
                79€ <span className="text-xs text-zinc-400 font-normal">/ mes</span>
              </h3>
              <p className="text-xs text-zinc-400">Volumen máximo de creación para marcas y equipos.</p>
              <ul className="text-xs text-zinc-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> 3,500 puntos mensuales
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Soporte dedicado 24/7
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" /> Acceso temprano a nuevos modelos
                </li>
              </ul>
            </div>
            <button
              onClick={() => handleStripeCheckout('studio')}
              disabled={stripeLoading !== null}
              className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2"
            >
              {stripeLoading === 'studio' ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Suscribirse Studio (Stripe)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {/* Profile Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
          <h2 className="text-base font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
            <User className="w-4 h-4 text-zinc-400" /> Datos del Perfil
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 uppercase font-semibold">
                Correo Electrónico
              </label>
              <input
                type="text"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1.5 uppercase font-semibold">
                Nombre Completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            {profileNotice && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {profileNotice}
              </p>
            )}

            <button
              type="submit"
              disabled={updatingProfile}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {updatingProfile ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
          <h2 className="text-base font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-400" /> Seguridad y Contraseña
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-300 mb-1 font-semibold">Contraseña Actual</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-semibold">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1 font-semibold">Confirmar</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            {passwordNotice && <p className="text-xs text-emerald-400">{passwordNotice}</p>}

            <button
              type="submit"
              disabled={updatingPassword}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white font-semibold text-xs transition-colors"
            >
              {updatingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>
      </div>

      {/* Claim Admin Role */}
      {user?.role !== 'admin' && (
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-400" />
            <h2 className="text-base font-bold text-white font-['Space_Grotesk']">
              Reclamar Rol de Administrador
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Si eres el propietario del servidor o despliegue, introduce el <code className="text-zinc-200">ADMIN_SECRET_KEY</code> configurado en las variables de entorno para elevar los privilegios de tu cuenta a administrador.
          </p>

          <form onSubmit={handleClaimAdmin} className="flex gap-2 max-w-md">
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Introduce clave secreta de admin..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={claimingAdmin || !adminSecret.trim()}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {claimingAdmin ? 'Comprobando...' : 'Reclamar Admin'}
            </button>
          </form>

          {adminNotice && <p className="text-xs text-emerald-400">{adminNotice}</p>}
          {adminError && <p className="text-xs text-red-400">{adminError}</p>}
        </div>
      )}
    </div>
  );
};
