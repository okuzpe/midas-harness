// outcomes.mjs — structured installer exit codes (docs/installer-outcomes.md).

export const INSTALL_OUTCOMES = Object.freeze({
  COMPLETED: 0,
  FAILED: 1,
  LOCK_HELD: 2,
  INCOMPLETE: 3,
  ROLLED_BACK: 5,
  NEEDS_REPAIR: 6,
});
