import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      expanded: true,
    },
    a11y: {
      // Fail stories with accessibility violations instead of only reporting them.
      test: "error",
    },
  },
  tags: ["autodocs"],
};

export default preview;
