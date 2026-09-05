import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { LibraryAsset } from '../types';
import {
  Library,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  Download,
  Trash2,
  Filter,
  Loader2,
  AlertCircle,
  FileBox,
} from 'lucide-react';

export const LibraryView: React.FC = () => {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    try {
      const endpoint = filterType === 'all' ? '/library' : `/library?type=${filterType}`;
      const res = await apiRequest<{ assets: LibraryAsset[] }>(endpoint);
      setAssets(res.assets || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar biblioteca.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [filterType]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiRequest('/library/upload', {
        method: 'POST',
        body: formData,
      });
      fetchAssets();
    } catch (err: any) {
      setError(err.message || 'Error al subir archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este elemento de la biblioteca?')) return;
    try {
      await apiRequest(`/library/${id}`, { method: 'DELETE' });
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err.message || 'Error al eliminar recurso.');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
            <Library className="w-3.5 h-3.5 text-white" />
            <span>Biblioteca Multimedia</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Recursos y Archivos de Producción
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Imágenes, audios generados, tomas de vídeo y archivos multimedia organizados en un solo lugar.
          </p>
        </div>

        <label className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-white/5 shrink-0">
          <Upload className="w-4 h-4" />
          <span>{uploading ? 'Subiendo...' : 'Subir Archivo'}</span>
          <input type="file" onChange={handleFileUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3 overflow-x-auto">
        {[
          { id: 'all', label: 'Todos los recursos' },
          { id: 'image', label: 'Imágenes' },
          { id: 'video', label: 'Vídeos' },
          { id: 'audio', label: 'Audios / Locuciones' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === tab.id
                ? 'bg-zinc-100 text-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">Cargando biblioteca...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 space-y-3">
          <FileBox className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
            No hay recursos en esta categoría
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Sube archivos desde tu equipo o genera imágenes y audios con las herramientas de IA.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="h-36 rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden flex items-center justify-center relative">
                {asset.type === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : asset.type === 'audio' ? (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <Mic className="w-8 h-8 text-zinc-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Audio MP3/WAV</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <VideoIcon className="w-8 h-8 text-zinc-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Clip de Vídeo</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-white truncate" title={asset.name}>
                  {asset.name}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                  <span>{formatSize(asset.size)}</span>
                  <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
                <a
                  href={asset.url}
                  download={asset.name}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition-colors"
                  title="Descargar"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-900 transition-colors"
                  title="Eliminar de la biblioteca"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
