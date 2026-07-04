// ============================================================================
// tokens.ts — the design-token guide, originally extracted from
// design/QuoteFoundry.dc.html. This is the SINGLE SOURCE the design-gate
// Playwright tests assert computed styles against. If a screen's computed
// color/font/radius doesn't match a value here, the design gate fails.
//
// 2026-07-03 — WCAG AA contrast pass (design review 06 §6 / master plan 2.2):
// five foreground tokens were darkened to clear 4.5:1 on their real surfaces.
// Mockup originals, for reference: accent #5E81F4 (white label 3.55:1),
// muted #9698D6 (2.47:1), faint #B0B0C8 (2.12:1), success #16A86A (2.86:1 on
// successBg), danger #EF5368 (3.44:1 on white). Hues preserved.
// ============================================================================

export const color = {
  // brand
  accent: '#4667DB',      // white text on this = 4.97:1
  accentDeep: '#1B51E5',
  // surfaces
  appBg: '#F4F4FB',
  surface: '#FFFFFF',
  // text
  ink: '#1C1D21',
  body: '#46485F',
  muted: '#63659B',       // 4.96:1 on appBg, 5.43:1 on white
  faint: '#6A6B83',       // 5.19:1 on white, 4.74:1 on appBg
  // borders / hairlines
  border: '#ECECF4',
  borderSoft: '#EEEEF4',
  // status
  success: '#0E7A4C',     // 5.01:1 on successBg, 5.38:1 on white
  successBg: '#EAFBF2',
  danger: '#C92A42',      // 5.39:1 on white, 4.85:1 on lost-pill bg
  dangerDot: '#FF808B',
  warnBg: '#FFF8E9',
  warnBorder: '#F6E3B8',
  // dark cost-summary panel (editor) — gradient endpoints
  panelFrom: '#2B2D42',
  panelTo: '#1C1D2B',
  panelAccentText: '#7CE7AC',
} as const;

export const font = {
  heading: "'Lato'",        // weights 700 / 900 — headings, numerals, totals
  body: "'Source Sans 3'",  // weights 400 / 600 — body, labels
} as const;

export const radius = {
  sm: '10px',
  md: '12px',
  lg: '14px',
  xl: '16px',
  card: '20px',
  cardLg: '22px',
  pill: '9px',
} as const;

// Standard control heights from the mockup.
export const control = {
  inputHeight: '46px',   // editor inputs
  rateInputHeight: '48px', // rate-settings inputs
  buttonHeight: '44px',  // top-bar / primary buttons
  touchMin: 40,          // responsive: min touch target (px)
} as const;

export const fonts = {
  googleHref:
    'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Source+Sans+3:wght@400;600;700&display=swap',
} as const;
