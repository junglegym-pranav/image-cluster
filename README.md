# Image Cluster

A Vite + React app that arranges a collection of images inside an SVG-defined shape. Pick a shape, watch the images flock into formation.

## Run it

```bash
npm install
npm run dev
```

## How it works

- **Shapes** are loaded at build time from `src/shapes/*.svg` via `import.meta.glob`. Each SVG needs at least one `<path>` element with a `d` attribute and a `viewBox`.
- **Images** are loaded from `src/assets/media/*.{png,jpg,jpeg,webp,gif,avif}` the same way.
- Point placement uses the native `SVGGeometryElement.isPointInFill()` API — for each image we reject-sample points in the path's bounding box, keeping ones that land inside the fill and are far enough from existing points (poisson-disk-style spacing).
- Position changes animate via `framer-motion` springs with a small per-image delay, so morphing between shapes reads as a flock rather than a snap.

## Add your own

Drop any SVG into `src/shapes/` or any image into `src/assets/media/` — the dev server picks them up on reload, no config to touch. Shape names come from the filename.

### SVG requirements

- Must have a `viewBox` attribute
- Must contain at least one `<path d="..."/>`
- Multiple paths in one SVG are merged (compound paths work fine)
- Other elements (`<rect>`, `<circle>`, etc.) are ignored — convert them to paths if you need them

If you have a non-path SVG, most editors (Figma, Illustrator, Inkscape) have a "convert to path" / "outline" command.

## Project layout

```
src/
  shapes/          ← drop SVGs here
  assets/media/    ← drop images here
  utils/
    sampleSVGPoints.js   ← point-in-path sampling
  App.jsx
  App.css
```
