# Fixture provenance

These fixtures are real, trimmed excerpts of files risk-swarm has already synced and hashed at
`public/snapshots/` (risk-swarm commit `d9df7886852cbaabeed3163b330c080352ed687e`, 2026-09-22), not
hand-invented data:

- `fomo/signals.json`: the first 5 real signals and first 2 real sync runs, verbatim, from risk-swarm's
  synced copy of FOMO's real `data/signals.json` (874 signals in the real file).
- `freight-risk-atlas/taxonomy.json`: the real `meta` block plus the first 2 of 12 real patterns
  (`FFT-001` Double Brokering, `FFT-002`), verbatim, from risk-swarm's synced copy of freight-risk-atlas's
  real `data/taxonomy.json`.
- `provenance.json`: structurally identical to risk-swarm's real `public/snapshots/provenance.json`,
  but with `sha256`/`bytes` recomputed for these trimmed files, not copied from the real one (the real
  file's hash is for the full, untrimmed content and would not match a smaller fixture on purpose —
  see the `note` field on each source, which says so explicitly rather than silently substituting a
  hash that would fail verification for the wrong reason).

Re-capturing full, untrimmed fixtures: read `risk-swarm/public/snapshots/{fomo/signals.json,
freight-risk-atlas/taxonomy.json, provenance.json}` directly; those are the real, complete synced files.
