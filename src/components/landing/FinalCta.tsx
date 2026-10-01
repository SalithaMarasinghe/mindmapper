import { Link } from 'react-router-dom';

export function FinalCta() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">
          Map the big picture. Go deep on every idea.
        </h2>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/register" 
            className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors"
          >
            Sign up
          </Link>
          <Link 
            to="/login" 
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
