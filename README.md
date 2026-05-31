# Decionis — Govern this step

GitHub Action that gates a workflow step on a signed [Decionis](https://decionis.com)
Decision Dossier. Use it to block production deploys, infrastructure changes, releases, or
agent-triggered actions on a policy verdict — and to attach a public, verifiable record
of the decision to every run.

- **Calls** `POST /v1/protocol/evaluate-decision` with the workflow context (or a payload you
  pass in)
- **Sets** the workflow step's outputs to the verdict, dossier id, policy version, reason
  code, and a public `verify-url` (Slack / Teams / LinkedIn unfurls render the OG card)
- **Fails** the step on `block` (default) — configurable to also fail on `escalate`, or to
  run in pure shadow mode where the step never fails
- **Optionally** posts the verdict + verify URL as a PR comment

## Usage

```yaml
- uses: decionis/govern@v1
  id: decionis
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    # `payload` is optional — without it, a minimal payload is built from the
    # workflow context (repo / ref / sha / event / actor / run id).
    payload: |
      {
        "environment": "production",
        "changeset_size": 47,
        "blast_radius": "high"
      }
    fail-on: block # block | escalate | block_or_escalate | never
    mode: enforce # enforce | shadow
    comment-pr: "true" # post PR comment with verdict + verify URL

- name: Deploy
  if: steps.decionis.outputs.decision == 'allow'
  run: ./deploy.sh
```

## Inputs

| Input                | Required | Default                       | Description                                                                 |
| -------------------- | -------- | ----------------------------- | --------------------------------------------------------------------------- |
| `api-key`            | yes      | —                             | Decionis API key with `protocol:evaluate` scope. Pass as a workflow secret. |
| `org-id`             | yes      | —                             | Decionis org id (UUID).                                                     |
| `workflow-key`       | yes      | —                             | Workflow key registered in Decionis policy (e.g. `github_deploy_approval`). |
| `payload`            | no       | _built from workflow context_ | JSON object describing the action being gated.                              |
| `fail-on`            | no       | `block`                       | `block` / `escalate` / `block_or_escalate` / `never`.                       |
| `mode`               | no       | `enforce`                     | `enforce` or `shadow`. Shadow never fails the step.                         |
| `comment-pr`         | no       | `false`                       | Post the verdict as a PR comment (requires `pull-requests: write`).         |
| `api-base-url`       | no       | `https://api.decionis.com`    | Override for staging / self-host.                                           |
| `site-base-url`      | no       | `https://decionis.com`        | Override for staging / self-host.                                           |
| `request-timeout-ms` | no       | `20000`                       | Timeout for the evaluate-decision call.                                     |

## Outputs

| Output           | Description                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `decision`       | `allow` / `block` / `escalate` / `restrain`                                                     |
| `dossier-id`     | Signed Decision Dossier id for this evaluation.                                                 |
| `verify-url`     | Public verify URL (with `?sig=` so unfurls render the verdict OG card in Slack / LinkedIn / X). |
| `policy-version` | Policy version (string) that produced the verdict.                                              |
| `reason-code`    | Stable reason code (string), if returned.                                                       |

## Permissions

Minimum for normal operation: none beyond `contents: read` (the default).

To enable `comment-pr: 'true'`, add `pull-requests: write` to your job:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Shadow-mode rollout

Run in shadow first — every verdict is recorded but the step never fails. Once the
verdict distribution looks right (you can review it on `/decionis-score/report` and your
audit log), flip `mode` to `enforce`.

The canonical rollout — pick a surface → install in shadow → watch the would-have-blocked
numbers → flip to enforce — is walked end-to-end at
[**decionis.com/shadow-mode?surface=github_action**](https://decionis.com/shadow-mode?surface=github_action).

```yaml
- uses: decionis/govern@v1
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    org-id: ${{ secrets.DECIONIS_ORG_ID }}
    workflow-key: github_deploy_approval
    mode: shadow
```

## Output of the Action run

Every step writes a short markdown summary to `$GITHUB_STEP_SUMMARY` — the verdict, a
link to the verification page, and the policy version that produced it — so the proof is
one click from the run page.

## Honesty notes

- Inputs are echoed back into the dossier so you can audit what produced the verdict.
- `shadow` mode never fails the step regardless of `fail-on`.
- When the API returns non-200, the step fails with the API status and a truncated body
  in the log — no silent green builds.

## Examples

See [`examples/`](./examples/) for ready-to-copy workflows:

- `gate-deploy.yml` — block production deploys on a `block` verdict.
- `gate-pr-comment.yml` — shadow-mode evaluator that posts the verdict as a PR comment
  without ever failing the build.
