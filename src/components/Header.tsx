import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import {
  Menu,
  X,
  Zap,
  Bell,
  Gift,
  Settings,
  Shield,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  mobileMenuOpen = false,
  setMobileMenuOpen,
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [giftModalOpen, setGiftModalOpen] = useState(false);

  const handleToggleMenu = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else if (setMobileMenuOpen) {
      setMobileMenuOpen(!mobileMenuOpen);
    }
  };

  // Format real points or display standard formatting
  const formattedPoints = user?.points != null ? Number(user.points).toLocaleString('de-DE') : '0';

  return (
    <>
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3.5 flex items-center justify-between select-none">
        {/* Left: Hamburger menu toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleMenu}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors focus:outline-none"
            aria-label="Menú principal"
            id="btn-header-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>

          {/* Logo G + GREY IA */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center text-left focus:outline-none group"
            id="btn-header-logo"
          >
            <BrandLogo size="sm" showText={true} showSubtitle={false} />
          </button>
        </div>

        {/* Right: Points indicator + Bell + Gift */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5">
          {/* Indicador de puntos (⚡ 12.560 pts) */}
          <button
            onClick={() => onNavigate('ajustes')}
            className="flex items-center space-x-1.5 bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 px-3 py-1.5 rounded-full transition-all focus:outline-none"
            title="Tus puntos disponibles"
            id="btn-header-points"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold text-white tracking-tight">
              {formattedPoints} pts
            </span>
          </button>

          {/* Campana de notificaciones con badge rojo */}
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors focus:outline-none"
            title="Notificaciones"
            id="btn-header-notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-black">
              0
            </span>
          </button>

          {/* Regalo (Gift box) */}
          <button
            onClick={() => setGiftModalOpen(true)}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors focus:outline-none"
            title="Recompensas y bonos diarios"
            id="btn-header-gift"
          >
            <Gift className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Notifications Drawer / Dropdown */}
      {notificationsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setNotificationsOpen(false)}
        >
          <div
            className="w-full max-w-sm h-full bg-zinc-950 border-l border-white/10 p-5 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold text-white">Notificaciones</h3>
                </div>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-8 text-center text-white/40 text-xs">
                <Bell className="w-8 h-8 mx-auto mb-2 text-white/20" />
                No tienes notificaciones pendientes.
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setNotificationsOpen(false);
                  onNavigate('historial');
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
              >
                Ver registro de actividad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift / Recompensas Modal */}
      {giftModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setGiftModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-950 border border-white/15 rounded-2xl p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mx-auto mb-4 text-yellow-400">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Bono de Bienvenida</h3>
            <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
              Tu cuenta tiene asignados créditos reales iniciales para explorar Chat, Director, Imagen, Video y Audio IA.
            </p>
            <div className="my-5 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/60">Saldo actual</span>
              <span className="text-sm font-bold text-white flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                {formattedPoints} pts
              </span>
            </div>
            <button
              onClick={() => {
                setGiftModalOpen(false);
                onNavigate('ajustes');
              }}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
            >
              Gestionar Puntos y Planes
            </button>
          </div>
        </div>
      )}
    </>
  );
};
