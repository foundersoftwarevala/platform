import { describe, expect, it } from "vitest";

import { classify, correlationKey, type FailureSignal } from "../healing/detection.server";
import { chooseAction, type ClaimedIncident } from "../healing/executor.server";

/**
 * Deciding what kind of failure something is.
 *
 * This is the most dangerous piece of judgement in the self-healing engine,
 * because the class chosen here decides what the system is allowed to do
 * about it. Classify a data inconsistency as transient and the answer is
 * "retry"; classify an intrusion as a dependency problem and the answer is
 * "fall back and carry on". So these tests are mostly about the failures that
 * must never be misrouted, and about the bias towards UNKNOWN — which cannot
 * heal itself — whenever nothing matches.
 */

function signal(over: Partial<FailureSignal> = {}): FailureSignal {
  return {
    sourceSystem: "mon-api",
    kind: "api_failure",
    domain: "ai",
    title: "Something happened",
    detail: "A thing occurred.",
    severity: "MEDIUM",
    ...over,
  };
}

describe("a security failure is never classified as anything else", () => {
  it("catches an unauthorized access report", () => {
    const out = classify(signal({ title: "Repeated unauthorized reads", kind: "access" }));
    expect(out.failureClass).toBe("SECURITY");
    expect(out.isFailure).toBe(true);
  });

  it("catches prompt injection", () => {
    expect(
      classify(signal({ detail: "prompt injection attempt in a retrieved document" })).failureClass,
    ).toBe("SECURITY");
  });

  it("wins even when the wording also looks like a timeout", () => {
    // The dangerous case: a security event that mentions a timeout would be
    // retried if the timeout matched first.
    const out = classify(
      signal({
        title: "Credential rejected",
        detail: "the request timed out after a forbidden response",
      }),
    );
    expect(out.failureClass).toBe("SECURITY");
  });
});

describe("ordinary failures are classified so a safe recovery exists", () => {
  it("reads a timeout as transient", () => {
    expect(classify(signal({ detail: "the provider timed out twice" })).failureClass).toBe(
      "TRANSIENT",
    );
  });

  it("reads an upstream problem as a dependency", () => {
    expect(
      classify(signal({ title: "Upstream gateway failing", kind: "integration" })).failureClass,
    ).toBe("DEPENDENCY");
  });

  it("reads stalled work as a workflow problem", () => {
    expect(classify(signal({ title: "Task stuck for six hours", kind: "task" })).failureClass).toBe(
      "WORKFLOW",
    );
  });

  it("reads latency as degradation rather than failure", () => {
    expect(classify(signal({ detail: "queue depth and latency rising" })).failureClass).toBe(
      "PERFORMANCE",
    );
  });
});

describe("classes that must not heal themselves are kept apart", () => {
  it("reads a consistency problem as DATA, not as something retryable", () => {
    const out = classify(signal({ title: "Orphan records found", detail: "inconsistent totals" }));
    expect(out.failureClass).toBe("DATA");
  });

  it("reads a configuration problem as CONFIGURATION", () => {
    expect(classify(signal({ detail: "the route is not configured" })).failureClass).toBe(
      "CONFIGURATION",
    );
  });
});

describe("when nothing matches, the answer is UNKNOWN", () => {
  it("refuses to guess a class it cannot recognise", () => {
    const out = classify(
      signal({
        kind: "weirdness",
        title: "Something odd",
        detail: "nobody knows",
        severity: "HIGH",
      }),
    );
    expect(out.failureClass).toBe("UNKNOWN");
    expect(out.because).toContain("no recovery can be chosen");
  });

  it("does not raise an incident for a low-severity unrecognised signal", () => {
    // Otherwise the queue fills with things no recovery could touch.
    expect(classify(signal({ kind: "weirdness", severity: "LOW" })).isFailure).toBe(false);
  });

  it("does raise one when an unrecognised signal is critical", () => {
    expect(classify(signal({ kind: "weirdness", severity: "CRITICAL" })).isFailure).toBe(true);
  });
});

describe("news is not a failure", () => {
  it("does not raise an incident for a KPI moving", () => {
    const out = classify(
      signal({ kind: "kpi_reading", title: "Conversion moved", severity: "LOW" }),
    );
    expect(out.isFailure).toBe(false);
    expect(out.because).toContain("reports a change rather than a failure");
  });

  it("does not raise one for a report being ready", () => {
    expect(classify(signal({ kind: "report_ready", severity: "LOW" })).isFailure).toBe(false);
  });
});

describe("sixty agents reporting one outage make one incident", () => {
  it("gives the same key to the same failure described differently", () => {
    const a = signal({
      title: "Gateway timing out",
      entityType: "api_services",
      entityId: "svc-1",
    });
    const b = signal({
      title: "No response from gateway",
      entityType: "api_services",
      entityId: "svc-1",
    });
    expect(correlationKey(a, "TRANSIENT")).toBe(correlationKey(b, "TRANSIENT"));
  });

  it("gives a different key to a different entity", () => {
    const a = signal({ entityType: "api_services", entityId: "svc-1" });
    const b = signal({ entityType: "api_services", entityId: "svc-2" });
    expect(correlationKey(a, "TRANSIENT")).not.toBe(correlationKey(b, "TRANSIENT"));
  });

  it("gives a different key to a different class of failure on the same thing", () => {
    const s = signal({ entityType: "api_services", entityId: "svc-1" });
    expect(correlationKey(s, "TRANSIENT")).not.toBe(correlationKey(s, "SECURITY"));
  });
});

describe("the executor only ever proposes what the policy allows", () => {
  const claim = (over: Partial<ClaimedIncident> = {}): ClaimedIncident => ({
    incidentId: "i1",
    failureClass: "TRANSIENT",
    attempts: 0,
    allowedActions: ["retry", "backoff", "reroute"],
    maxAttempts: 3,
    verificationMethod: "the operation is re-run",
    ...over,
  });

  it("takes the first permitted action that has not been tried", () => {
    expect(chooseAction(claim(), [])).toBe("retry");
    expect(chooseAction(claim(), ["retry"])).toBe("backoff");
    expect(chooseAction(claim(), ["retry", "backoff"])).toBe("reroute");
  });

  it("returns nothing once every permitted action is spent", () => {
    // This is what makes the circuit open deliberately rather than the worker
    // inventing a fourth thing to try.
    expect(chooseAction(claim(), ["retry", "backoff", "reroute"])).toBeNull();
  });

  it("cannot reach for another class's action", () => {
    // fallback_route belongs to DEPENDENCY. A transient incident must never
    // be offered it, whatever has already failed.
    const chosen = chooseAction(claim(), ["retry", "backoff", "reroute"]);
    expect(chosen).not.toBe("fallback_route");
  });
});
