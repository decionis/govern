# Decionis Policy

<!--
  DECIONIS_POLICY.md — your repo's governance policy, in plain Markdown.

  Place this file at the root of your repository. The Decionis Action reads it,
  content-hashes it, and injects it into every gated decision — so the gate
  governs against YOUR rules and the signed Decision Dossier records exactly
  which policy (by sha256) applied. Change the file → new hash → new recorded
  revision. Set `policy-file: ""` on the action to disable.

  Write rules however your team thinks. Headings/bullets keep it readable for
  humans; Decionis encodes the intent. Keep it specific and testable.
-->

## Scope

Applies to deploys, infrastructure changes, database migrations, and
AI-generated pull requests in this repository.

## Rules

### Production deploys

- **Block** production deploys during a change freeze.
- **Escalate** any production deploy outside business hours (require a human
  approver) before it runs.
- **Allow** production deploys that have a green CI run and an approved PR.

### Infrastructure (`terraform apply`, Pulumi, CDK)

- **Escalate** changes that touch IAM, security groups, or networking.
- **Block** destructive actions (resource deletion, force-replace) without an
  explicit approval label on the PR.

### Database migrations

- **Escalate** any migration that drops a column or table.
- **Allow** additive, reversible migrations.

### AI-generated changes

- **Restrain** (require human review) any change authored by an AI agent that
  touches deploy, infra, or migration paths.
- **Allow** AI-authored docs/test-only changes.

## Thresholds

- Treat any action with an estimated blast radius over **$10,000** as high-risk
  and escalate.
- Require two approvers for anything that modifies secrets or rotation.

<!--
  Notes:
  - Verdicts map to the action's `decision` output: allow / block / restrain /
    escalate.
  - Start in shadow mode (`mode: shadow`) to see what these rules would do
    without failing builds, then enforce.
-->
