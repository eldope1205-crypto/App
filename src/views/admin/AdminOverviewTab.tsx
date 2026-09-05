import React from 'react';
import {
  Users,
  Shield,
  FolderKanban,
  Zap,
  Coins,
  HardDrive,
  Activity,
  Server,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

interface AdminOverviewProps {
  overview: any;
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewProps> = ({
  overview,
  onNavigateTab,
  onRefresh,
}) => {
  const metrics = overview?.metrics || {};
  const systemInfo = overview?.systemInfo || {};
  const apiStatus = overview?.apiStatus || [];
  const recentLogs = overview?.recentAuditLogs || [];
  const maintenance = overview?.maintenance || { enabled: false };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Alerta de Modo Mantenimiento si está activo */}
      {maintenance.enabled && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Modo Mantenimiento Activado</p>
              <p className="text-xs text-amber-400/80">{maintenance.message || 'Los usuarios estándar tienen el acceso bloqueado temporalmente.'}</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('maintenance')}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-colors"
          >
            Gestionar
          </button>
        </div>
      )}

      {/* Tarjetas Principales de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Usuarios */}
        <div
          onClick={() => onNavigateTab('users')}
          className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-white/50 tracking-wider">Usuarios Totales</span>
            <div className="p-2 rounded-lg bg-white/5 text-white group-hover:bg-white/10 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.totalUsers ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>{metrics.activeUsers ?? 0} activos</span>
            <span className="text-emerald-400 font-medium flex items-center">
              {metrics.ownersCount ?? 1} Owner
            </span>
          </div>
        </div>

        {/* Proyectos y Creaciones */}
        <div
          onClick={() => onNavigateTab('content')}
          className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-white/50 tracking-wider">Proyectos Guardados</span>
            <div className="p-2 rounded-lg bg-white/5 text-white group-hover:bg-white/10 transition-colors">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.totalProjects ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>{metrics.totalAssets ?? 0} archivos subidos</span>
            <span>{formatBytes(metrics.totalStorageBytes)}</span>
          </div>
        </div>

        {/* Créditos Consumidos */}
        <div
          onClick={() => onNavigateTab('economy')}
          className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-white/50 tracking-wider">Puntos Consumidos</span>
            <div className="p-2 rounded-lg bg-white/5 text-yellow-400 group-hover:bg-white/10 transition-colors">
              <Zap className="w-4 h-4 fill-yellow-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {Number(metrics.totalPointsConsumed || 0).toLocaleString()}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>{metrics.totalGenerations ?? 0} operaciones IA</span>
            <span className="text-white/60">Puntos reales</span>
          </div>
        </div>

        {/* Suscripciones e Ingresos */}
        <div
          onClick={() => onNavigateTab('economy')}
          className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-white/50 tracking-wider">Suscripciones Activas</span>
            <div className="p-2 rounded-lg bg-white/5 text-emerald-400 group-hover:bg-white/10 transition-colors">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.subscriptionsCount ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>Ingresos Stripe:</span>
            <span className="text-emerald-400 font-mono font-medium">
              {((metrics.totalRevenueCents || 0) / 100).toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      {/* Monitor del Sistema y Estado de Motores de IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Motores de IA & Integraciones */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-white" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Estado de Motores de IA & Servicios
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('ai-config')}
              className="text-xs text-white/60 hover:text-white flex items-center gap-1"
            >
              Configurar <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {apiStatus.map((service: any) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.configured
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                        : 'bg-zinc-600'
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-white">{service.name}</span>
                    <span className="text-white/40 text-[11px] block">{service.role}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      service.configured
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-white/40 border border-white/10'
                    }`}
                  >
                    {service.configured ? 'Configurado' : 'Pendiente'}
                  </span>
                  <span className="text-white/40 text-[10px] block mt-0.5">
                    {service.latency ? `${service.latency}ms` : 'Local Engine'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnóstico del Servidor y Entorno */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Server className="w-4 h-4 text-white" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Infraestructura
              </h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Versión:</span>
                <span className="text-white font-medium">{systemInfo.version || 'v2.4'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Base de Datos:</span>
                <span className="text-white font-medium">{systemInfo.databaseType || 'SQLite WAL'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Tiempo Activo:</span>
                <span className="text-white font-medium">
                  {Math.floor((systemInfo.uptimeSeconds || 0) / 3600)}h {Math.floor(((systemInfo.uptimeSeconds || 0) % 3600) / 60)}m
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Memoria Heap:</span>
                <span className="text-white font-medium">{systemInfo.memoryHeapUsedMb || 0} MB</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Almacenamiento:</span>
                <span className="text-white font-medium">{systemInfo.storageMb || 0} MB</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-white/50">Propietario Base:</span>
                <span className="text-emerald-400 font-medium truncate max-w-[140px]" title={overview.configuredOwnerEmail}>
                  {overview.configuredOwnerEmail || 'Sin configurar'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10">
            <button
              onClick={() => onNavigateTab('monitoring')}
              className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Activity className="w-3.5 h-3.5" />
              Ver Diagnósticos Detallados
            </button>
          </div>
        </div>
      </div>

      {/* Registros de Auditoría Recientes */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Últimas Acciones Registradas en Auditoría
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('monitoring')}
            className="text-xs text-white/60 hover:text-white flex items-center gap-1 font-mono"
          >
            Ver todos los registros <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-white/40 py-4 font-mono">No hay registros de auditoría recientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase">
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Usuario</th>
                  <th className="py-2 px-3">Rol</th>
                  <th className="py-2 px-3">Acción</th>
                  <th className="py-2 px-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-white/40 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-white truncate max-w-[180px]">
                      {log.user_email}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white/80 font-bold">
                      {log.action}
                    </td>
                    <td className="py-2 px-3 text-white/50 truncate max-w-[280px]">
                      {log.details || log.resource}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
