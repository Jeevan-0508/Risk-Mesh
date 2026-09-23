# Fixture provenance

Captured 2026-09-23 directly from `fraud-watch`'s real on-disk simulation state file
(`data/world-state.json`), at upstream commit `880a12f046512bf5a9afc12c3614643310bfb6e0`
(fraud-watch, 2026-09-23T09:51:59+05:30).

fraud-watch is a static/vanilla-JS app with no server: there is nothing to call live. This is the
actual JSON its own `moEngine` module reads and writes at runtime, captured verbatim by reading the
file, not hand-written or model-generated.

- `world-state.mos.json`: `{ moEngine: { mos: [...] } }`, exactly `moEngine.mos` from the real file.
  A JS `Map` serialized to JSON as an array of `[id, record]` pairs (confirmed by inspection: this is
  NOT a plain array of records). Both real MO records present in the file at capture time are
  included: `MO-0001` (`EMERGING_BEHAVIOR`, `NEW`) and `MO-0002` (`EMERGING_BEHAVIOR`, `NEW`). Neither
  `KNOWN_MO`, `MO_VARIANT`, nor `POTENTIAL_NEW_MO` had a live example in this run at capture time; the
  classification-mapping tests below cover those synthetically (see `map.test.ts`), clearly labelled
  as such, and are not claimed to be captured fixtures.
- `world-state.malformed.json`: hand-written, deliberately shaped as fraud-watch's real
  `world-state.json` file with the `moEngine.mos` key renamed, to exercise the client's shape-guard
  path. This one is synthetic, and is not passed off as a real capture.

Re-capturing: open fraud-watch in a browser (or run its simulation headlessly), then read
`data/world-state.json` from wherever it persists state.
