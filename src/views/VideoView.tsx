import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  Video as VideoIcon,
  Sparkles,
  Play,
  Clock,
  AlertCircle,
  Loader2,
  Coins,
  CheckCircle2,
  RefreshCw,
  Film,
  Key,
} from 'lucide-react';

export const VideoView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [duration, setDuration] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshingJobs, setRefreshingJobs] = useState(false);

  const fetchJobs = async () => {
    setRefreshingJobs(true);
    try {
      const res = await apiRequest<{ jobs: any[] }>('/video/jobs');
      setJobs(res.jobs || []);
    } catch (err: any) {
      console.error('Failed to fetch video jobs:', err);
    } finally {
      setRefreshingJobs(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setError(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ jobId: string; message: string }>('/video/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          aspectRatio,
          duration,
        }),
      });

      setSuccessNotice(res.message);
      await refreshUser();
      fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar la generación de vídeo.');
    } finally {
      setLoading(false);
    }
  };

  const getCost = (d: number) => {
    if (d <= 5) return 50;
    if (d <= 10) return 80;
    return 120;
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <VideoIcon className="w-3.5 h-3.5 text-white" />
            <span>Motor de Vídeo Real: Google Veo / Runway</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Generación de Vídeo Cinematográfico
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Genera tomas dinámicas con coherencia física, movimientos de cámara y resolución HD mediante los modelos Veo y Runway Gen-3.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-zinc-400" />
            <span>Coste: {getCost(duration)} pts</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Generation */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl">
            <form onSubmit={handleGenerate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                  Prompt del Vídeo (Cinematic Prompt)
                </label>
                <textarea
                  required
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ejemplo: Drone shot flying smoothly over a futuristic carbon-fiber metropolis at dusk, glowing triangular monorails, volumetric neon fog, ultra photorealistic, 8k cinematic lighting, 60fps..."
                  className="w-full p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                    Formato
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '9:16', label: '9:16 Vertical' },
                      { id: '16:9', label: '16:9 Cine' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setAspectRatio(fmt.id as any)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                          aspectRatio === fmt.id
                            ? 'bg-zinc-100 text-black border-white font-bold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                    Duración
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[5, 10, 15].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDuration(sec)}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-all ${
                          duration === sec
                            ? 'bg-zinc-100 text-black border-white font-bold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-red-200">Error en la ejecución:</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {successNotice && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{successNotice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Iniciando render con motor de vídeo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" />
                    <span>Generar Vídeo Real ({getCost(duration)} pts)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Video Generation Jobs / Queue Status */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" /> Cola de Renderización en Servidor
              </span>
              <button
                onClick={fetchJobs}
                disabled={refreshingJobs}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                title="Actualizar estado"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingJobs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs space-y-2">
                <Film className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-zinc-300 font-medium">No hay trabajos de vídeo registrados aún</p>
                <p>Las peticiones de Google Veo y Runway se procesan de forma asíncrona.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {jobs.map((job) => {
                  let payload: any = {};
                  try {
                    payload = JSON.parse(job.input_payload);
                  } catch {}

                  return (
                    <div
                      key={job.id}
                      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-zinc-800">
                          {payload.provider || 'Google Veo'}
                        </span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : job.status === 'FAILED'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-zinc-800 text-zinc-200 border border-zinc-700 animate-pulse'
                          }`}
                        >
                          {job.status === 'PROCESSING' ? 'En proceso' : job.status}
                        </span>
                      </div>

                      <p className="text-zinc-300 line-clamp-2 italic">
                        "{payload.prompt || 'Sin prompt'}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/60">
                        <span>
                          {payload.aspectRatio} • {payload.duration}s • {job.points_cost} pts
                        </span>
                        <span>{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {job.error_message && (
                        <p className="text-[11px] text-red-400 bg-red-950/30 p-2 rounded border border-red-900/40">
                          {job.error_message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
