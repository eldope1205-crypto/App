import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Users,
  Database,
  Coins,
  Activity,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Ban,
  UserCheck,
  Plus,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Adjust points modal state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [pointsDelta, setPointsDelta] = useState<number>(100);
  const [pointsReason, setPointsReason] = useState<string>('Bono administrativo');
  const [adjusting, setAdjusting] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        apiRequest<{ stats?: any; metrics?: any }>('/admin/stats'),
        apiRequest<{ users: any[] }>('/admin/users'),
        apiRequest<{ logs: any[] }>('/admin/system-logs'),
      ]);
      setStats(statsRes.metrics || statsRes.stats || {});
      setUsersList(usersRes.users || []);
      setLogs(logsRes.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos administrativos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      setActionNotice(`Rol actualizado a ${newRole}.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar rol.');
    }
  };

  const handleToggleBan = async (userId: string) => {
    try {
      const res = await apiRequest<{ is_active: number }>(`/admin/users/${userId}/toggle-ban`, {
        method: 'PUT',
      });
      setActionNotice(`Estado de usuario cambiado a ${res.is_active ? 'Activo' : 'Suspendido'}.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado.');
    }
  };

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setAdjusting(true);

    try {
      await apiRequest(`/admin/users/${selectedUser.id}/adjust-points`, {
        method: 'POST',
        body: JSON.stringify({
          amount: pointsDelta,
          reason: pointsReason,
        }),
      });
      setActionNotice(`Puntos ajustados para ${selectedUser.email}.`);
      setSelectedUser(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Error al ajustar puntos.');
    } finally {
      setAdjusting(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Acceso Denegado</h2>
        <p className="text-xs text-zinc-400">
          Esta sección requiere privilegios de Administrador verificados en el servidor.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-800/60 text-xs font-semibold text-red-300 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Panel de Control Maestro</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
            Consola de Administración de GREY IA
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Gestión de usuarios reales, cuotas de cómputo, roles y registros del sistema.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Datos</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Real Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Usuarios Totales</span>
            <Users className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk']">
            {stats?.totalUsers || 0}
          </p>
          <p className="text-[11px] text-zinc-400">Registrados en la base de datos</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Proyectos</span>
            <FolderKanban className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk']">
            {stats?.totalProjects || 0}
          </p>
          <p className="text-[11px] text-zinc-400">Secuencias creadas</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Recursos Multimedia</span>
            <Database className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk']">
            {stats?.totalAssets || 0}
          </p>
          <p className="text-[11px] text-zinc-400">En la biblioteca</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Puntos Consumidos</span>
            <Coins className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk']">
            {stats?.totalPointsConsumed || 0}
          </p>
          <p className="text-[11px] text-zinc-400">Consumo global histórico</p>
        </div>
      </div>

      {/* Users Management Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-400" /> Directorio de Usuarios Reales
        </h2>

        <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-x-auto shadow-2xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/60 text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Plan</th>
                <th className="p-4">Puntos</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-white">{u.full_name || 'Sin nombre'}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">{u.email}</div>
                  </td>
                  <td className="p-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none"
                    >
                      <option value="user">Usuario</option>
                      <option value="creator">Creador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="p-4 uppercase font-bold text-[10px] text-zinc-300">{u.plan}</td>
                  <td className="p-4 font-mono font-bold text-white">{u.points} pts</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.is_active
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {u.is_active ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-200 font-medium inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Puntos
                    </button>
                    <button
                      onClick={() => handleToggleBan(u.id)}
                      className={`p-1 rounded border inline-flex items-center justify-center transition-colors ${
                        u.is_active
                          ? 'bg-red-950/40 border-red-900 text-red-400 hover:bg-red-900/60'
                          : 'bg-emerald-950/40 border-emerald-900 text-emerald-400 hover:bg-emerald-900/60'
                      }`}
                      title={u.is_active ? 'Suspender usuario' : 'Reactivar usuario'}
                    >
                      {u.is_active ? <Ban className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Logs */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" /> Registro de Eventos del Servidor
        </h2>
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2 max-h-64 overflow-y-auto font-mono text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-zinc-400 hover:text-zinc-200">
              <span>
                [{new Date(log.created_at).toLocaleTimeString()}] <strong className="text-zinc-200">{log.action}</strong>:{' '}
                {log.details}
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">{log.user_email || 'Sistema'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Adjust Points Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
              Ajustar Puntos a {selectedUser.email}
            </h3>

            <form onSubmit={handleAdjustPoints} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Cantidad (+ o -)
                </label>
                <input
                  type="number"
                  required
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Motivo</label>
                <input
                  type="text"
                  required
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200"
                >
                  {adjusting ? 'Aplicando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
