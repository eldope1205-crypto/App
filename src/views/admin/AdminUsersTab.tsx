import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Users,
  Search,
  Filter,
  Shield,
  Edit2,
  Trash2,
  CheckCircle2,
  Ban,
  Coins,
  Key,
  AlertCircle,
  Loader2,
  X,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface AdminUsersTabProps {
  currentUserRole?: string;
  currentUserId?: string;
  isCallerOwner?: boolean;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  currentUserRole,
  currentUserId,
  isCallerOwner,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit Modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<string>('USER');
  const [editPlan, setEditPlan] = useState<string>('FREE');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [pointsAdjustment, setPointsAdjustment] = useState<number>(0);
  const [pointsReason, setPointsReason] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (planFilter !== 'all') params.append('plan', planFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiRequest<{ users: any[] }>(`/admin/users?${params.toString()}`);
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, planFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setEditRole(user.role || 'USER');
    setEditPlan(user.plan || 'FREE');
    setEditStatus(user.status || 'ACTIVE');
    setPointsAdjustment(0);
    setPointsReason('');
    setNewPassword('');
    setError(null);
    setSuccessNotice(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        role: editRole,
        plan: editPlan,
        status: editStatus,
      };

      if (pointsAdjustment !== 0) {
        payload.pointsAdjustment = Number(pointsAdjustment);
        payload.pointsAdjustmentReason = pointsReason || 'Ajuste manual desde Super Admin';
      }

      if (newPassword.trim().length > 0) {
        if (newPassword.length < 6) {
          throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        }
        payload.newPassword = newPassword;
      }

      await apiRequest(`/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(`Usuario ${selectedUser.email} actualizado correctamente.`);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar usuario.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.role === 'OWNER') {
      alert('La cuenta del PROPIETARIO (OWNER) está blindada y no puede eliminarse.');
      return;
    }
    if (!confirm(`¿Estás COMPLETAMENTE seguro de eliminar al usuario ${user.email}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await apiRequest(`/admin/users/${user.id}`, { method: 'DELETE' });
      setSuccessNotice(`Usuario ${user.email} eliminado definitivamente.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar usuario.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header y Filtros */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-white" />
              Directorio y Gestión de Usuarios
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Control granular de roles, planes, saldo de créditos y seguridad de cuentas.
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Recargar listado"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Notificaciones */}
        {successNotice && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-xs text-emerald-400 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button onClick={() => setSuccessNotice(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between text-xs text-red-400 font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* Búsqueda */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por correo o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black border border-white/10 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
          </form>

          {/* Rol */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="all">Todos los Roles</option>
              <option value="OWNER">Propietarios (OWNER)</option>
              <option value="SUPER_ADMIN">Super Administradores</option>
              <option value="ADMIN">Administradores</option>
              <option value="CREATOR">Creadores</option>
              <option value="USER">Usuarios Estándar</option>
            </select>
          </div>

          {/* Plan */}
          <div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="all">Todos los Planes</option>
              <option value="FREE">FREE</option>
              <option value="STARTER">STARTER</option>
              <option value="CREATOR">CREATOR</option>
              <option value="PRO">PRO</option>
              <option value="ULTRA">ULTRA</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="all">Todos los Estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="SUSPENDED">Suspendidos / Bloqueados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/40 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-white/60" />
            <span className="text-xs font-mono">Cargando directorio de usuarios...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-white/40 font-mono text-xs">
            No se encontraron usuarios con los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-white/40 text-[10px] uppercase">
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Puntos</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Proyectos</th>
                  <th className="py-3 px-4">Registro</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const isOwner = u.role === 'OWNER';
                  const isSuspended = u.status === 'SUSPENDED';

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{u.name || 'Sin nombre'}</div>
                        <div className="text-[11px] text-white/50 select-text">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOwner
                              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                              : u.role === 'SUPER_ADMIN'
                              ? 'bg-purple-400/10 text-purple-300 border border-purple-400/30'
                              : u.role === 'ADMIN'
                              ? 'bg-white/10 text-white border border-white/20'
                              : 'bg-white/5 text-white/60'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-white/70 text-[10px] font-bold">
                          {u.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                        {Number(u.points || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSuspended
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isSuspended ? (
                            <>
                              <Ban className="w-2.5 h-2.5" /> Suspendido
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" /> Activo
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white/60">
                        {u.projects_count ?? 0}
                      </td>
                      <td className="py-3 px-4 text-white/40 whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                            title="Editar usuario y puntos"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isOwner && u.id !== currentUserId && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                              title="Eliminar usuario definitivamente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-lg bg-zinc-950 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Editar Usuario: {selectedUser.email}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs font-mono">
              {/* Rol */}
              <div>
                <label className="block text-white/60 mb-1">Rol de Acceso:</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={selectedUser.role === 'OWNER' && !isCallerOwner}
                  className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                >
                  <option value="USER">USER (Usuario Estándar)</option>
                  <option value="CREATOR">CREATOR (Creador)</option>
                  <option value="ADMIN">ADMIN (Administrador)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Super Administrador)</option>
                  {isCallerOwner && <option value="OWNER">OWNER (Propietario)</option>}
                </select>
                {selectedUser.role === 'OWNER' && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    Esta cuenta posee el rol supremo de PROPIETARIO (OWNER).
                  </p>
                )}
              </div>

              {/* Plan y Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Plan:</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="FREE">FREE</option>
                    <option value="STARTER">STARTER</option>
                    <option value="CREATOR">CREATOR</option>
                    <option value="PRO">PRO</option>
                    <option value="ULTRA">ULTRA</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Estado:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={selectedUser.role === 'OWNER'}
                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="SUSPENDED">Suspendido / Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Ajuste de Puntos */}
              <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-yellow-400" />
                    Ajustar Puntos (Saldo actual: {Number(selectedUser.points || 0).toLocaleString()} pts)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="100"
                    placeholder="+ / - puntos"
                    value={pointsAdjustment || ''}
                    onChange={(e) => setPointsAdjustment(Number(e.target.value))}
                    className="col-span-1 px-3 py-1.5 bg-black border border-white/10 rounded-lg text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Motivo del ajuste (ej. Compensación)"
                    value={pointsReason}
                    onChange={(e) => setPointsReason(e.target.value)}
                    className="col-span-2 px-3 py-1.5 bg-black border border-white/10 rounded-lg text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Restablecer Contraseña */}
              <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-1.5">
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-white/70" />
                  Cambiar Contraseña Administrativamente
                </span>
                <input
                  type="password"
                  placeholder="Dejar vacío para no modificar..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-1.5 bg-black border border-white/10 rounded-lg text-white focus:outline-none"
                />
                <p className="text-[10px] text-white/40">
                  Si escribes una nueva contraseña, sustituirá la actual de inmediato.
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
