# Decionis Govern

**One verdict before a workflow step runs — a deploy, a migration, an infrastructure change, an
agent's action — with a signed Decision Dossier of it.**

[![Marketplace](https://img.shields.io/github/v/release/decionis/govern?label=marketplace&logo=githubactions&logoColor=white&color=6D28D9)](https://github.com/marketplace/actions/decionis-action-gate)
[![Governed by Decionis](https://img.shields.io/badge/Governed%20by-Decionis-6D28D9?logo=shield&logoColor=white)](https://github.com/decionis/agent-safe-pipeline/tree/master/govern)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

```yaml
- uses: decionis/govern@v2
  with:
    api-key: ${{ secrets.DECIONIS_API_KEY }}
    tenant-id: ${{ vars.DECIONIS_TENANT_ID }}
    action: production-deploy
    environment: production
    run: ./scripts/deploy.sh # runs only on an ALLOW whose grant this step claimed
```

The step becomes an execution intent, Decionis decides on exactly that intent, the command runs
only on an `ALLOW` whose single-use grant the step claimed first, and what happened is finalized
into a signed Decision Dossier. `BLOCK` ends the step with the command never started; `ESCALATE`
can hold it while Decionis orchestrates a person's approval; `mode: shadow` starts the command at
once and records the verdict beside it, never failing a build. Nothing is decided locally: a
Decionis that cannot be reached is a refusal, and the command does not run.

## Where the gate lives

This repository is the Marketplace address. The gate itself — one Go binary for GitHub Actions,
GitLab CI, Jenkins and any other runner, speaking the Decionis execution contract the
[AgentSafe runtime](https://github.com/decionis/agent-safe-pipeline) speaks — lives in
[`decionis/agent-safe-pipeline` under `govern/`](https://github.com/decionis/agent-safe-pipeline/tree/master/govern),
with its tests, its releases and its page, [docs/govern.md](https://github.com/decionis/agent-safe-pipeline/blob/master/docs/govern.md).
[`action.yml`](./action.yml) here carries the listing's metadata and delegates every input and
output to that action at a pinned commit, which downloads the release binary its commit names and
verifies it before running.

- Every input, output, exit code and runner surface: [the gate's README](https://github.com/decionis/agent-safe-pipeline/blob/master/govern/README.md).
- The recipes in [`examples/`](./examples) are copies of the gate's: a deploy, `terraform apply`
  on the plan's blast radius, a release held for the release manager, shadow comments on every
  pull request, agent-authored pull requests, Dependabot auto-merge.
- Starting a repository: install the binary and run `govern init`, which writes a shadow-mode
  workflow and a `DECIONIS_POLICY.md` and touches nothing else.

## v1

`uses: decionis/govern@v1` is the earlier node20 action, which spoke the evaluate-decision API
with `org-id` and `workflow-key` inputs and evaluated a rules block locally. It stays where its
tags point ([v1.9.3](https://github.com/decionis/govern/tree/v1.9.3)) and is not developed
further; v2 speaks the execution contract, has no local policy engine, and takes `tenant-id` in
place of `org-id` and `workflow-key`. Keys and workspaces are the same.

Built by [Decionis](https://decionis.com?source=govern_readme) · Apache-2.0
