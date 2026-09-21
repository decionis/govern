# Security Policy

Decionis takes the security of **Decionis Govern** (`decionis/govern`), the gate it delegates to, and the platform it talks to seriously.

## Reporting a vulnerability

Please report security issues privately — do **not** open a public issue.

- Email **security@decionis.com** with a description, reproduction steps, and impact.
- Or use GitHub's [private vulnerability reporting](https://github.com/decionis/govern/security/advisories/new) on this repository.

We acknowledge reports within **2 business days** and aim to provide a remediation timeline within **5 business days**. Please allow reasonable time for a fix before any public disclosure; we're glad to credit reporters who coordinate disclosure.

## Scope

- `action.yml` in this repository, which delegates to the gate at a pinned commit.
- The gate itself, `govern/` in [decionis/agent-safe-pipeline](https://github.com/decionis/agent-safe-pipeline), whose [security policy](https://github.com/decionis/agent-safe-pipeline/security/policy) covers it: report there for the binary, the installer, the release archives and the contract client.
- The Decionis APIs the gate calls (`api.decionis.com`): enforce-and-bind, the escalation status, claim-token and finalize-token.

## What the action handles

- Your `DECIONIS_API_KEY` reaches the gate as an input and is sent solely to the configured `api-url` over HTTPS, as a bearer token. It is never logged and never given to the gated command.
- The execution grant a decision carries is claimed by the gate immediately before the command and never leaves it; the command receives the decision's identifiers and the authority's claim attestation.
- The pinned action downloads the release binary its commit names and verifies its SHA-256 before running it, or builds the same bytes from the pinned commit.

## More

- Security overview: <https://decionis.com/security>
- Privacy: <https://decionis.com/privacy>
- Terms: <https://decionis.com/terms>
