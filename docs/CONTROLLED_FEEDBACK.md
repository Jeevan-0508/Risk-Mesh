# Controlled knowledge feedback

The browser composer produces an unverified, pending proposal. It is not an approval.
The local CLI connects that proposal to the original Replay source bytes and to the
existing learning/knowledge ledgers. It never writes production code or taxonomy files.

## Workflow

1. Export a Replay research handoff and a MESH review proposal. Supply metadata JSON
   with `id`, `author_id`, `created_at`, `target` (`taxonomy_proposal`,
   `investigation_guidance`, or `control_mapping`), `version`, `previous_version`.
2. Run `bun scripts/knowledge-feedback.ts candidate HANDOFF PROPOSAL METADATA OUTPUT`.
   Source fingerprints are checked and re-hashed with SHA-256. Candidate simulation
   context has its own hash and never becomes supporting evidence.
3. Independently inspect source authenticity, entailment, independence and contradictions.
   At least two distinct configured human reviewers must approve the exact candidate hash.
   Author self-review and model output are insufficient. Review payloads use
   `contracts/knowledge-validation.ts`; sign them with
   `bun scripts/knowledge-feedback.ts sign PAYLOAD KEY_ID PRIVATE_KEY OUTPUT`.
4. Generate the exact proposed update with `... update CANDIDATE OUTPUT`. Run regression
   checks against this version. A separate configured runner signs its dataset hash,
   code revision, exact case IDs and passing/failing IDs. Regression is not empirical truth.
5. Assemble `mesh-validation-bundle.v1` from the candidate, signed reviews and signed
   regression receipt. Validate with `... verify BUNDLE TRUST_POLICY`.
6. Explicitly run `... promote BUNDLE TRUST_POLICY DIRECTORY`. This creates one immutable
   version package, preserves the original signed bundle, records adoption and links prior
   packages by hash. Duplicate/skipped versions, tampered histories and expired approvals
   are rejected. The local directory uses an exclusive lock; after a crash, inspect any
   `.promotion-lock` before manually removing it. There is no silent lock recovery.
7. A `taxonomy_proposal` remains a repository review proposal. Review and implement the
   authored pattern change on a feature branch, run taxonomy validation and its consumers'
   regression checks, then follow the repository approval process. No automatic code write.

## Trust and limitations

Trust policy is explicit operator configuration outside submitted bundles. No deployment
keys or human identities are invented. Private keys must remain outside the repository.
Signatures prove that configured keys signed the payload; they do not prove that a source
is true, that its claims entail the conclusion, or that two people are actually independent.
Those checks remain accountable human decisions. Bad trust configuration can defeat them.
No real claim was approved during implementation: tests use ephemeral keys and explicitly
illustrative `example.invalid` content. All calibrated probabilities remain null.

Synthetic, mocked and unavailable lessons cannot enter VALIDATED or ADOPTED. Mutable
objects returned by stores/ledgers are copies, so callers cannot rewrite prior history.
An observed outcome correction records both the previous and next values. A contradiction
blocks silent reactivation; a stale claim requires a newer signed review.

Local package hashes detect accidental or partial tampering; deletion of an entire store
cannot be detected without an external trusted checkpoint. This is a local review workflow,
not a distributed tamper-proof authority or an operationally validated learning system.
