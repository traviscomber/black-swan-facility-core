# Black Swan Facility Core — Design System

Version: 1.0  
Scope: Black Swan Facility Core web application  
Status: Implementation specification

## Authority

This file is the canonical visual specification for Black Swan Facility Core. It must be applied to the complete portal, including operational calendars, documents, tasks, invoices, forms and SOP interfaces.

## Design objective

The interface must feel dark, calm, operational, premium and unmistakably Black Swan. Brand recognition comes from warm dark surfaces, restrained brand accents, disciplined spacing, Everett Regular headings and Montserrat interface text.

## Non-negotiable rules

1. Never use white or bright application surfaces.
2. Never use gradients.
3. Use square geometry for cards, buttons, fields, tabs, badges, menus and dialogs.
4. Cards and buttons have no visible borders.
5. No glassmorphism, glow, heavy shadows or neon styling.
6. Navy and bright blue must not dominate the interface.
7. Brand colors communicate function, state, category or hierarchy only.
8. Everett Regular is used for headings only.
9. Montserrat is used for body and interface text.
10. Headings remain controlled and do not rely on bold weight.
11. Avoid card-inside-card structures.
12. Do not add decorative icons without operational purpose.
13. Do not use pure black or pure white.

## Canonical tokens

```css
:root {
  --bs-bg-primary: #171512;
  --bs-bg-secondary: #211e1a;
  --bs-surface-primary: #2b2722;
  --bs-surface-secondary: #39342d;
  --bs-surface-elevated: #514a40;
  --bs-surface-hover: #5d554a;
  --bs-surface-active: #675e52;

  --bs-text-primary: #e7e1d8;
  --bs-text-secondary: #b9b0a4;
  --bs-text-muted: #847c72;
  --bs-text-disabled: #625c54;
  --bs-divider-subtle: rgba(231, 225, 216, 0.08);
  --bs-overlay: rgba(23, 21, 18, 0.82);

  --bs-warm-yellow: #fdd32c;
  --bs-warm-orange: #ffa114;
  --bs-warm-muted-orange: #d66942;
  --bs-warm-bright-orange: #f65a2a;
  --bs-warm-fire: #ec2b02;
  --bs-warm-princess: #fdd7d4;
  --bs-warm-pig: #e47fad;
  --bs-cool-pope: #834693;
  --bs-cool-sage: #8bcba8;
  --bs-cool-basil: #366f45;
  --bs-cool-sky: #36b6f8;
  --bs-cool-river: #4679ae;
  --bs-cool-klein: #062ea5;

  --bs-font-heading: "Everett", "Helvetica Neue", Arial, sans-serif;
  --bs-font-body: "Montserrat", Arial, sans-serif;

  --bs-space-1: 4px;
  --bs-space-2: 8px;
  --bs-space-3: 12px;
  --bs-space-4: 16px;
  --bs-space-5: 24px;
  --bs-space-6: 32px;
  --bs-space-7: 40px;
  --bs-space-8: 48px;
  --bs-space-9: 64px;
  --bs-radius-none: 0;
}
```

## Semantic states

- Success, confirmed and complete: Cool Sage / Cool Basil.
- Active, selected and informational: Cool Sky / Cool River.
- Pending and attention: Warm Yellow / Warm Orange.
- Operational warning: Warm Muted Orange / Warm Bright Orange.
- Critical and destructive: Warm Fire, reserved for genuine critical states.
- Secondary category: Cool Pope / Warm Pig.
- Disabled or unavailable: muted text and neutral surface.

Color must never be the only state indicator.

## Surfaces

- Main canvas: `--bs-bg-primary`.
- Sidebar and persistent shell: `--bs-bg-secondary`.
- Cards, forms, tables and panels: `--bs-surface-primary`.
- Nested operational zones and rows: `--bs-surface-secondary`.
- Selected or temporarily elevated content: `--bs-surface-elevated`.

Separate zones with tone, spacing and alignment instead of visible borders.

## Typography

Headings use Everett at weight 400. Body, labels, navigation, controls, tables, buttons, captions and metadata use Montserrat. Body text is 14px/1.55. Operational headings must remain compact; no oversized hero typography inside the application.

## Layout and geometry

Use the 8px spacing grid. Desktop page padding is 32–48px, mobile page padding is 16px. Panel padding is 20–24px and compact operational zones use 16–20px. All interface corners are square. Circular geometry is limited to avatars, radio buttons, status dots, chart points and loading indicators.

## Components

Buttons are at least 40px high, borderless, square and shadowless. Primary actions use Cool Sage. Secondary actions use elevated neutral surfaces. Warning uses Warm Yellow. Destructive uses Warm Fire. Focus uses a visible 2px Cool Sky outline.

Cards and panels use warm neutral surfaces with no borders, rounded corners or shadows. Inputs use `--bs-surface-secondary` and persistent labels. Tables use tonal row separation rather than boxed cells. Status labels are compact rectangles or a colored indicator plus text, never pills.

## Calendars and occupancy grids

Calendars use warm neutral cells. Empty cells use the primary surface, hover uses surface hover, selected uses Cool River or Cool Sky, confirmed uses Cool Sage, pending uses Warm Yellow or Orange, warning uses Muted Orange, critical or blocked uses Warm Fire and disabled uses muted neutral surfaces. Do not outline every date cell.

## SOP interfaces

SOP library, editor and execution screens follow the same operational design system. They must not resemble a generic document manager. Use a clear hierarchy for code, status, owner, version, estimated time, procedure steps, evidence and acceptance criteria. Avoid nested cards. A procedure step uses tone, spacing and a restrained semantic indicator. Evidence and approval controls remain visible and operational.

## States and accessibility

Empty states are concise and provide one next action. Loading uses neutral skeletons without shimmer gradients. Success uses Cool Sage sparingly. Errors use Warm Fire only on the critical element and explain the next action. All controls require visible keyboard focus, WCAG AA contrast, persistent labels and minimum 40px touch targets.

## Verification checklist

Before a page is complete, verify warm dark surfaces, selective brand colors, Everett/Montserrat typography, square components, no gradients, no visible card borders, no heavy shadows, consistent semantic colors, 8px spacing, minimized nesting, visible focus, responsive behavior and all loading, empty, error, success and disabled states.

## Final principle

Every screen must feel like part of one coherent Black Swan operational system. Warm dark surfaces are the foundation, brand colors are controlled signals, typography provides quiet hierarchy and spacing performs the primary grouping work.