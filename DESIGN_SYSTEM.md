# Dojo design system

Dojo's job is to make evidence feel trustworthy and easy to act on. The Plinth system does that with a calm bone page, white evidence cards, one green for action, pill controls, and an illustrated dojo hall that gives the product a place.

## Where it lives

- Tokens: `apps/web/src/app/globals.css`. Three tiers (base, semantic, component); Tailwind v4 exposes the semantic tier as utilities (`bg-desk`, `bg-paper`, `text-ink-2`, `border-line`, `rounded-slip`, `shadow-slip`, `bg-accent`).
- Fonts: `apps/web/src/app/fonts/` (Clash Display for headings, Satoshi for text; Fontshare, ITF Free Font License) loaded with `next/font/local`; JetBrains Mono via `next/font/google`.
- Evidence cards: `apps/web/src/components/Receipt.tsx` (`Slip`, `SlipHead`, `SlipBody`, `Row`, `Stub`).
- Status: `apps/web/src/components/StatusBadge.tsx` (dot, word and color; never color alone).
- Home page: `apps/web/src/app/page.tsx` and `apps/web/src/components/home/`.

## Rules

- **Light only.** Page is bone (`bg-desk`), evidence sits on white cards (`bg-paper`, 16px radius, hairline border, one neutral shadow).
- **One green, three strengths.** `#0b8366` fills buttons under white text (4.72:1); `#08705a` is green text and links (5.78:1); `#0fa37f` is display type 24px+ and illustration only (3.06:1).
- **Pill controls.** Buttons, chips, inputs and tabs are pills. Code blocks and text areas use the 12px inset radius.
- **Type.** Headings in Clash Display, tracking -0.015em (never tight enough to merge words). Text in Satoshi, body 16px, inputs 16px. Numbers of three or more digits, hashes, ids and times use `.num` (JetBrains Mono, tabular).
- **No colored shadows or glows.** Shadows are neutral and downward.
- **Motion.** Hover 100ms, enter 200ms ease-out, exit 120ms; transform and opacity only. Pinned scroll chapters on the home page stop pinning under `prefers-reduced-motion`.
- **Focus.** Two rings, white then ink, following each element's own shape. Hit targets 44px.
- **Copy.** No em or en dashes in prose. Empty states say why they are empty. Every number comes from the catalog or a live read.

## Contrast (computed, WCAG 2.1)

| Token | On bone `#fafaf7` | On white |
|---|---|---|
| `ink` `#0a0a0a` | 18.93 | 19.80 |
| `ink-2` `#5e5e5d` | 6.21 | 6.49 |
| `ink-3` `#676765` | 5.42 | 5.67 |
| `line-strong` `#858582` (UI) | 3.54 | 3.70 |
| `ok` / `watch` / `warn` / `critical` | 4.89 to 5.78 | 5.12 to 6.04 |
| white on `accent` `#0b8366` | | 4.72 |
