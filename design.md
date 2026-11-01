# Design: NADI

The locked system. Every Hallmark run reads this first and screens share it. Change it on purpose; the file is the rule.

## System
- Genre: editorial (Ink's), dealt under atmospheric
- Shape of the first page: app screen (six views inside the kept shell)
- Theme: Ink, dealt 1/3, seed civic-app-kelantan-residents-e786·ce75b140·2026-10-31·r0
- Axes: light/grotesk-sans/chromatic-teal · posture: restrained
- Modes: light and dark from one token set, dark is the default (`.dark` on `<html>`, ThemeContext toggles it); high-contrast, colourblind, dyslexia, compact and large-touch modes override the same roles in `src/app/globals.css`
- Brand: the pulse logo (`public/logo.png`); the accent hue 187 is its middle stop, #54C8BD

## Tokens
`src/app/tokens.css` is the source of truth (Tailwind 4 `@theme static`, so every role is a utility: `bg-paper-2`, `text-ink-2`, `border-rule`, `rounded-card`, `font-outlier`). The roles:
```css
:root {
  --color-paper: oklch(99.5% 0.003 100);  --color-paper-2: oklch(97% 0.004 100);  --color-paper-3: oklch(94% 0.006 100);
  --color-ink: oklch(16% 0 0);  --color-ink-2: oklch(28% 0 0);  --color-muted: oklch(44% 0 0);  --color-rule: oklch(89% 0.004 100);
  --color-accent: oklch(50% 0.095 187);  --color-accent-ink: oklch(99.5% 0.003 100);  --color-focus: oklch(50% 0.095 187);
  --color-accent-soft / -soft-ink: the "in" tag;  --color-warning(-soft, -soft-ink), --color-danger(-ink, -soft, -soft-ink): the hazard scale, state only
  --font-display: "Epilogue", ui-sans-serif, system-ui, sans-serif;  --font-body: var(--font-display);  --font-outlier: "IBM Plex Mono", ui-monospace, monospace;
  --radius-card: 12px;  --radius-control: 10px;  --radius-pill: 999px;  --rule-hair: 1px;  --shadow-card: floating surfaces only
}
.dark { /* every role re-derived, hue held: paper L 15%, ink L 94%, accent oklch(76% 0.1 187), the logo's own teal */ }
```
The spacing scale, the app type scale (1.2 ratio, 12px floor), the easings and the durations are the scaffold's and live in `tokens.css`. Old names (`--bg-card`, `--text-primary`, `--accent` …) are aliases in `globals.css` and follow every mode.

## Colour
- Teal means in, open, live or eligible: a tag, a large figure, a link's hover, the focus ring. Never a fill, never running text.
- The hazard scale (warning, danger) marks river levels, alerts, SOS and errors, always with a word or an icon beside it, never colour alone.
- Ink and greys carry everything else. No stock Tailwind palette, no literals, no gradients, no glow, no glass.

## Type
- Epilogue 700 for heads and figures, 600 for names in a row, links, tags and controls, 400 for everything read. Three weights, no more.
- Labels, captions and table heads: 14px, sentence case, untracked. Never uppercase, never tracked, never mono.
- IBM Plex Mono only on figures that compare in a column (levels in metres, distances, times).
- Body 16px; nothing under 12px.

## Surfaces
- Whitespace, then a hairline, then a well (`.well`), then a card only for something independently interactive. Never a card in a card.
- Lists and tables are `.ruled`: an ink rule on top, hairlines between rows.

## Controls
- Primary: `.btn .btn--primary` · ink fill, paper text · 10px radius · 40px with a 44px hit target
- Secondary: `.btn` · `--color-rule` edge on paper-2 · same radius and height. Emergency calls only: `.btn--danger`.
- Icon buttons `.icon-btn` with an `aria-label`; fields `.field` with a `<label htmlFor>`; switches `.seg` with `aria-selected` or `aria-pressed`; state `.tag`, `.tag--in`, `--out`, `--on`, `--warn`, `--danger`.
- Focus: the global 2px `--color-focus` ring, instant. Never `outline-none` without the `.field` ring in its place.

## Motion
- Character: still. Nothing moves but state (a tab, a tag, a dialog fading in at `--dur-short`); no entrance reveals, no pulse, no bounce, no scale on hover. Loaders may spin. Under reduced motion everything ends at once (`base.css`).

## Exports
`src/app/tokens.css` in this project, wired as Tailwind 4 utilities. DTCG or shadcn blocks are added here on request.
