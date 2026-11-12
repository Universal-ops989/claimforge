import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";

import { color, fontSize, radius, shadow, space } from "../tokens";

const meta = {
  title: "Foundations/Tokens",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const label: CSSProperties = {
  fontFamily: "var(--cf-font-mono)",
  fontSize: "var(--cf-font-size-xs)",
  color: color.textMuted,
};

function Grid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: space[4],
        fontFamily: "var(--cf-font-sans)",
        color: color.text,
      }}
    >
      {children}
    </div>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <div
        style={{
          height: 56,
          borderRadius: radius.md,
          background: value,
          border: `1px solid ${color.border}`,
        }}
      />
      <div style={{ marginTop: space[2], fontWeight: 500 }}>{name}</div>
      <div style={label}>{value}</div>
    </div>
  );
}

/** Semantic colors. Components only use these, so themes can remap them. */
export const Colors: Story = {
  render: () => (
    <Grid>
      {Object.entries(color).map(([name, value]) => (
        <Swatch key={name} name={name} value={value} />
      ))}
    </Grid>
  ),
};

/** A 4px spacing grid. */
export const Spacing: Story = {
  render: () => (
    <div style={{ display: "grid", gap: space[3], color: color.text }}>
      {Object.entries(space).map(([name, value]) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: space[4] }}>
          <code style={{ ...label, width: 48 }}>{name}</code>
          <div style={{ height: 16, width: value, background: color.accent, borderRadius: 2 }} />
          <span style={label}>{value}</span>
        </div>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div style={{ display: "grid", gap: space[3], color: color.text }}>
      {Object.entries(fontSize).map(([name, value]) => (
        <div key={name} style={{ display: "flex", alignItems: "baseline", gap: space[4] }}>
          <code style={{ ...label, width: 48 }}>{name}</code>
          <span style={{ fontSize: value, fontFamily: "var(--cf-font-sans)" }}>
            Water damage in the main bathroom
          </span>
        </div>
      ))}
    </div>
  ),
};

export const RadiusAndShadow: Story = {
  name: "Radius & shadow",
  render: () => (
    <Grid>
      {Object.entries(radius).map(([name, value]) => (
        <div key={`r-${name}`}>
          <div
            style={{
              height: 64,
              background: color.accentSubtle,
              border: `1px solid ${color.accent}`,
              borderRadius: value,
            }}
          />
          <div style={label}>radius.{name}</div>
        </div>
      ))}
      {Object.entries(shadow).map(([name, value]) => (
        <div key={`s-${name}`}>
          <div
            style={{
              height: 64,
              background: color.surface,
              borderRadius: radius.lg,
              boxShadow: value,
            }}
          />
          <div style={label}>shadow.{name}</div>
        </div>
      ))}
    </Grid>
  ),
};
