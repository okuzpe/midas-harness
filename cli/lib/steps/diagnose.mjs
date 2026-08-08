// diagnose.mjs — requirements/checks surface wrapping install-diagnose.

import { diagnoseProject, formatDiagnosis } from '../../install-diagnose.mjs';
import { createPlan } from '../core/plan.mjs';
import { buildResultEnvelope } from '../report/render.mjs';

/**
 * @param {{ target: string, installCmd?: string, json?: boolean }} opts
 */
export function runDiagnoseStep(opts) {
  const diagnosis = diagnoseProject(opts.target, {
    installCmd: opts.installCmd,
  });
  const plan = createPlan({
    mode: 'diagnose',
    target: diagnosis.dir,
    requirements: [
      {
        id: 'install-present',
        ok: diagnosis.status !== 'not_installed',
        message: diagnosis.summary,
      },
    ],
    checks: [
      {
        id: 'status',
        ok: diagnosis.status === 'ready',
        message: `status=${diagnosis.status}`,
      },
    ],
    ops: [
      {
        id: 'next-action',
        kind: 'advise',
        reason: diagnosis.nextCli || diagnosis.nextSlash || 'none',
      },
    ],
  });

  const ok = diagnosis.status === 'ready';
  const envelope = buildResultEnvelope({
    ok,
    mode: 'diagnose',
    target: diagnosis.dir,
    phase: 'complete',
    plan,
    diagnosis,
    message: formatDiagnosis(diagnosis),
  });

  return { ok, diagnosis, plan, envelope, exitCode: ok ? 0 : 1 };
}
