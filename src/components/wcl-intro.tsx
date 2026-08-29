'use client';

import { useEffect, useState } from 'react';

/**
 * The opening titles.
 *
 * Plays on a fresh load of the Home page -- opening the site from its URL, or
 * refreshing Home -- and at no other time. Moving between Home, Fixtures,
 * Table, Stats and Teams is client-side navigation inside one document, and a
 * re-render or a state change is not a navigation at all, so neither replays
 * it.
 *
 * Two facts settle that, and both are properties of the *document* rather than
 * of React:
 *
 *   1. `playedInThisDocument` is module scope. A module is evaluated once per
 *      JavaScript context, and a context lasts exactly as long as the document
 *      does -- so this is false on a fresh load and true for the rest of the
 *      visit, however many times the component mounts.
 *
 *   2. `PerformanceNavigationTiming.name` is the URL the *document* was loaded
 *      with, and it does not change when the router pushes a new route. So
 *      landing on /fixtures and then walking to Home still reads as
 *      "/fixtures", which is what stops the intro appearing mid-visit.
 *
 * Checking `location.pathname` instead would be wrong for exactly that case:
 * by the time the component mounted it would say "/" and the intro would run
 * on a plain tab-to-tab move.
 *
 * Browser back and forward need no special case. Inside the site they are
 * soft navigations -- the document survives, so (1) has already latched and
 * nothing replays. The only way back lands here as a real document load is if
 * the visitor had left the site altogether, and that is a fresh arrival.
 */

/** Length of the titles. Kept in step with --wcl-intro-dur below. */
const INTRO_MS = 2800;

let playedInThisDocument = false;

function documentWasLoadedOnHome(): boolean {
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (!nav) return false;
  try {
    return new URL(nav.name, window.location.origin).pathname === '/';
  } catch {
    return false;
  }
}

export function WclIntro() {
  const [showing, setShowing] = useState(() => {
    // On the server the overlay is always written into the HTML, so a fresh
    // load paints the titles rather than a frame of Home underneath them.
    if (typeof window === 'undefined') return true;
    // Reached by the router rather than by loading the page: never.
    if (playedInThisDocument) return false;
    return documentWasLoadedOnHome();
  });

  useEffect(() => {
    if (!showing) return;
    // Latch on the way past, so every later mount in this document is a no-op.
    playedInThisDocument = true;

    // A timer, not just the animation's end event.
    //
    // The overlay is in the server HTML, so its animation starts at first
    // paint -- before React has hydrated and attached any handler. At the
    // full 2.8s that gap is irrelevant, but a reader with reduced motion has
    // every animation collapsed to a fraction of a millisecond by the rule in
    // globals.css: the end event fires while the page is still hydrating,
    // nothing is listening, and the overlay would sit there for good holding
    // the scroll lock. This clears it either way.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timer = window.setTimeout(() => setShowing(false), reduced ? 0 : INTRO_MS + 200);
    return () => window.clearTimeout(timer);
  }, [showing]);

  if (!showing) return null;

  return (
    <div
      className="wcl-intro"
      aria-hidden="true"
      // The whole overlay carries one animation whose only job is to fade the
      // titles out at the end; when it finishes, the titles are over.
      onAnimationEnd={(event) => {
        if (event.animationName.startsWith('wcl-intro-out')) setShowing(false);
      }}
      style={{ ['--wcl-intro-dur' as string]: `${INTRO_MS}ms` }}
    >
      <div className="wcl-intro__shake">
        <div className="wcl-intro__scene">
          <div className="wcl-intro__sky" />
          <div className="wcl-intro__stripes" />
          <div className="wcl-intro__ground" />
          <div className="wcl-intro__flood wcl-intro__flood--l" />
          <div className="wcl-intro__flood wcl-intro__flood--r" />
          <div className="wcl-intro__backlight" />
          <Striker />
          <div className="wcl-intro__flash" />
        </div>

        <div className="wcl-intro__trail" />
        <div className="wcl-intro__ball">
          <Ball />
        </div>
      </div>

      <div className="wcl-intro__wash" />
    </div>
  );
}

