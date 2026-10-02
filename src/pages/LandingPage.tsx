import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getPreferredAuthDestination, isStandaloneApp } from '../utils/authRedirect';
import { LandingNav } from '../components/landing/LandingNav';
import { Hero } from '../components/landing/Hero';
import { GapSection } from '../components/landing/GapSection';
import { FeatureSection } from '../components/landing/FeatureSection';
import { HowItWorks } from '../components/landing/HowItWorks';
import { AudienceSection } from '../components/landing/AudienceSection';
import { FinalCta } from '../components/landing/FinalCta';
import { LandingFooter } from '../components/landing/LandingFooter';

export function LandingPage() {
  const { user, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      navigate(getPreferredAuthDestination('/dashboard'), { replace: true });
    } else if (isStandaloneApp()) {
      navigate('/login?redirect=%2Fmobile', { replace: true });
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100 font-sans">
      <LandingNav />
      <Hero />
      <GapSection />
      <FeatureSection
        title="Infinite canvas"
        description="Root, branch, and leaf nodes form a natural hierarchy. Drag to position, bend edges by hand, and right-click any node for a quick preview without leaving the canvas."
        illustration="canvas"
        reversed={false}
      />
      <FeatureSection
        title="Deep node editor"
        description="Every node opens into a full study card: definition, mental model, ordered key points, good-vs-bad examples, and a Notion-style block editor with code blocks and markdown."
        illustration="nodeEditor"
        reversed={true}
      />
      <FeatureSection
        title="Test mode"
        description="Hide your notes and quiz yourself on definitions and key points before you need to know them. Track what you've mastered and what needs review."
        illustration="testMode"
        reversed={false}
      />
      <FeatureSection
        title="Offline-first"
        description="Maps and node content mirror to your device automatically. Keep studying without wifi—sync resumes when you're back online."
        illustration="offline"
        reversed={true}
      />
      <FeatureSection
        title="Share & collaborate"
        description="Generate read-only or editable share links for studying solo or working through material with a group."
        illustration="share"
        reversed={false}
      />
      <HowItWorks />
      <AudienceSection />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
