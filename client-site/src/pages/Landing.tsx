import { Hero } from '../components/landing/Hero';
import { SweSection } from '../components/landing/SweSection';
import { ToolStrip } from '../components/landing/ToolStrip';
import { WorkbenchShowSection } from '../components/landing/WorkbenchShowSection';
import { PricingSection } from '../components/landing/PricingSection';
import { Footer } from '../components/landing/Footer';
import { ProductHeader } from '../components/ProductHeader';

export function Landing() {
  return (
    <div className="flex w-full flex-col items-center">
      <ProductHeader />
      <Hero />
      <ToolStrip />
      <SweSection />
      <WorkbenchShowSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
