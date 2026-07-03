import { ProductHeader } from '../components/ProductHeader';
import { Footer } from '../components/landing/Footer';
import { CloudAgentsProductContent } from '../components/cloud/CloudAgentsProductContent';

export function CloudAgentsProduct() {
  return (
    <div className="min-h-screen w-full">
      <ProductHeader />
      <CloudAgentsProductContent />
      <Footer />
    </div>
  );
}