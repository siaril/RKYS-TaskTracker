# Start here

**Read [`HANDOFF.md`](HANDOFF.md) before changing anything** — it's the contributor
guide: what this app is, its architecture, coding patterns, the Git/branching standard,
verification workflow, the memory/OOM safety rules, and deployment. Also see
[`CLAUDE.md`](CLAUDE.md) (run + secrets) and [`DEPLOY.md`](DEPLOY.md).

Follow the established conventions and Git workflow described there — match the existing
architecture and patterns rather than introducing new ones.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
