import { z } from 'zod';
import { BUCKET_SCALE } from './hash.js';
import type { Serve } from './types.js';

export const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9_.-]*$/,
    'Use lowercase letters, numbers, ".", "_" or "-", starting with a letter or number',
  );

const nameSchema = z.string().trim().min(1).max(100);
const descriptionSchema = z.string().max(1000);
const variationIndexSchema = z.int().min(0);

const attributeValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const variationSchema = z.strictObject({
  value: z.json(),
  name: z.string().max(100).optional(),
});

const weightedVariationSchema = z.strictObject({
  variation: variationIndexSchema,
  weight: z.int().min(0).max(BUCKET_SCALE),
});

export const serveSchema = z.union([
  z.strictObject({ variation: variationIndexSchema }),
  z.strictObject({
    rollout: z
      .array(weightedVariationSchema)
      .min(1)
      .refine(
        (rollout) => rollout.reduce((sum, w) => sum + w.weight, 0) === BUCKET_SCALE,
        `Rollout weights must add up to ${BUCKET_SCALE} (100%)`,
      ),
  }),
]);

export const attributeClauseSchema = z.strictObject({
  attribute: z.string().min(1).max(100),
  operator: z.enum([
    'in',
    'startsWith',
    'endsWith',
    'contains',
    'lessThan',
    'lessThanOrEqual',
    'greaterThan',
    'greaterThanOrEqual',
  ]),
  values: z.array(attributeValueSchema).min(1).max(1000),
  negate: z.boolean().optional(),
});

export const segmentClauseSchema = z.strictObject({
  operator: z.literal('segmentMatch'),
  values: z.array(keySchema).min(1).max(100),
  negate: z.boolean().optional(),
});

export const clauseSchema = z.union([attributeClauseSchema, segmentClauseSchema]);

export const ruleSchema = z.strictObject({
  id: z.string().min(1).max(64),
  clauses: z.array(clauseSchema).min(1).max(100),
  serve: serveSchema,
});

export const targetSchema = z.strictObject({
  variation: variationIndexSchema,
  values: z.array(z.string().min(1).max(256)).max(10_000),
});

export const flagKindSchema = z.enum(['boolean', 'string', 'number', 'json']);
export type FlagKind = z.infer<typeof flagKindSchema>;

const kindChecks: Record<FlagKind, (value: unknown) => boolean> = {
  boolean: (value) => typeof value === 'boolean',
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number',
  json: () => true,
};

const variationsSchema = z.array(variationSchema).min(2).max(20);

export const createProjectSchema = z.strictObject({ key: keySchema, name: nameSchema });
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.strictObject({ name: nameSchema });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createEnvironmentSchema = z.strictObject({ key: keySchema, name: nameSchema });
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>;

export const createFlagSchema = z
  .strictObject({
    key: keySchema,
    name: nameSchema,
    description: descriptionSchema.optional(),
    kind: flagKindSchema.default('boolean'),
    /** Defaults to `[true, false]` for boolean flags; required otherwise. */
    variations: variationsSchema.optional(),
  })
  .refine((flag) => flag.kind === 'boolean' || flag.variations !== undefined, {
    message: 'Variations are required for non-boolean flags',
    path: ['variations'],
  })
  .refine((flag) => !flag.variations || variationsMatchKind(flag.kind, flag.variations), {
    message: 'Every variation value must match the flag kind',
    path: ['variations'],
  });
export type CreateFlagInput = z.infer<typeof createFlagSchema>;

export const updateFlagSchema = z.strictObject({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  variations: variationsSchema.optional(),
});
export type UpdateFlagInput = z.infer<typeof updateFlagSchema>;

export const updateFlagConfigSchema = z.strictObject({
  enabled: z.boolean().optional(),
  offVariation: variationIndexSchema.optional(),
  targets: z.array(targetSchema).max(20).optional(),
  rules: z.array(ruleSchema).max(100).optional(),
  fallthrough: serveSchema.optional(),
});
export type UpdateFlagConfigInput = z.infer<typeof updateFlagConfigSchema>;

export function variationsMatchKind(kind: FlagKind, variations: { value: unknown }[]): boolean {
  return variations.every((v) => kindChecks[kind](v.value));
}

export interface VariationRefs {
  offVariation: number;
  targets: { variation: number }[];
  rules: { serve: Serve }[];
  fallthrough: Serve;
}

function serveIndexes(serve: Serve): number[] {
  return 'variation' in serve ? [serve.variation] : serve.rollout.map((w) => w.variation);
}

/** True if every variation index in the config exists among `variationCount` variations. */
export function variationRefsAreValid(config: VariationRefs, variationCount: number): boolean {
  const indexes = [
    config.offVariation,
    ...config.targets.map((t) => t.variation),
    ...config.rules.flatMap((r) => serveIndexes(r.serve)),
    ...serveIndexes(config.fallthrough),
  ];
  return indexes.every((i) => i < variationCount);
}

export const createSdkKeySchema = z.strictObject({ name: nameSchema });
export type CreateSdkKeyInput = z.infer<typeof createSdkKeySchema>;
