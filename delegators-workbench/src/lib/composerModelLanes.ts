export type ComposerLane = 'lite' | 'pro' | 'max';

export const COMPOSER_LANE_ORDER: ComposerLane[] = ['lite', 'pro', 'max'];

const LANE_MODELS: Record<
  ComposerLane,
  { base: string[]; thinking: string[] }
> = {
  lite: {
    base: ['dlg-light', 'swe-fast'],
    thinking: ['dlg-light', 'swe-fast-thinking']
  },
  pro: {
    base: ['dlg-pro', 'swe-pro'],
    thinking: ['dlg-pro', 'swe-pro-thinking']
  },
  max: { base: ['swe-ultra'], thinking: ['swe-ultra-thinking'] }
};

function firstAllowed(
  candidates: string[],
  allowedModels: string[]
): string | null {
  return candidates.find((model) => allowedModels.includes(model)) ?? null;
}

export function composerLaneLabel(lane: ComposerLane): string {
  if (lane === 'lite') return 'Pro fast';
  if (lane === 'max') return 'UltraSpeed';
  return 'Pro';
}

export function composerTriggerLabel(
  lane: ComposerLane,
  thinking: boolean
): string {
  if (thinking) return `${composerLaneLabel(lane)} thinking`;
  return composerLaneLabel(lane);
}

export function laneForModel(model: string): ComposerLane | null {
  for (const lane of COMPOSER_LANE_ORDER) {
    const models = LANE_MODELS[lane];
    if (models.base.includes(model) || models.thinking.includes(model))
      return lane;
  }
  return null;
}

export function thinkingEnabledForModel(model: string): boolean {
  for (const lane of COMPOSER_LANE_ORDER) {
    if (LANE_MODELS[lane].thinking.includes(model)) return true;
  }
  return false;
}

export function laneIsAvailable(
  lane: ComposerLane,
  allowedModels: string[]
): boolean {
  const models = LANE_MODELS[lane];
  return Boolean(
    firstAllowed(models.base, allowedModels) ||
    firstAllowed(models.thinking, allowedModels)
  );
}

export function availableComposerLanes(
  allowedModels: string[]
): ComposerLane[] {
  return COMPOSER_LANE_ORDER.filter((lane) =>
    laneIsAvailable(lane, allowedModels)
  );
}

export function laneSupportsThinking(
  lane: ComposerLane,
  allowedModels: string[]
): boolean {
  return Boolean(firstAllowed(LANE_MODELS[lane].thinking, allowedModels));
}

export function planSupportsThinking(allowedModels: string[]): boolean {
  return COMPOSER_LANE_ORDER.some((lane) =>
    laneSupportsThinking(lane, allowedModels)
  );
}

/** Thinking toggle is only offered on fast / pro lanes — never UltraSpeed. */
export function showComposerThinkingToggle(
  lane: ComposerLane,
  allowedModels: string[]
): boolean {
  return (
    (lane === 'lite' || lane === 'pro') &&
    laneSupportsThinking(lane, allowedModels)
  );
}

export function resolveComposerModel(
  lane: ComposerLane,
  thinking: boolean,
  allowedModels: string[]
): string | null {
  const models = LANE_MODELS[lane];
  if (thinking) {
    const thinkingModel = firstAllowed(models.thinking, allowedModels);
    if (thinkingModel) return thinkingModel;
  }
  return (
    firstAllowed(models.base, allowedModels) ??
    firstAllowed(models.thinking, allowedModels)
  );
}

export function parseComposerModelSelection(
  model: string,
  allowedModels: string[]
): { lane: ComposerLane; thinking: boolean; model: string } {
  const lanes = availableComposerLanes(allowedModels);
  const mappedLane = laneForModel(model);
  if (mappedLane && lanes.includes(mappedLane)) {
    const thinking = thinkingEnabledForModel(model);
    const resolved = resolveComposerModel(mappedLane, thinking, allowedModels);
    if (resolved) return { lane: mappedLane, thinking, model: resolved };
  }
  for (const lane of [...lanes].reverse()) {
    const thinking = laneSupportsThinking(lane, allowedModels);
    const resolved = resolveComposerModel(lane, thinking, allowedModels);
    if (resolved) return { lane, thinking, model: resolved };
  }
  const fallback =
    allowedModels.find((entry) => laneForModel(entry)) ??
    allowedModels[0] ??
    model;
  const lane = laneForModel(fallback) ?? 'lite';
  return {
    lane,
    thinking: thinkingEnabledForModel(fallback),
    model: fallback
  };
}
