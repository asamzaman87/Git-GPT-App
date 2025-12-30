import { useEffect, useState } from 'react';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Check } from '@openai/apps-sdk-ui/components/Icon';
import { useWidget } from '../WidgetContext';
import { theme } from '../theme';
import type { AuthStatusOutput } from '../types';

// GitHub Icon Component
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

interface AuthViewProps {
  initialAuthData: AuthStatusOutput | null;
}

export function AuthView({ initialAuthData }: AuthViewProps) {
  const { isDark, callTool, openExternal, setWidgetState, notifyHeight, authData, setAuthData } = useWidget();
  const [isPolling, setIsPolling] = useState(false);

  const currentAuth = authData || initialAuthData;
  const isAuthenticated = currentAuth?.authenticated ?? false;

  useEffect(() => { notifyHeight(); }, [isAuthenticated, isPolling, notifyHeight]);

  // Polling for auth status
  useEffect(() => {
    if (!isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await callTool('check_github_auth_status', {}) as { structuredContent?: AuthStatusOutput };
        if (result?.structuredContent?.authenticated) {
          setAuthData(result.structuredContent);
          setWidgetState({ authenticated: true, user: (result.structuredContent as any).user });
          setIsPolling(false);
        }
      } catch (err) {
        console.error('[Widget] Poll error:', err);
      }
    }, 3000);

    const timeout = setTimeout(() => setIsPolling(false), 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [isPolling, callTool, setWidgetState, setAuthData]);

  const handleConnect = () => {
    if (currentAuth?.authUrl) {
      openExternal({ href: currentAuth.authUrl });
      setIsPolling(true);
    }
  };

  // Connected State
  if (isAuthenticated) {
    const user = (currentAuth as any)?.user;
    return (
      <div className={`rounded-2xl shadow-lg border p-8 relative overflow-hidden ${theme.card(isDark)}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center shadow-lg shadow-green-500/25 dark:shadow-green-500/20">
              <Check className={`size-6 text-white`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${theme.textPrimary(isDark)}`}>Connected</h2>
              <p className={`text-sm ${theme.textPrimary(isDark)}`}>GitHub linked</p>
            </div>
          </div>
          <Badge className='p-6 rounded-full' color="success">Active</Badge>
        </div>

        {user?.login && (
          <div className={`p-4 rounded-xl border ${theme.card(isDark)}`}>
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${theme.textPrimary(isDark)}`}>Signed in as</p>
            <div className="flex items-center gap-2">
              <GitHubIcon className="w-4 h-4" />
              <p className={`text-sm font-medium ${theme.textPrimary(isDark)}`}>@{user.login}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not Connected State
  return (
    <div className={`rounded-2xl shadow-lg border p-8 relative overflow-hidden ${theme.card(isDark)}`}>
      <div className="relative">
        {/* Icon Container */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${isDark ? 'bg-[#238636] shadow-green-600/25' : 'bg-[#238636] shadow-green-500/25'}`}>
            <GitHubIcon className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className={`text-2xl font-semibold text-center mb-3 ${theme.textPrimary(isDark)}`}>
          {isPolling
            ? 'Waiting for Sign In...'
            : currentAuth?.authUrl
              ? 'Connect GitHub'
              : 'Setting Up GitHub Access'
          }
        </h1>

        {/* Description */}
        <p className={`text-center leading-relaxed mb-8 ${theme.textPrimary(isDark)}`}>
          {isPolling
            ? 'Complete the sign-in in the new tab. This will update automatically.'
            : currentAuth?.authUrl
              ? 'Link your GitHub account to access your profile from ChatGPT'
              : 'Preparing your GitHub connection and checking authentication...'
          }
        </p>

        {isPolling ? (
          <div className="flex flex-col items-center gap-3 py-2 mb-6">
            <div className={`size-6 rounded-full border-2 border-t-[#238636] animate-spin ${theme.spinner(isDark)}`} />
            <p className={`text-xs ${theme.textPrimary(isDark)}`}>
              Checking every few seconds...
            </p>
          </div>
        ) : currentAuth?.authUrl ? (
          <>
            {/* GitHub Sign In Button */}
            <button
              onClick={handleConnect}
              className={`w-full h-12 flex items-center justify-center gap-3 font-medium rounded-xl text-white bg-[#24292f] hover:bg-[#32383f] transition-colors`}
            >
              <GitHubIcon className="w-5 h-5" />
              Continue with GitHub
            </button>

            {/* Privacy Notice */}
            <div className={`mt-6 flex items-start ${theme.textPrimary(isDark)} gap-2 p-3 rounded-lg border ${theme.buttonBorder(isDark)}`}>
              <svg className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                We only access your basic profile information. Your data is encrypted and never shared with third parties.
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className={`size-4 rounded-full border-2 border-t-[#238636] animate-spin ${theme.spinner(isDark)}`} />
            <p className={`text-sm ${theme.textPrimary(isDark)}`}>Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}
