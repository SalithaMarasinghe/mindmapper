import { CanvasIllustration } from './illustrations/CanvasIllustration';
import { NodeEditorIllustration } from './illustrations/NodeEditorIllustration';
import { TestModeIllustration } from './illustrations/TestModeIllustration';
import { OfflineIllustration } from './illustrations/OfflineIllustration';
import { ShareIllustration } from './illustrations/ShareIllustration';

interface FeatureSectionProps {
  title: string;
  description: string;
  illustration: 'canvas' | 'nodeEditor' | 'testMode' | 'offline' | 'share';
  reversed?: boolean;
}

export function FeatureSection({ title, description, illustration, reversed = false }: FeatureSectionProps) {
  const IllustrationComponent = {
    canvas: CanvasIllustration,
    nodeEditor: NodeEditorIllustration,
    testMode: TestModeIllustration,
    offline: OfflineIllustration,
    share: ShareIllustration,
  }[illustration];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className={`grid lg:grid-cols-2 gap-12 items-center ${reversed ? 'lg:grid-flow-dense' : ''}`}>
          <div className={`${reversed ? 'lg:col-start-2' : ''}`}>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">
              {title}
            </h2>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>
          <div className={`${reversed ? 'lg:col-start-1' : ''} relative`}>
            <IllustrationComponent />
          </div>
        </div>
      </div>
    </section>
  );
}
