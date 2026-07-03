type AuthClerkLoadingProps = {
  mode: 'sign-in' | 'sign-up';
};

export function AuthClerkLoading({ mode }: AuthClerkLoadingProps) {
  const label = mode === 'sign-up' ? 'Loading sign up…' : 'Loading sign in…';

  return (
    <div className="flex min-h-[220px] flex-col justify-center gap-4" aria-busy="true" aria-label={label}>
      <p className="text-[14px] text-secondary">{label}</p>
      <div className="h-12 w-[148px] animate-pulse rounded-xl bg-black/[0.06]" />
      <div className="h-px w-full bg-line" />
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-black/[0.06]" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-black/[0.06]" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-xl bg-black/[0.08]" />
    </div>
  );
}