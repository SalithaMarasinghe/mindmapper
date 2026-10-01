import { supabase } from '../lib/supabase';

// Standard Google scopes requested for reading email meeting invites and Google Calendar events
export const GOOGLE_MEETING_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

/**
 * Connect with Google via Supabase OAuth redirect flow
 */
export async function connectWithSupabaseGoogleOAuth(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: GOOGLE_MEETING_SCOPES,
      redirectTo: `${window.location.origin}/settings?google_auth=success`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }
}

/**
 * 1-Click in-place Google authorization popup using Google Identity Services (GIS)
 * Allows connecting without full page reload or signing out of existing account
 */
export function connectWithGoogleIdentityPopup(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;

    if (!google?.accounts?.oauth2) {
      return reject(
        new Error(
          'Google Identity Services client is still loading. Please check your internet connection or try again in a few seconds.'
        )
      );
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_MEETING_SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }
          if (tokenResponse.access_token) {
            resolve(tokenResponse.access_token);
          } else {
            reject(new Error('No access token returned from Google authorization.'));
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err.message || 'Google authorization was cancelled or encountered an error.'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (e: any) {
      reject(e);
    }
  });
}
