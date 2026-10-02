import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { setIntendedRedirect } from '../../utils/authRedirect';

export function ProtectedRoute() {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!user) {
    const target = location.pathname + location.search;
    setIntendedRedirect(target);
    return (
      <Navigate 
        to={`/login?redirect=${encodeURIComponent(target)}`} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  return <Outlet />;
}
