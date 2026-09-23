/**
 * Manual, opt-in live smoke test for the real Laya subprocess path — NOT part of `bun test` (needs
 * `uv` + network + torch, which CI/other machines may not have). Run with `bun run laya:smoke`.
 * Prints the real ModelResult `callModel('laya-typed', ...)` produces, unmocked.
 */
import { callModel } from './client';

const result = await callModel('laya-typed', {
  case_id: 'live-smoke',
  state: 'Carrier submitted a POD photo for a missing trailer claim. The photo EXIF timestamp is '
    + '11 days after the reported pickup date, and the trailer GPS ping history shows no movement '
    + 'for 6 days before the claim was filed.',
  question: {
    type: 'choice',
    instructions: 'Is this delivery documentation consistent with legitimate delivery, or does it show signs of fabrication?',
    criteria: {
      consistent: 'Evidence lines up with a legitimate delivery.',
      fabricated: 'Evidence shows signs of fabricated/falsified documentation.',
      inconclusive: 'Not enough signal either way.',
    },
  },
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
