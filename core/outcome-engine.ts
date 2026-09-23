/**
 * The Outcome Engine (spec section 11): stores a real, observed `Outcome` and links it back to
 * its case via `CaseEngine.setOutcome()` - the first real caller `setOutcome` has had since Phase
 * 4 (checked directly: before this file, its only caller anywhere in this repo was its own unit
 * test).
 *
 * `matches_prediction` is always the caller's own input, never computed here. Whether a case's
 * real `Decision.action` (ACCEPT, HUMAN_REVIEW, ...) turned out "correct" against a free-text
 * `actual_result` has no spec-declared formula (`contracts/schemas.ts` states no such mapping), so
 * that judgment stays a human/external call, exactly like `Case.setOutcome` already takes a plain
 * id rather than deriving anything from it. This engine records outcomes; it does not evaluate
 * whether MESH was right.
 */
import type { Outcome } from '../contracts/schemas';
import { MeshStore } from './store';
import { Ledger } from './ledger';
import { CaseEngine } from './case-engine';

export class OutcomeEngine {
  private readonly store = new MeshStore<Outcome>();

  constructor(private readonly ledger: Ledger, private readonly caseEngine: CaseEngine) {}

  /**
   * Stores the outcome and attaches it to its case in the same call - a caller building a real
   * `Outcome` should never have to remember the second step, and `Case.outcome_id` should never
   * point at an id the outcome store doesn't actually have. `caseEngine.setOutcome()` already
   * appends its own `'OUTCOME'` ledger event (checked against its existing test, which asserts
   * exactly one), so this method deliberately does not append a second one for the same action -
   * two ledger entries for one recorded outcome would be a duplicate, not an audit trail.
   */
  record(outcome: Outcome): Outcome {
    const stored = this.store.add(outcome);
    this.caseEngine.setOutcome(outcome.case_id, outcome.id, outcome.observed_at);
    return stored;
  }

  get(id: string): Outcome | undefined {
    return this.store.get(id);
  }

  list(): Outcome[] {
    return this.store.list();
  }

  /**
   * A correction to a previously recorded outcome is a new state on the same object (spec §42's
   * append-only rule applies to the ledger, not to forbidding an object from ever changing).
   * Unlike `Case`'s five-state lifecycle, `OutcomeStatus` has only RECORDED and AMENDED, and both
   * of those may always move to AMENDED - there is no illegal edge in a two-state model where
   * every state's one real move is the same move, so (unlike `CaseEngine.transitionStatus`) this
   * deliberately carries no transition-guard table: a guard that can never reject anything is
   * dead code, not safety.
   */
  amend(id: string, patch: Partial<Pick<Outcome, 'actual_result' | 'matches_prediction'>>, at: string, reason: string): Outcome {
    const current = this.store.require(id);
    const next: Outcome = { ...current, ...patch, status: 'AMENDED' };
    this.store.replace(id, next);
    this.ledger.append({ type: 'OUTCOME', at, case_id: current.case_id, ref_id: id, detail: `outcome amended: ${reason}` });
    return next;
  }
}
