'use client';

import { useActionState } from 'react';
import { closeGroupStage, fillFinal } from '@/lib/actions/knockout';
import type { ActionResult } from '@/lib/actions/shared';

/**
 * The two buttons that move the tournament out of the group stage.
 *
 * Both are deliberately plain server actions with no client state of their
 * own: the draw they produce is computed on the server from the standings, so
 * there is nothing here to keep in sync and nothing to get stale.
 */
export function CloseGroupStageButton({ ready, hint }: { ready: boolean; hint: string }) {
  const [state, run, pending] = useActionState<ActionResult | null>(
    async () => closeGroupStage(),
    null,
  );

  return (
    <form action={run} className="space-y-2">
      <button
        type="submit"
        disabled={!ready || pending}
        className="min-h-[3rem] w-full cursor-pointer rounded-xl bg-pitch px-4 text-sm font-bold text-ink transition-colors duration-200 hover:bg-pitch-bright disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint"
      >
        {pending ? 'Drawing…' : 'Close group stage & draw semi-finals'}
      </button>
      <p className="text-[0.68rem] leading-relaxed text-faint">{hint}</p>
      <Outcome state={state} />
    </form>
  );
}

export function FillFinalButton({ ready, hint }: { ready: boolean; hint: string }) {
  const [state, run, pending] = useActionState<ActionResult | null>(
    async () => fillFinal(),
    null,
  );

  return (
    <form action={run} className="space-y-2">
      <button
        type="submit"
        disabled={!ready || pending}
        className="min-h-[2.75rem] w-full cursor-pointer rounded-xl border border-line-bright bg-surface-2 px-4 text-xs font-bold text-chalk transition-colors duration-200 hover:border-pitch-dim disabled:cursor-not-allowed disabled:text-faint"
      >
        {pending ? 'Filling…' : 'Put the semi-final winners in the final'}
      </button>
      <p className="text-[0.68rem] leading-relaxed text-faint">{hint}</p>
      <Outcome state={state} />
    </form>
  );
}

function Outcome({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-xl border border-pitch-dim bg-pitch-glow px-3 py-2 text-xs leading-relaxed text-pitch-bright">
      {state.message}
    </p>
  ) : (
    <p className="rounded-xl border border-red-card/50 bg-red-card/10 px-3 py-2 text-xs leading-relaxed text-red-card">
      {state.error}
    </p>
  );
}
