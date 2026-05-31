// kg-suite-vault-contract-resolver — generalized N-axis policy resolver.
//
// Generalizes DefenseTech's resolvePolicy() pattern: given N orthogonal
// policy axes (each axis = a map from tier-name to per-tier policy),
// and a tuple identifying one tier per axis, return the most-restrictive
// merged policy across all axes.
//
// "Most-restrictive" is defined per-field:
//   - allowed_actions       → set intersection across axes
//   - minimum_status        → max along a caller-supplied ordering
//   - boolean requirements  → OR across axes (any axis that says
//                              "required" wins)
//
// Callers supply:
//   - axes:          [{ name, policies: { tierA: policy, tierB: policy, ... } }, ...]
//   - tierTuple:     { axisName: tierName, ... }
//   - statusOrdering (optional): array of status strings, least-strict
//                                 first. Used by max-status reduction.
//
// Returns a resolved policy object plus diagnostic metadata.

const DEFAULT_STATUS_ORDERING = [
  "any",
  "us-person-verified",
  "authorized-foreign-person-with-license",
  "secret-clearance",
  "top-secret-clearance",
  "ts-sci-clearance"
];

/**
 * Resolve N axes to a single most-restrictive policy.
 * @param {object} args
 * @param {Array<{name:string, policies:Record<string,object>}>} args.axes
 * @param {Record<string,string>} args.tierTuple   — axis name → tier name
 * @param {string[]} [args.statusOrdering]        — least-strict first
 * @returns {object} resolved policy + diagnostics
 */
export function resolveNAxis({ axes, tierTuple, statusOrdering = DEFAULT_STATUS_ORDERING }) {
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new Error("axes must be a non-empty array");
  }
  // Pick the per-axis policy for the tuple-named tier.
  const perAxisPolicies = axes.map((axis) => {
    const tier = tierTuple[axis.name];
    if (tier === undefined) throw new Error(`tierTuple missing entry for axis "${axis.name}"`);
    const policy = axis.policies[tier];
    if (policy === undefined) throw new Error(`axis "${axis.name}" has no policy for tier "${tier}"`);
    return { axisName: axis.name, tier, policy };
  });

  // 1) Intersect allowed_actions.
  const actionSets = perAxisPolicies.map((p) => new Set(p.policy.allowed_actions ?? []));
  const intersectedActions = [...actionSets[0]].filter((a) => actionSets.every((s) => s.has(a)));

  // 2) Max minimum status along the ordering.
  const indices = perAxisPolicies.map((p) => {
    const idx = statusOrdering.indexOf(p.policy.minimum_human_user_status ?? "any");
    if (idx === -1) throw new Error(`axis "${p.axisName}" tier "${p.tier}" minimum_human_user_status "${p.policy.minimum_human_user_status}" is not in statusOrdering`);
    return idx;
  });
  const maxIdx = Math.max(...indices);
  const maxStatus = statusOrdering[maxIdx];

  // 3) OR boolean requirements. We OR every field whose name starts with
  //    "requires_" so the resolver covers DefenseTech's existing fields
  //    AND future verticals' bespoke booleans without code changes.
  const requirementFields = new Set();
  for (const p of perAxisPolicies) {
    for (const key of Object.keys(p.policy)) {
      if (key.startsWith("requires_")) requirementFields.add(key);
    }
  }
  const resolvedRequirements = {};
  for (const field of requirementFields) {
    resolvedRequirements[field] = perAxisPolicies.some((p) => p.policy[field] === true);
  }

  return {
    tuple: tierTuple,
    resolved_allowed_actions: intersectedActions,
    resolved_minimum_human_user_status: maxStatus,
    ...resolvedRequirements,
    diagnostics: {
      per_axis: perAxisPolicies.map((p) => ({
        axis: p.axisName,
        tier: p.tier,
        allowed_actions: p.policy.allowed_actions ?? [],
        minimum_human_user_status: p.policy.minimum_human_user_status ?? "any"
      })),
      blocking_axis_on_actions: actionSets.map((set, idx) => ({
        axis: perAxisPolicies[idx].axisName,
        set_size: set.size
      })).sort((a, b) => a.set_size - b.set_size)[0]?.axis ?? null,
      max_status_axis: perAxisPolicies[indices.indexOf(maxIdx)].axisName
    }
  };
}

/**
 * Convenience adapter: extracts axes from a DefenseTech-shape vault contract
 * (object with axis_policies: { cui_handling_policy, export_control_handling_policy, foreign_person_handling_policy }).
 * Returns the standard axes array for resolveNAxis.
 */
export function defenseTechAxesFromContract(contract) {
  const a = contract.axis_policies ?? contract;
  return [
    { name: "cui",             policies: a.cui_handling_policy ?? {} },
    { name: "export_control",  policies: a.export_control_handling_policy ?? {} },
    { name: "foreign_person",  policies: a.foreign_person_handling_policy ?? {} }
  ];
}

/**
 * Convenience adapter: builds a resolveNAxis tuple from a (cui, export, foreign) triple.
 */
export function defenseTechTuple(cuiTier, exportTier, foreignTier) {
  return { cui: cuiTier, export_control: exportTier, foreign_person: foreignTier };
}

export const STATUS_ORDERING = DEFAULT_STATUS_ORDERING;
