export function maxActiveWorkbenchRuns(): number {
  const configured = Number.parseInt(process.env.WORKBENCH_MAX_ACTIVE_RUNS ?? '8', 10);
  if (!Number.isFinite(configured) || configured < 1) return 8;
  return Math.min(configured, 64);
}

export function workbenchCapacityError(): Error {
  return new Error('Workbench is at peak capacity. Wait a few moments and try again.');
}