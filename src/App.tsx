import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BrandLogo } from './components/BrandLogo';
import { BottomNavigation } from './components/BottomNavigation';

// Views
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';
import { RecoverPasswordView } from './views/RecoverPasswordView';
import { DashboardView } from './views/DashboardView';
import { ChatView } from './views/ChatView';
import { DirectorView } from './views/DirectorView';
import { VideoView } from './views/VideoView';
import { VideoEditorView } from './views/VideoEditorView';
import { ImageView } from './views/ImageView';
import { ImageEditorView } from './views/ImageEditorView';
import { AudioView } from './views/AudioView';
import { ViralView } from './views/ViralView';
import { ProjectsView } from './views/ProjectsView';
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { AdminView } from './views/AdminView';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register' | 'recover'>('login');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Sync with URL query parameter & pathname
  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '');

      if (viewParam === 'register' || pathname.endsWith('/register')) {
        setAuthView('register');
      } else if (viewParam === 'recover' || pathname.endsWith('/recover')) {
        setAuthView('recover');
      } else if (viewParam === 'login' || pathname.endsWith('/login')) {
        setAuthView('login');
      } else if (viewParam) {
        setCurrentView(viewParam);
      } else if (pathname && pathname !== '/') {
        const cleanPath = pathname.replace(/^\//, '');
        if (cleanPath) setCurrentView(cleanPath);
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const handleAuthNavigate = (view: 'login' | 'register' | 'recover' | string) => {
    const target = (view === 'register' || view === 'recover' || view === 'login') ? view : 'login';
    setAuthView(target);
    const url = new URL(window.location.href);
    url.search = `view=${target}`;
    window.history.pushState({}, '', url.toString());
  };

  const handleNavigate = (view: string) => {
    // If view contains query string like `editor-video?id=xyz`
    let targetView = view;
    let queryString = '';
    if (view.includes('?')) {
      const parts = view.split('?');
      targetView = parts[0];
      queryString = '?' + parts[1];
    }

    setCurrentView(targetView);
    setSidebarOpen(false);

    // Update browser history
    const url = new URL(window.location.href);
    url.search = `view=${targetView}${queryString ? '&' + queryString.substring(1) : ''}`;
    window.history.pushState({}, '', url.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <BrandLogo size="lg" animate />
        <p className="text-xs font-mono text-white/50 mt-6 tracking-widest uppercase animate-pulse">
          Iniciando Núcleo GREY IA...
        </p>
      </div>
    );
  }

  // Unauthenticated user -> Auth screens
  if (!user) {
    if (authView === 'register') {
      return <RegisterView onNavigate={handleAuthNavigate} />;
    }
    if (authView === 'recover') {
      return <RecoverPasswordView onNavigate={handleAuthNavigate} />;
    }
    return <LoginView onNavigate={handleAuthNavigate} initialMode={authView} />;
  }

  // Authenticated user -> Application Shell
  return (
    <div className="flex flex-col h-screen w-full bg-black text-white font-sans overflow-hidden select-none">
      {/* Top Bar Navigation */}
      <Header
        onNavigate={handleNavigate}
        currentView={currentView}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-black">
          {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
          {currentView === 'chat' && <ChatView />}
          {currentView === 'director' && <DirectorView onNavigate={handleNavigate} />}
          {currentView === 'video' && <VideoView />}
          {currentView === 'editor-video' && <VideoEditorView />}
          {(currentView === 'image' || currentView === 'imagen') && <ImageView onNavigate={handleNavigate} />}
          {currentView === 'editor-imagen' && <ImageEditorView />}
          {currentView === 'audio' && <AudioView />}
          {currentView === 'viral' && <ViralView />}
          {(currentView === 'projects' || currentView === 'proyectos') && <ProjectsView onNavigate={handleNavigate} />}
          {(currentView === 'library' || currentView === 'biblioteca') && <LibraryView />}
          {(currentView === 'history' || currentView === 'historial') && <HistoryView />}
          {(currentView === 'settings' || currentView === 'ajustes') && <SettingsView />}
          {currentView === 'admin' && <AdminView />}
        </main>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavigation currentView={currentView} onNavigate={handleNavigate} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
