import { useEffect, useMemo, useRef, useState } from 'react';

export interface Point {
  x: number; // days since some origin
  y: number;
  label: string; // e.g. "13 Nov"
  detail?: string; // extra tooltip text, e.g. "80 kg × 5"
}

/** Round axis steps to 1, 2, 2.5 or 5 × 10ⁿ. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.02);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/**
 * Single-series line chart: 2px line, light wash, direct label on the last point,
 * crosshair + tooltip on hover/touch. One series, so the heading names it (no legend).
 */
export function LineChart({ points, unit, height = 190 }: { points: Point[]; unit: string; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const m = { t: 34, r: 14, b: 24, l: 36 };
    const ys = points.map((p) => p.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const x0 = points[0].x;
    const x1 = points[points.length - 1].x;
    const iw = width - m.l - m.r;
    const ih = height - m.t - m.b;
    const sx = (x: number) => m.l + (x1 === x0 ? iw / 2 : ((x - x0) / (x1 - x0)) * iw);
    const sy = (y: number) => m.t + ih - ((y - y0) / (y1 - y0)) * ih;
    const xy = points.map((p) => [sx(p.x), sy(p.y)] as const);
    const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const base = m.t + ih;
    const area = `${path} L${xy[xy.length - 1][0].toFixed(1)} ${base} L${xy[0][0].toFixed(1)} ${base} Z`;
    return { m, ticks, sy, xy, path, area, base, iw };
  }, [points, width, height]);

  const pick = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geo.xy.length; i++) {
      if (Math.abs(geo.xy[i][0] - x) < Math.abs(geo.xy[best][0] - x)) best = i;
    }
    setHover(best);
  };

  const last = points.length - 1;
  const fmt = (v: number) => String(Math.round(v * 10) / 10);
  const h = hover != null && hover < points.length ? hover : null;
  const tipX = h != null ? Math.min(width - 60, Math.max(60, geo.xy[h][0])) : 0;
  const endAnchor = geo.xy[last][0] > width - 60 ? 'end' : 'middle';

  return (
    <div
      className="chart"
      ref={wrap}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Line chart, ${points.length} points, latest ${fmt(points[last].y)} ${unit}`}>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={geo.m.l} x2={width - geo.m.r} y1={geo.sy(t)} y2={geo.sy(t)} />
            <text className="tick" x={geo.m.l - 8} y={geo.sy(t) + 3.5} textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text className="tick" x={geo.m.l} y={height - 4}>
          {points[0].label}
        </text>
        {last > 0 && (
          <text className="tick" x={width - geo.m.r} y={height - 4} textAnchor="end">
            {points[last].label}
          </text>
        )}
        {points.length > 1 && <path className="wash" d={geo.area} />}
        {points.length > 1 && <path className="line" d={geo.path} />}
        {h != null && <line className="cross" x1={geo.xy[h][0]} x2={geo.xy[h][0]} y1={geo.m.t - 4} y2={geo.base} />}
        {points.length <= 24 &&
          geo.xy.slice(0, last).map(([x, y], i) => <circle key={i} className="dot" cx={x} cy={y} r={3} />)}
        <circle className="dot" cx={geo.xy[last][0]} cy={geo.xy[last][1]} r={5} />
        {h == null && (
          <text className="end-label" x={geo.xy[last][0]} y={geo.xy[last][1] - 12} textAnchor={endAnchor}>
            {fmt(points[last].y)}
          </text>
        )}
        {h != null && h !== last && <circle className="dot" cx={geo.xy[h][0]} cy={geo.xy[h][1]} r={5} />}
      </svg>
      {h != null && (
        <div className="chart-tip" style={{ left: tipX }}>
          <b>
            {fmt(points[h].y)} {unit}
          </b>{' '}
          · {points[h].label}
          {points[h].detail ? ` · ${points[h].detail}` : ''}
        </div>
      )}
    </div>
  );
}
