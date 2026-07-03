import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="w-full border-t border-line px-4 py-12">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-6 text-sm sm:flex-row">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/delegators-mark-black.png" alt="Delegators" className="h-4 w-auto object-contain" />
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-foreground">Delegators</span>
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-secondary">
          <a href="/" className="transition-colors hover:text-foreground">Suite</a>
          <a href="/swe" className="transition-colors hover:text-foreground">SWE</a>
          <Link to="/workbench" className="transition-colors hover:text-foreground">Workbench</Link>
          <a href="/docs" className="transition-colors hover:text-foreground">API Docs</a>
          <a href="/terms" className="transition-colors hover:text-foreground">Terms</a>
          <a href="/privacy" className="transition-colors hover:text-foreground">Privacy</a>
          <a href="/acceptable-use" className="transition-colors hover:text-foreground">Use Policy</a>
          <a href="/refund" className="transition-colors hover:text-foreground">Refunds</a>
          <a href="/delivery" className="transition-colors hover:text-foreground">Delivery</a>
          <a href="/contact" className="transition-colors hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}
