/** Result type and typed errors for the theory engine (FR-010). */
export type TheoryErrorKind =
  | 'UnknownType'
  | 'TripleAccidental'
  | 'OutOfRange'
  | 'InvalidProfile'
  | 'InvalidInterval'
  | 'InvalidNote';

export interface TheoryError {
  readonly kind: TheoryErrorKind;
  readonly message: string;
}

export type Result<T, E = TheoryError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(kind: TheoryErrorKind, message: string): Result<T> => ({
  ok: false,
  error: { kind, message },
});

/** Unwraps a Result, throwing on error. For tests and code paths already validated. */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`${r.error.kind}: ${r.error.message}`);
  return r.value;
}
