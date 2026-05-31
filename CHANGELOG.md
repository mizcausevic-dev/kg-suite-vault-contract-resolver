# Changelog

## [0.1] — 2026-05-30

### Added

- Initial release. `resolveNAxis()` generalizes the DefenseTech 3-axis resolvePolicy() pattern to N orthogonal policy axes.
- Per-field most-restrictive merge:
  - `allowed_actions` — set intersection across axes
  - `minimum_human_user_status` — max along caller-supplied status ordering
  - Any field starting with `requires_` — OR across axes (auto-detected, no pre-declaration required)
- Default status ordering: any · us-person-verified · authorized-foreign-person-with-license · secret-clearance · top-secret-clearance · ts-sci-clearance.
- DefenseTech convenience adapters: `defenseTechAxesFromContract(contract)` + `defenseTechTuple(cui, export, foreign)`.
- Diagnostics block on resolved policy: `per_axis`, `blocking_axis_on_actions`, `max_status_axis`.
- 9 unit tests covering: intersection, OR-of-requires, max-status, DefenseTech adapters, diagnostics, error cases.

### Not yet

- Browser bundle / UMD distribution (Node-only today).
- TypeScript types file (`.d.ts`).
- Custom action-ordering for "weaker actions imply stronger" semantics (e.g. write implies read). Today actions are treated as independent atoms.
- Performance optimization for very large axis/tier counts (current implementation is O(axes × actions); fine for the dozens-of-tiers scale, may need indexing past thousands).
