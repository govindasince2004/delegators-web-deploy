// Clerk wiring (P1 identity). The whole layer is optional: with no publishable key
// the site builds and behaves exactly as before (session-key dashboard only).
export const CLERK_PUBLISHABLE_KEY: string = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
export const clerkEnabled = CLERK_PUBLISHABLE_KEY.length > 0;

// Components rendered under <ClerkProvider> register the live token getter here so
// plain modules (api.ts) can attach the JWT without importing React context.
type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;

export function registerClerkTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export async function getClerkToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}
