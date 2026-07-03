import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { clerkEnabled } from '../lib/clerk';
import { NavAuthCta, NavAuthCtaFallback } from './NavAuthCta';

// The "notch": a charcoal bar fixed to the very top centre, flush at the top
// with rounded bottom corners (MacBook-display notch). Clicking Products makes
// the notch grow downward to reveal the products — names only, no icon boxes.

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const PRODUCTS = [
  { to: '/swe', name: 'SWE Sessions', desc: 'A governed coding window' },
  { to: '/workbench', name: 'Workbench', desc: 'Production-grade artifacts' },
  { to: '/flow', name: 'Flow', desc: 'Private preview · voice-to-coding dictation' },
  { to: '/cloud-agents', name: 'Cloud Agents', desc: 'Coming soon · async agent with proof video' },
  { to: '/cli', name: 'CLI', desc: 'Coming soon · terminal agent for your plan' },
];

export function ProductHeader() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
      <motion.nav
        ref={navRef}
        layout
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ layout: { duration: 0.42, ease: EASE }, default: { duration: 0.6, ease: EASE } }}
        className="pointer-events-auto w-[min(600px,calc(100%-24px))] rounded-b-[24px] bg-[#0c0c0d] shadow-[0_18px_40px_-16px_rgba(10,15,40,0.5)] ring-1 ring-white/[0.08]"
      >
        <div className="flex h-[52px] items-center justify-between gap-2 pl-3.5 pr-1.5">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5"
            onClick={() => { setOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <img src="/delegators-mark-white.png" alt="Delegators" className="h-[26px] w-auto object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-white">Delegators</span>
          </Link>

          <div className="hidden items-center md:flex">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 px-3.5 py-2 text-[14px] text-white/70 transition-colors hover:text-white"
              aria-expanded={open}
            >
              Products
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            <Link to="/swe" className="px-3.5 py-2 text-[14px] text-white/70 transition-colors hover:text-white" onClick={() => setOpen(false)}>
              SWE
            </Link>
            <Link to="/workbench" className="px-3.5 py-2 text-[14px] text-white/70 transition-colors hover:text-white" onClick={() => setOpen(false)}>
              Workbench
            </Link>
            <Link to="/pricing" className="px-3.5 py-2 text-[14px] text-white/70 transition-colors hover:text-white" onClick={() => setOpen(false)}>
              Pricing
            </Link>
          </div>

          <div className="flex items-center">
            {clerkEnabled ? <NavAuthCta /> : <NavAuthCtaFallback />}
          </div>
        </div>

        {/* The notch grows down to reveal products */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-2.5 pb-2.5"
            >
              <div className="grid gap-1 border-t border-white/[0.08] pt-2.5 sm:grid-cols-2">
                {PRODUCTS.map(({ to, name, desc }) => (
                  <Link
                    key={name}
                    to={to}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-3.5 py-3 transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="block text-[14px] font-medium text-white">{name}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-white/45">{desc}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </div>
  );
}

