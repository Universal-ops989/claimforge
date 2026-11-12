import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles.css";

/** Applies the toolbar's theme to <html>, exactly as ThemeProvider does in apps. */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  return Story();
};

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      expanded: true,
    },
    // Page background comes from the theme tokens instead of the backgrounds addon.
    backgrounds: { disable: true },
    a11y: {
      // Fail stories with accessibility violations instead of only reporting them.
      test: "error",
    },
  },
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme],
  tags: ["autodocs"],
};

export default preview;
