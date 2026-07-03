import { ProductHeader } from '../components/ProductHeader';
import { Footer } from '../components/landing/Footer';
import { WorkbenchProductContent } from '../components/workbench/WorkbenchProductContent';

export function WorkbenchProduct() {
  return (
    <div className="min-h-screen w-full">
      <ProductHeader />
      <WorkbenchProductContent />
      <Footer />
    </div>
  );
}