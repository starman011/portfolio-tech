# Saqlain Khan — Architecture, Code & Intelligence

A static portfolio that tells the story of one practice across architecture, computational design, production software, and architectural AI.

Open index.html directly, or serve this folder with a local web server. No install is required; GSAP is included locally.

- `npm run check` validates script syntax, local references, image alternatives and section links.
- `npm run build` creates a portable public-only `dist/` bundle.

## Content
The homepage is organized as a continuous narrative: interactive parametric study, practice, ObjectTracer, SEBIRA, computational design, research, then experience and contact. Employment appears only in the closing chapter.

The supplied original resume is downloadable. Updated website analytics are recorded in SOURCES.md; the PDF has not been edited. System design summaries come from the supplied project READMEs.

## Development
Spec Kit was initialized with the installed Specify CLI. Project principles are in .specify/memory/constitution.md; implementation specification, plan and tasks are in specs/001-portfolio-refinement/.

Theme tokens are at the start of styles.css; hero.css owns the model-first opening and editorial refinements. The model and project interactions use native browser APIs and guard unavailable storage. GSAP progressively enhances entrances and scroll transitions. Continuous hero motion stops outside the viewport and respects reduced-motion preferences. Core content stays readable without JavaScript.

## Project recordings

ObjectTracer now uses the existing `assets/motion/1.mp4` recording. SEBIRA and WFC retain intentional placeholders for the user's recordings. The three `data-motion-slot` hooks are preserved for future replacement.

In `index.html`, replace the entire `div` bearing the matching `data-motion-slot` attribute with your image, keeping its surrounding `figure`:

| Slot | Suggested file | Recording |
| --- | --- | --- |
| `objecttracer` | `assets/motion/objecttracer.gif` | Scan once, pan to America, show moving objects |
| `sebira` | `assets/motion/sebira.gif` | Explore and zoom into the knowledge-graph nodes |
| `wfc` | `assets/motion/wfc.gif` | Adjust parameters and generate terrain variations |

For example, create `assets/motion/`, place the ObjectTracer recording inside it, then replace its placeholder with:

```html
<img src="assets/motion/objecttracer.gif"
     alt="ObjectTracer scanning North America and displaying moving aircraft"
     width="1280" height="720" loading="lazy">
```

Update that figure's “Reserved” caption after adding the real recording. Use each file's real dimensions; the panels already support images and videos with rounded corners. Avoid claiming a recording is current telemetry. Run `npm run build` after adding files; referenced media is copied automatically. For long clips, a muted MP4 with native controls is a lighter, pausable alternative to GIF.

## Permutation field

Exactly two concentric circular rings form the opening, one in the XY plane and one in the XZ plane. Their planes stay 90° apart. Each ring spins within its own plane in the opposite direction, while a shared rigid rotation turns the assembly. The discarded braided core and extra framing rings are no longer generated. Themes remain black ink on warm paper, or pale wireframe/jade-copper dots on dark.

permutation-engine.js applies Fold, Twist, Shift and Stretch only to the swept 2D cross-section. Their ordered shear, rotation and proportion changes cannot deform the circular centre paths. The full set has 24 permutations; 15 nonempty subsets give 64 ordered sequences. These are deterministic geometric transformations, not AI inference, structural simulation or environmental analysis.

Every form has 14,336 corresponding particles: 224 path samples × 32 section samples × two rings. Radii are fixed at 2.84 and 2.18, and section extent is bounded at approximately 0.24. Numerical normals supply RGB orientation and illustrative lighting. WebGL and Canvas 2D share geometry and two rotation matrices. Automatic transitions use a 5.9-second cycle with smootherstep interpolation. WebGL targets 60fps; Canvas is capped near 30fps.

Each rule responds to one click: it swaps one position forward in the sequence (wrapping at the end), and changes the ring profile in about one second. The operation is highlighted and its new position announced. Shuffle, pause, orbit, Home/reset, subsets and separation remain. While paused or under reduced motion, manual changes are immediate and do not restart rotation.

motion.js uses locally bundled GSAP 3.13.0 with IntersectionObserver for gentle entrances, ambient light drift and bounded pointer hover. It never writes scroll or focus. ScrollTrigger is no longer loaded: its image/disclosure refresh path temporarily reset document scroll. Native reading progress drives the small hero retreat. Motion preferences revert enhancements; missing GSAP leaves the page and geometry functional.

The Dots / Wireframe / RGB normals switch preserves the form and camera. Dots is the initial mode in both themes. Theme changes preserve the chosen view. Wireframe uses 5,376 unique edges along closed cross-sections, with no edges bridging the two rings. Controls live behind “Explore the form +”; pause remains immediately available. The larger camera framing reserves a circular envelope through each rotation.

focus.css refines the existing theme: restrained accents, readable data, fewer exposed controls and detailed project disclosures. ObjectTracer explains the journey from scattered signals to a spatial interface. Architecture and BIM studies retain their process and implementation details behind “+”. The old shape-grammar.js, building-model.js and webgl-model.js files are retained as prior iterations but are no longer loaded or used by the active checks.

## North America tracking companion

`tracker.js` renders a dependency-free 2D map using the clipped Natural Earth geometry in `assets/data/north-america.js`. Twelve aircraft and six vessels follow generated routes; positions, speeds, altitude, and vessel length are illustrative, not ADS-B or AIS telemetry. Object selection works through both map markers and a native dropdown. Traffic layers, bounded zoom, reset, and pause are available. Reduced-motion preferences and visibility changes suspend the simulation. This companion is separate from the ObjectTracer GIF slot and links to the real product.
