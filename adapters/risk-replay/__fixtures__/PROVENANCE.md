# Fixture provenance

Captured 2026-09-23 from a real local instance of `risk-replay`'s FastAPI backend
(`uv run uvicorn app.api.main:app --port 8811`, run from `backend/`), against upstream commit
`a3a22bcdfd042106b5fa362cace3432433261f8f` (risk-replay, 2026-09-22), using its own seeded golden
dataset (`backend/app/golden_dataset.py` / `seed.py`). These are real recorded HTTP responses, not
hand-written or model-generated fixtures.

- `decision-detail.dec-001.json` — `GET /decisions/DEC-001`
- `counterfactual.dec-001.remove-e3.json` — `POST /decisions/DEC-001/counterfactual` with
  `{"mutations":[{"type":"REMOVE_EVIDENCE","target":"E3","reason":"mesh adapter live test"}]}`.
  This is the response that first surfaced the exact phrase "decision-critical under the replay
  model" (spec §18) coming from risk-replay's own `causal_engine.py`, live.
- `dna.dec-001.json` — `GET /decisions/DEC-001/dna`

Re-capturing: start the server as above from a clone of risk-replay, then re-run the three requests.
