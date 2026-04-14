# Trust Guardrails

## Product law

1. Evidence first
2. Draft second
3. Approval required
4. AI may suggest, never silently assert
5. Every output must link back to proof
6. GitHub is candidate evidence, not truth

## AI rules

AI may:

- suggest factual summaries
- suggest tags
- suggest proof strength
- suggest proof gaps
- suggest role relevance
- draft from approved evidence only

AI may not:

- invent accomplishments
- invent metrics
- infer business impact from GitHub activity alone
- auto-approve evidence
- silently strengthen claims
- use unapproved evidence in generation
- mark anything public-safe without explicit user action

## Security rules

- RLS from day one
- no runtime `service_role` access in normal requests
- fail closed on generation
- reject cross-user reads and writes
- treat provider tokens as sensitive and short-lived
