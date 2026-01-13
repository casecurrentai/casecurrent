import * as crypto from 'crypto';
import { prisma } from '../db';
import { logAnalyticsEvent } from './events';

export interface ExperimentConfig {
  key: string;
  variants: { name: string; weight: number }[];
  active: boolean;
}

const EXPERIMENT_CONFIGS: ExperimentConfig[] = [
  {
    key: 'intake_script_v2',
    variants: [
      { name: 'control', weight: 50 },
      { name: 'variant_a', weight: 50 },
    ],
    active: true,
  },
  {
    key: 'qualification_threshold',
    variants: [
      { name: 'control', weight: 50 },
      { name: 'high_bar', weight: 25 },
      { name: 'low_bar', weight: 25 },
    ],
    active: true,
  },
  {
    key: 'followup_timing',
    variants: [
      { name: 'immediate', weight: 33 },
      { name: 'delayed_5m', weight: 34 },
      { name: 'delayed_15m', weight: 33 },
    ],
    active: true,
  },
];

function stableHash(input: string): number {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
}

function assignVariant(
  config: ExperimentConfig,
  orgId: string,
  userId?: string
): string {
  const hashInput = `${orgId}:${userId || 'anonymous'}:${config.key}`;
  const hashValue = stableHash(hashInput);
  const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
  const bucket = hashValue % totalWeight;

  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant.name;
    }
  }

  return config.variants[0].name;
}

export function getExperimentConfig(key: string): ExperimentConfig | undefined {
  return EXPERIMENT_CONFIGS.find((c) => c.key === key);
}

export function listExperiments(): ExperimentConfig[] {
  return EXPERIMENT_CONFIGS.filter((c) => c.active);
}

export async function getExperimentAssignment(
  orgId: string,
  userId: string | undefined,
  key: string,
  logExposure = true
): Promise<{ key: string; variant: string } | null> {
  const config = getExperimentConfig(key);

  if (!config || !config.active) {
    return null;
  }

  const variant = assignVariant(config, orgId, userId);

  if (logExposure) {
    await logAnalyticsEvent({
      orgId,
      userId,
      type: 'experiment.exposure',
      payload: {
        experimentKey: key,
        variant,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return { key, variant };
}

export async function logExperimentConversion(
  orgId: string,
  userId: string | undefined,
  key: string,
  variant: string,
  eventName: string,
  metadata?: Record<string, string | number | boolean | null>
): Promise<void> {
  const config = getExperimentConfig(key);

  if (!config) {
    throw new Error(`Unknown experiment: ${key}`);
  }

  const validVariant = config.variants.find((v) => v.name === variant);
  if (!validVariant) {
    throw new Error(`Invalid variant "${variant}" for experiment "${key}"`);
  }

  await logAnalyticsEvent({
    orgId,
    userId,
    type: 'experiment.conversion',
    payload: {
      experimentKey: key,
      variant,
      eventName,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    },
  });
}

export interface ExperimentStats {
  key: string;
  variants: Array<{
    name: string;
    exposures: number;
    conversions: number;
    conversionRate: number;
  }>;
  startDate: string;
  endDate: string;
}

export async function getExperimentStats(
  orgId: string,
  key: string,
  startDate?: Date,
  endDate?: Date
): Promise<ExperimentStats | null> {
  const config = getExperimentConfig(key);
  if (!config) return null;

  const where: Record<string, unknown> = {
    orgId,
    type: { in: ['experiment.exposure', 'experiment.conversion'] },
  };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const events = await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  const variantStats: Record<string, { exposures: number; conversions: number }> = {};

  for (const variant of config.variants) {
    variantStats[variant.name] = { exposures: 0, conversions: 0 };
  }

  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (payload.experimentKey !== key) continue;

    const variant = payload.variant as string;
    if (!variantStats[variant]) continue;

    if (event.type === 'experiment.exposure') {
      variantStats[variant].exposures++;
    } else if (event.type === 'experiment.conversion') {
      variantStats[variant].conversions++;
    }
  }

  return {
    key,
    variants: config.variants.map((v) => ({
      name: v.name,
      exposures: variantStats[v.name].exposures,
      conversions: variantStats[v.name].conversions,
      conversionRate:
        variantStats[v.name].exposures > 0
          ? variantStats[v.name].conversions / variantStats[v.name].exposures
          : 0,
    })),
    startDate: (startDate || new Date(0)).toISOString(),
    endDate: (endDate || new Date()).toISOString(),
  };
}
