# 🛡️ Decionis Action Gate

**Govern high-risk actions before they execute.**

[![Marketplace](https://img.shields.io/github/v/release/decionis/govern?label=marketplace&logo=githubactions&logoColor=white&color=6D28D9)](https://github.com/marketplace/actions/decionis-action-gate)
[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/govern)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> **Before software executes, Decionis decides whether it's allowed to.**

GitHub Actions runs the code. **Decionis decides whether the run is authorized.** Add one step and every deploy, migration, infra change, or AI-generated PR is evaluated against your policy, approvals, and risk — then **allowed, blocked, or escalated** before it executes, with a signed Decision Dossier as audit-ready proof.

Start in **shadow mode**, where it _never fails your build_ — observe what it would have caught, then flip one line to `enforce`.

---

## The question every pipeline now faces

AI coding agents — **Claude Code, Copilot, Cursor, Codex, OpenHands** — now open PRs, edit workflows, write migrations, and trigger deploys. The hard question is no longer _"who wrote this code?"_ It's:

> **Should this action be allowed to execute?**

That's the Action Gate.

## 30-second quickstart

**Wrap the command you want to govern.** Decionis runs it _through_ the gate, so it can't execute without an authorizing verdict:

```yaml
- uses: decionis/govern@v1
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    action: production-deploy
    run: ./deploy.sh # ← Decionis runs this ONLY if it authorizes the action
```

On `allow` the command runs. On `block`/`escalate` it **never runs** and the step fails. Try it risk-free with `mode: shadow` — the command still runs, but Decionis only records the verdict (never fails the build):

```yaml
- uses: decionis/govern@v1
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    action: production-deploy
    run: ./deploy.sh
    mode: shadow # observe-only; records the verdict, never blocks
    comment-pr: "true" # posts the verdict + verify link on the PR
```

Need keys? Create them free at **[decionis.com/quickstart?source=github_action](https://decionis.com/quickstart?source=github_action)** — no card, no call.

### Why a wrapper, not an `if:`

A common pattern is to gate on the output:

```yaml
- uses: decionis/govern@v1
  id: gate
- run: ./deploy.sh
  if: steps.gate.outputs.decision == 'allow' # ⚠️ advisory — can be deleted
```

That `if:` is **advisory**. Anyone — or any AI agent editing the workflow — can delete one line and the deploy runs ungoverned. With `run:`, **Decionis owns the execution path**: the command only exists inside the gate, so bypassing it means rewriting the step — a visible, reviewable diff (protect `.github/workflows/**` with CODEOWNERS + branch protection to close that too). The verdict-only + `if:` form still works for cases where you can't wrap the command, but reach for `run:` whenever you actually need to _enforce_.

### Execution Grants — move the trust boundary to the target

A wrapper still lives in the workflow. To make execution **cryptographically** gated, set `request-grant: true`: on an authorizing verdict Decionis mints a short-lived, single-use, Ed25519-signed **Execution Grant**, injected into the command as `DECIONIS_EXECUTION_GRANT`. The deploy target verifies it (offline against the public JWKS, or online to burn the single-use nonce) **before doing anything** — so a rewritten workflow that skips the gate produces no valid grant and the target refuses.

```yaml
- uses: decionis/govern@v1
  with:
    workflow-key: github_deploy_approval
    action: production-deploy
    request-grant: true
    grant-audience: prod-us-east
    run: ./deploy.sh # reads $DECIONIS_EXECUTION_GRANT, presents it to the target
```

Full design: [`docs/architecture/execution-authority-governor-layer.md`](https://github.com/decionis/govern). Verify endpoints: `POST /v1/protocol/execution-grants/verify` and the JWKS at `/.well-known/decionis-execution-grant-jwks.json`.

### Tier 3 — brokered credentials (no standing secrets)

The strongest form: the deploy box holds **no** credentials. Register a target's secret with Decionis once, then exchange the grant for it at run time — skip the gate and `redeem` returns nothing, so the deploy fails closed. See [`examples/gate-deploy-broker.yml`](./examples/gate-deploy-broker.yml) and `POST /v1/protocol/execution-grants/redeem`.

---

## Three concepts

### 1. 🚦 Action Gate

One verdict before execution — **`allow`**, **`block`**, or **`escalate`**. Composable into any later step via `steps.<id>.outputs.decision`.

### 2. 🟣 Shadow Mode

`mode: shadow` records what _would_ have been blocked without ever failing a build. Watch the would-have-blocked numbers, then enforce when the evidence convinces you.

### 3. 🧾 Decision Dossiers

Every verdict produces a signed, public-verifiable [Decision Dossier](https://decionis.com/dossier-example?source=github_action): **why** it happened, **who** approved it, **which policy** applied, and the **risk**. The verify link unfurls as an OG card in Slack / Teams / LinkedIn — paste it in an incident, a change ticket, or an audit and it holds up.

---

## Lead use case — govern AI-generated changes

When an AI agent opens a PR or triggers a deploy, gate it **before** it merges or ships:

```yaml
- uses: decionis/govern@v1
  id: gate
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: ai_change_gate
    action: ai-generated-pr
    comment-pr: "true"
    payload: |
      { "author": "${{ github.actor }}", "agent_generated": true }
```

See [`examples/gate-ai-agent-pr.yml`](./examples/gate-ai-agent-pr.yml) for the full recipe (auto-detects agent authorship and requires a human verdict on risky changes).

## Also governs

- **Deployments** — production releases, blue/green cutovers
- **Infrastructure** — `terraform apply`, Pulumi, CDK
- **Data** — database migrations, destructive jobs
- **Privileged workflows** — release pipelines, secrets rotation, IAM changes

## What reviewers see on the PR

A single, **self-updating** comment (re-runs edit it in place — no thread spam):

![Example Decionis PR comment — Blocked verdict with a signed verify link](./assets/pr-comment.svg)

## 📌 Add the badge

Show your pipeline is governed — and let other devs discover the gate. Also emitted as the `badge-markdown` output (pointing at the live verify URL):

```markdown
[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/govern)
```

[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/govern)

---

## Recipes

Copy-paste workflows in [`examples/`](./examples/):

| Recipe                                                              | What it gates                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`gate-ai-agent-pr.yml`](./examples/gate-ai-agent-pr.yml)           | AI-generated PRs (Claude Code, Copilot, Cursor…) before merge. |
| [`gate-deploy.yml`](./examples/gate-deploy.yml)                     | A production deploy on a `block` verdict (enforce).            |
| [`gate-terraform.yml`](./examples/gate-terraform.yml)               | `terraform apply` on the plan's blast radius.                  |
| [`gate-release.yml`](./examples/gate-release.yml)                   | A verdict before a tagged release ships.                       |
| [`auto-merge-dependabot.yml`](./examples/auto-merge-dependabot.yml) | Auto-merge a dependency PR only when the verdict is `allow`.   |
| [`gate-pr-comment.yml`](./examples/gate-pr-comment.yml)             | Shadow-mode evaluator that comments without failing the build. |

## Inputs

| Input                | Required | Default                       | Description                                                        |
| -------------------- | -------- | ----------------------------- | ------------------------------------------------------------------ |
| `api-key`            | yes      | —                             | Decionis API key with `protocol:evaluate` scope. Pass as a secret. |
| `org-id`             | yes      | —                             | Decionis org id (UUID).                                            |
| `workflow-key`       | yes      | —                             | Workflow key registered in Decionis policy.                        |
| `action`             | no       | —                             | Short label for what's being gated (e.g. `production-deploy`).     |
| `run`                | no       | —                             | Command Decionis runs **only if authorized** (the enforcing path). |
| `shell`              | no       | `bash`                        | Shell for `run` — `bash` or `sh`.                                  |
| `request-grant`      | no       | `false`                       | Mint a signed Execution Grant on allow (Governor Layer).           |
| `grant-audience`     | no       | —                             | Bind the grant to a target/env id (e.g. `prod-us-east`).           |
| `payload`            | no       | _built from workflow context_ | JSON object describing the action being gated.                     |
| `fail-on`            | no       | `block`                       | `block` / `escalate` / `block_or_escalate` / `never`.              |
| `mode`               | no       | `enforce`                     | `enforce` or `shadow`. Shadow never fails the step.                |
| `comment-pr`         | no       | `false`                       | Post (and update in place) the verdict as a PR comment.            |
| `show-attribution`   | no       | `true`                        | Include the "Governed by Decionis" footer on the PR comment.       |
| `api-base-url`       | no       | `https://api.decionis.com`    | Override for staging / self-host.                                  |
| `site-base-url`      | no       | `https://decionis.com`        | Override for staging / self-host.                                  |
| `request-timeout-ms` | no       | `20000`                       | Timeout for the evaluate-decision call.                            |

## Outputs

| Output             | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `decision`         | `allow` / `block` / `escalate` / `restrain`                                   |
| `dossier-id`       | Signed Decision Dossier id for this evaluation.                               |
| `verify-url`       | Public verify URL (`?sig=` so unfurls render the verdict OG card).            |
| `policy-version`   | Policy version (string) that produced the verdict.                            |
| `reason-code`      | Stable reason code (string), if returned.                                     |
| `badge-markdown`   | Ready-to-paste "Governed by Decionis" badge linking to the live verify URL.   |
| `executed`         | `true` if a `run` command was authorized and executed, `false` if blocked.    |
| `execution-grant`  | Signed Execution Grant (EdDSA JWT) when `request-grant: true` and authorized. |
| `grant-expires-at` | ISO timestamp when the Execution Grant expires.                               |

## Permissions

Default (`contents: read`) is enough. To enable `comment-pr: 'true'`:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## How it works

The action calls `POST /v1/protocol/evaluate-decision` with the action label + payload (or a payload built from the workflow context), and returns the signed verdict. Inputs are echoed into the dossier so you can audit exactly what produced it. `shadow` mode **never** fails the step; a non-200 from the API fails the step with the status — no silent green builds.

---

<sub>Built by [Decionis](https://decionis.com?source=github_action_readme) · [Quickstart](https://decionis.com/quickstart?source=github_action) · [Dossier example](https://decionis.com/dossier-example?source=github_action) · MIT licensed</sub>
