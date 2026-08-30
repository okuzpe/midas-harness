// model-profiles.mjs — executable model-profile definitions for Midas.
//
// Keep the routing logic in one place so the installer, doctor, docs and tests can all agree on the
// same profile names and resolved model ids.

export const ROUTING_PROFILE_ALIASES = {
  openai: 'openai-mini',
};

export const ROUTING_PROFILE_IDS = ['claude', 'openai-mini', 'local-hybrid'];

export const DEFAULT_ROUTING_PROFILE = 'openai-mini';

export const COST_PROFILE_IDS = ['balanced', 'max_savings', 'max_quality'];

/**
 * Claude-only overlays for `cost_profile`. Other `routing_profile` presets ignore these —
 * they already collapse or relocate tiers. Under `max_savings`, Phase 4/8 gate skills still
 * escalate orchestrate to Opus (see `docs/agents-and-models.md`).
 */
export const CLAUDE_COST_PROFILE_ROUTING = {
  balanced: {
    orchestrate: 'claude-opus-4-8',
    build: 'claude-sonnet-4-6',
    scout: 'claude-haiku-4-5',
  },
  max_savings: {
    orchestrate: 'claude-sonnet-4-6',
    build: 'claude-sonnet-4-6',
    scout: 'claude-haiku-4-5',
  },
  max_quality: {
    orchestrate: 'claude-opus-4-8',
    build: 'claude-opus-4-8',
    scout: 'claude-haiku-4-5',
  },
};

/** Stages where `max_savings` still escalates orchestrate to Opus (Phase 4 + Phase 8). */
export const MAX_SAVINGS_ORCHESTRATE_ESCALATE_STAGES = [
  'tech_architecture',
  'audit_adjust',
];

export const MODEL_PROFILES = {
  claude: {
    label: 'Claude',
    summary: 'Legacy Claude routing for existing installs.',
    routing: {
      orchestrate: 'claude-opus-4-8',
      build: 'claude-sonnet-4-6',
      scout: 'claude-haiku-4-5',
    },
    effort: {
      orchestrate: 'high',
      build: 'medium',
      scout: 'low',
    },
  },
  'openai-mini': {
    label: 'OpenAI mini',
    summary: 'GPT-5.4 mini across all three tiers.',
    routing: {
      orchestrate: 'gpt-5.4-mini',
      build: 'gpt-5.4-mini',
      scout: 'gpt-5.4-mini',
    },
    effort: {
      orchestrate: 'xhigh',
      build: 'high',
      scout: 'medium',
    },
  },
  'local-hybrid': {
    label: 'Local hybrid',
    summary: 'Claude orchestrate with local build/scout provenance.',
    routing: {
      orchestrate: 'claude-opus-4-8',
      build: 'local_model.id',
      scout: 'local_model.id',
    },
    effort: {
      orchestrate: 'high',
      build: 'medium',
      scout: 'medium',
    },
  },
};

/** Normalize a routing profile value, mapping legacy aliases onto the active ids. */
export function normalizeRoutingProfile(value) {
  if (!value) return null;
  const raw = String(value).trim();
  return ROUTING_PROFILE_ALIASES[raw] || raw;
}

/**
 * Resolve the routing model ids for a profile.
 * `localModelId` is only used for the local-hybrid profile.
 */
export function resolveRoutingModels(profile, { localModelId = 'local_model.id' } = {}) {
  const normalized = normalizeRoutingProfile(profile) || DEFAULT_ROUTING_PROFILE;
  if (normalized === 'local-hybrid') {
    return {
      orchestrate: MODEL_PROFILES['local-hybrid'].routing.orchestrate,
      build: localModelId,
      scout: localModelId,
    };
  }
  const selected = MODEL_PROFILES[normalized];
  if (!selected) {
    throw new Error(`Unknown routing profile: ${profile}`);
  }
  return { ...selected.routing };
}

/** Normalize a cost_profile value; unknown values return null. */
export function normalizeCostProfile(value) {
  if (!value) return null;
  const raw = String(value).trim();
  return COST_PROFILE_IDS.includes(raw) ? raw : null;
}

/**
 * Resolve the effective tier→model map from both axes.
 * `cost_profile` overlays apply only when `routing_profile` is `claude` (or unset → treated as
 * claude for legacy installs that never wrote `routing_profile`).
 */
export function resolveCostAwareRouting(
  routingProfile,
  costProfile,
  { localModelId = 'local_model.id', defaultRoutingProfile = 'claude' } = {},
) {
  const normalizedRouting =
    normalizeRoutingProfile(routingProfile) || defaultRoutingProfile || DEFAULT_ROUTING_PROFILE;
  const base = resolveRoutingModels(normalizedRouting, { localModelId });
  if (normalizedRouting !== 'claude') return base;
  const normalizedCost = normalizeCostProfile(costProfile) || 'balanced';
  const overlay = CLAUDE_COST_PROFILE_ROUTING[normalizedCost];
  return overlay ? { ...overlay } : base;
}

/** Whether a cost profile is one of the supported ids. */
export function isKnownCostProfile(profile) {
  return COST_PROFILE_IDS.includes(normalizeCostProfile(profile));
}

/** Whether a routing profile is one of the supported ids. */
export function isKnownRoutingProfile(profile) {
  return ROUTING_PROFILE_IDS.includes(normalizeRoutingProfile(profile));
}

/** Known model ids used in routing profiles, plus the local provenance placeholder. */
export function knownRoutingModelIds() {
  return new Set([
    ...Object.values(MODEL_PROFILES.claude.routing),
    ...Object.values(MODEL_PROFILES['openai-mini'].routing),
    ...Object.values(CLAUDE_COST_PROFILE_ROUTING.max_savings),
    ...Object.values(CLAUDE_COST_PROFILE_ROUTING.max_quality),
    'local_model.id',
  ]);
}
