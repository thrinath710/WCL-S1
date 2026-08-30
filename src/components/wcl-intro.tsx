'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';

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

/**
 * How the titles are played.
 *
 * `film` is the rendered clip; `motion` is the drawn ball, kept as the
 * fallback rather than deleted. A video is the one part of this that can
 * simply refuse -- autoplay blocked, codec unsupported, the file still in
 * flight on a bad connection -- and an opening title that sometimes shows
 * nothing is worse than one that is never quite as pretty.
 */
type Mode = 'film' | 'motion';

/**
 * How long each opening runs.
 *
 * The clip is played to fit `film` rather than at a fixed multiplier: the
 * rate is worked out from the file's own duration when its metadata lands,
 * so swapping the source for a longer or shorter one still gives two seconds
 * and nothing has to be edited here.
 */
const LENGTH_MS: Record<Mode, number> = { film: 2000, motion: 1050 };

let playedInThisDocument = false;

/**
 * The key that keeps it to once a visit.
 *
 * Set from the inline script below rather than from React, because the
 * decision has to be made before the overlay paints: on the refreshes that
 * skip it, waiting for hydration would show a frame of the titles and then
 * snatch them away.
 */
const SEEN_KEY = 'wcl:intro-seen';

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
  const [mode, setMode] = useState<Mode>('film');
  /**
   * Whether the opening has actually started.
   *
   * The drawn version starts the instant it is painted. A clip cannot: it has
   * megabytes to fetch and decode first, and the overlay's own clock was
   * running the whole time -- so on anything but a warm cache the titles were
   * torn down while the video was still a second from the end. Nothing runs
   * until this is true, and for film it is the `playing` event that sets it.
   */
  const [rolling, setRolling] = useState(false);
  const started = mode === 'motion' || rolling;
  const INTRO_MS = LENGTH_MS[mode];

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
    // `__wclIntroSeen` is set by the inline script when it has already played
    // in this tab. The markup still matches the server -- the stylesheet has
    // hidden it -- so this only has to take it back out of the DOM.
    const seen = Boolean((window as unknown as { __wclIntroSeen?: number }).__wclIntroSeen);
    if (reduced || seen) {
      const now = window.setTimeout(() => setShowing(false), 0);
      return () => window.clearTimeout(now);
    }
    if (!started) return;      // the clip has not rolled yet; the clock waits

    // Enough slack that the clip's own `ended` normally wins the race; this
    // is only here for the case where it never arrives.
    const timer = window.setTimeout(() => setShowing(false), INTRO_MS + 260);
    return () => window.clearTimeout(timer);
  }, [showing, started, INTRO_MS]);

  // The recoil is a spring, so it overshoots and settles the way a camera on a
  // shoulder does. CSS easing cannot do that, which is the one thing here
  // worth reaching for Motion over keyframes for. It sits on its own element
  // so it never fights the CSS transform on the shake layer, and it fires from
  // the same 20% mark the strike lands on.
  const root = useRef<HTMLDivElement>(null);
  const recoil = useRef<HTMLDivElement>(null);

  // The frame taking the hit, driven by Motion.
  //
  // Two things had to be right before this did anything at all:
  //
  //   * A spring has one target, so a three-value list like [1, 1.05, 1]
  //     collapses to the last value and animates nothing. A two-value list is
  //     a from/to, which it does handle -- and it has to be one call, because
  //     Motion batches its writes to the next frame, so a separate "displace"
  //     call first would leave the spring reading the old value in the same
  //     tick and travelling from 1 to 1.
  //
  //   * The timing comes off the CSS clock, not off this effect. The
  //     stylesheet starts at first paint; hydration can be a few hundred
  //     milliseconds behind it on a phone, and scheduling from here fired the
  //     recoil long after the ball had already hit.
  //
  // The overshoot and settle is the whole reason to reach for Motion here.
  // CSS easing cannot express it.
  useEffect(() => {
    if (mode !== 'motion') return;          // the clip carries its own impact
    if (!showing || !recoil.current || !root.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const el = recoil.current;
    const [timeline] = root.current.getAnimations();
    const elapsed = typeof timeline?.currentTime === 'number' ? timeline.currentTime : 0;
    const contact = INTRO_MS * 0.74;   // the ball reaching the lens
    if (elapsed > contact + 150) return;      // hydrated late; the moment has gone

    const at = window.setTimeout(() => {
      animate(
        el,
        { scale: [1.08, 1], rotate: [-1.1, 0] },
        { type: 'spring', stiffness: 480, damping: 13, mass: 0.9 },
      );
    }, Math.max(0, contact - elapsed));
    return () => window.clearTimeout(at);
  }, [showing, mode, INTRO_MS]);

  /*
   * Speed, set from script.
   *
   * `playbackRate` has no HTML attribute, and several browsers reset it when
   * an element loads new metadata, so it is applied on mount and again on
   * every loadedmetadata rather than once. The figure is derived from the
   * file rather than fixed, so the opening is two seconds whatever the source
   * happens to be.
   */
  const film = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (mode !== 'film' || !showing) return;
    const el = film.current;
    if (!el) return;

    const fit = () => {
      const seconds = LENGTH_MS.film / 1000;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        el.playbackRate = el.duration / seconds;
      }
    };
    fit();
    el.addEventListener('loadedmetadata', fit);

    const roll = () => { fit(); setRolling(true); };
    el.addEventListener('playing', roll);

    // Autoplay can be refused outright; if it is, fall back rather than
    // sitting on a black rectangle.
    void el.play?.().catch(() => setMode('motion'));

    // And if it simply never gets going -- a slow connection, a codec the
    // browser will not take -- do not hold the page behind a black screen.
    const patience = window.setTimeout(() => {
      if (el.paused || el.currentTime === 0) setMode('motion');
    }, 1400);

    return () => {
      el.removeEventListener('loadedmetadata', fit);
      el.removeEventListener('playing', roll);
      window.clearTimeout(patience);
    };
  }, [mode, showing]);

  if (!showing) return null;

  return (
    <div
      ref={root}
      className="wcl-intro"
      aria-hidden="true"
      data-mode={mode}
      data-rolling={started ? '' : undefined}
      onAnimationEnd={(event) => {
        if (event.animationName.startsWith('wcl-intro-out')) setShowing(false);
      }}
      style={{ ['--wcl-intro-dur' as string]: `${INTRO_MS}ms` }}
    >
      {/*
        A way out that does not need the bundle.
        
        Everything else here is React: the clip's own `ended`, the backstop
        timer, the fallback to the drawn version -- all of it waits for
        hydration. On a bad enough connection hydration is tens of seconds
        away, and until then this overlay is an opaque sheet over the whole
        page. Measured at 40kbps it never lifted at all.
        
        This runs the moment the parser reaches it, long before any bundle,
        and marks the overlay expired if it is somehow still up after three
        and a half seconds. It only sets an attribute -- removing the node
        would leave React trying to unmount a child that is no longer there.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            '(function(){var s=document.currentScript,o=s&&s.parentNode;if(!o)return;' +
            // once a visit: if it has already run in this tab, hide it now
            'try{if(sessionStorage.getItem(' + JSON.stringify(SEEN_KEY) + ')){' +
            'o.setAttribute("data-seen","");window.__wclIntroSeen=1;return}' +
            'sessionStorage.setItem(' + JSON.stringify(SEEN_KEY) + ',"1")}catch(e){}' +
            // and never let it hold the page, whatever happens to the bundle
            'setTimeout(function(){' +
            'if(o.isConnected)o.setAttribute("data-expired","")},3500)})()',
        }}
      />

      {mode === 'film' ? (
        <video
          ref={film}
          className="wcl-intro__film"
          src="/wcl-intro.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={() => setShowing(false)}
          onError={() => setMode('motion')}
          onStalled={() => setMode('motion')}
        />
      ) : (
        <div className="wcl-intro__recoil" ref={recoil}>
          <div className="wcl-intro__shake">
            <div className="wcl-intro__scene">
              <div className="wcl-intro__sky" />
              <div className="wcl-intro__stripes" />
              <div className="wcl-intro__ground" />
              <div className="wcl-intro__flood wcl-intro__flood--l" />
              <div className="wcl-intro__flood wcl-intro__flood--r" />
              <div className="wcl-intro__backlight" />
            </div>

            <div className="wcl-intro__trail" />
            <div className="wcl-intro__ball">
              <Ball />
            </div>
            <div className="wcl-intro__flash" />
          </div>
        </div>
      )}

      <div className="wcl-intro__wash" />
    </div>
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
