# Third-party notices

This project vendors third-party source code. Each vendored file keeps its original
license header; this file records provenance for review.

## React Bits — animated components

- Source: <https://reactbits.dev> · <https://github.com/DavidHDev/react-bits>
- License: **MIT + Commons Clause** (<https://reactbits.dev/LICENSE.md>)
- Vendored into `apps/site/src/components/react-bits/` (TypeScript + Tailwind variants):

| Component | Registry id | Runtime dependency |
| --- | --- | --- |
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
- The landing background is pure CSS (no WebGL runtime dependency), so `ogl` is not
  a project dependency.
