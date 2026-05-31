# kg-suite-vault-contract-resolver

> Generalized **N-axis policy intersection resolver** for Kinetic Gain Protocol Suite vault contracts. Extracted from the DefenseTech `cui-data-vault-contract-profile`'s 3-axis `resolvePolicy()` so any future vertical, or a buyer composing a multi-vertical contract, can declare N orthogonal policy axes and resolve them at runtime to a single most-restrictive policy.

Part of the [Kinetic Gain Protocol Suite](https://suite.kineticgain.com).

## The pattern

A vault contract often has multiple **independent** regulatory regimes that each set their own per-tier rules. DefenseTech is the first vertical with three:

- `cui_categorization` (9 tiers PUBLIC → SCI) — set by NARA-ISOO + DoD CIO
- `export_control_status` (4 tiers NOT-CONTROLLED → ITAR) — set by DDTC + BIS
- `foreign_person_access_restriction` (5 tiers US-PERSON-ONLY → NO-RESTRICTION) — set by per-employer + DDTC

A request to operate on a `(CUI-Specified-NoForn, ITAR, US-Person-Only)` resource must satisfy *all three* axes' policies. The most-restrictive axis wins on every dimension.

This library generalizes that pattern. Any vertical can declare N axes; the resolver returns the merged most-restrictive policy.

## What "most-restrictive" means per field

| Field | Reduction across axes |
| --- | --- |
| `allowed_actions` | Set intersection — an action must be allowed on every axis |
| `minimum_human_user_status` | Max along a caller-supplied status ordering (default: any → us-person → AFP → secret → ts → ts-sci) |
| Any field starting with `requires_` | OR — any axis that says `true` wins |

The `requires_*` reduction is generic: callers don't pre-declare which booleans exist. DefenseTech's `requires_distribution_statement`, `requires_fso_cosign`, `requires_audit_stream_event` all reduce automatically. Future verticals can add e.g. `requires_bar_id`, `requires_supervisor_attestation` without code changes.

## Usage

```bash
npm install kg-suite-vault-contract-resolver
```

```js
import { resolveNAxis } from "kg-suite-vault-contract-resolver";

const axes = [
  {
    name: "cui",
    policies: {
      "CUI-BASIC":            { allowed_actions: ["read","search","generate"], minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true },
      "CUI-SPECIFIED-NOFORN": { allowed_actions: ["read","search"],             minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true, requires_distribution_statement: true }
    }
  },
  {
    name: "export_control",
    policies: {
      "NOT-EXPORT-CONTROLLED": { allowed_actions: ["read","search","generate"], minimum_human_user_status: "any" },
      ITAR:                    { allowed_actions: ["read","search"],             minimum_human_user_status: "us-person-verified", requires_distribution_statement: true }
    }
  },
  {
    name: "foreign_person",
    policies: {
      "US-PERSON-ONLY":  { allowed_actions: ["read","search","generate"], minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true },
      "FIVE-EYES-ONLY":  { allowed_actions: ["read","search"],             minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true }
    }
  }
];

const resolved = resolveNAxis({
  axes,
  tierTuple: { cui: "CUI-SPECIFIED-NOFORN", export_control: "ITAR", foreign_person: "US-PERSON-ONLY" }
});

// resolved = {
//   tuple: { cui: "CUI-SPECIFIED-NOFORN", export_control: "ITAR", foreign_person: "US-PERSON-ONLY" },
//   resolved_allowed_actions: ["read", "search"],
//   resolved_minimum_human_user_status: "us-person-verified",
//   requires_audit_stream_event: true,
//   requires_distribution_statement: true,
//   diagnostics: { per_axis: [...], blocking_axis_on_actions: "cui", max_status_axis: "cui" }
// }
```

## DefenseTech convenience adapters

For DefenseTech-shape vault contracts (the most-common case today):

```js
import { defenseTechAxesFromContract, defenseTechTuple, resolveNAxis } from "kg-suite-vault-contract-resolver";

const axes  = defenseTechAxesFromContract(vaultContract);
const tuple = defenseTechTuple("CUI-SPECIFIED-NOFORN", "ITAR", "US-PERSON-ONLY");
const resolved = resolveNAxis({ axes, tierTuple: tuple });
```

## Diagnostics

The `diagnostics` block on the resolved policy answers the buyer-side procurement reviewer's three default questions:

- **Why am I limited to these actions?** → `blocking_axis_on_actions` names the axis with the smallest allowed-action set.
- **Whose clearance bar am I hitting?** → `max_status_axis` names the axis whose minimum was selected.
- **What did each axis individually say?** → `per_axis` lists the per-axis policy that fed the merge.

## Why a separate lib

- **DefenseTech `cui-data-vault-contract-profile`** had a 3-axis-hardcoded `resolvePolicy()`. That works for one vertical.
- Future verticals (e.g., a hypothetical privacy-tier × geo × data-class vault contract) shouldn't reinvent the intersection logic.
- Buyer-composed multi-vertical contracts (e.g., a SaaS vendor touching HealthTech + FinTech data) need to compose axes from multiple verticals' contracts at runtime. The resolver supports any N ≥ 1.
- The lib is small (~90 LOC), no deps, MIT-licensed.

## Composes with

- [`cui-data-vault-contract-profile`](https://github.com/mizcausevic-dev/cui-data-vault-contract-profile) — DefenseTech vault contract that originated the 3-axis pattern
- [`defense-decision-record-audit-stream-reference`](https://github.com/mizcausevic-dev/defense-decision-record-audit-stream-reference) — reference impl that uses this resolver to gate audit-stream events
- All sibling-vertical vault contracts (HealthTech, EdTech, etc.) — currently 1-axis equivalents but extensible to N
- [Kinetic Gain Protocol Suite](https://suite.kineticgain.com) — umbrella

## License

MIT.
