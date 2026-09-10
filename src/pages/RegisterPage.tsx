import { useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '../components/auth/AuthForm';

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f1117] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-[#1e2433] p-8 rounded-xl shadow-xl border border-[#2d3748]">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-100">🧠 MindMap</h1>
          <h2 className="mt-4 text-2xl font-semibold text-slate-200">Create a new account</h2>
        </div>

        <AuthForm mode="register" onSuccess={() => navigate('/dashboard')} />

        <div className="mt-6 flex justify-center text-sm">
          <span className="text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-400 hover:text-teal-300">
              Login
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
