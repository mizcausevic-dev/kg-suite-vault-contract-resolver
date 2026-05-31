import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNAxis, defenseTechAxesFromContract, defenseTechTuple, STATUS_ORDERING } from "../src/index.mjs";

// Synthetic 2-axis fixture (LegalTech-like simplification).
const TWO_AXIS = [
  {
    name: "privilege",
    policies: {
      public:     { allowed_actions: ["read", "search", "generate"], minimum_human_user_status: "any", requires_audit_stream_event: false },
      privileged: { allowed_actions: ["read", "search"],             minimum_human_user_status: "any", requires_audit_stream_event: true,  requires_bar_id: true }
    }
  },
  {
    name: "matter_status",
    policies: {
      open:   { allowed_actions: ["read", "search", "generate"], minimum_human_user_status: "any", requires_audit_stream_event: false },
      closed: { allowed_actions: ["read"],                       minimum_human_user_status: "any", requires_audit_stream_event: true }
    }
  }
];

test("resolveNAxis: intersection of actions", () => {
  const r = resolveNAxis({ axes: TWO_AXIS, tierTuple: { privilege: "privileged", matter_status: "closed" } });
  assert.deepEqual(r.resolved_allowed_actions, ["read"]);
});

test("resolveNAxis: OR of requires_*", () => {
  const r = resolveNAxis({ axes: TWO_AXIS, tierTuple: { privilege: "privileged", matter_status: "open" } });
  assert.equal(r.requires_audit_stream_event, true);
  assert.equal(r.requires_bar_id, true);
});

test("resolveNAxis: requires_* defaults absent when no axis sets true", () => {
  const r = resolveNAxis({ axes: TWO_AXIS, tierTuple: { privilege: "public", matter_status: "open" } });
  assert.equal(r.requires_audit_stream_event, false);
});

test("resolveNAxis: max status across axes", () => {
  const axes = [
    { name: "a", policies: { x: { allowed_actions: ["read"], minimum_human_user_status: "us-person-verified" } } },
    { name: "b", policies: { y: { allowed_actions: ["read"], minimum_human_user_status: "secret-clearance" } } }
  ];
  const r = resolveNAxis({ axes, tierTuple: { a: "x", b: "y" } });
  assert.equal(r.resolved_minimum_human_user_status, "secret-clearance");
});

test("resolveNAxis: defenseTech adapters work", () => {
  const contract = {
    axis_policies: {
      cui_handling_policy: {
        "CUI-BASIC": { allowed_actions: ["read", "search"], minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true, requires_distribution_statement: false }
      },
      export_control_handling_policy: {
        ITAR: { allowed_actions: ["read"], minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true, requires_distribution_statement: true }
      },
      foreign_person_handling_policy: {
        "US-PERSON-ONLY": { allowed_actions: ["read", "search", "generate"], minimum_human_user_status: "us-person-verified", requires_audit_stream_event: true }
      }
    }
  };
  const axes = defenseTechAxesFromContract(contract);
  const tuple = defenseTechTuple("CUI-BASIC", "ITAR", "US-PERSON-ONLY");
  const r = resolveNAxis({ axes, tierTuple: tuple });
  assert.deepEqual(r.resolved_allowed_actions, ["read"]);
  assert.equal(r.requires_distribution_statement, true);
  assert.equal(r.requires_audit_stream_event, true);
});

test("resolveNAxis: diagnostics surface blocking axis", () => {
  const r = resolveNAxis({ axes: TWO_AXIS, tierTuple: { privilege: "privileged", matter_status: "closed" } });
  // matter_status=closed has the smallest action set (just read) — it's the blocking axis.
  assert.equal(r.diagnostics.blocking_axis_on_actions, "matter_status");
});

test("resolveNAxis: throws on missing tier", () => {
  assert.throws(() => resolveNAxis({ axes: TWO_AXIS, tierTuple: { privilege: "nonexistent", matter_status: "open" } }), /no policy for tier/);
});

test("resolveNAxis: throws on missing axis in tuple", () => {
  assert.throws(() => resolveNAxis({ axes: TWO_AXIS, tierTuple: { privilege: "privileged" } }), /missing entry/);
});

test("STATUS_ORDERING is exported", () => {
  assert.ok(STATUS_ORDERING.includes("ts-sci-clearance"));
});
