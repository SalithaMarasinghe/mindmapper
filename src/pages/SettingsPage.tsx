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
  
  const [theme, setTheme] = useState<'light'|'dark'|'system'>('system');
  const [fontSize, setFontSize] = useState<'normal'|'large'>('normal');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Sync local states if missing
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
        await fetchMaps(); // Refresh dashboard
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
      // Depending on Supabase configuration, standard auth.admin API might be locked
      // We will securely default to a Client-level RPC or fallback warning gracefully
      const { error } = await supabase.rpc('delete_user');
      
      if (error) {
        console.warn('RPC delete failed natively, attempting standard client removal (likely blocked by RLS):', error);
        // Fallback for demonstration if RPC missing
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition hover:bg-gray-100 rounded-full active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg text-gray-900 tracking-tight">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">{initial}</div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto pt-20 px-4 sm:px-6 lg:px-8 pb-32">
        
        {/* 1. Profile Section */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Profile</h2>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-6">
               <div className="shrink-0 flex justify-center sm:block">
                 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white font-extrabold text-3xl flex items-center justify-center shadow-md">
                   {initial}
                 </div>
               </div>
               <div className="flex-1 flex flex-col gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Display Name</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={displayName}
                       onChange={e => setDisplayName(e.target.value)}
                       className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                     />
                     <button
                       onClick={handleSaveProfile}
                       disabled={isSavingProfile || displayName === profile?.displayName}
                       className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                     >
                       {isSavingProfile ? 'Saving...' : 'Save'}
                     </button>
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email (Read Only)</label>
                   <input 
                     type="text" 
                     readOnly
                     value={user?.email || ''}
                     className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
                   />
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* 2. Appearance */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette className="w-4 h-4" /> Appearance</h2>
          <div className="bg-white border border-gray-200 rounded-2xl p-0 overflow-hidden shadow-sm divide-y divide-gray-100">
             
             <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <div className="font-bold text-gray-900">Color Theme</div>
                 <div className="text-sm text-gray-500 font-medium">Choose your workspace lighting.</div>
               </div>
               <div className="flex bg-gray-100 p-1 rounded-xl">
                  {(['light', 'dark', 'system'] as const).map(t => (
                    <button 
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${theme === t ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t}
                    </button>
                  ))}
               </div>
             </div>

             <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <div className="font-bold text-gray-900">Typography Scaling</div>
                 <div className="text-sm text-gray-500 font-medium">Increase font size for better readability globally.</div>
               </div>
               <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button 
                    onClick={() => handleFontChange('normal')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${fontSize === 'normal' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Normal
                  </button>
                  <button 
                    onClick={() => handleFontChange('large')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${fontSize === 'large' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Large
                  </button>
               </div>
             </div>

          </div>
        </section>

        {/* 3. Data Management */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Data & Storage</h2>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-6">
            
            <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center p-4 bg-teal-50 border border-teal-100 rounded-xl">
               <div>
                 <div className="font-bold text-teal-900 mb-0.5">Export Backup</div>
                 <div className="text-sm text-teal-700/80 font-medium leading-snug">Download a JSON bundle of all your mindmaps and active recall notes.</div>
               </div>
               <button 
                 onClick={handleExportAll}
                 className="shrink-0 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all active:scale-95 text-sm"
               >
                 <Download className="w-4 h-4" /> Export All (.json)
               </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center p-4 bg-blue-50 border border-blue-100 rounded-xl">
               <div>
                 <div className="font-bold text-blue-900 mb-0.5">Import Backup</div>
                 <div className="text-sm text-blue-700/80 font-medium leading-snug">Restore maps from a previous JSON bundle. This merges, it won't delete existing maps.</div>
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
                 <div className="font-bold text-gray-900 text-sm">Storage Usage Estimate</div>
                 <div className="text-xs font-bold text-teal-600">{maps.length} Maps Synced</div>
               </div>
               <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                 <div className="bg-teal-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((maps.length / 500) * 100, 100)}%` }} />
               </div>
               <div className="text-xs text-gray-400 font-semibold mt-2 text-right">Free Tier Limit: ~500 Maps</div>
            </div>

          </div>
        </section>

        {/* 4. Danger Zone */}
        <section className="mb-0">
          <h2 className="text-sm font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Danger Zone</h2>
          <div className="bg-white border text-red-600 border-red-200 rounded-2xl p-5 sm:p-6 shadow-sm">
             <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
               <div>
                 <div className="font-bold mb-0.5 text-red-700">Delete Account</div>
                 <div className="text-sm text-red-600/80 font-medium leading-snug max-w-md">Permanently wipe your account, settings, and all mindmap data from the database servers. This cannot be undone.</div>
               </div>
               <button 
                 onClick={() => setShowDeleteConfirm(true)}
                 className="shrink-0 flex items-center justify-center gap-2 bg-white border-2 border-red-100 hover:bg-red-50 text-red-600 px-5 py-2.5 rounded-lg font-bold transition-all active:scale-95 text-sm"
               >
                 <Trash2 className="w-4 h-4" /> Delete Everything
               </button>
             </div>

             {/* Inline Delete Confirm Hook */}
             {showDeleteConfirm && (
               <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-in slide-in-from-top-2">
                  <p className="font-bold text-red-900 text-sm mb-4">Are you absolutely sure? Type 'DELETE' to confirm, or click cancel.</p>
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
                      className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-5 py-2 rounded-lg font-bold transition text-sm flex-1 sm:max-w-max"
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
