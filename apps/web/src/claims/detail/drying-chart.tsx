import type { Schema } from "@claimforge/api-client";
import { Button, Stack, Text } from "@claimforge/ui";
import { useId, useState, type PointerEvent } from "react";

import { DRYING_LABEL, reading, type LogPoint } from "../moisture";

type Visit = Schema<"DryingLogVisit">;

/** The drawing's own units; the SVG scales to its box. */
const WIDTH = 360;
const HEIGHT = 168;
const PAD = { top: 16, right: 52, bottom: 24, left: 36 };

/** A visit's date, short: "Nov 15". */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Round numbers for the y-axis: 0 and a step that gives up to four lines. */
export function ticks(top: number): number[] {
  const rough = top / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const count = Math.ceil(top / step);
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toFixed(6)));
}

/** The visits that read this point, in order, with their values. */
export function series(point: LogPoint, visits: Visit[]) {
  return visits.flatMap((visit, i) => {
    const value = point.values[i];
    return value === null || value === undefined ? [] : [{ at: visit.taken_at, value }];
  });
}

/**
 * One point's readings over the visits, against its dry standard. A single series, so
 * no legend: the point names it. Hovering finds the nearest visit; "Show the numbers"
 * gives the same figures as a table, for screen readers and anyone who wants them.
 */
export function DryingChart({ point, visits }: { point: LogPoint; visits: Visit[] }) {
  const read = series(point, visits);
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();

  if (read.length === 0) return null;

  const times = read.map((r) => Date.parse(r.at));
  const [first, last] = [Math.min(...times), Math.max(...times)];
  const goal = point.dry_standard;
  const top = Math.max(...read.map((r) => r.value), goal ?? 0) * 1.15 || 1;
  const yTicks = ticks(top);
  const yMax = yTicks.at(-1) ?? top;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (at: string) =>
    PAD.left + (last === first ? plotW / 2 : ((Date.parse(at) - first) / (last - first)) * plotW);
  const y = (value: number) => PAD.top + plotH - (value / yMax) * plotH;
  const end = read.at(-1);
  const label = (value: number) => reading(value, point.scale);

  /** The visit nearest the pointer, along the time axis. */
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return; // not laid out: nothing to point at
    const at = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    read.forEach((r, i) => {
      if (Math.abs(x(r.at) - at) < Math.abs(x(read[nearest]?.at ?? r.at) - at)) nearest = i;
    });
    setActive(nearest);
  };

  const summary = `Point ${point.label}: ${read
    .map((r) => `${label(r.value)} on ${day(r.at)}`)
    .join(
      ", ",
    )}${goal === null ? "; no goal" : `; dry at ${label(goal)} or less`}. ${DRYING_LABEL[point.status]}.`;
  const shown = active === null ? null : read[active];

  return (
    <Stack gap={2}>
      <div style={{ position: "relative", maxWidth: "28rem" }}>
        <svg
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          width="100%"
          role="img"
          aria-label={summary}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setActive(null);
          }}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--cf-color-border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                fontSize={10}
                fill="var(--cf-color-text-muted)"
              >
                {tick}
              </text>
            </g>
          ))}
          {goal !== null && (
            <g>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(goal)}
                y2={y(goal)}
                stroke="var(--cf-color-text-muted)"
                strokeWidth={1.5}
              />
              <text
                x={WIDTH - PAD.right + 6}
                y={y(goal)}
                dy="0.32em"
                fontSize={10}
                fill="var(--cf-color-text-muted)"
              >
                {`Goal ${label(goal)}`}
              </text>
            </g>
          )}
          {active !== null && shown && (
            <line
              x1={x(shown.at)}
              x2={x(shown.at)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--cf-color-border-strong)"
              strokeWidth={1}
            />
          )}
          <polyline
            points={read.map((r) => `${String(x(r.at))},${String(y(r.value))}`).join(" ")}
            fill="none"
            stroke="var(--cf-color-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {read.map((r, i) => (
            <circle
              key={r.at}
              cx={x(r.at)}
              cy={y(r.value)}
              r={i === active ? 5 : 4}
              fill="var(--cf-color-accent)"
              stroke="var(--cf-color-surface)"
              strokeWidth={2}
            />
          ))}
          {end && (
            // The latest reading, labelled at the end of the line; the goal sits on the right too,
            // so the label goes above the last mark.
            <text
              x={x(end.at)}
              y={y(end.value) - 10}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--cf-color-text)"
            >
              {label(end.value)}
            </text>
          )}
          <text x={PAD.left} y={HEIGHT - 6} fontSize={10} fill="var(--cf-color-text-muted)">
            {day(read[0]?.at ?? "")}
          </text>
          {read.length > 1 && end && (
            <text
              x={x(end.at)}
              y={HEIGHT - 6}
              textAnchor="end"
              fontSize={10}
              fill="var(--cf-color-text-muted)"
            >
              {day(end.at)}
            </text>
          )}
        </svg>
        {shown && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: `${String((x(shown.at) / WIDTH) * 100)}%`,
              transform: "translate(-50%, -100%)",
              background: "var(--cf-color-surface-raised)",
              border: "1px solid var(--cf-color-border)",
              borderRadius: "var(--cf-radius-md)",
              padding: "var(--cf-space-1) var(--cf-space-2)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <Text size="sm">{`${day(shown.at)}: ${label(shown.value)}`}</Text>
          </div>
        )}
      </div>
      <div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={asTable}
          aria-controls={tableId}
          onClick={() => {
            setAsTable((open) => !open);
          }}
        >
          {asTable ? "Hide the numbers" : "Show the numbers"}
        </Button>
      </div>
      {asTable && (
        <table id={tableId} style={{ borderCollapse: "collapse", maxWidth: "28rem" }}>
          <caption style={{ textAlign: "start" }}>
            <Text size="sm" tone="muted">{`Point ${point.label} readings`}</Text>
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "start" }}>
                <Text size="sm">Visit</Text>
              </th>
              <th scope="col" style={{ textAlign: "end" }}>
                <Text size="sm">Reading</Text>
              </th>
              <th
                scope="col"
                style={{ textAlign: "start", paddingInlineStart: "var(--cf-space-4)" }}
              >
                <Text size="sm">Dry?</Text>
              </th>
            </tr>
          </thead>
          <tbody>
            {read.map((r) => (
              <tr key={r.at}>
                <th scope="row" style={{ textAlign: "start", fontWeight: "normal" }}>
                  <Text size="sm">{day(r.at)}</Text>
                </th>
                <td style={{ textAlign: "end" }}>
                  <Text size="sm">{label(r.value)}</Text>
                </td>
                <td style={{ paddingInlineStart: "var(--cf-space-4)" }}>
                  <Text size="sm">
                    {goal === null ? "No goal" : r.value <= goal ? "Yes" : "No"}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Stack>
  );
}
