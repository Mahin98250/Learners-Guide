# Mobile Layout Root Cause

The mobile portal regression was caused by layered responsive overrides constraining and reorienting the shared mobile shell. The stable reference commit is d0d3d6b894f560a6923e4c8960c196bca06453fd.

The intended hierarchy is viewport -> #root -> .lg-app-shell -> portal shell -> header/content/bottom navigation. Mobile portals must use a vertical flex column, occupy the available viewport width, and keep the scroll region fluid. Global selectors must not target arbitrary flex containers or use :has() to alter unrelated portal structure.

This document records the root-cause boundary so future responsive changes are made at the correct layer rather than by stacking portal-specific patches.
