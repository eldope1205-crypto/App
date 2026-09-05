import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { DirectorPlan } from '../types';
import {
  Film,
  Sparkles,
  ArrowRight,
  Clock,
  Video as VideoIcon,
  Mic,
  Camera,
  Layers,
  FileCheck,
  AlertCircle,
  Loader2,
  Coins,
  Check,
  Copy,
} from 'lucide-react';

interface DirectorViewProps {
  onNavigate: (view: string) => void;
}

export const DirectorView: React.FC<DirectorViewProps> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directorPlan, setDirectorPlan] = useState<DirectorPlan | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ plan: DirectorPlan; pointsRemaining: number }>('/director/plan', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          aspectRatio,
          targetDuration,
        }),
      });

      setDirectorPlan(res.plan);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Error al generar desglose con Director IA.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportToEditor = async () => {
    if (!directorPlan || exporting) return;
    setExporting(true);
    setError(null);

    try {
      const res = await apiRequest<{ projectId: string; message: string }>('/director/export-to-project', {
        method: 'POST',
        body: JSON.stringify({ plan: directorPlan }),
      });
      // Navigate directly into Video Editor with project ID
      onNavigate(`editor-video?id=${res.projectId}`);
    } catch (err: any) {
      setError(err.message || 'Error al exportar el proyecto al editor.');
    } finally {
      setExporting(false);
    }
  };

  const copyPrompt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <Film className="w-3.5 h-3.5 text-white" />
            <span>Director IA Cinematográfico</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Planificación y Dirección Audiovisual
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Descompone tu idea en un guion técnico cinematográfico: escenas calculadas al segundo, prompts visuales para vídeo, narración y efectos de sonido.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-zinc-400" />
            <span>Coste: 40 pts</span>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl">
        <form onSubmit={handleGeneratePlan} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              ¿Cuál es la idea, concepto o historia que quieres dirigir?
            </label>
            <textarea
              required
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ejemplo: Un documental cinematográfico de 30 segundos sobre cómo la computación cuántica cambiará la medicina en el año 2035. Tono misterioso y esperanzador."
              className="w-full p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                Formato / Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '9:16', label: '9:16 (Vertical / TikTok)' },
                  { id: '16:9', label: '16:9 (Horizontal / Cine)' },
                  { id: '1:1', label: '1:1 (Cuadrado)' },
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
                    {fmt.id}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                Duración Objetivo
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { sec: 15, label: '15 segundos' },
                  { sec: 30, label: '30 segundos' },
                  { sec: 60, label: '60 segundos' },
                ].map((dur) => (
                  <button
                    key={dur.sec}
                    type="button"
                    onClick={() => setTargetDuration(dur.sec)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                      targetDuration === dur.sec
                        ? 'bg-zinc-100 text-black border-white font-bold'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    {dur.sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Director IA diseñando producción...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Desarrollar Producción Completa (40 pts)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Director Plan Display */}
      {directorPlan && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Plan Overview Card */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-700/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-700 font-bold uppercase text-zinc-300">
                  {directorPlan.genre || 'Cinemático'}
                </span>
                <span className="text-xs text-zinc-400">•</span>
                <span className="text-xs text-zinc-400">{directorPlan.aspectRatio}</span>
                <span className="text-xs text-zinc-400">•</span>
                <span className="text-xs text-zinc-400">{directorPlan.totalDuration} segundos</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Space_Grotesk']">
                {directorPlan.title}
              </h2>
              <p className="text-xs text-zinc-300 mt-1 max-w-2xl">{directorPlan.logline}</p>
            </div>

            <button
              onClick={handleExportToEditor}
              disabled={exporting}
              className="px-6 py-3.5 rounded-xl bg-zinc-100 text-black font-bold text-sm hover:bg-white transition-all flex items-center gap-2 shadow-xl shadow-white/10 shrink-0 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Cargar en Editor de Vídeo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Scenes Breakdown */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight font-['Space_Grotesk']">
              Desglose de Escenas ({directorPlan.scenes?.length || 0} Planos)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {directorPlan.scenes?.map((scene, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-white">
                        {scene.sceneNumber || idx + 1}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{scene.title}</h4>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">{scene.duration}s</span>
                  </div>

                  {/* Visual prompt */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1.5">
                        <VideoIcon className="w-3.5 h-3.5 text-zinc-400" /> Prompt Visual
                      </span>
                      <button
                        onClick={() => copyPrompt(scene.visualPrompt, idx)}
                        className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800/70 font-mono">
                      {scene.visualPrompt}
                    </p>
                  </div>

                  {/* Camera motion */}
                  {scene.cameraMotion && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Camera className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Movimiento de cámara: <strong className="text-zinc-200">{scene.cameraMotion}</strong></span>
                    </div>
                  )}

                  {/* Narration voice */}
                  <div>
                    <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-zinc-400" /> Guion Voz en Off
                    </span>
                    <p className="text-xs text-zinc-200 italic bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-800/50">
                      "{scene.narrationScript}"
                    </p>
                  </div>

                  {/* Sound FX */}
                  {scene.soundEffects && (
                    <div className="text-[11px] text-zinc-400">
                      Sonido FX: <span className="text-zinc-300">{scene.soundEffects}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
