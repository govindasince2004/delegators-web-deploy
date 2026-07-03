const AUTH_HERO_IMAGE = '/auth/hero.jpg';

// Right half — single static hero, edge-to-edge. No video, no side gutters.
export function AuthVideoPanel() {
  return (
    <img
      src={AUTH_HERO_IMAGE}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover object-center select-none"
      decoding="async"
      fetchPriority="high"
    />
  );
}