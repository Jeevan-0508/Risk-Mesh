import { readFileSync, writeFileSync } from 'node:fs';
import { candidateFromProposal, promoteKnowledge, readBoundedJson } from '../core/knowledge-feedback';
import { canonicalJson, signAttestation, verifyKnowledgeValidation, versionedUpdate } from '../core/controlled-validation';
import { HumanValidationReview, KnowledgeCandidate, RegressionReceipt } from '../contracts/knowledge-validation';

const [command, ...args] = process.argv.slice(2);
function output(path: string, value: unknown) { writeFileSync(path, canonicalJson(value) + '\n', { flag: 'wx', mode: 0o600 }); }
try {
  if (command === 'candidate' && args.length === 4) {
    const [handoff, proposal, metadata, target] = args as [string,string,string,string];
    output(target, candidateFromProposal(readBoundedJson(handoff), readBoundedJson(proposal), readBoundedJson(metadata) as Parameters<typeof candidateFromProposal>[2]));
  } else if (command === 'update' && args.length === 2) {
    output(args[1]!, versionedUpdate(KnowledgeCandidate.parse(readBoundedJson(args[0]!))));
  } else if (command === 'sign' && args.length === 4) {
    const [payloadFile, keyId, privateKeyFile, target] = args as [string,string,string,string];
    const raw = readBoundedJson(payloadFile);
    const payload = HumanValidationReview.or(RegressionReceipt).parse(raw);
    output(target, signAttestation(payload, keyId, readFileSync(privateKeyFile, 'utf8')));
  } else if (command === 'verify' && args.length === 2) {
    const permit = verifyKnowledgeValidation(readBoundedJson(args[0]!), readBoundedJson(args[1]!), new Date().toISOString());
    console.log(`Verified configured review policy for ${permit.candidate.id} v${permit.candidate.version}; probability remains unknown.`);
  } else if (command === 'promote' && args.length === 3) {
    const result = promoteKnowledge(readBoundedJson(args[0]!), readBoundedJson(args[1]!), args[2]!, new Date().toISOString());
    console.log(`Created local approved package: ${result.path}. Repository update still requires review.`);
  } else {
    throw new Error('Usage: bun scripts/knowledge-feedback.ts candidate HANDOFF PROPOSAL METADATA OUTPUT | update CANDIDATE OUTPUT | sign PAYLOAD KEY_ID PRIVATE_KEY OUTPUT | verify BUNDLE TRUST_POLICY | promote BUNDLE TRUST_POLICY DIRECTORY');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Controlled feedback failed');
  process.exitCode = 1;
}
