---
# Lesson template: copy this file to <slug>.md and fill it in yourself.
# Lessons are not tied to any book. Curriculum packs (content/packs/) group and order them.
# The schema is defined in specs/001-theory-fretboard-lessons (FR-022, FR-023, FR-063). Validation runs at build time.
id: ""                    # unique, kebab-case, e.g. "notes-on-the-neck"
title: ""
level: ""                 # beginner | intermediate | advanced
tags: []                  # goal/genre/topic tags used to suggest paths (feature 016), e.g. [blues, soloing]
instruments: []           # any of: guitar, bass, or [any]
concepts: []              # concept ids (feature 006 builds the concept graph from these)
fretboard_preset:         # optional; remove this block if unused
  root: ""                # e.g. "G" or "F#"
  scale: ""               # one scale type OR leave empty and use chord
  chord: ""               # one chord quality OR leave empty and use scale
  labels: ""              # notes | degrees | none
  frets: []               # optional [start, end]
  preset: ""              # optional built-in instrument preset id, e.g. "guitar6-drop-d"
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
