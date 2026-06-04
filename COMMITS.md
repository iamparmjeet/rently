# Commit Message Reference

## Format

type(scope): description

## Types

feat → new feature
fix → bug fix
refactor → no behavior change, better shape
chore → deps, config, tooling
style → formatting only (biome, whitespace)
build → turbo, tsconfig, monorepo config

## Scopes

db · validators · api · auth · email · server · web
property · unit · tenant · lease · payment · utility · invite · dashboard

## Examples

feat(web/tenant): add TenantCard with status badge
fix(db): correct UUID type in tenantInvites table
refactor(api): extract VerifyOwnership into shared helper
chore(deps): add commitlint and lefthook commit-msg hook

## Rule

If your message needs "and" → split the commit
CSS stays with its component, not a separate commit
