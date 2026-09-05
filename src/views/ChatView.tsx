import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { ChatConversation, ChatMessage } from '../types';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Coins,
} from 'lucide-react';

export const ChatView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const res = await apiRequest<{ conversations: ChatConversation[] }>('/chat/conversations');
      setConversations(res.conversations || []);
      if (res.conversations && res.conversations.length > 0 && !activeConvId) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      try {
        const res = await apiRequest<{ messages: ChatMessage[] }>(`/chat/conversations/${activeConvId}/messages`);
        setMessages(res.messages || []);
      } catch (err: any) {
        console.error('Failed to load messages:', err);
      }
    };
    fetchMessages();
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateNew = async () => {
    try {
      const res = await apiRequest<{ conversation: ChatConversation }>('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Nueva conversación' }),
      });
      setConversations([res.conversation, ...conversations]);
      setActiveConvId(res.conversation.id);
      setMessages([]);
    } catch (err: any) {
      setError(err.message || 'Error al crear conversación.');
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/chat/conversations/${id}`, { method: 'DELETE' });
      const nextConvs = conversations.filter((c) => c.id !== id);
      setConversations(nextConvs);
      if (activeConvId === id) {
        setActiveConvId(nextConvs.length > 0 ? nextConvs[0].id : null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al eliminar conversación.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setError(null);
    const userText = input.trim();
    setInput('');

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await apiRequest<{
        conversationId: string;
        message: ChatMessage;
        pointsRemaining: number;
      }>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConvId,
          content: userText,
        }),
      });

      if (!activeConvId) {
        setActiveConvId(res.conversationId);
      }
      setMessages((prev) => [...prev, res.message]);
      await refreshUser();
      fetchConversations();
    } catch (err: any) {
      setError(err.message || 'Error al obtener respuesta de Gemini.');
      // remove temp message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-[#060608] text-white">
      {/* Sidebar: Conversation history */}
      <div className="w-full md:w-80 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-48 md:h-full shrink-0">
        <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Chats Activos</span>
          </div>
          <button
            onClick={handleCreateNew}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white transition-colors"
            title="Nuevo chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              No hay conversaciones guardadas.
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full group px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="truncate pr-2">
                  <p className="truncate font-medium text-zinc-200">{conv.title}</p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-400 rounded transition-opacity"
                  title="Eliminar conversación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Model badge */}
        <div className="p-3 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Modelo: <strong className="text-zinc-300">Gemini 3.8 Flash</strong></span>
          <span className="flex items-center gap-1 text-zinc-400">
            <Coins className="w-3 h-3 text-zinc-400" /> 10 pts/msg
          </span>
        </div>
      </div>

      {/* Chat conversation view */}
      <div className="flex-1 flex flex-col h-full bg-[#060608]">
        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-4 shadow-xl">
                <Bot className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">
                GREY IA Chat Core
              </h2>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Asistente de inteligencia artificial real potenciado por Google Gemini 3.8 Flash. Consulta estrategias de vídeo, guiones de contenido, optimización creativa y código.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setInput('Escribe 3 ganchos virales para un vídeo de tecnología sobre IA.')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  "3 ganchos virales para vídeo de IA"
                </button>
                <button
                  onClick={() => setInput('Dame una estructura de 5 escenas para un corto de ciencia ficción.')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  "Estructura para corto de ciencia ficción"
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                    msg.role === 'user'
                      ? 'bg-zinc-800 border border-zinc-700 text-white'
                      : 'bg-white text-black font-semibold'
                  }`}
                >
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-zinc-800/90 text-white rounded-tr-none'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-tl-none relative group'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.role === 'assistant' && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-opacity flex items-center gap-1"
                        title="Copiar respuesta"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-xs font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-400 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                <span>GREY IA procesando respuesta...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/90">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje a GREY IA..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-5 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
