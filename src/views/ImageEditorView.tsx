import React, { useState, useRef, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import {
  Palette,
  RotateCw,
  Sliders,
  Download,
  Upload,
  Type,
  Undo,
  Save,
  CheckCircle2,
  AlertCircle,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

export const ImageEditorView: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);

  // Text overlay
  const [overlayText, setOverlayText] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(36);

  const [saving, setSaving] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('grey_ia_edit_image');
    if (saved) {
      loadImage(saved);
      sessionStorage.removeItem('grey_ia_edit_image');
    }
  }, []);

  const loadImage = (url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      originalImageRef.current = img;
      setImageSrc(url);
      renderCanvas();
    };
    img.src = url;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        loadImage(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas dimensions for rotation
    const isSideways = rotation % 180 !== 0;
    canvas.width = isSideways ? img.height : img.width;
    canvas.height = isSideways ? img.width : img.height;

    ctx.save();
    // Center transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Apply CSS filters directly to 2D context
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%) sepia(${sepia}%) blur(${blur}px)`;

    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();

    // Render Text Overlay
    if (overlayText.trim()) {
      ctx.save();
      ctx.font = `bold ${textSize}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
      ctx.fillText(overlayText, canvas.width / 2, canvas.height - 30);
      ctx.restore();
    }
  };

  useEffect(() => {
    if (imageSrc) {
      renderCanvas();
    }
  }, [brightness, contrast, saturation, grayscale, sepia, blur, rotation, flipH, flipV, overlayText, textColor, textSize]);

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setGrayscale(0);
    setSepia(0);
    setBlur(0);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setOverlayText('');
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `grey-ia-edited-${Date.now()}.png`;
    a.click();
  };

  const handleSaveToLibrary = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setStatusNotice(null);
    setErrorNotice(null);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      await apiRequest('/library/save-asset', {
        method: 'POST',
        body: JSON.stringify({
          name: `Edición ${new Date().toLocaleTimeString()}`,
          type: 'image',
          url: dataUrl,
          mimeType: 'image/png',
        }),
      });
      setStatusNotice('Imagen guardada exitosamente en la Biblioteca.');
    } catch (err: any) {
      setErrorNotice(err.message || 'Error al guardar imagen en biblioteca.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <Palette className="w-3.5 h-3.5 text-white" />
            <span>Editor de Imagen Canvas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Estudio de Retoque y Filtros
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Ajusta parámetros de color, balance lumínico, orientación y tipografía sobre tus creaciones o fotos subidas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-xs font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
            <Upload className="w-4 h-4 text-zinc-400" />
            <span>Cargar Archivo</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>

          {imageSrc && (
            <>
              <button
                onClick={handleSaveToLibrary}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-xs font-semibold text-zinc-200 hover:text-white transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-zinc-400" />
                <span>{saving ? 'Guardando...' : 'Añadir a Biblioteca'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/5"
              >
                <Download className="w-4 h-4" />
                <span>Exportar PNG</span>
              </button>
            </>
          )}
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {errorNotice && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-4 space-y-5">
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-zinc-400" /> Parámetros Visuales
              </span>
              <button
                onClick={handleReset}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                title="Reiniciar valores"
              >
                <Undo className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Brillo</span>
                  <span>{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Contraste</span>
                  <span>{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Saturación</span>
                  <span>{saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Escala de Grises</span>
                  <span>{grayscale}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={grayscale}
                  onChange={(e) => setGrayscale(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Sepia</span>
                  <span>{sepia}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sepia}
                  onChange={(e) => setSepia(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 font-semibold mb-1">
                  <span>Desenfoque (Blur)</span>
                  <span>{blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={blur}
                  onChange={(e) => setBlur(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>
            </div>

            {/* Transform buttons */}
            <div className="pt-2 border-t border-zinc-800/80">
              <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Transformación geométrica
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" /> +90°
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((f) => !f)}
                  className={`p-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                    flipH ? 'bg-zinc-100 text-black font-bold' : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" /> Espejo H
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((f) => !f)}
                  className={`p-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                    flipV ? 'bg-zinc-100 text-black font-bold' : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" /> Espejo V
                </button>
              </div>
            </div>

            {/* Text Overlay */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-zinc-400" /> Superposición de Texto
              </span>
              <input
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder="Escribe texto sobre la imagen..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
              />
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer"
                  title="Color del texto"
                />
                <input
                  type="range"
                  min="16"
                  max="72"
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="flex-1 accent-white"
                  title="Tamaño de fuente"
                />
                <span className="text-[11px] text-zinc-400">{textSize}px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="lg:col-span-8">
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 p-6 min-h-[500px] flex items-center justify-center overflow-auto relative">
            {!imageSrc ? (
              <div className="flex flex-col items-center text-center p-8 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Palette className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                  Lienzo de Edición Vacío
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Carga una imagen desde tu equipo o genera una imagen en "Imagen IA" y envíala aquí para retocarla.
                </p>
                <label className="mt-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-white/5">
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar imagen local</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="max-h-[600px] max-w-full object-contain rounded-xl shadow-2xl border border-zinc-800"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
