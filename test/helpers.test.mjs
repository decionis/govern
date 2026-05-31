import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPrCommentBody,
  buildVerifyUrl,
  governedByBadgeMarkdown,
  resolvePayload,
  shouldFail,
  verdictBadgeUrl,
  verdictTheme,
} from "../src/index.mjs";

describe("shouldFail", () => {
  it("fails on block when fail-on=block (default)", () => {
    assert.equal(shouldFail("block", "block", "enforce"), true);
    assert.equal(shouldFail("deny", "block", "enforce"), true);
    assert.equal(shouldFail("denied", "block", "enforce"), true);
  });

  it("does NOT fail on escalate when fail-on=block", () => {
    assert.equal(shouldFail("escalate", "block", "enforce"), false);
    assert.equal(shouldFail("review", "block", "enforce"), false);
  });

  it("fails on escalate / review when fail-on=escalate", () => {
    assert.equal(shouldFail("escalate", "escalate", "enforce"), true);
    assert.equal(shouldFail("review", "escalate", "enforce"), true);
    assert.equal(shouldFail("block", "escalate", "enforce"), false);
  });

  it("fail-on=block_or_escalate covers both", () => {
    assert.equal(shouldFail("block", "block_or_escalate", "enforce"), true);
    assert.equal(shouldFail("escalate", "block_or_escalate", "enforce"), true);
    assert.equal(shouldFail("allow", "block_or_escalate", "enforce"), false);
  });

  it("shadow mode never fails the step regardless of verdict or fail-on", () => {
    for (const decision of ["allow", "block", "escalate", "review", "deny"]) {
      for (const failOn of ["block", "escalate", "block_or_escalate", "never"]) {
        assert.equal(shouldFail(decision, failOn, "shadow"), false, `shadow ${decision}/${failOn}`);
      }
    }
  });

  it("fail-on=never opts out of all failures", () => {
    assert.equal(shouldFail("block", "never", "enforce"), false);
    assert.equal(shouldFail("escalate", "never", "enforce"), false);
  });

  it("never fails on an allow verdict, regardless of fail-on", () => {
    for (const failOn of ["block", "escalate", "block_or_escalate", "never"]) {
      assert.equal(shouldFail("allow", failOn, "enforce"), false);
    }
  });
});

describe("buildVerifyUrl", () => {
  it("includes ?sig= and ?source=github_actions for OG-rich unfurls", () => {
    const url = buildVerifyUrl("https://decionis.com", "dsr-abc", "sha256:0123");
    assert.equal(
      url,
      "https://decionis.com/verify/decision-dossiers/dsr-abc?sig=sha256%3A0123&source=github_actions",
    );
  });

  it("omits ?sig= when no signature is available, still attributes the source", () => {
    const url = buildVerifyUrl("https://decionis.com", "dsr-abc", null);
    assert.equal(
      url,
      "https://decionis.com/verify/decision-dossiers/dsr-abc?source=github_actions",
    );
  });

  it("URL-encodes dossier ids with special chars", () => {
    const url = buildVerifyUrl("https://decionis.com", "dsr/abc#1", null);
    assert.match(url, /dsr%2Fabc%231/);
  });

  it("strips a trailing slash from the site base URL", () => {
    const url = buildVerifyUrl("https://decionis.com/", "dsr-x", null);
    assert.match(url, /^https:\/\/decionis\.com\/verify\/decision-dossiers\/dsr-x/);
  });
});

describe("verdictTheme", () => {
  it("maps verdict synonyms to a stable label + color", () => {
    assert.equal(verdictTheme("allow").label, "Allowed");
    assert.equal(verdictTheme("deny").label, "Blocked");
    assert.equal(verdictTheme("denied").label, "Blocked");
    assert.equal(verdictTheme("review").label, "Escalate");
    assert.equal(verdictTheme("restrained").label, "Restrained");
  });
  it("is case-insensitive and falls back for unknown verdicts", () => {
    assert.equal(verdictTheme("BLOCK").label, "Blocked");
    assert.equal(verdictTheme("weird").label, "weird");
    assert.equal(verdictTheme("").label, "Unknown");
  });
});

describe("verdictBadgeUrl", () => {
  it("is a shields.io URL carrying the verdict label", () => {
    assert.match(verdictBadgeUrl("block"), /^https:\/\/img\.shields\.io\/badge\/Decionis-Blocked-/);
    assert.match(verdictBadgeUrl("allow"), /Decionis-Allowed-2ea043/);
  });
});

describe("governedByBadgeMarkdown", () => {
  it("produces a clickable shields badge linking to the action by default", () => {
    const md = governedByBadgeMarkdown();
    assert.match(md, /^\[!\[Governed by Decionis\]\(https:\/\/img\.shields\.io\/badge\/Governed/);
    assert.match(md, /\(https:\/\/github\.com\/decionis\/govern\)$/);
  });
  it("links to a custom URL (e.g. the live verify URL) when given one", () => {
    assert.match(
      governedByBadgeMarkdown("https://decionis.com/verify/x"),
      /\(https:\/\/decionis\.com\/verify\/x\)$/,
    );
  });
});

describe("buildPrCommentBody", () => {
  const base = {
    decision: "block",
    dossierId: "dsr-123",
    verifyUrl: "https://decionis.com/verify/decision-dossiers/dsr-123?sig=abc",
    policyVersion: "v4.3.0",
    reasonCode: "velocity_ceiling_exceeded",
    runMode: "enforce",
    failOn: "block",
  };
  it("includes the hidden sticky marker so re-runs update in place", () => {
    assert.match(buildPrCommentBody(base), /<!-- decionis-govern -->/);
  });
  it("renders the verdict, verify link, policy, and reason", () => {
    const body = buildPrCommentBody(base);
    assert.match(body, /Governed step — Blocked/);
    assert.match(body, /Verify this decision →/);
    assert.match(body, /v4\.3\.0/);
    assert.match(body, /velocity_ceiling_exceeded/);
  });
  it("shows the shadow-mode note (never fails build) in shadow", () => {
    const body = buildPrCommentBody({ ...base, runMode: "shadow" });
    assert.match(body, /Shadow mode/);
    assert.match(body, /never fails your build/);
  });
  it("includes attribution by default and omits it when disabled", () => {
    assert.match(buildPrCommentBody(base), /Governed by .*Decionis/);
    const bare = buildPrCommentBody({ ...base, showAttribution: false });
    assert.doesNotMatch(bare, /Governed by <a/);
  });
});

describe("resolvePayload", () => {
  it("falls back to a GitHub-context-derived payload when input is blank", () => {
    const payload = resolvePayload("", () => ({ source: "github_actions_test", repo: "x/y" }));
    assert.equal(payload.source, "github_actions_test");
    assert.equal(payload.repo, "x/y");
  });

  it("parses a JSON object input as-is", () => {
    const payload = resolvePayload('{"environment":"production","blast_radius":"high"}');
    assert.deepEqual(payload, { environment: "production", blast_radius: "high" });
  });

  it("throws on invalid JSON", () => {
    assert.throws(() => resolvePayload("not json"), /not valid JSON/);
  });

  it("throws if payload JSON is an array, not an object", () => {
    assert.throws(() => resolvePayload("[1,2,3]"), /must be an object/);
  });
});
