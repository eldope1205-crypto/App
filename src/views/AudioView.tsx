import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  Mic,
  Play,
  Pause,
  Download,
  Coins,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Volume2,
  Save,
} from 'lucide-react';

export const AudioView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('Kore');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const voices = [
    { id: 'Kore', name: 'Kore', gender: 'Femenina', desc: 'Calmada, profesional y elegante' },
    { id: 'Zephyr', name: 'Zephyr', gender: 'Masculina', desc: 'Enérgica y clara para ganchos virales' },
    { id: 'Puck', name: 'Puck', gender: 'Masculina', desc: 'Juvenil, dinámica y conversacional' },
    { id: 'Fenrir', name: 'Fenrir', gender: 'Masculina', desc: 'Profunda, cinematográfica y autoritaria' },
    { id: 'Aoede', name: 'Aoede', gender: 'Femenina', desc: 'Narrativa, suave para documentales' },
  ];

  const handleGenerateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ audioUrl: string; provider: string; pointsRemaining: number }>('/audio/generate', {
        method: 'POST',
        body: JSON.stringify({
          text,
          voice,
        }),
      });

      setAudioUrl(res.audioUrl);
      setProviderUsed(res.provider);
      setNotice(`Voz generada exitosamente con ${res.provider} y guardada en tu biblioteca.`);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Error al sintetizar la voz.');
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioUrl) return;
    if (!audioRef) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioRef(audio);
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioRef.pause();
        setIsPlaying(false);
      } else {
        audioRef.play();
        setIsPlaying(true);
      }
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `grey-ia-voice-${Date.now()}.wav`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <Mic className="w-3.5 h-3.5 text-white" />
            <span>Síntesis Vocal & Audio IA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Voz Humana Hiperrealista
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Sintetiza narraciones fluidas con entonación natural, pausas orgánicas y acentos adaptados para documentales, anuncios y reels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-zinc-400" />
            <span>Coste: 20 pts</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl">
            <form onSubmit={handleGenerateVoice} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                  Guion o Texto a Locutar
                </label>
                <textarea
                  required
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ejemplo: Bienvenido al futuro de la inteligencia artificial. En este vídeo descubrirás las tres tecnologías que transformarán tu carrera profesional en los próximos meses..."
                  className="w-full p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                  Voz y Tono
                </label>
                <div className="space-y-2">
                  {voices.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setVoice(v.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        voice === v.id
                          ? 'bg-zinc-100 text-black border-white'
                          : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{v.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              voice === v.id ? 'bg-black/10 text-black' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {v.gender}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 ${voice === v.id ? 'text-zinc-700' : 'text-zinc-400'}`}>
                          {v.desc}
                        </p>
                      </div>
                      <Volume2 className={`w-4 h-4 ${voice === v.id ? 'text-black' : 'text-zinc-500'}`} />
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Sintetizando audio neuronal...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-black" />
                    <span>Generar Locución (20 pts)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Audio Player & Monitor Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 min-h-[380px] flex flex-col justify-between">
            <div className="border-b border-zinc-800/80 pb-3 mb-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Reproductor & Salida de Audio
              </span>
              {providerUsed && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold uppercase">
                  {providerUsed}
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800 text-center space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-300 mx-auto" />
                  <p className="text-xs text-zinc-300 font-medium">Modulando fonemas y síntesis acústica...</p>
                </div>
              ) : audioUrl ? (
                <div className="w-full max-w-sm space-y-6">
                  {/* Waveform graphic representation */}
                  <div className="flex items-center justify-center gap-1 h-16 px-4 py-2 bg-zinc-950 rounded-xl border border-zinc-800">
                    {[16, 28, 40, 60, 48, 32, 54, 70, 80, 50, 64, 45, 30, 20, 45, 60, 75, 40, 25, 35].map((h, i) => (
                      <div
                        key={i}
                        className={`w-1.5 rounded-full transition-all ${
                          isPlaying ? 'bg-white animate-pulse' : 'bg-zinc-600'
                        }`}
                        style={{ height: `${isPlaying ? Math.max(10, Math.round(h * Math.random())) : h}%` }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={togglePlay}
                      className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-all shadow-xl shadow-white/10"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400 italic">
                    "{text.slice(0, 70)}..."
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-zinc-400">
                  <Mic className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-xs font-medium text-zinc-400">El archivo de audio sintetizado aparecerá aquí</p>
                  <p className="text-[11px] text-zinc-500">Selecciona una voz y escribe tu guion</p>
                </div>
              )}
            </div>

            {audioUrl && (
              <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Guardado en tu Biblioteca</span>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Audio</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
