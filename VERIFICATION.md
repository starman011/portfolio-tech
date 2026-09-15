# Verification — focus and progressive detail
Updated 2026-09-15.

## Toggle and camera follow-up

- Removed the obsolete `.theme-toggle > span:first-child` rule. Its higher specificity forced the new 44 × 26 switch track back to the old 10 × 10 half-circle. A regression checks that the conflicting selector is absent and only one current switch exists.
- Replaced straight camera segments with cyclic Catmull–Rom interpolation and gradually ramped travel speed. The sampled relative projection-matrix velocity discontinuity fell from 0.0244 to 0.0004. This is a math regression, not a visual or frame-rate benchmark.
- Buildings and occupied-dot overlays taper to zero at the patch margins. Tests cover both detail sizes, ring-wrap boundaries and long visits; swapped rows are invisible when their buffers change.
- The user clarified that the colour issue occurs on repeated dark → light switching and supplied a screenshot showing pale text and black canvas dots on a dark brown background. The screenshot is consistent with browser auto-darkening, not the authored dark theme. The old root and hero declared `light`, which does not opt out of automatic recolouring. Added `only light` at the root, hero and initial metadata; theme changes now synchronize the root marker and browser metadata with the body/canvas. The original palette values are unchanged.
- After the account-limit tool reported available usage, the same browser connection worked again. Before the safeguard, settled light backgrounds matched across the first two cycles in the controlled tab; the user's darkened appearance was not independently reproduced there. With the new source loaded, the live root and hero report `light only`, and dark mode reports `dark`. Six repeated state-test cycles and three fresh initializations also pass. This verifies the safeguard and state consistency, not the user's browser-specific darkening setting.
- Completed two full light → dark → light cycles in the real browser after the patch. Final screenshot at 736 × 863 shows the original white-centred warm-paper hero, black text and black dots; computed body/hero colours remain `rgb(238, 233, 222)` / `rgb(247, 244, 236)`. The switch track is 44px and the transition finishes with the control enabled. WebGL reports no city shader issue. No viewport override was introduced during this follow-up. All checks, stylesheet parsing and the 28-file build pass.

## Current city-journey pass

- Added repeatable checks in `scripts/check-city.mjs` and `scripts/check-interactions.mjs`. Pure geometry checks cover eight families, order-dependent assemblies, constant vertex correspondence, radial anchoring during morphs, bounded detail counts and camera projections.
- Dependency-free DOM/WebGL doubles exercise Look closer, frozen rotation/profile, independently advancing camera, manual assembly changes, pause, whole-form return, denied storage, theme switching, view-transition failure fallback and reduced motion. These doubles check payloads and shader delimiter balance, not real GPU compilation or visual appearance.
- Before browser access was blocked, real WebGL rendered the close-up successfully in both palettes. Desktop was inspected at 1280 × 900 and mobile at 390 × 844. Detailed instance counts were 336 and 208 respectively; no horizontal overflow was observed. Rule changes and the three view modes worked, and paused clock/mix values remained unchanged across a subsequent check.
- A graphics precision mismatch was found and corrected during that browser review. A Canvas fallback also rendered successfully during the earlier compatibility check.
- Subsequent browser actions were denied because the automatic approval service reported an account usage limit. No alternate browser or indirect automation was used. The final simplification, persistent anchor dots, frozen close-up and animated theme toggle have local regression coverage but have **not** been visually rechecked. The final footer/scroll check and viewport reset could not be completed after that denial.
- No physical-device performance or FPS benchmark was run. The performance claim is limited to shared instancing, fewer detailed buildings, reduced close-up pixel density and no continuous geometry rebuild in the close-up.
- Igloo was viewed only as a reference for motion and continuity. All geometry and rendering here are original; no reference-site assets were copied.

## Current pass

