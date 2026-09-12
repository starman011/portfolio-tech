# Implementation Plan

**Date**: 2026-09-10 · **Spec**: [spec.md](spec.md)

Preserve the static HTML/CSS/JS site and approved palette and typography. Present an architect fluent in code through an interactive Canvas 2D pavilion, three distinct personal-project stories, architecture images, expandable engineering studies, a research section, and final experience/CV chapter. Use subtle motion and rounded corners. Reserve the three GIF panels for the user's own recordings.

## Technical Context
No frontend dependencies. Native details for case-study notes; Canvas 2D for computed geometry; CSS tokens for both themes; IntersectionObserver to suspend motion off-screen. Local official logos and user-owned images. Existing Google Fonts retained.

## Constitution Check
Visual continuity, source-grounded claims, accessibility, bounded motion, static portability, no telemetry or new backend.

## Verification
Script syntax, semantic structure, local links/assets, DOM interaction simulations (including denied storage and reduced motion), and HTTP serving. Pavilion tests cover finite geometry at parameter boundaries, normal-derived colors, sun-time formatting, and rotation suspension. Browser visual QA is not claimed. No real-time footage is simulated.
