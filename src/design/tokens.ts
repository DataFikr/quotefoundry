// ============================================================================
// tokens.ts — the design-token guide, extracted verbatim from
// design/QuoteForge.dc.html. This is the SINGLE SOURCE the design-gate
// Playwright tests assert computed styles against. If a screen's computed
// color/font/radius doesn't match a value here, the design gate fails.
// Do not invent values; every token below appears in the mockup.
// ============================================================================

export const color = {
  // brand
  accent: '#5E81F4',
  accentDeep: '#1B51E5',
  // surfaces
  appBg: '#F4F4FB',
  surface: '#FFFFFF',
  // text
  ink: '#1C1D21',
  body: '#46485F',
  muted: '#9698D6',
  faint: '#B0B0C8',
  // borders / hairlines
  border: '#ECECF4',
  borderSoft: '#EEEEF4',
  // status
  success: '#16A86A',
  successBg: '#EAFBF2',
  danger: '#EF5368',
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
