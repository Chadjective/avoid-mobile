/**
 * "Your perks": three battery meters (scans today, requests today, follows)
 * and a tap-to-expand Member / Holder / Staker table.
 *
 * Fill is remaining / limit and drains from full to the current level when the
 * meter appears (600ms; instant under the phone's reduce-motion setting). The
 * wording and arithmetic are in session/perks.ts (tested in Node); the SKR
 * tier line and its next step stay in Profile's SKR row, so they are not
 * repeated here. Without `usage` (an older server) the meters are hidden and
 * only the tier's perks text shows.
 */
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Mono, Prose, color, space, useReducedMotion } from "@/src/design";
import {
  hasUsage,
  meterBand,
  meterFraction,
  meterLabel,
  segmentFills,
  tierTable,
  type MeterBand,
  type MeterUsage,
} from "@/src/session/perks";
import { getMe } from "@/src/api/me";
import { SKR_PERKS, normalizeSkrTier } from "@/src/session/skr";

const SEGMENTS = 10;
const W = 240;
const H = 24;
const NUB = 6;
const BODY_W = W - NUB;
const PAD = 3;
const GAP = 2;
const SEG_W = (BODY_W - PAD * 2 - GAP * (SEGMENTS - 1)) / SEGMENTS;

const BAND_COLOR: Record<MeterBand, string> = {
  ok: color.accentAnchor,
  low: color.accentCaution,
  empty: color.accentCritical,
};

export function Battery(props: { fraction: number; fill: string }) {
  const fills = segmentFills(props.fraction, SEGMENTS);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet">
      <Rect
        x={0.5}
        y={0.5}
        width={BODY_W - 1}
        height={H - 1}
        rx={3}
        fill="none"
        stroke={color.textMuted}
        strokeWidth={1}
      />
      <Rect x={BODY_W} y={H / 2 - 5} width={NUB} height={10} rx={1.5} fill={color.textMuted} />
      {fills.map((f, i) => (
        <Rect
          key={i}
          x={PAD + i * (SEG_W + GAP)}
          y={PAD}
          width={SEG_W}
          height={H - PAD * 2}
          rx={1}
          fill={props.fill}
          opacity={f <= 0 ? 0.08 : 0.25 + 0.75 * f}
        />
      ))}
    </Svg>
  );
}

/** One labelled battery. Animates from full to `fraction` on mount and on change. */
function Meter(props: { title: string; usage: MeterUsage; now: number; reduced: boolean }) {
  const target = meterFraction(props.usage.used, props.usage.limit);
  const anim = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(props.reduced ? target : 1);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (props.reduced) {
      anim.setValue(target);
      setShown(target);
      return;
    }
    const run = Animated.timing(anim, {
      toValue: target,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [anim, target, props.reduced]);

  const band = meterBand(target);
  const label = meterLabel(props.usage, props.now);
  return (
    <View
      style={{ marginTop: space.md }}
      accessible
      accessibilityLabel={`${props.title}: ${label}`}
    >
      <Mono size="micro" tone="muted" label>
        {props.title}
      </Mono>
      <View style={{ marginTop: 4 }}>
        <Battery fraction={shown} fill={BAND_COLOR[band]} />
      </View>
      <Mono size="micro" tone={band === "ok" ? "secondary" : "primary"} style={{ marginTop: 4 }}>
        {label}
      </Mono>
    </View>
  );
}

export function PerksCard(props: {
  skrTier: string;
  /** Test seam; defaults to the clock. */
  now?: number;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const now = props.now ?? Date.now();
  const tier = normalizeSkrTier(props.skrTier);
  const p = SKR_PERKS[tier];
  // The shared session fetch of /api/me omits usage (it runs on every launch);
  // only this card asks for it, once when Profile shows it.
  const [raw, setRaw] = useState<unknown>(null);
  useEffect(() => {
    let live = true;
    getMe({ usage: true })
      .then((m) => {
        if (live) setRaw(m.usage ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const usage = hasUsage(raw) ? raw : null;
  const table = tierTable(SKR_PERKS, usage?.tier_effective ?? tier);
  const boost = usage ? usage.queue_boost : p.queuePriority;

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel="Your perks, tap to compare tiers"
      style={{ marginTop: space.md }}
    >
      <Mono size="label" label tone="muted">
        your perks
      </Mono>
      {usage ? (
        <>
          <Meter title="Scans today" usage={usage.scans} now={now} reduced={reduced} />
          <Meter title="Requests today" usage={usage.requests} now={now} reduced={reduced} />
          <Meter title="Follows" usage={usage.follows} now={now} reduced={reduced} />
        </>
      ) : (
        <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
          {p.follows} follows · {p.scansPerDay} scans a day · {p.requestsPerDay} requests a day
        </Mono>
      )}
      <Prose weight="medium" style={{ marginTop: space.md }}>
        Queue priority +{boost}
      </Prose>
      <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
        {open ? "Hide tier comparison" : "Tap to compare tiers"}
      </Mono>
      {open ? (
        <View style={{ marginTop: space.sm }}>
          <TableRow cells={["", ...table.header]} header />
          {table.rows.map((r) => (
            <TableRow key={r.tier} cells={[r.tier, ...r.cells]} current={r.current} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function TableRow(props: { cells: string[]; header?: boolean; current?: boolean }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 3 }}>
      {props.cells.map((c, i) => (
        <Mono
          key={i}
          size="micro"
          tone={props.header ? "muted" : props.current ? "primary" : "secondary"}
          weight={props.current ? "semibold" : "regular"}
          color={props.current && i === 0 ? color.accentAnchor : undefined}
          style={{ flex: i === 0 ? 1.1 : 1, textAlign: i === 0 ? "left" : "right" }}
        >
          {c}
        </Mono>
      ))}
    </View>
  );
}
