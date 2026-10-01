import { useState } from 'react';
import {
  Mail,
  CheckCircle2,
  Key,
  RefreshCw,
  Send,
  Calendar,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import {
  connectWithSupabaseGoogleOAuth,
  connectWithGoogleIdentityPopup,
} from '../../services/googleAuth';
import { toast } from 'react-hot-toast';

export function EmailIntegrationSettings() {
  const {
    gmailAccessToken,
    setGmailAccessToken,
    useTestInbox,
    setUseTestInbox,
    autoCheckIntervalMinutes,
    setAutoCheckInterval,
    syncEmails,
    simulateIncomingEmail,
    isSyncing,
    lastSyncedAt,
  } = useEmailStore();

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tokenInput, setTokenInput] = useState(gmailAccessToken || '');

  // Custom simulation state
  const [customSender, setCustomSender] = useState(
    'Sarah Chen (Tech Lead) <sarah.chen@techteam.internal>'
  );
  const [customSubject, setCustomSubject] = useState(
    'Invitation: Client Demo & Standup @ 2:00 PM'
  );
  const [customBody, setCustomBody] = useState(
    `Hey Salitha, let's sync up with the client today at 2:00 PM.\nMeeting link: https://meet.google.com/xyz-demo-meet\nAgenda: Walkthrough of the MindMapper dark mode refactor.`
  );
  const [isSimulating, setIsSimulating] = useState(false);

  // 1-Click Connect with Google (Supabase OAuth)
  const handleConnectWithGoogle = async () => {
    setIsConnectingGoogle(true);
    toast.loading('Redirecting to Google for authorization...', { id: 'google-auth' });
    try {
      await connectWithSupabaseGoogleOAuth();
      // Browser redirects to Google consent screen
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      toast.error('Google sign-in error: ' + (err.message || 'Unknown error'), { id: 'google-auth' });
      setIsConnectingGoogle(false);
    }
  };

  // 1-Click In-Place Popup (GIS)
  const handleConnectWithPopup = async () => {
    if (!googleClientId.trim()) {
      toast.error('Please enter your Google OAuth Client ID first');
      return;
    }
    setIsConnectingGoogle(true);
    toast.loading('Opening Google Authorization Popup...', { id: 'google-popup' });
    try {
      const accessToken = await connectWithGoogleIdentityPopup(googleClientId.trim());
      setGmailAccessToken(accessToken);
      setUseTestInbox(false);
      toast.success('Successfully connected Google account! Fetching Calendar & Gmail...', {
        id: 'google-popup',
      });
      await syncEmails();
    } catch (err: any) {
      console.error('Popup error:', err);
      toast.error(err.message || 'Google authorization failed', { id: 'google-popup' });
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnect = () => {
    setGmailAccessToken(null);
    setUseTestInbox(true);
    toast.success('Google account disconnected. Switched back to test inbox.');
  };

  const handleManualSync = async () => {
    toast.loading('Syncing Google Calendar & Gmail for meetings...', { id: 'email-settings-sync' });
    const fetched = await syncEmails();
    const meetingsFound = fetched.filter((e) => e.hasMeetingInvite).length;
    toast.success(
      meetingsFound > 0
        ? `Sync complete! Found ${meetingsFound} meeting invitation(s).`
        : 'Sync complete. All meetings up to date.',
      { id: 'email-settings-sync' }
    );
  };

  const handleSimulateEmail = () => {
    if (!customSubject.trim() || !customBody.trim()) {
      toast.error('Subject and body cannot be empty');
      return;
    }

    setIsSimulating(true);
    const newEmail = simulateIncomingEmail({
      sender: customSender.trim(),
      subject: customSubject.trim(),
      body: customBody.trim(),
    });

    setIsSimulating(false);
    if (newEmail.hasMeetingInvite) {
      toast.success(
        `Meeting invitation detected & notification created! Click the bell in the header to join.`,
        { duration: 5000 }
      );
    } else {
      toast('Email added to inbox (no meeting detected).');
    }
  };

  const isConnected = !!gmailAccessToken && !useTestInbox;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Mail className="w-4 h-4" /> Google Calendar & Email Meeting Integration
      </h2>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-6">
        {/* 1. Main 1-Click Connect Banner */}
        <div className="p-5 bg-gradient-to-r from-[#0d1320] to-[#0a1628] border border-cyan-500/30 rounded-2xl flex flex-col gap-4 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-white text-black shadow-md flex items-center justify-center shrink-0">
                {/* Official Google SVG "G" Icon */}
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {isConnected ? 'Google Account Connected' : '1-Click Connect with Google'}
                  </h3>
                  {isConnected ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700/80">
                      Test Mode Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Authorize read access to your <strong>Google Calendar</strong> and <strong>Gmail</strong> so Jarvis can automatically detect upcoming team meetings, extract Google Meet & Zoom links, and alert you with 1-click join notifications.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {isConnected ? (
                <>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition shadow-md disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Calendar & Gmail'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#141414] hover:bg-[#1a1a1a] text-slate-400 hover:text-red-400 text-xs font-medium border border-[#222222] transition"
                    title="Disconnect Google Account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectWithGoogle}
                  disabled={isConnectingGoogle}
                  className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition shadow-lg hover:shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Connect with Google (1-Click)</span>
                </button>
              )}
            </div>
          </div>

          {/* Requested Scopes Info Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-cyan-500/20 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-cyan-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Permissions Requested:
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0a0a0a] text-slate-300 border border-[#1a1a1a]">
              <Mail className="w-3 h-3 text-teal-400" />
              Gmail Read Only (gmail.readonly)
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0a0a0a] text-slate-300 border border-[#1a1a1a]">
              <Calendar className="w-3 h-3 text-blue-400" />
              Google Calendar Read Only (calendar.readonly)
            </span>
          </div>
        </div>

        {/* 2. Fast In-Place Popup & Advanced Options Toggle */}
        <div className="flex items-center justify-between px-1 text-xs">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-slate-400 hover:text-teal-400 underline underline-offset-4 transition"
          >
            {showAdvanced ? 'Hide Client ID & Manual Token Options' : 'Alternative: Connect via Client ID Popup or Manual Token'}
          </button>

          {lastSyncedAt && (
            <span className="text-[11px] text-slate-500">
              Last checked: {new Date(lastSyncedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Advanced Options Accordion */}
        {showAdvanced && (
          <div className="p-4 bg-[#080808] border border-[#141414] rounded-xl flex flex-col gap-4 animate-in fade-in duration-150">
            {/* GIS Popup */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Key className="w-4 h-4 text-teal-400" />
                <span>Option B: In-Place Popup (Google Identity Services)</span>
              </div>
              <p className="text-xs text-slate-400">
                If you have a Google OAuth Client ID from Google Cloud Console, enter it here to open the consent popup directly in this tab without any redirect:
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <input
                  type="text"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  className="flex-1 rounded-lg border border-[#1a1a1a] bg-[#000000] text-slate-200 placeholder:text-slate-600 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConnectWithPopup}
                  disabled={isConnectingGoogle}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition"
                >
                  Open Popup
                </button>
              </div>
            </div>

            {/* Manual Token Fallback */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[#141414]">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Key className="w-4 h-4 text-slate-400" />
                <span>Option C: Direct Access Token (Developer Fallback)</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ya29.a0AfH6SM..."
                  className="flex-1 rounded-lg border border-[#1a1a1a] bg-[#000000] text-slate-200 placeholder:text-slate-600 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setGmailAccessToken(tokenInput.trim() || null);
                    if (tokenInput.trim()) setUseTestInbox(false);
                    toast.success(tokenInput.trim() ? 'Access token saved!' : 'Token cleared.');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#141414] hover:bg-[#1a1a1a] border border-[#222222] text-slate-200 font-semibold text-xs transition"
                >
                  Save Token
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Mode Toggle: Simulated Team Inbox */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 bg-[#080808] border border-[#141414] rounded-xl">
          <div>
            <div className="font-bold text-slate-200 text-sm">
              Use Simulated Team Inbox (Instant Testing)
            </div>
            <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
              Provides pre-loaded realistic developer team meeting invites (Sprint Planning, Emergency Architecture Review) with real Google Meet and Zoom links so you can test end-to-end without configuring Google Cloud credentials.
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={useTestInbox}
              onChange={(e) => {
                setUseTestInbox(e.target.checked);
                toast.success(
                  e.target.checked ? 'Switched to Simulated Inbox' : 'Switched to Live Google Mode'
                );
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#141414] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#e2e8f0] after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        {/* 4. Simulate Custom Incoming Meeting Email */}
        <div className="p-4 bg-[#080808] border border-[#141414] rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Send className="w-4 h-4 text-teal-400" />
            <span>Simulate Incoming Team Meeting Email</span>
          </div>
          <p className="text-xs text-slate-400">
            Paste or simulate any email body to test the AI extractor and 1-click notification join button immediately.
          </p>

          <div className="flex flex-col gap-2 mt-1">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Sender</label>
              <input
                type="text"
                value={customSender}
                onChange={(e) => setCustomSender(e.target.value)}
                className="w-full rounded-lg border border-[#1a1a1a] bg-[#000000] text-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Subject</label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full rounded-lg border border-[#1a1a1a] bg-[#000000] text-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Email Body (Include meeting link)
              </label>
              <textarea
                rows={3}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="w-full rounded-lg border border-[#1a1a1a] bg-[#000000] text-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none resize-none font-mono"
              />
            </div>

            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={handleSimulateEmail}
                disabled={isSimulating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold text-xs shadow-md transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Simulate & Trigger Meeting Notification</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. Sync Frequency */}
        <div className="flex items-center justify-between p-4 bg-[#080808] border border-[#141414] rounded-xl text-xs">
          <div>
            <div className="font-semibold text-slate-200">Auto-Check Frequency</div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              How often the AI assistant scans for new incoming team meeting invitations
            </div>
          </div>
          <select
            value={autoCheckIntervalMinutes}
            onChange={(e) => setAutoCheckInterval(Number(e.target.value))}
            className="rounded-lg border border-[#1a1a1a] bg-[#000000] text-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
          >
            <option value={5}>Every 5 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 1 hour</option>
            <option value={0}>Manual only</option>
          </select>
        </div>
      </div>
    </section>
  );
}
