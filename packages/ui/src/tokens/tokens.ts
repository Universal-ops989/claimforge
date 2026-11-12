/**
 * Typed references to the design tokens defined in CSS.
 *
 * Use these when a value has to live in JavaScript (charts, canvas, inline
 * styles). They resolve at runtime through CSS variables, so they follow
 * the active theme automatically.
 */
const v = <T extends string>(name: T) => `var(--cf-${name})` as const;

export const color = {
  bg: v("color-bg"),
  bgSubtle: v("color-bg-subtle"),
  surface: v("color-surface"),
  surfaceRaised: v("color-surface-raised"),
  surfaceSunken: v("color-surface-sunken"),
  border: v("color-border"),
  borderStrong: v("color-border-strong"),
  text: v("color-text"),
  textMuted: v("color-text-muted"),
  textSubtle: v("color-text-subtle"),
  textInverse: v("color-text-inverse"),
  accent: v("color-accent"),
  accentSubtle: v("color-accent-subtle"),
  accentText: v("color-accent-text"),
  success: v("color-success"),
  successSubtle: v("color-success-subtle"),
  warning: v("color-warning"),
  warningSubtle: v("color-warning-subtle"),
  danger: v("color-danger"),
  dangerSubtle: v("color-danger-subtle"),
  info: v("color-info"),
  infoSubtle: v("color-info-subtle"),
} as const;

export const space = {
  0: v("space-0"),
  0.5: v("space-0-5"),
  1: v("space-1"),
  1.5: v("space-1-5"),
  2: v("space-2"),
  3: v("space-3"),
  4: v("space-4"),
  5: v("space-5"),
  6: v("space-6"),
  8: v("space-8"),
  10: v("space-10"),
  12: v("space-12"),
  16: v("space-16"),
} as const;

export type SpaceToken = keyof typeof space;

export const radius = {
  none: v("radius-none"),
  sm: v("radius-sm"),
  md: v("radius-md"),
  lg: v("radius-lg"),
  xl: v("radius-xl"),
  full: v("radius-full"),
} as const;

export const fontSize = {
  xs: v("font-size-xs"),
  sm: v("font-size-sm"),
  md: v("font-size-md"),
  lg: v("font-size-lg"),
  xl: v("font-size-xl"),
  "2xl": v("font-size-2xl"),
  "3xl": v("font-size-3xl"),
  "4xl": v("font-size-4xl"),
} as const;

export const shadow = {
  xs: v("shadow-xs"),
  sm: v("shadow-sm"),
  md: v("shadow-md"),
  lg: v("shadow-lg"),
  xl: v("shadow-xl"),
} as const;

export const zIndex = {
  dropdown: v("z-dropdown"),
  sticky: v("z-sticky"),
  overlay: v("z-overlay"),
  modal: v("z-modal"),
  popover: v("z-popover"),
  toast: v("z-toast"),
  tooltip: v("z-tooltip"),
} as const;

export const tokens = { color, space, radius, fontSize, shadow, zIndex } as const;