- `npm run build` passes geometry checks for all 64 ordered rule sequences, source/asset checks, the new scroll-free motion lifecycle regression and bundle generation (26 files).
- Browser preview inspected through localhost. Direct file-URL inspection is unavailable through the browser tool.
- Confirmed a stale script in the preview (old playback text despite updated server code). Versioned changed asset URLs now load the current code; the build strips query strings when copying files.
- The original bottom jump was not reliably reproduced. Source inspection found that ScrollTrigger refresh temporarily sets document scroll to zero on lazy-image loads and disclosure toggles. Removed this dependency from the page; IntersectionObserver drives the remaining GSAP entrances without writing scroll or focus.
- In-browser: all four rule buttons change the sequence; Wireframe and Dots switch correctly; pause/play and the disclosed controls work. The two-ring model is larger and still initially uses Dots.
- Opened the sample map (18 objects), canopy process (four stages) and BIM collection (three distinct studies). Closing disclosures and scrolling to the footer after lazy images load leaves scrollY equal to the maximum scroll position. No desktop horizontal overflow was observed.
- Mobile hero visually inspected at 390 × 844; the large dot form, identity and collapsed controls fit the screen. Desktop inspection used 1280 × 800. Viewport override is reset after testing.
- The existing ObjectTracer MP4 is preserved. SEBIRA and WFC retain their reserved recording slots. Resume and employer/client attribution are unchanged.
- Follow-up refinement: body copy uses 16px sizing; controls and metadata have clearer hierarchy. The supplied personal writing is condensed into the existing narrative and a native “+” disclosure. Existing static/build checks were rerun; the earlier desktop/mobile screenshots preceded this follow-up typography and copy pass.

## Earlier checks (2026-09-12)

## Checks performed

- Static validation: syntax for every referenced script, unique IDs, anchors, all 23 local references, exactly one H1, and image alternatives.
- Geometry: exactly two rings; their section centroids trace exact circular paths in perpendicular planes across all 64 ordered rule sequences. Animated plane normals remain perpendicular at sampled times from 0 to 120 seconds. Profiles are distinct, coordinates finite and normals unit-length. All arrangements retain 14,336 points.
- jsdom interaction checks: all four rules change the sequence after one click and start a morph; rapid shuffle, keyboard focus through reordered controls, subsets down to one rule, RGB mode, light control, orbit/reset, separation, inspector Escape, theme and SEBIRA nodes.
- Lifecycle: one scheduled model loop, pause/resume, manual changes while paused without advancing the rotation clock, offscreen and hidden-page suspension, page exit/return, reduced motion and denied storage under a file URL.
- Actual bundled GSAP 3.13.0 and ScrollTrigger initialize in jsdom. Ambient animation follows field pause/page events; reduced motion removes the timeline and scroll triggers. Bounded pointer callbacks run without errors.
- The no-GSAP path retains working controls and model rendering.
- Wireframe: 5,376 unique edges, bounded indices and no edges between rings. Two finite, normalized rotation matrices preserve the perpendicular planes. Canvas checks cover black lines/dots in light mode and pale lines/luminous dots in dark mode, including immediate recolouring while paused.
- Mocked WebGL API checks cover indexed line drawing, point drawing, buffer stride, exactly two part matrices, RGB selection and both palettes. This does not constitute real shader compilation or visual GPU testing.
- Both stylesheets parse with PostCSS.
- Three GIF placeholders, three experience marks, the curiosity-led copy and project system stories remain present. No management/pivot language or research quotation was introduced.
- Public bundle generated by npm run build.
- The existing local preview returned HTTP 200. Refresh the existing tab to load this iteration; no additional browser tab was opened.

Reproducible geometry/static check: npm run check. The temporary interaction harnesses are /private/tmp/portfolio-field-check.cjs and /private/tmp/portfolio-motion-check.cjs, using the workspace's existing jsdom/PostCSS installation rather than new project dependencies.

## Earlier verification limits

The September 12 pass could not perform browser inspection. The current pass adds browser screenshots and UI interaction checks, but not physical-device performance or touch testing. Earlier jsdom and mocked WebGL checks are not GPU performance benchmarks. Circularity and perpendicularity remain mathematically verified.

This is an original deterministic geometric experiment, not trained AI, a structural model or daylight analysis. Distinct operations produce different point coordinates; no claim is made that each is structurally buildable.

The three project GIF slots remain intentionally reserved for the user. Product metrics come from the user's documentation, not independently rerun product suites. The tracking companion remains explicitly simulated. No publishing, source upload or résumé changes were performed.
