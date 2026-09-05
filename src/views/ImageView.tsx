import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Palette,
  Coins,
  AlertCircle,
  Loader2,
  Maximize2,
  CheckCircle2,
  Layers,
} from 'lucide-react';

interface ImageViewProps {
  onNavigate: (view: string) => void;
}

export const ImageView: React.FC<ImageViewProps> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const aspectRatios = [
    { id: '1:1', label: '1:1 Cuadrado', desc: 'Feed / Avatar' },
    { id: '9:16', label: '9:16 Vertical', desc: 'Stories / Reels / TikTok' },
    { id: '16:9', label: '16:9 Horizontal', desc: 'YouTube / Cine' },
    { id: '3:4', label: '3:4 Retrato', desc: 'Fotografía' },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setError(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ imageUrl: string; assetId: string; pointsRemaining: number }>('/image/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          aspectRatio,
        }),
      });

      setGeneratedImage(res.imageUrl);
      setSuccessNotice('Imagen generada y guardada en tu biblioteca.');
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Error al generar la imagen con el modelo de IA.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `grey-ia-${Date.now()}.png`;
    a.click();
  };

  const handleSendToEditor = () => {
    if (!generatedImage) return;
    sessionStorage.setItem('grey_ia_edit_image', generatedImage);
    onNavigate('editor-imagen');
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <ImageIcon className="w-3.5 h-3.5 text-white" />
            <span>Generador de Imágenes IA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Creación Visual Hiperrealista
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Genera imágenes nítidas de alta resolución mediante el modelo multimodal Gemini. Formatos adaptados a redes sociales o cine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-zinc-400" />
            <span>Coste: 25 pts</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl">
            <form onSubmit={handleGenerate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                  Prompt descriptivo
                </label>
                <textarea
                  required
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ejemplo: Un fotograma cinematográfico de un astronauta en un templo alienígena de cristal negro, iluminación volumétrica suave, niebla realista, 8k, bokeh, estética hiperdetallada..."
                  className="w-full p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">
                  Relación de Aspecto
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        aspectRatio === ratio.id
                          ? 'bg-zinc-100 text-black border-white'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-bold">{ratio.label}</p>
                      <p className={`text-[10px] ${aspectRatio === ratio.id ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {ratio.desc}
                      </p>
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

              {successNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-start gap-2.5">
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
                    <span>Sintetizando imagen con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" />
                    <span>Generar Imagen (25 pts)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Preview Column */}
        <div className="lg:col-span-7">
          <div className="h-full min-h-[420px] rounded-2xl bg-zinc-950 border border-zinc-800/80 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Lienzo de Salida
              </span>
              {generatedImage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendToEditor}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Editar en Canvas</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Image Canvas Container */}
            <div className="flex-1 flex items-center justify-center bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800/80 p-4 overflow-hidden relative min-h-[340px]">
              {loading ? (
                <div className="flex flex-col items-center text-center p-6 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
                  <p className="text-xs text-zinc-300 font-medium">Renderizando píxeles con modelo de visión...</p>
                  <p className="text-[11px] text-zinc-400">Esto toma habitualmente entre 3 y 8 segundos</p>
                </div>
              ) : generatedImage ? (
                <div className="relative group max-h-[500px] flex items-center justify-center">
                  <img
                    src={generatedImage}
                    alt={prompt}
                    referrerPolicy="no-referrer"
                    className="max-h-[480px] w-auto object-contain rounded-lg shadow-2xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-6 text-zinc-400 space-y-2">
                  <ImageIcon className="w-10 h-10 text-zinc-600" />
                  <p className="text-xs font-medium text-zinc-400">El resultado generado aparecerá aquí</p>
                  <p className="text-[11px] text-zinc-400">Escribe tu descripción y selecciona el ratio de aspecto</p>
                </div>
              )}
            </div>

            {generatedImage && (
              <div className="mt-4 pt-3 border-t border-zinc-900 text-xs text-zinc-400 flex items-center justify-between">
                <span>Guardada en Biblioteca como activo de producción</span>
                <span>Formato {aspectRatio}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
