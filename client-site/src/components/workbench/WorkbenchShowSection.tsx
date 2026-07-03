import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { MediaFrame } from './MediaFrame';

const MEDIA = {
  hero: '/workbench/hero-studio.jpg',
} as const;

export function WorkbenchShowSection() {
  return (
    <section id="workbench" className="wb-section wb-section--show">
      <div className="wb-section-inner">
        <div className="wb-show-grid">
          <div className="wb-show-copy">
            <p className="wb-eyebrow">Delegators Workbench</p>
            <h2 className="wb-show-title">
              One studio for decks, reports, and operating models.
            </h2>
            <p className="wb-show-lead">
              Chat on the left. Live preview on the right. Export to PPTX, PDF, or XLSX when it&apos;s ready.
            </p>
            <div className="wb-show-actions">
              <Link to="/workbench" className="wb-btn wb-btn--primary">
                Explore Workbench
                <ArrowRight size={16} />
              </Link>
              <a href="#pricing" className="wb-btn wb-btn--ghost">
                See pricing
              </a>
            </div>
            <div className="wb-show-pills">
              <span className="wb-pill">
                <Sparkles size={12} />
                Live preview
              </span>
              <span className="wb-pill">PPTX · PDF · XLSX</span>
              <span className="wb-pill">Templates</span>
            </div>
          </div>

          <div className="wb-show-visual">
            <MediaFrame
              label="delegators workbench"
              src={MEDIA.hero}
              alt="Delegators Workbench — chat and live deck preview"
              aspect="cinema"
              fit="cover"
              className="wb-show-frame"
            />
          </div>
        </div>
      </div>
    </section>
  );
}