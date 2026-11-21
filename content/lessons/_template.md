---
# Lesson template: copy this file to <part>-<chapter>-<slug>.md and fill it in yourself.
# The schema is defined in specs/001-theory-fretboard-lessons (FR-022, FR-023). Validation runs at build time.
id: ""                    # unique, kebab-case, e.g. "p1-c3-notes-on-the-neck"
title: ""
track: ""                 # book part number (e.g. "1") or an owner-defined track id (e.g. "bass")
book_chapter: 0           # chapter number (optional for owner-defined tracks)
instruments: []           # any of: guitar, bass, or [any]
concepts: []              # concept ids (feature 006 builds the prerequisite DAG from these)
fretboard_preset:         # optional; remove this block if unused
  root: ""                # e.g. "G" or "F#"
  scale: ""               # one scale type OR leave empty and use chord
  chord: ""               # one chord quality OR leave empty and use scale
  labels: ""              # notes | degrees | none
  frets: []               # optional [start, end]
  profile: ""             # optional built-in profile id, e.g. "guitar-drop-d"
drills: []                # list of { type, instruments, params }; progressions need { key: { tonic, mode }, chords: [...] }
songs: []                 # optional list of { title, note }
needs: []                 # optional: [audio-input] or [audio-input, camera] (feature 015); never camera alone
play: {}                  # reserved for feature 003; ignored in 001
camera_coach: {}          # reserved for feature 010; ignored in 001
---

## Read

<!-- Your own words. -->

## Notes for See

<!-- Optional: what to look for on the fretboard. -->
