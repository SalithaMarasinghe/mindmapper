import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { connectWithSupabaseGoogleOAuth } from '../../services/googleAuth';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSuccess: () => void;
}

export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const { signIn, signUp } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const inputClass = "w-full rounded-md border border-[#1a1a1a] bg-[#000000] text-slate-200 placeholder:text-slate-500 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";
  const labelClass = "block text-sm font-medium mb-1 text-slate-300";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    let result;

    if (mode === 'login') {
      result = await signIn(email, password);
    } else {
      result = await signUp(email, password, displayName);
    }

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === 'register' && (
        <div>
          <label className={labelClass} htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            required
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {mode === 'register' && (
        <div>
          <label className={labelClass} htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            required
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="text-sm border border-red-800/60 text-red-400 bg-red-900/20 p-3 rounded-md">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 flex w-full items-center justify-center rounded-md bg-teal-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : mode === 'login' ? (
          'Sign In'
        ) : (
          'Register'
        )}
      </button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#1a1a1a]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#000000] px-2 text-slate-500">Or continue with</span>
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          try {
            await connectWithSupabaseGoogleOAuth();
          } catch (e: any) {
            setError(e.message || 'Google OAuth failed');
          }
        }}
        className="flex w-full items-center justify-center gap-2.5 rounded-md bg-white py-2 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
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
        <span>Continue with Google</span>
      </button>
    </form>
  );
}
