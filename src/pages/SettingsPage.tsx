import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Palette, Database, AlertCircle, Trash2, Download, Upload } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { exportAllMaps, importMaps } from '../utils/exportImport';
import { useMapsStore } from '../store/mapsStore';

export function SettingsPage() {
  const { user, profile, updateProfile, signOut } = useAuthStore();
  const { maps, fetchMaps } = useMapsStore();
  
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  const [theme, setTheme] = useState<'light'|'dark'|'system'>('dark');
  const [fontSize, setFontSize] = useState<'normal'|'large'>('normal');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (profile?.displayName && !displayName) {
      setDisplayName(profile.displayName);
    }
  }, [profile, displayName]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateProfile({ displayName });
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFontChange = (size: 'normal'|'large') => {
    setFontSize(size);
    if (size === 'large') {
      document.body.classList.add('text-lg');
    } else {
      document.body.classList.remove('text-lg');
    }
  };

  const handleExportAll = async () => {
    try {
      toast.loading('Generating export...', { id: 'export' });
      await exportAllMaps();
      toast.success('Export downloaded!', { id: 'export' });
    } catch (e: any) {
      console.error(e);
      toast.error('Export failed: ' + e.message, { id: 'export' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast.loading('Importing maps...', { id: 'import' });
    try {
      const { imported, errors } = await importMaps(file);
      if (imported > 0) {
        toast.success(`Successfully imported ${imported} map(s)!`, { id: 'import' });
        await fetchMaps();
      } else {
        toast.error(`Import failed. ${errors[0] || ''}`, { id: 'import' });
      }
    } catch (err: any) {
      toast.error('Import process failed entirely.', { id: 'import' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_user');
      
      if (error) {
        console.warn('RPC delete failed natively:', error);
        toast.error('Account deletion block: Your Supabase instance lacks the delete_user RPC privileges internally. Please delete manually in the dashboard for now.');
      } else {
        toast.success('Account deleted completely. Goodbye!');
        await signOut();
      }
    } catch (e: any) {
      toast.error('Severing connection failed securely.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const initial = displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col font-sans">
      
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#1e2433] border-b border-[#2d3748] z-50 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 -ml-2 text-slate-400 hover:text-slate-100 transition hover:bg-[#2d3748] rounded-full active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg text-slate-100 tracking-tight">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">{initial}</div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto pt-20 px-4 sm:px-6 lg:px-8 pb-32">
        
        {/* 1. Profile Section */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Profile</h2>
          <div className="bg-[#1e2433] border border-[#2d3748] rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-6">
               <div className="shrink-0 flex justify-center sm:block">
                 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white font-extrabold text-3xl flex items-center justify-center shadow-md">
                   {initial}
                 </div>
               </div>
               <div className="flex-1 flex flex-col gap-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Display Name</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={displayName}
                       onChange={e => setDisplayName(e.target.value)}
                       className="flex-1 bg-[#0f1117] border border-[#2d3748] rounded-lg px-4 py-2 text-sm font-medium text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-[#1a2030] transition-all outline-none"
                     />
                     <button
                       onClick={handleSaveProfile}
                       disabled={isSavingProfile || displayName === profile?.displayName}
                       className="bg-teal-600 hover:bg-teal-700 disabled:bg-[#2d3748] disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                     >
                       {isSavingProfile ? 'Saving...' : 'Save'}
                     </button>
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email (Read Only)</label>
                   <input 
                     type="text" 
                     readOnly
                     value={user?.email || ''}
                     className="w-full bg-[#0f1117] border border-[#2d3748] rounded-lg px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed"
                   />
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* 2. Appearance */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette className="w-4 h-4" /> Appearance</h2>
          <div className="bg-[#1e2433] border border-[#2d3748] rounded-2xl p-0 overflow-hidden shadow-sm divide-y divide-[#2d3748]">
             
             <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <div className="font-bold text-slate-100">Color Theme</div>
                 <div className="text-sm text-slate-400 font-medium">Choose your workspace lighting.</div>
               </div>
               <div className="flex bg-[#0f1117] p-1 rounded-xl border border-[#2d3748]">
                  {(['light', 'dark', 'system'] as const).map(t => (
                    <button 
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${theme === t ? 'bg-[#2d3748] shadow-sm text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {t}
                    </button>
                  ))}
               </div>
             </div>

             <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <div className="font-bold text-slate-100">Typography Scaling</div>
                 <div className="text-sm text-slate-400 font-medium">Increase font size for better readability globally.</div>
               </div>
               <div className="flex bg-[#0f1117] p-1 rounded-xl border border-[#2d3748]">
                  <button 
                    onClick={() => handleFontChange('normal')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${fontSize === 'normal' ? 'bg-[#2d3748] shadow-sm text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Normal
                  </button>
                  <button 
                    onClick={() => handleFontChange('large')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${fontSize === 'large' ? 'bg-[#2d3748] shadow-sm text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Large
                  </button>
               </div>
             </div>

          </div>
        </section>

        {/* 3. Data Management */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Data & Storage</h2>
          <div className="bg-[#1e2433] border border-[#2d3748] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-6">
            
            <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center p-4 bg-teal-900/20 border border-teal-800/50 rounded-xl">
               <div>
                 <div className="font-bold text-teal-300 mb-0.5">Export Backup</div>
                 <div className="text-sm text-teal-400/70 font-medium leading-snug">Download a JSON bundle of all your mindmaps and active recall notes.</div>
               </div>
               <button 
                 onClick={handleExportAll}
                 className="shrink-0 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all active:scale-95 text-sm"
               >
                 <Download className="w-4 h-4" /> Export All (.json)
               </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl">
               <div>
                 <div className="font-bold text-blue-300 mb-0.5">Import Backup</div>
                 <div className="text-sm text-blue-400/70 font-medium leading-snug">Restore maps from a previous JSON bundle. This merges, it won't delete existing maps.</div>
               </div>
               <div>
                 <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImport}
                 />
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={isImporting}
                   className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all active:scale-95 text-sm"
                 >
                   <Upload className="w-4 h-4" /> {isImporting ? 'Importing...' : 'Upload .json'}
                 </button>
               </div>
            </div>

            <div>
               <div className="flex justify-between items-end mb-2">
                 <div className="font-bold text-slate-200 text-sm">Storage Usage Estimate</div>
                 <div className="text-xs font-bold text-teal-400">{maps.length} Maps Synced</div>
               </div>
               <div className="w-full bg-[#2d3748] rounded-full h-3 overflow-hidden">
                 <div className="bg-teal-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((maps.length / 500) * 100, 100)}%` }} />
               </div>
               <div className="text-xs text-slate-500 font-semibold mt-2 text-right">Free Tier Limit: ~500 Maps</div>
            </div>

          </div>
        </section>

        {/* 4. Danger Zone */}
        <section className="mb-0">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Danger Zone</h2>
          <div className="bg-[#1e2433] border border-red-900/60 rounded-2xl p-5 sm:p-6 shadow-sm">
             <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
               <div>
                 <div className="font-bold mb-0.5 text-red-400">Delete Account</div>
                 <div className="text-sm text-red-400/70 font-medium leading-snug max-w-md">Permanently wipe your account, settings, and all mindmap data from the database servers. This cannot be undone.</div>
               </div>
               <button 
                 onClick={() => setShowDeleteConfirm(true)}
                 className="shrink-0 flex items-center justify-center gap-2 bg-[#1e2433] border-2 border-red-900/60 hover:bg-red-900/20 text-red-400 px-5 py-2.5 rounded-lg font-bold transition-all active:scale-95 text-sm"
               >
                 <Trash2 className="w-4 h-4" /> Delete Everything
               </button>
             </div>

             {showDeleteConfirm && (
               <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-xl animate-in slide-in-from-top-2">
                  <p className="font-bold text-red-300 text-sm mb-4">Are you absolutely sure? Type 'DELETE' to confirm, or click cancel.</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 max-w-[150px] w-full rounded-lg font-bold shadow-sm transition active:scale-95 text-sm"
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="bg-[#2d3748] text-slate-300 border border-[#3d4a60] hover:bg-[#364155] px-5 py-2 rounded-lg font-bold transition text-sm flex-1 sm:max-w-max"
                    >
                      Cancel
                    </button>
                  </div>
               </div>
             )}
          </div>
        </section>

      </main>
    </div>
  );
}
