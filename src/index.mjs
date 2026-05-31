// @ts-check
// Decionis GitHub Action — Node 20 entrypoint.
// Zero deps: uses built-in fetch + node:fs.
// Resolves a Decionis Decision Dossier for the current workflow step and
// fails the step on a `block` (or `escalate`, configurable) verdict.

import { appendFile, readFile } from "node:fs/promises";

const FAIL_MODES = new Set(["block", "escalate", "block_or_escalate", "never"]);
const RUN_MODES = new Set(["enforce", "shadow"]);

/** Read an Action input (GitHub maps inputs to env vars). */
function getInput(name, { required = false } = {}) {
  const envKey = `INPUT_${name.toUpperCase().replace(/-/g, "_")}`;
  const value = process.env[envKey];
  if (value === undefined || value === "") {
    if (required) throw new Error(`Decionis: missing required input '${name}'`);
    return "";
  }
  return value;
}

function getBooleanInput(name, fallback = false) {
  const raw = getInput(name).trim().toLowerCase();
  if (raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

/** GitHub log commands — these render nicely in the Action log. */
function logGroup(title, body) {
  console.log(`::group::${title}`);
  console.log(body);
  console.log("::endgroup::");
}
function logError(message) {
  console.log(`::error::${message}`);
}
function logNotice(message) {
  console.log(`::notice::${message}`);
}

/** Set a GitHub Action output (file-based, the v2 mechanism). */
async function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return; // running locally, just no-op
  const safe = value === null || value === undefined ? "" : String(value);
  // Use heredoc syntax so multiline values are safe.
  const delim = `__DECIONIS_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await appendFile(outputFile, `${name}<<${delim}\n${safe}\n${delim}\n`);
}

/** Write to the run summary (markdown rendered on the run page). */
async function writeSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  await appendFile(summaryFile, markdown + "\n");
}

/**
 * Build a minimal payload from the GitHub workflow context when the consumer
 * didn't pass one. Honest — only includes fields actually present on the run.
 */
function buildPayloadFromContext() {
  const env = process.env;
  return {
    source: "github_actions",
    github: {
      repository: env.GITHUB_REPOSITORY ?? null,
      ref: env.GITHUB_REF ?? null,
      sha: env.GITHUB_SHA ?? null,
      event_name: env.GITHUB_EVENT_NAME ?? null,
      actor: env.GITHUB_ACTOR ?? null,
      run_id: env.GITHUB_RUN_ID ?? null,
      run_attempt: env.GITHUB_RUN_ATTEMPT ?? null,
      workflow: env.GITHUB_WORKFLOW ?? null,
      job: env.GITHUB_JOB ?? null,
      server_url: env.GITHUB_SERVER_URL ?? "https://github.com",
    },
  };
}

/**
 * Parse the consumer-provided payload string. Accepts JSON object or JSON
 * object inside a heredoc-style string. Falls back to context-derived payload
 * if the input is blank.
 */
export function resolvePayload(rawInput, contextBuilder = buildPayloadFromContext) {
  const trimmed = (rawInput ?? "").trim();
  if (trimmed === "") return contextBuilder();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    throw new Error("payload JSON must be an object");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Decionis: input 'payload' is not valid JSON object: ${reason}`);
  }
}

/** Decide whether a given verdict should fail the step under the configured mode. */
export function shouldFail(decision, failOn, runMode) {
  if (runMode === "shadow") return false;
  const d = (decision ?? "").toLowerCase();
  if (failOn === "never") return false;
  if (failOn === "block") return d === "block" || d === "deny" || d === "denied";
  if (failOn === "escalate") return d === "escalate" || d === "review";
  if (failOn === "block_or_escalate") {
    return d === "block" || d === "deny" || d === "denied" || d === "escalate" || d === "review";
  }
  // Unknown fail-on values are treated as the default (block).
  return d === "block" || d === "deny" || d === "denied";
}

/** Build the canonical public verify URL (with `?sig=` for the OG card). */
export function buildVerifyUrl(siteBase, dossierId, signature) {
  const base = siteBase.replace(/\/$/, "");
  const id = encodeURIComponent(dossierId);
  if (signature) {
    const sig = encodeURIComponent(signature);
    return `${base}/verify/decision-dossiers/${id}?sig=${sig}&source=github_actions`;
  }
  return `${base}/verify/decision-dossiers/${id}?source=github_actions`;
}

