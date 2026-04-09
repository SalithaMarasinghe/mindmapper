import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
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
          <label className="block text-sm font-medium mb-1" htmlFor="displayName">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {mode === 'register' && (
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="text-sm border border-red-200 text-red-600 bg-red-50 p-3 rounded-md">
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
    </form>
  );
}
