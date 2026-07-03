import type { ArtifactDocument } from '../src/lib/shared.js';

export type ArtifactPatchOperation =
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string };

export type ArtifactPatchRequest = {
  instruction: string;
  operations?: ArtifactPatchOperation[];
};

function parsePath(path: string): Array<string | number> {
  return path
    .split('.')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function setAtPath(target: unknown, path: Array<string | number>, value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (typeof head === 'number') {
    const array = Array.isArray(target) ? [...target] : [];
    if (rest.length === 0) {
      array[head] = value;
      return array;
    }
    array[head] = setAtPath(array[head], rest, value);
    return array;
  }
  const record = typeof target === 'object' && target !== null ? { ...(target as Record<string, unknown>) } : {};
  if (rest.length === 0) {
    record[head] = value;
    return record;
  }
  record[head] = setAtPath(record[head], rest, value);
  return record;
}

function removeAtPath(target: unknown, path: Array<string | number>): unknown {
  if (path.length === 0) return target;
  const [head, ...rest] = path;
  if (typeof head === 'number') {
    const array = Array.isArray(target) ? [...target] : [];
    if (rest.length === 0) {
      array.splice(head, 1);
      return array;
    }
    array[head] = removeAtPath(array[head], rest);
    return array;
  }
  const record = typeof target === 'object' && target !== null ? { ...(target as Record<string, unknown>) } : {};
  if (rest.length === 0) {
    delete record[head];
    return record;
  }
  record[head] = removeAtPath(record[head], rest);
  return record;
}

export function applyArtifactPatch(artifact: ArtifactDocument, operations: ArtifactPatchOperation[]): ArtifactDocument {
  let next: unknown = artifact;
  for (const operation of operations) {
    const path = parsePath(operation.path);
    if (operation.op === 'remove') {
      next = removeAtPath(next, path);
    } else {
      next = setAtPath(next, path, operation.value);
    }
  }
  return next as ArtifactDocument;
}

export function buildStructuredPatchMessages(options: {
  artifact: ArtifactDocument;
  instruction: string;
  sourceEvidence?: string;
}): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: [
        'You revise Delegators Workbench artifacts using structured JSON patches.',
        'Return only JSON: { operations: [{ op: "replace"|"add"|"remove", path: "dot.path", value? }] }.',
        'Paths use dot notation with numeric indices for arrays, e.g. slides.2.title.',
        'Never invent facts. Preserve truthful user-provided content unless the instruction changes it.',
        'Do not return the full artifact — only patch operations.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Instruction:\n${options.instruction}`,
        options.sourceEvidence ? `Evidence:\n${options.sourceEvidence}` : '',
        `Current artifact JSON:\n${JSON.stringify(options.artifact)}`
      ].filter(Boolean).join('\n\n')
    }
  ];
}

export function parsePatchResponse(content: string): ArtifactPatchOperation[] | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    const parsed = JSON.parse(candidate) as { operations?: ArtifactPatchOperation[] };
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0) return null;
    return parsed.operations.filter((operation) =>
      (operation.op === 'remove' && typeof operation.path === 'string') ||
      ((operation.op === 'replace' || operation.op === 'add') && typeof operation.path === 'string')
    );
  } catch {
    return null;
  }
}