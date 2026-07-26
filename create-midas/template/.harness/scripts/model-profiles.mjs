// model-profiles.mjs — executable model-profile definitions for Midas.
//
// Keep the routing logic in one place so the installer, doctor, docs and tests can all agree on the
// same profile names and resolved model ids.

export const ROUTING_PROFILE_ALIASES = {
  openai: 'openai-mini',
};

export const ROUTING_PROFILE_IDS = ['claude', 'openai-mini', 'local-hybrid'];

export const DEFAULT_ROUTING_PROFILE = 'openai-mini';

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

/** Whether a routing profile is one of the supported ids. */
export function isKnownRoutingProfile(profile) {
  return ROUTING_PROFILE_IDS.includes(normalizeRoutingProfile(profile));
}

/** Known model ids used in routing profiles, plus the local provenance placeholder. */
export function knownRoutingModelIds() {
  return new Set([
    ...Object.values(MODEL_PROFILES.claude.routing),
    ...Object.values(MODEL_PROFILES['openai-mini'].routing),
    'local_model.id',
  ]);
}
