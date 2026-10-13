# Security and trust boundaries

RISK//MESH treats provenance as part of the result, not as decoration. Adapter outputs carry source, status, trust status, timestamps, hashes, and notes describing what was actually observed.

## Fail-closed status model

- `LIVE` means an adapter reached and validated a live source.
- `SNAPSHOT` means a captured source exists and carries snapshot metadata.
- `SIMULATED` means the source is synthetic or a simulation.
- `UNAVAILABLE` means the deployed Observatory cannot currently reach or validate the source.

The registry tests explicitly prevent unavailable sources from being silently promoted to live data.

## External inputs

Adapters validate response shape with the contract schemas and return a typed failure when the source is missing, malformed, or unreachable. Fraud Watch is preserved as simulated data even when its file is readable. RISK//REPLAY is marked unavailable in the static Observatory when its backend cannot be reached.

## Operational boundary

The public Observatory is a static portfolio surface. It is not an authenticated control plane, a production telemetry system, or a data-retention service. Do not place secrets in the repository or treat its generated briefing as a substitute for source-system access controls.
