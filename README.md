# 🛡️ Decionis — Govern this step

**Gate any deploy, release, or infra change on a signed Decision Dossier — and leave verifiable proof on every run.**

[![Marketplace](https://img.shields.io/github/v/release/decionis/govern?label=marketplace&logo=githubactions&logoColor=white&color=6D28D9)](https://github.com/marketplace/actions/decionis-govern-this-step)
[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/govern)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`decionis/govern` calls the Decionis policy engine before a step runs, returns a **signed, public-verifiable verdict** (`allow` / `block` / `escalate`), and — optionally — posts it to the PR. Start in **shadow mode** where it _never fails your build_, watch what it would have caught, then flip one line to `enforce`.

---

## 30-second quickstart

Add this to any workflow. In `shadow` mode it records a verdict and **never fails your build** — zero risk to try:

```yaml
- uses: decionis/govern@v1
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    mode: shadow # ← records every verdict; step never fails
    comment-pr: "true" # ← posts the verdict + verify link on the PR
```

Need keys? Create them free at **[decionis.com/quickstart?source=github_action](https://decionis.com/quickstart?source=github_action)** (no credit card, no call).

When you're ready, gate the real thing — `enforce` fails the run on a `block`:

```yaml
- uses: decionis/govern@v1
  id: gate
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    mode: enforce

- name: Deploy
  if: steps.gate.outputs.decision == 'allow'
  run: ./deploy.sh
```

---

## Why teams add it

- **Proof, not vibes.** Every verdict produces a signed [Decision Dossier](https://decionis.com/dossier-example?source=github_action) with a public verify URL — paste it in a change ticket, an audit, or an incident review and it holds up.
- **Zero-risk rollout.** `mode: shadow` measures what _would_ have been blocked without ever touching a green build. Flip to `enforce` when the evidence convinces you.
- **Lives where your pipeline lives.** No bot to babysit, no portal to check — the verdict lands in the run summary and (optionally) the PR.
- **The verify link unfurls.** Drop it in Slack / Teams / LinkedIn / X and it renders the verdict as an OG card.

## What reviewers see on the PR

With `comment-pr: 'true'`, the action posts a single, **self-updating** comment (re-runs edit it in place — no thread spam):

> 🛑 **Governed step — Blocked**
> | | |
> |---|---|
> | **Verdict** | `block` |
> | **Policy** | `github_deploy_approval@v4` |
> | **Reason** | `change_window_closed` |
>
> **[🔎 Verify this decision →](https://decionis.com/verify/decision-dossiers/…)** — signed, tamper-evident proof.
>
> <sub>🛡️ Governed by Decionis · gate your own deploys with `decionis/govern`</sub>

## 📌 Add the badge

Show that your pipeline is governed — and let other devs discover the check. The action also emits this as the `badge-markdown` output (pointing at the live verify URL):

```markdown
[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/govern)
```

[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/govern)

---

## Recipes

Copy-paste workflows in [`examples/`](./examples/):

| Recipe                                                              | What it gates                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`gate-deploy.yml`](./examples/gate-deploy.yml)                     | Block a production deploy on a `block` verdict (enforce).          |
| [`gate-pr-comment.yml`](./examples/gate-pr-comment.yml)             | Shadow-mode evaluator that comments on PRs without failing builds. |
| [`gate-terraform.yml`](./examples/gate-terraform.yml)               | Gate `terraform apply` on the plan's blast radius.                 |
| [`gate-release.yml`](./examples/gate-release.yml)                   | Require a verdict before a tagged release ships.                   |
| [`auto-merge-dependabot.yml`](./examples/auto-merge-dependabot.yml) | Only auto-merge a dependency PR when the verdict is `allow`.       |

### Compose the verdict into later steps

```yaml
- uses: decionis/govern@v1
  id: gate
  with: { api-key: ${{ secrets.DECIONIS_API_KEY }}, org-id: ${{ secrets.DECIONIS_ORG_ID }}, workflow-key: release_gate }

- name: Ship
  if: steps.gate.outputs.decision == 'allow'
  run: ./ship.sh

- name: Page on-call to review
  if: steps.gate.outputs.decision == 'escalate'
  run: ./notify.sh "${{ steps.gate.outputs.verify-url }}"
```

## Inputs

| Input                | Required | Default                       | Description                                                                 |
| -------------------- | -------- | ----------------------------- | --------------------------------------------------------------------------- |
| `api-key`            | yes      | —                             | Decionis API key with `protocol:evaluate` scope. Pass as a secret.          |
| `org-id`             | yes      | —                             | Decionis org id (UUID).                                                     |
| `workflow-key`       | yes      | —                             | Workflow key registered in Decionis policy (e.g. `github_deploy_approval`). |
| `payload`            | no       | _built from workflow context_ | JSON object describing the action being gated.                              |
| `fail-on`            | no       | `block`                       | `block` / `escalate` / `block_or_escalate` / `never`.                       |
| `mode`               | no       | `enforce`                     | `enforce` or `shadow`. Shadow never fails the step.                         |
| `comment-pr`         | no       | `false`                       | Post (and update in place) the verdict as a PR comment.                     |
| `show-attribution`   | no       | `true`                        | Include the "Governed by Decionis" footer on the PR comment.                |
| `api-base-url`       | no       | `https://api.decionis.com`    | Override for staging / self-host.                                           |
| `site-base-url`      | no       | `https://decionis.com`        | Override for staging / self-host.                                           |
| `request-timeout-ms` | no       | `20000`                       | Timeout for the evaluate-decision call.                                     |

## Outputs

| Output           | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `decision`       | `allow` / `block` / `escalate` / `restrain`                                 |
| `dossier-id`     | Signed Decision Dossier id for this evaluation.                             |
| `verify-url`     | Public verify URL (`?sig=` so unfurls render the verdict OG card).          |
| `policy-version` | Policy version (string) that produced the verdict.                          |
| `reason-code`    | Stable reason code (string), if returned.                                   |
| `badge-markdown` | Ready-to-paste "Governed by Decionis" badge linking to the live verify URL. |

## Permissions

Default (`contents: read`) is enough. To enable `comment-pr: 'true'`:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Shadow → enforce rollout

The canonical path — install in shadow → watch the would-have-blocked numbers → flip to enforce — is walked end-to-end at **[decionis.com/shadow-mode?surface=github_action](https://decionis.com/shadow-mode?surface=github_action)**.

```yaml
- uses: decionis/govern@v1
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    mode: shadow # observe first; flip to enforce when you're convinced
```

## Honesty notes

- Inputs are echoed into the dossier, so you can audit exactly what produced a verdict.
- `shadow` mode **never** fails the step, regardless of `fail-on`.
- A non-200 from the API fails the step with the status + a truncated body — no silent green builds.
- The PR comment is sticky (one comment, updated in place) — re-runs don't spam the thread.

---

<sub>Built by [Decionis](https://decionis.com?source=github_action_readme) · [Quickstart](https://decionis.com/quickstart?source=github_action) · [Dossier example](https://decionis.com/dossier-example?source=github_action) · MIT licensed</sub>
