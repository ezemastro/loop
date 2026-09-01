/**
 * Pure confirmation gate for account deletion. The only thing standing between a tap and an
 * irreversible action, so it is asserted by jest rather than trusted from a JSX read.
 *
 * Strict `===` is deliberate: trimming or case-folding would loosen an irreversible gate, and
 * this function has no mandate to do that. `accountEmail.length > 0` closes the case where a
 * user record without an email would let an empty typed field match.
 */
export function canConfirmAccountDeletion(
  typed: string,
  accountEmail: string,
  isDeleting: boolean,
): boolean {
  return !isDeleting && typed === accountEmail && accountEmail.length > 0;
}
