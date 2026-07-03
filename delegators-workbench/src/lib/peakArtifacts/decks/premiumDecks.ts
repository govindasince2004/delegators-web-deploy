import type { ArtifactDocument } from '../../shared.js';
import { deckArchetypes } from '../archetypes/deckArchetypes.js';
import { buildDeckArtifactId, buildDeckFromArchetype, type DeckVertical } from '../builders/deckBuilder.js';
import { xboardVerticals } from '../xboardLimeFamily.js';

export type PremiumDeckEntry = {
  id: string;
  archetypeId: string;
  verticalId: string;
  artifact: ArtifactDocument;
};

/** Shared vertical copy variants — 10 industry wedges per archetype. */
export const deckVerticals: DeckVertical[] = xboardVerticals;

function buildPremiumDeckEntries(): PremiumDeckEntry[] {
  const entries: PremiumDeckEntry[] = [];
  for (const archetype of deckArchetypes) {
    for (const vertical of deckVerticals) {
      entries.push({
        id: buildDeckArtifactId(archetype.id, vertical.id),
        archetypeId: archetype.id,
        verticalId: vertical.id,
        artifact: buildDeckFromArchetype(archetype, vertical)
      });
    }
  }
  return entries;
}

export const premiumDeckEntries: PremiumDeckEntry[] = buildPremiumDeckEntries();

export const premiumDeckCount = premiumDeckEntries.length;

export function getPremiumDeckById(id: string): PremiumDeckEntry | undefined {
  return premiumDeckEntries.find((entry) => entry.id === id);
}