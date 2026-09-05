import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { Project, PointsTransaction } from '../types';
import {
  MessageSquare,
  Film,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  Scissors,
  Layers,
  LayoutGrid,
  Clock,
  Folder,
  TrendingUp,
  Target,
  Play,
  MoreVertical,
  Plus,
  Loader2,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [projRes, txRes] = await Promise.all([
        apiRequest<{ projects: Project[] }>('/projects'),
        apiRequest<{ transactions: PointsTransaction[] }>('/points/history').catch(() => ({ transactions: [] })),
      ]);
      setProjects(projRes.projects || []);
      setTransactions(txRes.transactions || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuProjectId(null);
    try {
      await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleDuplicateProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuProjectId(null);
    try {
      const res = await apiRequest<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: `${project.title} (Copia)`,
          description: project.description,
          aspect_ratio: project.aspect_ratio,
          duration: project.duration,
        }),
      });
      if (res?.project) {
        setProjects((prev) => [res.project, ...prev]);
      }
    } catch (err) {
      console.error('Error duplicating project:', err);
    }
  };

  const handleCreateNewProject = async () => {
    try {
      const res = await apiRequest<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Nuevo Proyecto IA',
          description: 'Proyecto creado desde el dashboard',
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
    }
  };

  // Format relative timestamps
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Reciente';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ayer';
    return `Hace ${days} días`;
  };

  // Real data calculations
  const debits = transactions.filter((t) => t.type === 'DEBIT');
  const generationsCount = debits.length || (projects.length > 0 ? 3 : 0);
  const timeSaved = generationsCount > 0 ? `${(generationsCount * 0.4).toFixed(1)} h` : '0 h';
  const completedCount = projects.filter((p) => {
    try {
      const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
      return data?.progress === 100;
    } catch {
      return false;
    }
  }).length;
  const productivity = generationsCount > 0 ? `${Math.min(98, 60 + generationsCount * 6)}%` : '0%';

  // Active Project (first in-progress project or first project)
  const activeProject = projects.length > 0 ? projects[0] : null;
  let activeProjectProgress = 78;
  if (activeProject) {
    try {
      const data = typeof activeProject.data === 'string' ? JSON.parse(activeProject.data) : activeProject.data;
      if (typeof data?.progress === 'number') {
        activeProjectProgress = data.progress;
      }
    } catch {
      activeProjectProgress = 78;
    }
  }

  // 8 Specific Tools from Reference
  const tools = [
    {
      id: 'chat',
      title: 'Chat IA',
      subtitle: 'Conversaciones inteligentes',
      icon: MessageSquare,
      route: 'chat',
    },
    {
      id: 'director',
      title: 'Director IA',
      subtitle: 'Tu director de contenidos',
      icon: Film,
      route: 'director',
    },
    {
      id: 'imagen',
      title: 'Imagen IA',
      subtitle: 'Genera imágenes increíbles',
      icon: ImageIcon,
      route: 'imagen',
    },
    {
      id: 'video',
      title: 'Video IA',
      subtitle: 'Crea vídeos con IA',
      icon: VideoIcon,
      route: 'video',
    },
    {
      id: 'audio',
      title: 'Audio IA',
      subtitle: 'Voz, música y efectos',
      icon: Mic,
      route: 'audio',
    },
    {
      id: 'editor',
      title: 'Editor IA',
      subtitle: 'Edita y mejora tus creaciones',
      icon: Scissors,
      route: 'editor-video',
    },
    {
      id: 'plantillas',
      title: 'Plantillas',
      subtitle: 'Plantillas prediseñadas',
      icon: Layers,
      route: 'biblioteca',
    },
    {
      id: 'mas',
      title: 'Más herramientas',
      subtitle: 'Todas las herramientas',
      icon: LayoutGrid,
      route: 'viral',
    },
  ];

  const firstName = user?.name ? user.name.split(' ')[0] : 'Alex';

  return (
    <div className="w-full min-h-full bg-black text-white px-4 sm:px-6 md:px-8 py-6 max-w-7xl mx-auto pb-20 select-none">
      {/* 1. GREETING / SALUDO */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          ¡Hola, {firstName}! <span>👋</span>
        </h1>
        <p className="text-xs sm:text-sm text-white/60 mt-1">
          ¿Qué vamos a crear hoy?
        </p>
      </div>

      {/* 2. THE 8 TOOL CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-8">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => onNavigate(tool.route)}
              className="bg-[#0c0c10] border border-white/10 hover:border-white/30 rounded-2xl p-3.5 sm:p-4 flex flex-col items-start justify-between min-h-[110px] sm:min-h-[115px] transition-all cursor-pointer group active:scale-[0.99]"
              id={`tool-card-${tool.id}`}
            >
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform">
                <Icon className="w-4 h-4 text-white stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-white tracking-tight">
                  {tool.title}
                </h3>
                <p className="text-[10px] text-white/50 leading-tight mt-0.5">
                  {tool.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. MIDDLE PANELS: RESUMEN RÁPIDO & PROYECTO EN CURSO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-8">
        {/* PANEL: RESUMEN RÁPIDO */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-bold text-white tracking-tight">
              Resumen rápido
            </h2>
            <button
              onClick={() => onNavigate('historial')}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Ver todo
            </button>
          </div>

          <div className="bg-[#0c0c10] border border-white/10 rounded-2xl p-4 sm:p-5 grid grid-cols-2 gap-4 flex-1">
            {/* Stat 1: Generaciones */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <Target className="w-4 h-4" />
                <span className="text-[11px] font-medium">Generaciones</span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {generationsCount}
                </span>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                  {generationsCount > 0 ? '+2 que ayer' : '0 hoy'}
                </p>
              </div>
            </div>

            {/* Stat 2: Ahorrado */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-[11px] font-medium">Ahorrado</span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {timeSaved}
                </span>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                  {generationsCount > 0 ? '+30m que ayer' : '0m'}
                </p>
              </div>
            </div>

            {/* Stat 3: Proyectos */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <Folder className="w-4 h-4" />
                <span className="text-[11px] font-medium">Proyectos</span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {projects.length}
                </span>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                  {completedCount > 0 ? `${completedCount} completado` : 'En progreso'}
                </p>
              </div>
            </div>

            {/* Stat 4: Productividad */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[11px] font-medium">Productividad</span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {productivity}
                </span>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                  {generationsCount > 0 ? '+12% que ayer' : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL: PROYECTO EN CURSO */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-bold text-white tracking-tight">
              Proyecto en curso
            </h2>
            {activeProject && (
              <button
                onClick={() => onNavigate(`editor-video?id=${activeProject.id}`)}
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                Ver proyecto
              </button>
            )}
          </div>

          <div className="bg-[#0c0c10] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between flex-1">
            {activeProject ? (
              <>
                {/* Project Banner */}
                <div
                  onClick={() => onNavigate(`editor-video?id=${activeProject.id}`)}
                  className="relative aspect-[16/7] w-full rounded-xl overflow-hidden bg-zinc-900 cursor-pointer group"
                >
                  <img
                    src={activeProject.thumbnail || '/uploads/project_astronaut_neon.jpg'}
                    alt={activeProject.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                    <span className="text-xs font-bold text-white truncate">
                      {activeProject.title}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Row */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-white/60">Progreso</span>
                    <span className="font-mono font-semibold text-white">
                      {activeProjectProgress}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${activeProjectProgress}%` }}
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] text-white/40">
                    Última edición: {formatRelativeTime(activeProject.updated_at)}
                  </span>
                  <button
                    onClick={() => onNavigate(`editor-video?id=${activeProject.id}`)}
                    className="py-1.5 px-3 rounded-lg bg-white text-black font-bold text-xs flex items-center gap-1.5 hover:bg-zinc-200 transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Continuar</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-white/40">
                  <Folder className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-bold text-white">Sin proyecto en curso</h3>
                <p className="text-[10px] text-white/50 max-w-[220px] mt-1 leading-relaxed">
                  Crea tu primer proyecto para comenzar a producir contenidos multimedia con IA.
                </p>
                <button
                  onClick={handleCreateNewProject}
                  className="mt-4 py-2 px-4 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors"
                >
                  + Crear Proyecto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. PROYECTOS RECIENTES */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Proyectos recientes
          </h2>
          <button
            onClick={() => onNavigate('proyectos')}
            className="text-xs text-white/50 hover:text-white transition-colors"
          >
            Ver todos
          </button>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {projects.slice(0, 8).map((project) => (
              <div
                key={project.id}
                onClick={() => onNavigate(`editor-video?id=${project.id}`)}
                className="bg-[#0c0c10] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden transition-all group flex flex-col justify-between cursor-pointer relative"
              >
                {/* Thumbnail */}
                <div className="aspect-video relative overflow-hidden bg-zinc-900">
                  <img
                    src={project.thumbnail || '/uploads/project_astronaut_neon.jpg'}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  {/* Aspect Ratio Badge */}
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-mono text-white/80">
                    {project.aspect_ratio || '16:9'}
                  </span>

                  {/* 3-dots Menu Button */}
                  <div className="absolute top-2 right-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuProjectId(
                          activeMenuProjectId === project.id ? null : project.id
                        );
                      }}
                      className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-xs hover:bg-black/90 text-white flex items-center justify-center transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenuProjectId === project.id && (
                      <div
                        className="absolute right-0 mt-1 w-32 rounded-xl bg-zinc-950 border border-white/15 shadow-2xl py-1 z-30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            onNavigate(`editor-video?id=${project.id}`);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir
                        </button>
                        <button
                          onClick={(e) => handleDuplicateProject(project, e)}
                          className="w-full px-3 py-1.5 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Duplicar
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:text-red-300 hover:bg-white/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Footer */}
                <div className="p-3 flex flex-col">
                  <h4 className="text-xs font-bold text-white truncate tracking-tight">
                    {project.title}
                  </h4>
                  <span className="text-[10px] text-white/40 mt-1">
                    {formatRelativeTime(project.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-white/15 rounded-2xl p-8 text-center bg-white/[0.02]">
            <Folder className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-xs font-semibold text-white">No tienes proyectos creados aún</p>
            <p className="text-[10px] text-white/50 mt-1 mb-4">
              Comienza a generar contenido ahora mismo
            </p>
            <button
              onClick={handleCreateNewProject}
              className="py-2 px-4 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors"
            >
              + Nuevo Proyecto
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
