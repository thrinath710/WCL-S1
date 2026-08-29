import { ImageResponse } from 'next/og';
import { getSnapshot, indexById } from '@/lib/queries';
import { headlineMatch } from '@/lib/schedule';
import { isCounted, STAGE_LABEL } from '@/lib/types';

/**
 * Share preview image.
 *
 * A link dropped into a WhatsApp group unfurls with the tournament name and
 * the score that matters right now, so people can see the state of play
 * without opening anything. `?match=<id>` pins it to one match.
 */
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#060c08';
const PITCH = '#2ee86a';
const GOLD = '#ffc94a';
const CHALK = '#f1f7f2';
const MUTED = '#8ea597';
const LINE = '#22352a';
const LIVE = '#ff3b5c';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('match');

  const { settings, teams, matches } = await getSnapshot();
  const teamIndex = indexById(teams);

  const pinned = matchId ? matches.find((m) => m.id === matchId) : undefined;
  const headline = pinned
    ? { match: pinned, kind: pinned.status === 'live' ? ('live' as const) : isCounted(pinned) ? ('last' as const) : ('next' as const) }
    : headlineMatch(matches);

  const home = headline ? teamIndex.get(headline.match.home_team_id) : undefined;
  const away = headline ? teamIndex.get(headline.match.away_team_id) : undefined;
  const showScore = headline ? headline.kind !== 'next' : false;
  const live = headline?.kind === 'live';

  const kicker = live
    ? 'LIVE NOW'
    : headline?.kind === 'next'
      ? 'NEXT KICKOFF'
      : headline
        ? 'LATEST RESULT'
        : '';

  // Before a ball is kicked the preview says where things stand rather than
  // echoing the tagline that is already in the header.
  const standby =
    teams.length === 0
      ? 'Fixtures and standings coming soon'
      : `${teams.length} ${teams.length === 1 ? 'team' : 'teams'} registered · fixtures coming soon`;

  const stageLine = headline
    ? headline.match.stage === 'group'
      ? `Group ${headline.match.group_name ?? ''}`
      : STAGE_LABEL[headline.match.stage]
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: INK,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Pitch markings: a halfway line and centre circle, so the preview
            reads as football before a word of it is read. */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 600,
            top: 0,
            width: 2,
            height: 630,
            backgroundColor: PITCH,
            opacity: 0.12,
          }}
        />
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 465,
            top: 180,
            width: 270,
            height: 270,
            borderRadius: 135,
            border: `2px solid ${PITCH}`,
            opacity: 0.12,
          }}
        />
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', width: 14, height: 56, backgroundColor: PITCH, borderRadius: 7 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, color: CHALK, letterSpacing: -1.5 }}>
              {settings.name}
            </div>
            {settings.tagline ? (
              <div style={{ display: 'flex', fontSize: 22, color: MUTED, marginTop: 6 }}>
                {settings.tagline}
              </div>
            ) : null}
          </div>
        </div>

        {/* headline match */}
        {headline && home && away ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 4,
                color: live ? LIVE : PITCH,
                marginBottom: 18,
              }}
            >
              {kicker}
              {stageLine ? `   ·   ${stageLine.toUpperCase()}` : ''}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
              <Side name={home.name} kit="dark" align="flex-start" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 132,
                    fontWeight: 800,
                    color: live ? LIVE : CHALK,
                    letterSpacing: -6,
                    lineHeight: 1,
                  }}
                >
                  {showScore
                    ? `${headline.match.home_score} – ${headline.match.away_score}`
                    : 'v'}
                </div>
                {headline.match.home_pens != null && headline.match.away_pens != null ? (
                  <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: GOLD, marginTop: 10 }}>
                    {headline.match.home_pens} – {headline.match.away_pens} on penalties
                  </div>
                ) : null}
              </div>
              <Side name={away.name} kit="light" align="flex-end" />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 4,
                color: PITCH,
              }}
            >
              6-A-SIDE FOOTBALL
            </div>
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: CHALK }}>
              {standby}
            </div>
          </div>
        )}

        {/* footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `2px solid ${LINE}`,
            paddingTop: 22,
            fontSize: 22,
            color: MUTED,
          }}
        >
          <div style={{ display: 'flex' }}>
            6-a-side{teams.length > 0 ? ` · ${teams.length} teams` : ''}
          </div>
          <div style={{ display: 'flex' }}>Fixtures · Table · Stats</div>
        </div>
      </div>
    ),
    size,
  );
}

/** The home side wears dark and the away side light -- see lib/kit.ts. */
function Side({
  name,
  kit,
  align,
}: {
  name: string;
  kit: 'dark' | 'light';
  align: 'flex-start' | 'flex-end';
}) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        alignItems: align,
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: kit === 'dark' ? '#14181c' : '#eef1ed',
          border: `2px solid ${kit === 'dark' ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.35)'}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          fontSize: 38,
          fontWeight: 700,
          color: CHALK,
          textAlign: align === 'flex-end' ? 'right' : 'left',
          lineHeight: 1.15,
        }}
      >
        {name}
      </div>
    </div>
  );
}
