import React, { useState } from 'react';
import { Home, Folder, Plus, Clock, Settings, X, Film, Sparkles, MessageSquare, Image, Mic } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface BottomNavigationProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentView,
  onNavigate,
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleQuickCreate = async (type: string) => {
    setCreateModalOpen(false);
    if (type === 'project') {
      setCreating(true);
      try {
        const res = await apiRequest<{ project: { id: string } }>('/projects', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Nuevo Proyecto IA',
            description: 'Proyecto creado desde el acceso rápido',
            aspect_ratio: '9:16',
            duration: 15,
          }),
        });
        if (res?.project?.id) {
          onNavigate(`editor-video?id=${res.project.id}`);
        } else {
          onNavigate('proyectos');
        }
      } catch (err) {
        console.error('Error creating project:', err);
        onNavigate('proyectos');
      } finally {
        setCreating(false);
      }
    } else {
      onNavigate(type);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: Home },
    { id: 'proyectos', label: 'Proyectos', icon: Folder },
    { id: 'crear', label: 'Crear', icon: Plus, isAction: true },
    { id: 'historial', label: 'Historial', icon: Clock },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
  ];

  const isCurrent = (id: string) => {
    if (id === 'dashboard') return currentView === 'dashboard';
    if (id === 'proyectos') return currentView === 'proyectos' || currentView === 'projects' || currentView.startsWith('editor');
    if (id === 'historial') return currentView === 'historial' || currentView === 'history';
    if (id === 'ajustes') return currentView === 'ajustes' || currentView === 'settings';
    return currentView === id;
  };

  return (
    <>
      <nav
        className="sticky bottom-0 z-40 w-full bg-black/95 backdrop-blur-md border-t border-white/10 px-4 pt-2 pb-1 flex flex-col items-center select-none"
        id="bottom-navigation-bar"
      >
        <div className="w-full flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(item.id);

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={() => setCreateModalOpen(true)}
                  className="relative -top-2 flex flex-col items-center focus:outline-none group"
                  id="btn-nav-crear"
                  aria-label="Crear nuevo proyecto o contenido"
                >
                  <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)] group-hover:scale-105 transition-all">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-medium text-white/70 group-hover:text-white mt-1">
                    Crear
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all focus:outline-none ${
                  active ? 'text-white' : 'text-white/40 hover:text-white/80'
                }`}
                id={`btn-nav-${item.id}`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                <span className={`text-[10px] mt-1 tracking-tight ${active ? 'font-semibold text-white' : 'font-normal'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Home Indicator Bar matching the reference phone mockup */}
        <div className="w-32 h-1 bg-white/20 rounded-full mt-1 mb-0.5" />
      </nav>

      {/* Creation Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-zinc-950 border border-white/15 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <h3 className="text-base font-bold text-white">Crear Nuevo Contenido</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4">
              <button
                onClick={() => handleQuickCreate('project')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-left transition-all group"
              >
                <Film className="w-5 h-5 text-white mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Nuevo Proyecto</p>
                <p className="text-[10px] text-white/50 mt-0.5">Timeline y editor multipista</p>
              </button>

              <button
                onClick={() => handleQuickCreate('director')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-left transition-all group"
              >
                <Sparkles className="w-5 h-5 text-white mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Director IA</p>
                <p className="text-[10px] text-white/50 mt-0.5">Generación de guión y tomas</p>
              </button>

              <button
                onClick={() => handleQuickCreate('imagen')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-left transition-all group"
              >
                <Image className="w-5 h-5 text-white mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Imagen IA</p>
                <p className="text-[10px] text-white/50 mt-0.5">Generar arte y fotografía</p>
              </button>

              <button
                onClick={() => handleQuickCreate('chat')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-left transition-all group"
              >
                <MessageSquare className="w-5 h-5 text-white mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Chat IA</p>
                <p className="text-[10px] text-white/50 mt-0.5">Asistente creativo Gemini</p>
              </button>

              <button
                onClick={() => handleQuickCreate('video')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-left transition-all group"
              >
                <Film className="w-5 h-5 text-white mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Video IA</p>
                <p className="text-[10px] text-white/50 mt-0.5">Renderizado cinemático</p>
              </button>

              <button
                onClick={() => handleQuickCreate('audio')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 text-left transition-all group"
              >
                <Mic className="w-5 h-5 text-white mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Audio & Voz</p>
                <p className="text-[10px] text-white/50 mt-0.5">Locución y efectos</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
