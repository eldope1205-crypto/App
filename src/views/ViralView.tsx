import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { ViralKit } from '../types';
import {
  Share2,
  Sparkles,
  Copy,
  Check,
  Coins,
  AlertCircle,
  Loader2,
  Flame,
  FileText,
  Hash,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export const ViralView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<'tiktok' | 'shorts' | 'reels' | 'youtube'>('tiktok');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viralKit, setViralKit] = useState<ViralKit | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ viralKit: ViralKit; pointsRemaining: number }>('/viral/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          platform,
          niche,
        }),
      });

      setViralKit(res.viralKit);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Error al generar kit viral.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <Share2 className="w-3.5 h-3.5 text-white" />
            <span>Creador de Contenido Viral</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Ganchos y Guiones de Alta Retención
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Estrategias de psicología algorítmica para TikTok, Reels y Shorts: hooks que detienen el scroll, guiones cronometrados y hashtags optimizados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-zinc-400" />
            <span>Coste: 15 pts</span>
          </div>
        </div>
      </div>

      {/* Form Generator */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl">
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                Tema central o idea del vídeo
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ejemplo: Por qué nunca deberías dormir con el móvil al lado de la cama"
                className="w-full px-4 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                Nicho / Audiencia objetivo
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ejemplo: Salud, Productividad, Emprendedores jóvenes"
                className="w-full px-4 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
              Plataforma
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'tiktok', label: 'TikTok' },
                { id: 'reels', label: 'Instagram Reels' },
                { id: 'shorts', label: 'YouTube Shorts' },
                { id: 'youtube', label: 'YouTube Largo' },
              ].map((plt) => (
                <button
                  key={plt.id}
                  type="button"
                  onClick={() => setPlatform(plt.id as any)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                    platform === plt.id
                      ? 'bg-zinc-100 text-black border-white font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {plt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Diseñando estrategia viral...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Generar Kit Viral (15 pts)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Kit Display */}
      {viralKit && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3">
          {/* Hooks Section */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h3 className="text-base font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
                <Flame className="w-4 h-4 text-zinc-300" /> 5 Ganchos de Retención Inmediata (0-3 segundos)
              </h3>
              <span className="text-xs text-zinc-400">Detén el scroll</span>
            </div>

            <div className="space-y-2.5">
              {viralKit.hooks.map((hook, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between gap-4 text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-white">"{hook}"</span>
                  </div>
                  <button
                    onClick={() => copyText(hook, `hook-${i}`)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                    title="Copiar gancho"
                  >
                    {copiedKey === `hook-${i}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Full Script */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h3 className="text-base font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-300" /> Guion Completo Cronometrado
              </h3>
              <button
                onClick={() => copyText(viralKit.fullScript, 'script')}
                className="text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                {copiedKey === 'script' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Guion</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap">
              {viralKit.fullScript}
            </div>
          </div>

          {/* Titles & Hashtags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
              <h4 className="text-sm font-bold text-white font-['Space_Grotesk']">
                Títulos de Alta Conversión (CTR)
              </h4>
              <div className="space-y-2">
                {viralKit.titles.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-200 font-medium">{t}</span>
                    <button
                      onClick={() => copyText(t, `title-${idx}`)}
                      className="text-zinc-400 hover:text-white"
                    >
                      {copiedKey === `title-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
              <h4 className="text-sm font-bold text-white font-['Space_Grotesk'] flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-zinc-400" /> Hashtags Optimizados
              </h4>
              <div className="flex flex-wrap gap-2">
                {viralKit.hashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    onClick={() => copyText(tag, `tag-${idx}`)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 cursor-pointer transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {viralKit.visualTips && (
                <div className="pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                  <strong className="text-zinc-300 block mb-1">Consejo visual:</strong>
                  {viralKit.visualTips}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
