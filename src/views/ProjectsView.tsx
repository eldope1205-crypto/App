import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Project } from '../types';
import {
  FolderKanban,
  Plus,
  Play,
  Copy,
  Trash2,
  Clock,
  Scissors,
  Loader2,
  AlertCircle,
  Film,
} from 'lucide-react';

interface ProjectsViewProps {
  onNavigate: (view: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [showModal, setShowModal] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await apiRequest<{ projects: Project[] }>('/projects');
      setProjects(res.projects || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar proyectos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await apiRequest<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          aspect_ratio: aspectRatio,
          duration: 30,
        }),
      });
      setShowModal(false);
      setNewTitle('');
      onNavigate(`editor-video?id=${res.project.id}`);
    } catch (err: any) {
      setError(err.message || 'Error al crear proyecto.');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/projects/${id}/duplicate`, { method: 'POST' });
      fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Error al duplicar el proyecto.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;
    try {
      await apiRequest(`/projects/${id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el proyecto.');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <FolderKanban className="w-3.5 h-3.5 text-white" />
            <span>Gestión de Proyectos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Mis Proyectos Audiovisuales
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Administra tus composiciones multicapa, vídeos exportados y desgloses de producción.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/5"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proyecto</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">Cargando proyectos...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 space-y-3">
          <Film className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
            No tienes proyectos aún
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Crea una secuencia en blanco o genera un desglose completo a partir de una idea con el Director IA.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => onNavigate('director')}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-xs text-zinc-200 hover:text-white transition-colors"
            >
              Usar Director IA
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
            >
              Crear en blanco
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onNavigate(`editor-video?id=${p.id}`)}
              className="group p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-900/60 transition-all flex flex-col justify-between cursor-pointer space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold uppercase">
                    {p.aspect_ratio}
                  </span>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDuplicate(p.id, e)}
                      className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
                      title="Duplicar proyecto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-white text-sm group-hover:text-zinc-200 transition-colors">
                  {p.title}
                </h3>
                {p.description && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {p.duration}s
                </span>
                <span className="font-semibold text-zinc-300 group-hover:text-white flex items-center gap-1">
                  Editar <Scissors className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
              Crear Nuevo Proyecto
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Título del Proyecto
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej. Comercial Primavera 2026"
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Formato / Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['9:16', '16:9', '1:1'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setAspectRatio(fmt as any)}
                      className={`py-2 rounded-lg text-xs font-semibold border ${
                        aspectRatio === fmt
                          ? 'bg-zinc-100 text-black border-white'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear y Editar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
