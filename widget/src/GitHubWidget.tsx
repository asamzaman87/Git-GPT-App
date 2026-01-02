import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useOpenAI } from './useOpenAI';
import { WidgetContext, useWidget, type WidgetContextType } from './WidgetContext';
import { AuthView, PRContextView } from './components';
import { PRsView } from './components/PRsView';
import { theme } from './theme';
import type { AuthStatusOutput, PullRequestsOutput, PullRequestContext } from './types';
import './main.css';

// ============================================
// Main Widget with Router
// ============================================
function WidgetRouter({ initialData }: { initialData: unknown }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuthData, setPrsData, setPrContextData, prContextData, authData } = useWidget();
  const [initialRouteSet, setInitialRouteSet] = useState(false);

  useEffect(() => {
    console.log('[Widget] Route changed to:', location.pathname);
  }, [location.pathname]);

  // Auto-detect data type and route accordingly on initial load
  useEffect(() => {
    if (initialRouteSet || !initialData) return;

    const data = initialData as Record<string, unknown>;
    console.log('[Widget] Auto-detecting data type:', Object.keys(data));

    // Check if it's PR context data (has 'prContext' object)
    if ('prContext' in data && data.prContext) {
      console.log('[Widget] Detected PR context data, navigating to /pr-context');
      setPrContextData(data.prContext as PullRequestContext);
      setAuthData({ authenticated: true });
      navigate('/pr-context', { replace: true });
      setInitialRouteSet(true);
      return;
    }

    // Check if it's PRs data (has 'pullRequests' array)
    if ('pullRequests' in data && Array.isArray(data.pullRequests)) {
      console.log('[Widget] Detected PRs data, navigating to /prs');
      setPrsData(data as unknown as PullRequestsOutput);
      // Also mark as authenticated since we could fetch PRs
      setAuthData({ authenticated: true });
      navigate('/prs', { replace: true });
      setInitialRouteSet(true);
      return;
    }

    // Check if auth is required
    if ('authRequired' in data && data.authRequired === true) {
      console.log('[Widget] Detected authRequired, showing auth view');
      setAuthData({
        authenticated: false,
        authUrl: data.authUrl as string | undefined
      });
      setInitialRouteSet(true);
      return;
    }

    // Check if it's auth data (has 'authenticated')
    if ('authenticated' in data) {
      console.log('[Widget] Detected auth data, staying on /');
      setAuthData({
        authenticated: data.authenticated as boolean,
        authUrl: data.authUrl as string | undefined,
        user: data.user as any,
      });
      setInitialRouteSet(true);
      return;
    }

    // Unknown data type, stay on current route
    console.log('[Widget] Unknown data type, staying on current route');
    setInitialRouteSet(true);
  }, [initialData, initialRouteSet, navigate, setAuthData, setPrsData, setPrContextData]);

  // Derive initial auth data for AuthView
  const initialAuthData: AuthStatusOutput | null = (() => {
    if (!initialData) return authData;
    const data = initialData as Record<string, unknown>;

    // Handle authRequired
    if ('authRequired' in data && data.authRequired === true) {
      return {
        authenticated: false,
        authUrl: data.authUrl as string | undefined
      };
    }

    // Handle regular auth data
    if ('authenticated' in data) {
      return {
        authenticated: data.authenticated as boolean,
        authUrl: data.authUrl as string | undefined,
        user: data.user as any,
      };
    }

    return authData;
  })();

  return (
    <Routes>
      <Route path="/" element={<AuthView initialAuthData={initialAuthData} />} />
      <Route path="/prs" element={<PRsView />} />
      <Route path="/pr-context" element={<PRContextView initialData={prContextData ? { prContext: prContextData } : undefined} />} />
    </Routes>
  );
}

export default function GitHubWidget() {
  const { data, theme: appTheme, isLoading, error, callTool, openExternal, notifyHeight, setWidgetState, openai } = useOpenAI<AuthStatusOutput>();
  const isDark = appTheme === 'dark';

  const [authData, setAuthData] = useState<AuthStatusOutput | null>(null);
  const [prsData, setPrsData] = useState<PullRequestsOutput | null>(null);
  const [prContextData, setPrContextData] = useState<PullRequestContext | null>(null);

  // Only restore from widgetState if there's no fresh data from the tool call
  useEffect(() => {
    // If we have fresh data from the tool call, don't load from cache
    if (data) return;

    const state = openai?.widgetState as {
      authenticated?: boolean;
      view?: string;
      prs?: PullRequestsOutput;
    } | null;

    if (state?.authenticated) {
      setAuthData({ authenticated: true });
    }
    if (state?.prs) setPrsData(state.prs);
  }, [openai?.widgetState, data]);

  // Wrapper for openExternal that accepts string URL
  const handleOpenExternal = (url: string) => {
    openExternal({ href: url });
  };

  const contextValue: WidgetContextType = {
    theme: appTheme,
    isDark,
    callTool,
    openExternal: handleOpenExternal,
    notifyHeight,
    setWidgetState,
    authData,
    setAuthData,
    prsData,
    setPrsData,
    prContextData,
    setPrContextData,
  };

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border shadow-sm ${theme.card(isDark)}`}>
        <div className="flex items-center justify-center gap-3 py-8">
          <div className={`size-5 rounded-full border-2 border-t-blue-500 animate-spin ${theme.spinner(isDark)}`} />
          <p className={`text-sm ${theme.textSecondary(isDark)}`}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-xl border text-center shadow-sm ${theme.card(isDark)}`}>
        <p className={theme.textSecondary(isDark)}>{error}</p>
      </div>
    );
  }

  return (
    <WidgetContext.Provider value={contextValue}>
      <BrowserRouter>
        <WidgetRouter initialData={data} />
      </BrowserRouter>
    </WidgetContext.Provider>
  );
}
