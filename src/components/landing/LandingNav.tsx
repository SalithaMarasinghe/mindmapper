import { Link } from 'react-router-dom';

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-sm border-b border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-slate-100 tracking-tight">
              Mindmap Tool
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">
                How it works
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Log in
            </Link>
            <Link 
              to="/register" 
              className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
