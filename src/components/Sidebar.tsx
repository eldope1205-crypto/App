import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  MessageSquare,
  Film,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  Scissors,
  Share2,
  FolderKanban,
  Library,
  Clock,
  Settings,
  Shield,
  Palette,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  mobileMenuOpen = false,
  setMobileMenuOpen,
  isOpen = false,
  onClose,
}) => {
  const { user } = useAuth();
  const isDrawerOpen = isOpen || mobileMenuOpen;

  const handleClose = () => {
    if (onClose) onClose();
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  const mainTools = [
    { id: 'dashboard', label: 'Inicio', icon: Sparkles },
    { id: 'chat', label: 'Chat IA', icon: MessageSquare, badge: 'Flash' },
    { id: 'director', label: 'Director IA', icon: Film, badge: 'Core' },
    { id: 'imagen', label: 'Imagen IA', icon: ImageIcon },
    { id: 'editor-imagen', label: 'Editor Imagen', icon: Palette },
    { id: 'video', label: 'Vídeo IA', icon: VideoIcon, badge: 'Veo' },
    { id: 'editor-video', label: 'Editor Vídeo', icon: Scissors },
    { id: 'audio', label: 'Audio & Voz', icon: Mic },
    { id: 'viral', label: 'Creador Viral', icon: Share2 },
  ];

  const managementTools = [
    { id: 'proyectos', label: 'Proyectos', icon: FolderKanban },
    { id: 'biblioteca', label: 'Biblioteca', icon: Library },
    { id: 'historial', label: 'Historial', icon: Clock },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
  ];

  const handleNav = (viewId: string) => {
    onNavigate(viewId);
    handleClose();
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between select-none">
      <div className="space-y-6">
        {/* Main AI Generation Tools */}
        <div>
          <div className="px-3 mb-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40">
              Motores de Producción
            </span>
          </div>
          <nav className="flex flex-col space-y-1.5">
            {mainTools.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id || (item.id === 'imagen' && currentView === 'image');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs uppercase tracking-widest transition-all text-left group ${
                    active
                      ? 'text-white font-bold bg-white/5'
                      : 'text-white/40 hover:text-white hover:bg-white/5 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-1 h-4 rounded-full transition-all ${
                        active ? 'bg-white shadow-[0_0_8px_white]' : 'bg-transparent group-hover:bg-white/30'
                      }`}
                    />
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        active ? 'bg-white text-black font-bold' : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Management & Workspaces */}
        <div>
          <div className="px-3 mb-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40">
              Espacios de Trabajo
            </span>
          </div>
          <nav className="flex flex-col space-y-1.5">
            {managementTools.map((item) => {
              const Icon = item.icon;
              const active =
                currentView === item.id ||
                (item.id === 'proyectos' && currentView === 'projects') ||
                (item.id === 'biblioteca' && currentView === 'library') ||
                (item.id === 'historial' && currentView === 'history') ||
                (item.id === 'ajustes' && currentView === 'settings');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs uppercase tracking-widest transition-all text-left group ${
                    active
                      ? 'text-white font-bold bg-white/5'
                      : 'text-white/40 hover:text-white hover:bg-white/5 font-medium'
                  }`}
                >
                  <div
                    className={`w-1 h-4 rounded-full transition-all ${
                      active ? 'bg-white shadow-[0_0_8px_white]' : 'bg-transparent group-hover:bg-white/30'
                    }`}
                  />
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Admin Navigation (Privileged: OWNER, SUPER_ADMIN, ADMIN) */}
        {(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.email?.toLowerCase() === 'eldope1205@gmail.com') && (
          <div>
            <div className="px-3 mb-2.5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/40">
                Super Administración
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-black font-bold uppercase">
                {user?.role || 'OWNER'}
              </span>
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => handleNav('admin')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all text-left group ${
                  currentView === 'admin'
                    ? 'text-white font-bold bg-white/10 border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.08)]'
                    : 'text-white/70 hover:text-white hover:bg-white/5 border border-white/10'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-1.5 h-4 rounded-full transition-all ${
                      currentView === 'admin' ? 'bg-white shadow-[0_0_8px_white]' : 'bg-transparent group-hover:bg-white/40'
                    }`}
                  />
                  <Shield className="w-4 h-4 text-white" />
                  <span className="truncate">Panel de Control Total</span>
                </div>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Estado de APIs Monitor matching Design Theme */}
      <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl">
        <p className="text-[10px] text-white/50 uppercase tracking-wider font-mono mb-2.5">
          Estado de APIs
        </p>
        <div className="space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/70">Gemini 3.8</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/70">Runway Gen-3</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/70">ElevenLabs</span>
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-black border-r border-white/10 p-6 min-h-[calc(100vh-5rem)] overflow-y-auto">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex">
          <div className="w-4/5 max-w-xs bg-black border-r border-white/10 h-full p-6 flex flex-col justify-between overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/10">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-white">Navegación</span>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1">{navContent}</div>
          </div>
          <div className="flex-1" onClick={handleClose} />
        </div>
      )}
    </>
  );
};

