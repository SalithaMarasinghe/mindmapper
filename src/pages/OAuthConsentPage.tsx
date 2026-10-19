import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { setIntendedRedirect } from '../utils/authRedirect';

interface OAuthConsentDetails {
  authorization_id: string;
  redirect_uri: string;
  client: { name: string; client_uri?: string | null };
  user: { email?: string | null };
  scope: string;
}

export function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();
  const authorizationId = searchParams.get('authorization_id');
  const [details, setDetails] = useState<OAuthConsentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorizationId) {
      setError('The authorization request is missing its ID. Return to ChatGPT and try connecting again.');
      setLoading(false);
      return;
    }
    if (authLoading) return;
    if (!user) {
      const redirect = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
      setIntendedRedirect(redirect);
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: requestError }) => {
      if (cancelled) return;
      if (requestError || !data) {
        setError(requestError?.message || 'Could not load the authorization request.');
      } else if ('redirect_url' in data) {
        window.location.replace(data.redirect_url);
        return;
      } else {
        setDetails(data as OAuthConsentDetails);
      }
      setLoading(false);
    }).catch((requestError: unknown) => {
      if (!cancelled) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load the authorization request.');
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [authorizationId, authLoading, user, navigate]);

  const decide = async (decision: 'approve' | 'deny') => {
    if (!authorizationId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = decision === 'approve'
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error) throw result.error;
      if (!result.data?.redirect_url) throw new Error('Supabase did not return the authorization redirect.');
      window.location.assign(result.data.redirect_url);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Could not complete the authorization decision.');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0a0a0a] p-7 shadow-2xl sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-300">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Jarvis account access</p>
        <h1 className="mt-2 text-2xl font-semibold">Authorize an MCP connection</h1>

        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-slate-400" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading the authorization request…
          </div>
        ) : details ? (
          <>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              <strong className="text-white">{details.client.name}</strong> is requesting access to your Jarvis account.
            </p>
            <dl className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-black/50 p-4 text-sm">
              <div>
                <dt className="font-medium text-slate-400">Signed in as</dt>
                <dd className="mt-1 break-all text-slate-100">{user?.email || details.user?.email || 'Your account'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Requested permissions</dt>
                <dd className="mt-2">
                  {details.scope?.trim() ? (
                    <ul className="flex flex-wrap gap-2">
                      {details.scope.split(/\s+/).map((scope) => (
                        <li key={scope} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">{scope}</li>
                      ))}
                    </ul>
                  ) : <span className="text-slate-300">Access to the tools enabled for this MCP connection.</span>}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Return address</dt>
                <dd className="mt-1 break-all text-xs text-slate-300">{details.redirect_uri}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Approving lets this connection call Jarvis tools using your account. You can deny access if you did not start this connection.
            </p>
            {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300" role="alert">{error}</p>}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void decide('deny')}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900 disabled:opacity-50"
              >
                Deny
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void decide('approve')}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve access
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-slate-300">{error || 'This authorization request is unavailable.'}</p>
            <button type="button" onClick={() => navigate('/settings')} className="mt-6 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900">
              Return to Jarvis
            </button>
          </>
        )}
      </section>
    </main>
  );
}
