import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-100 tracking-tight">
              Mindmap Tool
            </span>
            <span className="text-slate-400 text-sm">
              · Map the big picture
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link 
              to="/login" 
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Log in
            </Link>
            <Link 
              to="/register" 
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-8 text-center sm:text-left">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Mindmap Tool. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
