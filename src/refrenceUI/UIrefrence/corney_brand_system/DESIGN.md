---
name: CORNEY Brand System
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#5c403b'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#916f6a'
  outline-variant: '#e6bdb7'
  surface-tint: '#be0f09'
  primary: '#b50303'
  on-primary: '#ffffff'
  primary-container: '#da291c'
  on-primary-container: '#fff5f3'
  inverse-primary: '#ffb4a8'
  secondary: '#775a00'
  on-secondary: '#ffffff'
  secondary-container: '#ffc72c'
  on-secondary-container: '#6f5400'
  tertiary: '#575959'
  on-tertiary: '#ffffff'
  tertiary-container: '#707171'
  on-tertiary-container: '#f6f7f7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad4'
  primary-fixed-dim: '#ffb4a8'
  on-primary-fixed: '#410000'
  on-primary-fixed-variant: '#930001'
  secondary-fixed: '#ffdf99'
  secondary-fixed-dim: '#f6bf22'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4300'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  margin-page: 32px
  gutter-grid: 24px
  padding-card: 20px
  stack-gap: 16px
  min-tap-target: 52px
---

## Brand & Style
The design system for this brand focuses on high-energy, high-appetite appeal tailored for the Indonesian fast-food market. The brand personality is professional, vibrant, and approachable, aimed at Gen Z and millennial consumers who value speed and "Instagrammable" street food aesthetics.

The design style is **Modern Corporate / Appetizing**, characterized by a bold use of brand colors and high-quality food photography. It utilizes clean surfaces with soft depth to ensure the UI feels premium rather than "cheap" fast food. Every interaction is designed to evoke excitement and immediate craving, using a high-contrast palette and energetic typography to drive conversion.

## Colors
The palette is built on the classic high-arousal fast-food combination of Red and Yellow. 
- **Primary Red (#DA291C):** Used for critical actions, branding, and highlighting savory options. It is the dominant color for buttons and active states.
- **Accent Yellow (#FFC72C):** Used for "New" tags, price highlights, and secondary elements. It provides a sunny, optimistic contrast to the red.
- **Surface & Backgrounds:** The primary background is White (#FFFFFF) to maintain a clean, professional "kitchen-fresh" feel. 
- **Typography:** Dark Text (#1A1A1A) is used for maximum legibility on white, while Neutral Gray (#6B7280) handles secondary metadata and placeholder text.

## Typography
This design system utilizes **Plus Jakarta Sans** for all roles. This font is chosen for its modern, rounded, and welcoming Indonesian heritage, which perfectly aligns with the brand’s approachable yet professional aesthetic.

- **Headings:** Use extra-bold (800) and bold (700) weights to create a strong visual hierarchy. Large display sizes use tight letter-spacing to feel more "compact" and energetic.
- **Body:** Uses regular (400) weight for maximum readability in menu descriptions.
- **Interactive Labels:** Semi-bold (600) is used for buttons and navigation items to ensure they stand out as clickable elements.

## Layout & Spacing
Optimized for a **10-inch Android tablet in landscape orientation**, the layout follows a fluid 12-column grid.

- **Structure:** A fixed left-hand navigation sidebar (approx. 240px) with a fluid main content area for the menu grid.
- **Rhythm:** An 8px base unit drives all spacing. 
- **Touch Targets:** Given the fast-paced nature of a kiosk or tablet order system, all interactive elements have a minimum height of 52px.
- **Responsive Behavior:** On the 10-inch landscape screen, the product grid should default to 3 columns to ensure product imagery remains large and appetizing.

## Elevation & Depth
The design system uses **Tonal Layers** combined with **Ambient Shadows** to create a sense of organized depth.

- **Level 0 (Background):** Solid White (#FFFFFF).
- **Level 1 (Cards/Containers):** Elevated using a soft, diffused shadow (Blur: 16px, Y: 4px, 8% Opacity of #1A1A1A) to make food items "pop" from the background.
- **Level 2 (Modals/Overlays):** Higher elevation with a more pronounced shadow and a 20% backdrop dimming to focus user attention on customization options (e.g., choosing sauces).

## Shapes
In line with the "soft and approachable" brand personality, the shape language is consistently rounded.

- **Primary Radius:** 14px (approx. 0.875rem) for all main containers, including product cards and primary buttons.
- **Secondary Radius:** Small components like checkboxes or "New" tags use a 6px radius.
- **Full Rounding:** Search bars and quantity selectors use a pill-shape for a more modern, friendly feel.

## Components

- **Primary Buttons:** Minimum height 52px. Solid Red background with White text. Use 14px corner radius. Heavy drop shadow on hover/press to feel "squishy" and tactile.
- **Product Cards:** White background, 14px radius, soft shadow. Image occupies the top 60% of the card. Prices are highlighted in Bold Red or against a Yellow pill for promotions.
- **Category Chips:** Horizontal scrolling list of chips. Inactive: Light gray stroke; Active: Solid Yellow background with Dark Text.
- **Input Fields:** 52px height, pill-shaped or 14px radius. Uses a 1px Neutral Gray border that thickens and turns Red when focused.
- **Add-to-Cart Toggle:** A large, tactile +/- component. The "Add" button should be the most prominent element on the card.
- **Status Indicators:** Use the Accent Yellow for "Limited Time" or "Best Seller" badges, placed at the top-left of product cards.