export function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Start a map and drop your root idea',
      description: 'Create a new mindmap and place your central concept at the root.'
    },
    {
      number: '2',
      title: 'Branch out visually as the topic grows',
      description: 'Add branch nodes to explore related concepts and connections.'
    },
    {
      number: '3',
      title: 'Open any node and write the deep version',
      description: 'Click into any node to add definitions, mental models, and examples.'
    },
    {
      number: '4',
      title: 'Test yourself before you actually need to know it',
      description: 'Use test mode to quiz yourself and reinforce your understanding.'
    }
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight text-center mb-16">
          How it works
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="text-5xl font-bold text-teal-600/20 mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">
                {step.title}
              </h3>
              <p className="text-slate-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