async function postPrComment(repoFullName, prNumber, githubToken, body) {
  if (!repoFullName || !prNumber || !githubToken) return false;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ body }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function maybeCommentPr({ enabled, decision, dossierId, verifyUrl, policyVersion }) {
  if (!enabled) return;
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") return;
  const repoFullName = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!repoFullName || !eventPath || !githubToken) return;
  let prNumber = null;
  try {
    const event = JSON.parse(await readFile(eventPath, "utf8"));
    prNumber = event?.pull_request?.number ?? event?.number ?? null;
  } catch {
    return;
  }
  if (!prNumber) return;
  const verdictBadge =
    decision === "allow" ? "✅ Allowed" : decision === "block" ? "🛑 Blocked" : `⚠️ ${decision}`;
  const body = [
    `**Decionis · governed step verdict** — ${verdictBadge}`,
    "",
    `- Dossier: \`${dossierId}\``,
    `- Policy version: \`${policyVersion ?? "unknown"}\``,
    `- [View verification →](${verifyUrl})`,
  ].join("\n");
  await postPrComment(repoFullName, prNumber, githubToken, body);
}

async function main() {
  const apiKey = getInput("api-key", { required: true });
  const orgId = getInput("org-id", { required: true });
  const workflowKey = getInput("workflow-key", { required: true });
  const payload = resolvePayload(getInput("payload"));
  const failOnRaw = (getInput("fail-on") || "block").trim().toLowerCase();
  const failOn = FAIL_MODES.has(failOnRaw) ? failOnRaw : "block";
  const runModeRaw = (getInput("mode") || "enforce").trim().toLowerCase();
  const runMode = RUN_MODES.has(runModeRaw) ? runModeRaw : "enforce";
  const commentPr = getBooleanInput("comment-pr", false);
  const apiBaseUrl = (getInput("api-base-url") || "https://api.decionis.com").replace(/\/$/, "");
  const siteBaseUrl = (getInput("site-base-url") || "https://decionis.com").replace(/\/$/, "");
  const timeoutMs = Number(getInput("request-timeout-ms") || "20000") || 20000;

  const requestBody = {
    org_id: orgId,
    workflow_key: workflowKey,
    payload,
    mode: runMode === "shadow" ? "SHADOW" : "ENFORCE",
    source: "github_actions",
  };

  logGroup(
    "Decionis evaluate-decision request",
    JSON.stringify(
      {
        url: `${apiBaseUrl}/v1/protocol/evaluate-decision`,
        org_id: orgId,
        workflow_key: workflowKey,
        mode: requestBody.mode,
        fail_on: failOn,
        payload_keys: Object.keys(payload),
      },
      null,
      2,
    ),
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/v1/protocol/evaluate-decision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "x-decionis-source": "github_actions",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logError(`Decionis API returned ${response.status}: ${text.slice(0, 600)}`);
    throw new Error(`Decionis evaluate-decision failed (${response.status})`);
  }

  const data = await response.json();
  const decision = String(data?.decision ?? data?.outcome ?? "").toLowerCase();
  const dossierId = String(data?.dossier_id ?? data?.dossier?.dossier_id ?? "");
  const signature = data?.verification?.signature ?? data?.signature ?? null;
  const policyVersion = data?.policy_version ?? data?.dossier?.policy_version ?? null;
  const reasonCode =
    (Array.isArray(data?.reason_codes) && data.reason_codes[0]) ?? data?.reason_code ?? null;
  const verifyUrl = dossierId ? buildVerifyUrl(siteBaseUrl, dossierId, signature) : "";

  await Promise.all([
    setOutput("decision", decision),
    setOutput("dossier-id", dossierId),
    setOutput("verify-url", verifyUrl),
    setOutput("policy-version", policyVersion ?? ""),
    setOutput("reason-code", reasonCode ?? ""),
  ]);

  const verdictLine =
    decision === "allow"
      ? `✅ Decionis verdict: **allow** (policy ${policyVersion ?? "—"})`
      : decision === "block"
        ? `🛑 Decionis verdict: **block** (policy ${policyVersion ?? "—"})`
        : `⚠️ Decionis verdict: **${decision}** (policy ${policyVersion ?? "—"})`;

  await writeSummary(
    [
      "## Decionis · Governed step",
      "",
      verdictLine,
      "",
      dossierId ? `- Dossier: \`${dossierId}\`` : "",
      reasonCode ? `- Reason: \`${reasonCode}\`` : "",
      verifyUrl ? `- [View verification →](${verifyUrl})` : "",
      runMode === "shadow"
        ? "- _Shadow mode — step will not fail regardless of verdict._"
        : `- _Fail-on: \`${failOn}\`_`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (decision) logNotice(`Decionis verdict: ${decision} (dossier ${dossierId || "—"})`);

  await maybeCommentPr({ enabled: commentPr, decision, dossierId, verifyUrl, policyVersion });

  if (shouldFail(decision, failOn, runMode)) {
    logError(
      `Decionis blocked this step (verdict=${decision}, fail-on=${failOn}, mode=${runMode}). Dossier: ${dossierId}`,
    );
    process.exit(1);
  }
}

const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === new URL(process.argv[1], "file://").href;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((err) => {
    logError(`Decionis Action failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
