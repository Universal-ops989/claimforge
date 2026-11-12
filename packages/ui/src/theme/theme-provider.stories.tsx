import type { Meta, StoryObj } from "@storybook/react-vite";

import { color, radius, space } from "../tokens";
import { ThemeProvider, useTheme, type ThemePreference } from "./theme-provider";

const OPTIONS: ThemePreference[] = ["light", "dark", "system"];

function ThemePicker() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div
      style={{
        display: "grid",
        gap: space[3],
        padding: space[6],
        background: color.surface,
        color: color.text,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        fontFamily: "var(--cf-font-sans)",
      }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: space[4] }}>
        <legend style={{ fontWeight: 600, marginBottom: space[2] }}>Theme</legend>
        {OPTIONS.map((option) => (
          <label key={option} style={{ display: "flex", gap: space[1], alignItems: "center" }}>
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => {
                setTheme(option);
              }}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <p style={{ margin: 0, color: color.textMuted }}>
        Resolved theme: <strong>{resolvedTheme}</strong>
      </p>
    </div>
  );
}

const meta = {
  title: "Foundations/ThemeProvider",
  component: ThemeProvider,
  parameters: {
    docs: {
      description: {
        component:
          "Wrap the app in `ThemeProvider` to apply light or dark tokens and follow the OS preference. Read or change the theme with `useTheme()`.",
      },
    },
  },
  args: { storageKey: null, children: null },
  render: (args) => (
    <ThemeProvider {...args}>
      <ThemePicker />
    </ThemeProvider>
  ),
} satisfies Meta<typeof ThemeProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { defaultTheme: "light" } };
