# Fixture provenance

Captured 2026-09-23 by actually running the real `laya` PyPI package (0.3.7) against the real
`convaiinnovations/laya-typed-decisions` checkpoint on HuggingFace (Apache-2.0), via:

```
HF_HUB_DISABLE_SYMLINKS=1 USE_TF=0 uv run --with laya python scripts/laya_infer.py < input.json
```

(the exact subprocess `adapters/model-registry/laya-runtime.ts`'s `callLayaSubprocess` invokes in
production). This is a real model, a real download (huggingface.co, unauthenticated, public
weights), and a real forward pass on CPU - not hand-written or model-invented JSON. Two Windows-
specific issues were hit and fixed along the way, not glossed over:

- `HF_HUB_DISABLE_SYMLINKS=1` - huggingface_hub's cache defaults to symlinks, which need an
  elevated privilege Windows does not grant by default (`OSError: [WinError 1314]`).
- The question schema in Laya's own README quickstart example undersells the real signature - it
  is `Dict[question_id, question_definition]`, not a bare list. Confirmed by reading the installed
  `laya/agent.py` (`Agent.system_one`) directly rather than guessing from the README a second time.

`laya-typed-fabrication-call.json`: one real choice-type call, a carrier-fraud-style scenario (POD
photo timestamp 11 days after pickup, GPS shows 6 days of no movement before the claim). Laya's
real answer is genuinely uncertain (`confidence: 0.0238`, near-uniform 3-way probabilities) - this
is not a curated "impressive" example, it is the actual first well-formed call this session made,
and it happens to be a good illustration of the System-1 directive's "Laya uncertain -> route to
Jev/escalate" path (Path B). `action.act_probability: 1.0` is the RL head's own action-selection
signal (see `rl_agent_config.json`'s `act_costs`/`cost_wrong_act`); this repo does not yet assign
it a first-class meaning in the MESH contract because the model card does not document its exact
semantics - preserved as-is inside `raw_output` rather than interpreted.

Also observed on load (not captured in the JSON, noted here instead): a `RuntimeWarning` that this
checkpoint ships a `temperature_by_options` value (`choice:11+=0.1006`) outside its own valid range
`[0.5, 5]`, clipped to `0.5` by the runtime - directly corroborates the model card's own "still
over-confident, refit before relying on the probabilities" limitation.

Re-capturing: from this repo, `python3 -c "..."` a request dict matching the shape in
`laya_infer.py`'s docstring, or reuse `~/.aki/tmp/laya_smoke.py`'s pattern from this session (not
kept in the repo - a one-off capture script, same convention as risk-swarm's fixtures).
