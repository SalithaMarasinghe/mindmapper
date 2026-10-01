import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AuthForm } from '../components/auth/AuthForm';

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#000000] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-[#0a0a0a] p-8 rounded-xl shadow-xl border border-[#1a1a1a]">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-100">🧠 MindMap</h1>
          <h2 className="mt-4 text-2xl font-semibold text-slate-200">Sign in to your account</h2>
        </div>

        <AuthForm mode="login" onSuccess={() => navigate('/dashboard')} />

        <div className="mt-6 flex justify-center text-sm">
          <span className="text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-teal-400 hover:text-teal-300">
              Register
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
