export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem", // 8px
  md: "0.75rem", // 12px
  base: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
  "3xl": "4rem", // 64px
} as const

export const containerPadding = {
  mobile: "spacing.base", // 16px
  tablet: "spacing.lg", // 24px
  desktop: "spacing.xl", // 32px
} as const

export const gapClasses = {
  tight: "gap-2",
  normal: "gap-4",
  loose: "gap-6",
  "extra-loose": "gap-8",
} as const

export const paddingClasses = {
  card: "p-6",
  section: "px-4 py-8 md:px-6 md:py-12",
  page: "px-4 py-6 md:px-6 md:py-8 lg:px-8",
} as const
