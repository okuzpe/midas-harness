# Tribunal — method & references

`/midas-tribunal` is an adversarial, evidence-grounded debate. Its design deliberately encodes findings
from the multi-agent-debate and decision-science literature; the choices below are *why* it isn't theater.
These are pointers (the rationale behind the skill), not a literature review — verify any specific claim
against its source.

## Why these mechanics (and roughly where they come from)
- **Evidence-or-struck** — debate beats single-pass critique only when every claim cites checkable
  evidence; ungrounded debate degrades. (Du et al., *Improving Factuality and Reasoning in LMs through
  Multiagent Debate*, 2023; Khan et al., *Debating with More Persuasive LLMs Leads to More Truthful
  Answers*, 2024.)
- **Producer ≠ judge; a jury, not a lone self-judge** — self-grading suffers self-preference bias; a
  small diverse panel is cheaper and less biased. (Verga et al., *Replacing Judges with Juries* / PoLL,
  2024; Huang et al., *LLMs Cannot Self-Correct Reasoning Yet*, ICLR 2024.)
- **Force dissent (the Catfish)** — without a dissent-forcing role, agents degenerate to premature
  consensus / silent agreement. (Liang et al., *Encouraging Divergent Thinking* / Degeneration-of-Thought,
  2023; "catfish / devil's-advocate" line of work, 2025.)
- **Independent re-verification (CoVe)** — verify contested claims in fresh context so the verdict isn't
  biased by the transcript. (Dhuliawala et al., *Chain-of-Verification*, 2023.)
- **Bias hygiene for the judge** — shuffle order, mask authorship, penalize verbosity; LLM judges show
  position, verbosity, and authority biases. (Zheng et al., *Judging LLM-as-a-Judge with MT-Bench*, 2023.)

## The lenses (decision science)
Premortem / prospective hindsight (Klein, *HBR* 2007); dialectical inquiry & devil's advocacy; inversion
(Munger); second-order thinking; **ATAM** (risks, sensitivity & tradeoff points); **FMEA** (severity ×
occurrence × detection); **STRIDE** (threat modeling per trust boundary); Six Thinking Hats (de Bono);
YAGNI / simplicity.
