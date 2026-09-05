import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { Project, PointsTransaction } from '../types';
import {
  MessageSquare,
  Scan,
  Image as ImageIcon,
  Clapperboard,
  AudioWaveform,
  Scissors,
  Layers,
  LayoutGrid,
  Clock,
  Folder,
  TrendingUp,
  Play,
  MoreVertical,
  FileText,
  Volume2,
  Video as VideoIcon,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

// 8 Sample Reference Projects matching the design in the photo
const REFERENCE_PROJECTS = [
  {
    id: 'ref-1',
    title: 'Vídeo TikTok IA Futuro',
    thumbnail: '/uploads/project_astronaut_neon.jpg',
    timeLabel: 'Hace 2 horas',
    iconType: 'video',
    aspect_ratio: '9:16',
    progress: 78,
  },
  {
    id: 'ref-2',
    title: 'Guion YouTube - Viajes',
    thumbnail: '/uploads/project_mountains.jpg',
    timeLabel: 'Ayer',
    iconType: 'document',
    aspect_ratio: '16:9',
    progress: 100,
  },
  {
    id: 'ref-3',
    title: 'Campaña Anuncio Tech',
    thumbnail: '/uploads/project_tech_city.jpg',
    timeLabel: '2 días atrás',
    iconType: 'image',
    aspect_ratio: '16:9',
    progress: 65,
  },
  {
    id: 'ref-4',
    title: 'Imagen Espacial',
    thumbnail: '/uploads/project_astronaut_neon.jpg',
    timeLabel: '3 días atrás',
    iconType: 'image',
    aspect_ratio: '1:1',
    progress: 100,
  },
  {
    id: 'ref-5',
    title: 'Voz en off - Podcast',
    thumbnail: '/uploads/project_mic_podcast.jpg',
    timeLabel: '3 días atrás',
    iconType: 'audio',
    aspect_ratio: '16:9',
    progress: 90,
  },
  {
    id: 'ref-6',
    title: 'Guion Corto Inspiracional',
    thumbnail: '/uploads/project_forest_sun.jpg',
    timeLabel: '4 días atrás',
    iconType: 'document',
    aspect_ratio: '9:16',
    progress: 85,
  },
  {
    id: 'ref-7',
    title: 'Personaje IA Cyberpunk',
    thumbnail: '/uploads/project_cyberpunk.jpg',
    timeLabel: '5 días atrás',
    iconType: 'image',
    aspect_ratio: '9:16',
    progress: 100,
  },
  {
    id: 'ref-8',
    title: 'Vídeo Promo Producto',
    thumbnail: '/uploads/project_product_bottle.jpg',
    timeLabel: '5 días atrás',
    iconType: 'video',
    aspect_ratio: '1:1',
    progress: 95,
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [, setTransactions] = useState<PointsTransaction[]>([]);
  const [, setLoading] = useState(true);
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
      icon: Scan,
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
      title: 'Vídeo IA',
      subtitle: 'Crea vídeos con IA',
      icon: Clapperboard,
      route: 'video',
    },
    {
      id: 'audio',
      title: 'Audio IA',
      subtitle: 'Voz, música y efectos',
      icon: AudioWaveform,
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

  // Helper to map project icon based on title or type
  const getIconForProject = (title: string, iconType?: string) => {
    if (iconType === 'video') return VideoIcon;
    if (iconType === 'document') return FileText;
    if (iconType === 'audio') return Volume2;
    if (iconType === 'image') return ImageIcon;

    const lower = title.toLowerCase();
    if (lower.includes('vídeo') || lower.includes('video') || lower.includes('promo') || lower.includes('tiktok')) {
      return VideoIcon;
    }
    if (lower.includes('guion') || lower.includes('texto') || lower.includes('script')) {
      return FileText;
    }
    if (lower.includes('voz') || lower.includes('podcast') || lower.includes('audio') || lower.includes('música')) {
      return Volume2;
    }
    return ImageIcon;
  };

  // Helper for relative timestamps matching reference style
  const getRelativeTimeLabel = (index: number, dateStr?: string) => {
    if (REFERENCE_PROJECTS[index]?.timeLabel) {
      return REFERENCE_PROJECTS[index].timeLabel;
    }
    if (!dateStr) return 'Reciente';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Ahora mismo';
    if (hours < 24) return `Hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ayer';
    return `${days} días atrás`;
  };

  // Merge projects from DB with reference structure to guarantee 8 exact visual cards
  const displayProjects = projects.length >= 8
    ? projects.slice(0, 8)
    : [
        ...projects,
        ...REFERENCE_PROJECTS.slice(projects.length, 8).map((ref) => ({
          id: ref.id,
          title: ref.title,
          description: '',
          aspect_ratio: ref.aspect_ratio,
          duration: 15,
          thumbnail: ref.thumbnail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Project)),
      ];

  return (
    <div className="w-full min-h-full bg-black text-white px-4 sm:px-6 md:px-8 py-5 max-w-7xl mx-auto pb-20 select-none">
      {/* 1. GREETING / SALUDO */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          ¡Hola, {firstName}! <span>👋</span>
        </h1>
        <p className="text-xs sm:text-sm text-white/50 mt-1 font-normal">
          ¿Qué vamos a crear hoy?
        </p>
      </div>

      {/* 2. THE 8 TOOL CARDS (4 COLUMNS EXACTLY AS IN PHOTO) */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => onNavigate(tool.route)}
              className="bg-[#0d0d12] border border-white/[0.08] hover:border-white/20 rounded-2xl p-2.5 sm:p-3.5 flex flex-col items-center justify-center text-center min-h-[110px] sm:min-h-[120px] transition-all cursor-pointer group active:scale-[0.98]"
              id={`tool-card-${tool.id}`}
            >
              <div className="text-white mb-2 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[1.8]" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight text-center leading-tight">
                {tool.title}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-white/50 leading-tight text-center mt-1 line-clamp-2">
                {tool.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* 3. MIDDLE PANELS: RESUMEN RÁPIDO & PROYECTO EN CURSO (2 COLUMNS SIDE-BY-SIDE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6">
        {/* PANEL IZQUIERDO: RESUMEN RÁPIDO */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Resumen rápido
            </h2>
            <button
              onClick={() => onNavigate('historial')}
              className="text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors"
            >
              Ver todo
            </button>
          </div>

          <div className="bg-[#0d0d12] border border-white/[0.08] rounded-2xl p-3.5 sm:p-4 grid grid-cols-2 gap-3 sm:gap-4 flex-1">
            {/* Stat 1: Generaciones */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-white stroke-[1.8]" />
                <span className="text-lg sm:text-xl font-bold text-white tracking-tight">3</span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">Generaciones</p>
              <p className="text-[10px] text-emerald-400 font-medium mt-0.5">+2 que ayer</p>
            </div>

            {/* Stat 2: Ahorrado */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-white stroke-[1.8]" />
                <span className="text-lg sm:text-xl font-bold text-white tracking-tight">1.2 h</span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">Ahorrado</p>
              <p className="text-[10px] text-emerald-400 font-medium mt-0.5">+30m que ayer</p>
            </div>

            {/* Stat 3: Proyectos */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-white stroke-[1.8]" />
                <span className="text-lg sm:text-xl font-bold text-white tracking-tight">2</span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">Proyectos</p>
              <p className="text-[10px] text-emerald-400 font-medium mt-0.5">1 completado</p>
            </div>

            {/* Stat 4: Productividad */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-white stroke-[1.8]" />
                <span className="text-lg sm:text-xl font-bold text-white tracking-tight">78%</span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">Productividad</p>
              <p className="text-[10px] text-emerald-400 font-medium mt-0.5">+12% que ayer</p>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: PROYECTO EN CURSO */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Proyecto en curso
            </h2>
            <button
              onClick={() => onNavigate('editor-video?id=ref-1')}
              className="text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors"
            >
              Ver proyecto
            </button>
          </div>

          <div className="bg-[#0d0d12] border border-white/[0.08] rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between flex-1">
            {/* Project Thumbnail Image */}
            <div
              onClick={() => onNavigate('editor-video?id=ref-1')}
              className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-zinc-900 mb-2.5 cursor-pointer group relative"
            >
              <img
                src="/uploads/project_astronaut_neon.jpg"
                alt="Vídeo TikTok IA Futuro"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Title */}
            <h3 className="text-xs sm:text-sm font-bold text-white truncate tracking-tight mb-2">
              Vídeo TikTok IA Futuro
            </h3>

            {/* Progress Bar Row */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: '78%' }}
                />
              </div>
              <span className="text-[10px] font-mono text-white/70">78%</span>
            </div>

            {/* Footer Row */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-white/50">
                Última edición: Hoy, 9:30
              </span>
              <button
                onClick={() => onNavigate('editor-video?id=ref-1')}
                className="border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 rounded-full px-2.5 py-1 text-[11px] font-medium text-white flex items-center gap-1 transition-colors"
              >
                <Play className="w-3 h-3 text-white fill-transparent stroke-[2]" />
                <span>Continuar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PROYECTOS RECIENTES (2 COLUMNS, EXACTLY 8 CARDS) */}
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

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {displayProjects.map((project, idx) => {
            const ProjectIcon = getIconForProject(project.title, (project as any).iconType);
            const timeLabel = getRelativeTimeLabel(idx, project.updated_at);

            return (
              <div
                key={project.id || `proj-${idx}`}
                onClick={() => onNavigate(`editor-video?id=${project.id}`)}
                className="bg-[#0d0d12] border border-white/[0.08] hover:border-white/20 rounded-2xl overflow-hidden transition-all group flex flex-col justify-between cursor-pointer relative"
              >
                {/* Thumbnail Container */}
                <div className="aspect-[16/10] relative overflow-hidden bg-zinc-900">
                  <img
                    src={project.thumbnail || REFERENCE_PROJECTS[idx]?.thumbnail || '/uploads/project_astronaut_neon.jpg'}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />

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
                      className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-xs hover:bg-black/90 text-white flex items-center justify-center transition-colors"
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

                {/* Card Info Footer */}
                <div className="p-2.5 sm:p-3 flex flex-col">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate tracking-tight">
                    {project.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-white/50 mt-1">
                    <ProjectIcon className="w-3 h-3 text-white/60 shrink-0" />
                    <span className="truncate">{timeLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
