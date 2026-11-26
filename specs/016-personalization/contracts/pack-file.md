# Contract: User Pack File (016 FR-014)

```text
{ "format": "fretsense-pack", "schemaVersion": 1,
  "pack": { "id": kebab ≤64, "title": ≤120, "source"?: ≤200,
            "sections": [ { "title": ≤120, "label"?: ≤40, "lessons": lessonId[] ≤200 } ] ≤500 } }
```

- Same strict `packSchema` as the build (001 contracts/content-formats.md, pack section), plus:
  `File.size` ≤ 1 MB checked before `file.text()`, then the shared `depthWithin`/`hasPrototypeKeys`
  pre-scan, then `JSON.parse`, then Zod; depth ≤ 16, prototype keys rejected, every text ≤ 200 after
  NFC, control/bidi/zero-width rejected, unknown fields rejected.
- `pack.id` equal to `general-theory` or to an existing pack's id → imported as a copy with a new
  id (`<id>-copy`, `-copy-2`, … up to `-copy-99`, truncating the base so the id stays ≤ 64) and
  title suffix " (copy)".
- Unknown lesson ids are kept, listed in the preview as missing, and shown as unavailable.
- Export writes exactly this shape (no author, no profile ids). All text renders as plain text.
- Tests: a 1 MB + 1 byte file, nesting depth 17, a `__proto__` key, an id at 64 chars, and
  `<img onerror>` and bidi text rendered literally; no `dangerouslySetInnerHTML` in pack/path screens.
