import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { Project, TimelineTrack, TimelineClip } from '../types';
import {
  Scissors,
  Play,
  Pause,
  Plus,
  Trash2,
  Save,
  Volume2,
  VolumeX,
  Type,
  Video as VideoIcon,
  Mic,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Film,
} from 'lucide-react';

export const VideoEditorView: React.FC = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('Proyecto sin título');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [totalDuration, setTotalDuration] = useState<number>(30);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [tracks, setTracks] = useState<TimelineTrack[]>([
    { id: 'track-video', name: 'Pista Vídeo / Visual', type: 'video', clips: [] },
    { id: 'track-audio', name: 'Pista Audio / Voz', type: 'audio', clips: [] },
    { id: 'track-subtitles', name: 'Pista Subtítulos', type: 'subtitles', clips: [] },
  ]);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const playbackTimerRef = useRef<number | null>(null);

  // Load project from URL params or fetch latest
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    const loadProject = async (targetId: string) => {
      try {
        const res = await apiRequest<{ project: Project }>(`/projects/${targetId}`);
        const p = res.project;
        setProjectId(p.id);
        setProjectTitle(p.title);
        setAspectRatio(p.aspect_ratio || '9:16');
        setTotalDuration(p.duration || 30);
        if (p.data && p.data.tracks) {
          setTracks(p.data.tracks);
        }
      } catch (err: any) {
        console.error('Failed to load project:', err);
      }
    };

    if (id) {
      loadProject(id);
    } else {
      // Create auto project if none selected
      const initNew = async () => {
        try {
          const res = await apiRequest<{ project: Project }>('/projects', {
            method: 'POST',
            body: JSON.stringify({
              title: 'Nueva Secuencia',
              aspect_ratio: '9:16',
              duration: 30,
            }),
          });
          setProjectId(res.project.id);
          setProjectTitle(res.project.title);
          if (res.project.data?.tracks) {
            setTracks(res.project.data.tracks);
          }
        } catch {}
      };
      initNew();
    }
  }, []);

  // Playback engine
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return Math.min(totalDuration, Number((prev + 0.1).toFixed(1)));
        });
      }, 100);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, totalDuration]);

  const handleSaveProject = async () => {
    if (!projectId) return;
    setSaving(true);
    setNotice(null);
    setErrorNotice(null);

    try {
      await apiRequest(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: projectTitle,
          aspect_ratio: aspectRatio,
          duration: totalDuration,
          data: {
            tracks,
            settings: { aspectRatio, duration: totalDuration, fps: 30 },
          },
        }),
      });
      setNotice('Proyecto guardado correctamente.');
    } catch (err: any) {
      setErrorNotice(err.message || 'Error al guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddClip = (trackType: 'video' | 'audio' | 'subtitles') => {
    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      title: trackType === 'video' ? 'Nuevo Plano' : trackType === 'audio' ? 'Pista de Audio' : 'Nuevo Subtítulo',
      start: currentTime,
      duration: 5,
      type: trackType === 'subtitles' ? 'text' : trackType,
      volume: 1,
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.type === trackType) {
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      })
    );
    setSelectedClipId(newClip.id);
  };

  const handleDeleteClip = (clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))
    );
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const selectedClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  // Find active clips for current playhead
  const currentVideoClip = tracks
    .find((t) => t.type === 'video')
    ?.clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration);

  const currentSubtitleClip = tracks
    .find((t) => t.type === 'subtitles')
    ?.clips.find((c) => currentTime >= c.start && currentTime < c.start + c.duration);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#050507] text-white select-none">
      {/* Top Bar Controls */}
      <div className="h-14 px-4 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
            <Scissors className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="bg-transparent font-bold text-sm text-white focus:outline-none focus:border-b border-zinc-500 max-w-xs"
          />
          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold uppercase">
            {aspectRatio}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none"
          >
            <option value="9:16">9:16 Vertical (TikTok / Reels)</option>
            <option value="16:9">16:9 Horizontal (YouTube)</option>
            <option value="1:1">1:1 Cuadrado</option>
          </select>

          <button
            onClick={handleSaveProject}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 shadow-lg shadow-white/5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Guardar Proyecto'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-1.5 bg-emerald-950/40 border-b border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Workspace (Preview + Properties) */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Central Stage / Video Monitor */}
        <div className="flex-1 bg-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {/* Virtual Aspect Container */}
          <div
            className={`relative bg-black rounded-xl border border-zinc-800 shadow-2xl flex items-center justify-center overflow-hidden ${
              aspectRatio === '9:16'
                ? 'w-[220px] h-[390px] sm:w-[260px] sm:h-[460px]'
                : aspectRatio === '16:9'
                ? 'w-[440px] h-[248px] sm:w-[540px] sm:h-[304px]'
                : 'w-[320px] h-[320px]'
            }`}
          >
            {/* Active visual clip or placeholder */}
            {currentVideoClip ? (
              <div className="w-full h-full p-4 flex flex-col justify-between text-center bg-gradient-to-t from-zinc-950 via-zinc-900 to-zinc-950 text-white">
                <div className="text-[10px] uppercase font-bold text-zinc-400">
                  {currentVideoClip.title}
                </div>
                <div className="p-3 text-xs text-zinc-300 italic font-mono bg-black/40 rounded border border-zinc-800">
                  {currentVideoClip.visualPrompt || 'Plano de vídeo'}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {formatTime(currentTime - currentVideoClip.start)} / {currentVideoClip.duration}s
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center p-4 text-zinc-600">
                <Film className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-mono">Sin plano en {formatTime(currentTime)}</p>
              </div>
            )}

            {/* Subtitle Overlay */}
            {currentSubtitleClip && (
              <div className="absolute bottom-6 inset-x-3 text-center pointer-events-none">
                <span className="inline-block px-3 py-1 rounded bg-black/80 text-white text-xs sm:text-sm font-extrabold tracking-wide drop-shadow-md border border-white/20 font-['Space_Grotesk']">
                  {currentSubtitleClip.title || 'Subtítulo'}
                </span>
              </div>
            )}
          </div>

          {/* Monitor Transport Playback Controls */}
          <div className="mt-4 flex items-center gap-4 bg-zinc-950/90 px-4 py-2 rounded-full border border-zinc-800">
            <button
              onClick={() => setCurrentTime(0)}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Reiniciar cabezal"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <span className="text-xs font-mono font-semibold text-zinc-300">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
          </div>
        </div>

        {/* Clip Properties Panel */}
        <div className="w-full md:w-72 bg-zinc-950 border-l border-zinc-800/80 p-4 shrink-0 overflow-y-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-3">
            Propiedades del Clip
          </span>

          {selectedClip ? (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Título / Contenido</label>
                <input
                  type="text"
                  value={selectedClip.title || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTracks((prev) =>
                      prev.map((t) => ({
                        ...t,
                        clips: t.clips.map((c) => (c.id === selectedClip.id ? { ...c, title: val } : c)),
                      }))
                    );
                  }}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-400 mb-1">Inicio (seg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={selectedClip.start}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTracks((prev) =>
                        prev.map((t) => ({
                          ...t,
                          clips: t.clips.map((c) => (c.id === selectedClip.id ? { ...c, start: val } : c)),
                        }))
                      );
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Duración (seg)</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={selectedClip.duration}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTracks((prev) =>
                        prev.map((t) => ({
                          ...t,
                          clips: t.clips.map((c) => (c.id === selectedClip.id ? { ...c, duration: val } : c)),
                        }))
                      );
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {selectedClip.visualPrompt && (
                <div>
                  <label className="block text-zinc-400 mb-1">Prompt Visual</label>
                  <textarea
                    rows={3}
                    value={selectedClip.visualPrompt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTracks((prev) =>
                        prev.map((t) => ({
                          ...t,
                          clips: t.clips.map((c) => (c.id === selectedClip.id ? { ...c, visualPrompt: val } : c)),
                        }))
                      );
                    }}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-[11px]"
                  />
                </div>
              )}

              <button
                onClick={() => handleDeleteClip(selectedClip.id)}
                className="w-full py-2 rounded-lg bg-red-950/40 border border-red-900 text-red-300 hover:bg-red-900/60 transition-colors flex items-center justify-center gap-1.5 mt-4"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Clip</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Selecciona un clip en la línea de tiempo para editar sus parámetros.
            </p>
          )}
        </div>
      </div>

      {/* Multitrack Timeline */}
      <div className="h-64 bg-zinc-950 border-t border-zinc-800/80 flex flex-col shrink-0">
        {/* Timeline Header & Scrubber Ruler */}
        <div className="h-10 px-4 border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-zinc-300">Pistas Multicapa</span>
            <button
              onClick={() => handleAddClip('video')}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> + Vídeo
            </button>
            <button
              onClick={() => handleAddClip('audio')}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> + Audio
            </button>
            <button
              onClick={() => handleAddClip('subtitles')}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> + Subtítulo
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Línea de tiempo: {totalDuration}s</span>
          </div>
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-2">
              <div className="w-32 shrink-0 text-xs font-semibold text-zinc-300 truncate flex items-center gap-1.5">
                {track.type === 'video' ? (
                  <VideoIcon className="w-3.5 h-3.5 text-zinc-400" />
                ) : track.type === 'audio' ? (
                  <Mic className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <Type className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span className="truncate">{track.name}</span>
              </div>

              {/* Track Lane */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  setCurrentTime(Number((ratio * totalDuration).toFixed(1)));
                }}
                className="flex-1 h-12 bg-zinc-900/70 border border-zinc-800/80 rounded-lg relative overflow-hidden cursor-pointer"
              >
                {/* Playhead indicator bar */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20 pointer-events-none"
                  style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                />

                {/* Clips in Track */}
                {track.clips.map((clip) => {
                  const left = (clip.start / totalDuration) * 100;
                  const width = (clip.duration / totalDuration) * 100;
                  const isSelected = selectedClipId === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        setCurrentTime(clip.start);
                      }}
                      className={`absolute top-1 bottom-1 rounded-md px-2 flex items-center text-[11px] font-semibold truncate border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-zinc-100 text-black border-white shadow-md z-10'
                          : track.type === 'video'
                          ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                          : track.type === 'audio'
                          ? 'bg-zinc-800/90 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                      }`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(2, width)}%`,
                      }}
                      title={`${clip.title} (${clip.duration}s)`}
                    >
                      <span className="truncate">{clip.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
