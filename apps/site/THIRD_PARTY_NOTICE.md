# Third-party notices

This project vendors third-party source code. Each vendored file keeps its original
license header; this file records provenance for review.

## React Bits — animated components

- Source: <https://reactbits.dev> · <https://github.com/DavidHDev/react-bits>
- License: **MIT + Commons Clause** (<https://reactbits.dev/LICENSE.md>)
- Vendored into `apps/site/src/components/react-bits/` (TypeScript + Tailwind variants):

| Component | Registry id | Runtime dependency |
| --- | --- | --- |
| Aurora | `Aurora-TS-TW` | `ogl` |
| BlurText | `BlurText-TS-TW` | `motion` |
| CountUp | `CountUp-TS-TW` | `motion` |
| GradientText | `GradientText-TS-TW` | `motion` |
| LogoLoop | `LogoLoop-TS-TW` | none |
| Magnet | `Magnet-TS-TW` | none |
| SpotlightCard | `SpotlightCard-TS-TW` | none |

Notes:

- Components are copied as source (shadcn/jsrepo registry style), not installed as a
  package, and are lightly edited to fit this project's Fumadocs/Tailwind v4 theme.
- The MIT + Commons Clause license permits free and commercial use, but restricts
  selling the software itself. Lorelum's core remains Apache-2.0; these files keep
  their own license headers.
- `Aurora` (WebGL fragment shader) is the single GPU-heavy layer. It is lazy-loaded
  (`React.lazy`, separate async chunk), gated to dark theme + desktop pointer +
  `prefers-reduced-motion: off`, resolution/DPR-capped, and its rAF loop pauses when
  the hero is offscreen or the tab is hidden. It pulls in the `ogl` runtime
  dependency (MIT).

## GSAP — animation engine + ScrollTrigger/ScrollSmoother

- Package: `gsap@3.15.0` (`apps/site` dependency)
- Source: <https://gsap.com> · <https://github.com/greensock/GSAP>
- License: **GSAP Standard "no charge" license** (<https://gsap.com/standard-license/>).
  Free for commercial use; not GPL/AGPL, so it does not affect Lorelum's Apache-2.0 core.
- Used for the landing page's ScrollSmoother smooth scroll, ScrollTrigger scrub
  parallax + hero exit, SplitText word/char reveals, the custom dot+ring cursor,
  the panel scale reveal, and the terminal's GSAP sine float. Registered once in
  `apps/site/src/components/landing/gsap-client.ts`, ships with the landing chunk,
  and is disabled under `prefers-reduced-motion: reduce`.
