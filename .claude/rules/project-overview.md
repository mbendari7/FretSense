---
paths:
  - "docs/**"
  - "specs/**"
  - "content/**"
  - "README.md"
---

# Project overview

> Moved verbatim from CLAUDE.md on 2026-11-25 (ADR-0013). CLAUDE.md keeps a 3-line summary; this is the full text. The product north star is `docs/PRODUCT.md`.

FretSense is a guitar **and bass** theory handbook, real-time practice companion, and on-device
machine-vision and ML system, **personalised for every user**: their own gear (My Gear), goals,
learning paths, lesson stages and curriculum packs. The built-in curriculum is general theory,
delivered as a curriculum pack; users create packs mapping lessons to any book or course (the
owner's *Guitar Theory for Dummies* pack is one example, not a dependency). **Nothing is locked**:
the curriculum recommends, never forces. Lessons have stages Read → See → Drill → Play →
Camera-coach. Features are capability-oriented and ship in product releases v0.1–v1.0. The vision,
pillars, release plan and non-goals are in `docs/PRODUCT.md` (the product north star, below the
constitution); every spec names its release.

The three goals matter equally:
1. **A teaching tool any guitarist or bassist (the owner included) uses every session**, that adapts
   to them. If a feature wouldn't help a real practice session, it doesn't ship.
2. **A deep ML and vision system**: real models, datasets, evaluation and MLOps.
3. **Fundamental engineering skills**, each used where it's genuinely needed (`docs/SKILLS-MATRIX.md`).

**This is not vibe coding.** The constitution (`.specify/memory/constitution.md`, v3.0.0) is the
highest authority. If this file disagrees with it, the constitution wins and this file gets fixed.
