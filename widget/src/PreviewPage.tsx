import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { WidgetContext, type WidgetContextType } from './WidgetContext';
import { AuthView } from './components';
import type { AuthStatusOutput } from './types';
import './main.css';

// Mock data
const mockAuthNotConnected: AuthStatusOutput = {
  authenticated: false,
  authUrl: 'https://github.com/login/oauth/authorize'
};

const mockAuthConnected: AuthStatusOutput = {
  authenticated: true,
  user: {
    login: 'octocat',
    id: 1,
    name: 'The Octocat',
    avatar_url: 'https://github.com/octocat.png'
  }
};

function PreviewNav() {
  const location = useLocation();
  const isDark = location.pathname.includes('dark');

  const navLinks = [
    { path: '/auth-not-connected', label: 'Auth (Not Connected)' },
    { path: '/auth-connected', label: 'Auth (Connected)' },
  ];

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Component Preview
          </h1>
          <div className="flex gap-2">
            <Link
              to={location.pathname.replace('/dark', '')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !isDark
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Light
            </Link>
            <Link
              to={`${location.pathname.replace('/dark', '')}/dark`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Dark
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {navLinks.map(link => {
            const linkPath = isDark ? `${link.path}/dark` : link.path;
            const isActive = location.pathname === linkPath;
            return (
              <Link
                key={link.path}
                to={linkPath}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = location.pathname.includes('/dark');
  const theme = isDark ? 'dark' : 'light';

  const [authData, setAuthData] = useState<AuthStatusOutput | null>(null);

  // Redirect from root to default view
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/preview.html') {
      navigate('/auth-not-connected', { replace: true });
    }
  }, [location.pathname, navigate]);

  const mockContext: WidgetContextType = {
    theme,
    isDark,
    callTool: async (name: string, args: Record<string, unknown>) => {
      console.log('Mock callTool:', name, args);
      await new Promise(resolve => setTimeout(resolve, 500));
      return { structuredContent: {} };
    },
    openExternal: (url: string) => {
      console.log('Mock openExternal:', url);
      alert('Would open: ' + url);
    },
    notifyHeight: () => {},
    setWidgetState: () => {},
    authData,
    setAuthData,
    prsData: null,
    setPrsData: () => {},
    prContextData: null,
    setPrContextData: () => {},
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <PreviewNav />
      <div className={`pt-32 pb-8 px-4 min-h-screen transition-colors ${isDark ? 'bg-black' : 'bg-slate-100'}`}>
        <div className="max-w-lg mx-auto">
          <WidgetContext.Provider value={mockContext}>
            <Routes>
              <Route path="/auth-not-connected" element={<AuthView initialAuthData={mockAuthNotConnected} />} />
              <Route path="/auth-not-connected/dark" element={<AuthView initialAuthData={mockAuthNotConnected} />} />

              <Route path="/auth-connected" element={<AuthView initialAuthData={mockAuthConnected} />} />
              <Route path="/auth-connected/dark" element={<AuthView initialAuthData={mockAuthConnected} />} />

              <Route path="/" element={<AuthView initialAuthData={mockAuthNotConnected} />} />
            </Routes>
          </WidgetContext.Provider>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <BrowserRouter basename="/">
      <PreviewRoutes />
    </BrowserRouter>
  );
}
