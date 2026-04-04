# AGENTS.md

## Working agreements

This repository is a Next.js application deployed through GitHub Pages, with Firebase used for authentication and data persistence. The project includes question-bank import, diagnostics, and Firebase sync behavior.

## Primary goals
- Keep the app deployable to GitHub Pages.
- Preserve Firebase connectivity and client-side configuration.
- Preserve question-bank import compatibility.
- Prefer minimal diffs and avoid unrelated refactors.

## Allowed scope
You may edit:
- `app/**`
- `components/**`
- `lib/**`
- `public/**`
- `styles/**`
- app-specific config files

Avoid editing unless explicitly required:
- lockfiles
- Firebase project settings
- GitHub Actions workflows
- Firestore rules
- large generated data files
- deployment environment names

## Exploration order
1. Read `README.md`.
2. Read the target page, component, or utility being changed.
3. Read adjacent import / sync / diagnostic code before editing it.
4. Reuse existing patterns before introducing new abstractions.

## Implementation preferences
- Prefer minimal diffs.
- Preserve current behavior unless the task explicitly requires a change.
- Do not silently rename environment variables.
- Do not change JSON import formats without updating validators, diagnostics, and UI messaging together.
- Do not invent question-bank content.
- Preserve source fidelity for imported questions and explanations.

## Firebase handling
- Treat Firebase config keys and collection names as compatibility-sensitive.
- Do not casually change auth flow, Firestore paths, or import schema.
- If a change touches Firebase write/read logic, verify both write and read paths.
- If a change touches diagnostics, preserve explicit success/fail logs.

## Question-bank handling
- Preserve compatibility for the currently supported import schema.
- If schema changes are necessary, update all of the following together:
  - parser
  - validator
  - import UI
  - diagnostic flow
  - documentation
- Keep chapter / domain / subdomain behavior internally consistent.
- Do not remove explanation fields or weaken import validation silently.

## Validation
After a meaningful code change, run the smallest relevant checks available in the project.

At minimum, validate:
- the app still builds
- the affected UI path loads
- the import flow still accepts the supported JSON format
- Firebase-dependent paths fail clearly when config is missing
- diagnostics still distinguish success, timeout, and permission failures

If existing scripts already cover this, prefer the repo’s current scripts instead of inventing new ones.

## Final handoff
Always report:
- files changed
- why those files changed
- what was validated
- remaining risks or unverified areas

## Never do these by default
- do not rewrite the whole app
- do not switch deployment strategy
- do not replace Firebase with another backend
- do not change GitHub Pages assumptions
- do not modify secrets, workflow names, or environment names without explicit instruction