/**
 * The figure, as a silhouette read against the floodlights.
 *
 * The kicking leg is a separate path rotated about the hip rather than a
 * second drawing cross-faded in: one rotation animates on the compositor, and
 * swinging through the ball is what a kick actually looks like.
 */
function Striker() {
  return (
    <svg className="wcl-intro__figure" viewBox="0 0 240 300" fill="none" role="presentation">
      {/* Contact with the ground. Without it the figure hovers. */}
      <ellipse cx="120" cy="288" rx="56" ry="9" fill="#000" opacity="0.55" />

      <g className="wcl-intro__torso" fill="#020604">
        {/* Head and neck. */}
        <circle cx="120" cy="50" r="16" />
        <path d="M112 63 h16 v13 h-16 z" />

        {/* Shoulders down to the hips, squared to the camera. */}
        <path
          d="M120 72
             c14 0 26 5 31 13
             c4 20 4 43 1 65
             l-7 8 h-50 l-7 -8
             c-3 -22 -3 -45 1 -65
             c5 -8 17 -13 31 -13 z"
        />

        {/* Arms, opening out as the body braces for the strike. */}
        <path d="M92 84 c-14 8 -23 24 -25 43 l12 3 c2 -14 8 -25 19 -32 z" />
        <path d="M148 84 c14 8 23 24 25 43 l-12 3 c-2 -14 -8 -25 -19 -32 z" />

        {/* Standing leg, taking the weight, with the boot flat. */}
        <path d="M100 154 l22 2 -4 56 2 60 -22 1 -3 -60 z" />
        <path d="M97 271 h24 l3 14 -33 1 z" />
      </g>

      <g className="wcl-intro__leg" fill="#020604">
        {/* The kicking leg, swung about the hip and through the ball. */}
        <path d="M124 152 l22 2 4 56 6 46 -22 3 -8 -47 z" />
        <path d="M133 254 l24 2 4 15 -30 -2 z" />
      </g>
    </svg>
  );
}

/**
 * The ball.
 *
 * Lit from the floodlights above and rimmed in pitch green from the ground,
 * so it belongs to the scene rather than sitting on top of it.
 */
function Ball() {
  return (
    <svg className="wcl-intro__ball-inner" viewBox="0 0 100 100" role="presentation">
      <defs>
        <radialGradient id="wclBallLight" cx="36%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#f4f7f4" />
          <stop offset="38%" stopColor="#ccd7ce" />
          <stop offset="72%" stopColor="#7a8a7f" />
          <stop offset="100%" stopColor="#28352d" />
        </radialGradient>
        <radialGradient id="wclBallRim" cx="50%" cy="50%" r="50%">
          <stop offset="84%" stopColor="#2ee86a00" />
          <stop offset="100%" stopColor="#2ee86a" stopOpacity="0.3" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="48" fill="url(#wclBallLight)" />

      {/* The classic panelling, kept dark so it reads at any size. */}
      <g fill="#0d1611">
        <path d="M50 20 l15 11 -6 18 h-18 l-6 -18 z" />
        <path d="M50 8 l-9 7 -8 -4 a44 44 0 0 1 34 0 l-8 4 z" opacity="0.9" />
        <path d="M18 44 l12 -9 5 17 -11 13 -10 -6 a44 44 0 0 1 4 -15 z" />
        <path d="M82 44 l-12 -9 -5 17 11 13 10 -6 a44 44 0 0 0 -4 -15 z" />
        <path d="M36 74 l6 -8 16 0 6 8 -5 13 a44 44 0 0 1 -18 0 z" />
      </g>

      <circle cx="50" cy="50" r="48" fill="url(#wclBallRim)" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#020604" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}
