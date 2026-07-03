let archiveHydrated = false;

export function isThreadArchiveHydrated(): boolean {
  return archiveHydrated;
}

export function markThreadArchiveHydrated(): void {
  archiveHydrated = true;
}

export function resetThreadArchiveHydrationForTests(): void {
  archiveHydrated = false;
}