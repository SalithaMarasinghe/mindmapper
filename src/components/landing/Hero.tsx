import { Link } from 'react-router-dom';
import { HeroDiagram } from './illustrations/HeroDiagram';

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-100 tracking-tight leading-tight">
              Map the big picture. Go deep on every idea.
            </h1>
            <p className="mt-6 text-lg text-slate-400 leading-relaxed">
              Mindmap Tool pairs an infinite visual mind map with a full study card for every node — definitions, mental models, examples, and self-tests — so you don't just remember the outline, you understand the subject.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link 
                to="/register" 
                className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors text-center"
              >
                Sign up free
              </Link>
              <Link 
                to="/login" 
                className="text-slate-400 hover:text-slate-100 transition-colors text-center"
              >
                Log in
              </Link>
            </div>
          </div>
          <div className="relative">
            <HeroDiagram />
          </div>
        </div>
      </div>
    </section>
  );
}
