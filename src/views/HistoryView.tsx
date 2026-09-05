import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { PointsTransaction } from '../types';
import { Clock, Coins, ArrowUpRight, ArrowDownLeft, AlertCircle, Loader2 } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiRequest<{ transactions: PointsTransaction[] }>('/points/history');
        setTransactions(res.transactions || []);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el historial.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60 text-xs font-semibold text-zinc-300 mb-2">
          <Clock className="w-3.5 h-3.5 text-white" />
          <span>Historial de Operaciones</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
          Auditoría de Créditos y Uso
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Registro inmutable de transacciones, consumos por herramienta IA y recargas.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">Cargando historial...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 space-y-2">
          <Coins className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-white">Sin movimientos registrados</p>
          <p className="text-xs text-zinc-400">Las acciones que consuman créditos quedarán registradas aquí.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-2xl">
          <div className="divide-y divide-zinc-800/80">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div key={tx.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isPositive
                          ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                      }`}
                    >
                      {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">
                        {tx.description || tx.feature}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span className="capitalize">{tx.feature}</span>
                        <span>•</span>
                        <span>{new Date(tx.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-bold font-mono ${
                        isPositive ? 'text-emerald-400' : 'text-zinc-200'
                      }`}
                    >
                      {isPositive ? `+${tx.amount}` : tx.amount} pts
                    </span>
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">
                      {tx.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
