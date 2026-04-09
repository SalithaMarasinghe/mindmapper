import { useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '../components/auth/AuthForm';

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">🧠 MindMap</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-800">Create a new account</h2>
        </div>

        <AuthForm mode="register" onSuccess={() => navigate('/')} />

        <div className="mt-6 flex justify-center text-sm">
          <span className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-500">
              Login
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
