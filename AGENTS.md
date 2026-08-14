## Boilerplate AGENTS.md

This is a template to use when starting new projects. Adapt as needed.

---------

# Development Guide for AI Agents

You are a senior engineer working in a monorepo. You prioritize type safety, readable code to all levels of engineers, and small, reviewable diffs.

## Do

Things you should be doing:

- Use `import type { X }` for TypeScript type imports
- Use early returns to reduce nesting: `if (!booking) return null;`
- Use conventional commits: `feat:`, `fix:`, `refactor:`
- Create PRs in draft mode by default
- Only create PRs if explicitly asked to do so
- Import directly from source files, not barrel files (e.g., `@calcom/ui/components/button` not `@calcom/ui`)
- Put permission checks in `page.tsx`, never in `layout.tsx`
- Use `ast-grep` for searching if available; otherwise use `rg` (ripgrep), then fall back to `grep`
- Only add code comments that explain **why**, not **what** — see [code comment guidelines](quality-code-comments.md)


## Don't

Things you should NOT be doing:

- Never use `as any` - use proper type-safe solutions instead
- Never expose `credential.key` field in API responses or queries
- Never commit secrets or API keys
- Never use barrel imports from index.ts files
- Never skip running type checks before pushing
- Never create large PRs (>1000 lines or >10 files) - split them instead
- Never add comments that simply restate what the code does (e.g., `// Get the user` above a `getUser()` call)
- Never make a PR unless explicitly asked to do so

## PR Size Guidelines (FULLY IGNORE THIS SECTION)

Large PRs are difficult to review, prone to errors, and slow down the development process. Always aim for smaller, self-contained PRs that are easier to understand and review.

### Size Limits

- **Lines changed**: Keep PRs under 1000 lines of code (additions + deletions). For large changes, ask me to clarify whether we should break something into multiple PRs or keep it as one big one. 
- **Files changed**: Keep PRs under 10 code files
- **Single responsibility**: Each PR should do one thing well

**Note**: These limits apply to code files only. Non-code files like documentation (README.md, CHANGELOG.md), lock files (yarn.lock, package-lock.json), and auto-generated files are excluded from the count.

For large changes that are over these limits, ask me to clarify whether we should break something into multiple PRs or keep it as one big one (once I explicitly ask you to make a PR). 

### How to Split Large Changes

When a task requires extensive changes, break it into multiple PRs:

1. **By layer**: Separate database/schema changes, backend logic, and frontend UI into different PRs
2. **By feature component**: Split a feature into its constituent parts (e.g., API endpoint PR, then UI PR, then integration PR)
3. **By refactor vs feature**: Do preparatory refactoring in a separate PR before adding new functionality
4. **By dependency order**: Create PRs in the order they can be merged (base infrastructure first, then features that depend on it)

### Examples of Good PR Splits

**Instead of one large "Add booking notifications" PR:**
- PR 1: Add notification preferences schema and migration
- PR 2: Add notification service and API endpoints
- PR 3: Add notification UI components
- PR 4: Integrate notifications into booking flow

**Instead of one large "Refactor calendar sync" PR:**
- PR 1: Extract calendar sync logic into dedicated service
- PR 2: Add new calendar provider abstraction
- PR 3: Migrate existing providers to new abstraction
- PR 4: Add new calendar provider support

### Benefits of Smaller PRs

- Faster review cycles and quicker feedback
- Easier to identify and fix issues
- Lower risk of merge conflicts
- Simpler to revert if problems arise
- Better git history and easier debugging

## Commands

Put key commands here. Create external refernce file for full list of commands. 


## Boundaries

### Always do
- Run type check on changed files before committing
- Run relevant tests before pushing
- Follow conventional commits for PR titles

### Ask first
- Adding new dependencies
- Changes affecting multiple packages
- Deleting files
- Running full build or E2E suites

### Never do
- Commit secrets, API keys, or `.env` files
- Expose `credential.key` in any query
- Use `as any` type casting
- Force push or rebase shared branches
- Modify generated files directly

## Project Structure

```
apps/...                   # EX: Main Next.js application
...
```

### Key files
...

## Tech Stack - complete as needed

- **Framework**: Next.js 13+ (App Router in some areas)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL
- **API**: ...
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit), Playwright (E2E)

## Code Examples

### Good error handling

```typescript
// Good - Descriptive error with context
throw new Error(`Unable to create booking: User ${userId} has no available time slots for ${date}`);

// Bad - Generic error
throw new Error("Booking failed");
```

### Good imports

```typescript
// Good - Type imports and direct paths
import type { User } from "@prisma/client";
import { Button } from "@calcom/ui/components/button";

// Bad - Regular import for types, barrel imports
import { User } from "@prisma/client";
import { Button } from "@calcom/ui";
```

## PR Checklist

- [ ] Title follows conventional commits: `feat(scope): description`
- [ ] Type check passes: `yarn type-check:ci --force`
- [ ] Lint passes: `yarn lint:fix`
- [ ] Relevant tests pass
- [ ] Diff is small and focused
- [ ] No secrets or API keys committed
- [ ] Created as draft PR

## When Stuck

- Ask a clarifying question before making large speculative changes
- Propose a short plan for complex tasks
- Open a draft PR with notes if unsure about approach
- Fix type errors before test failures - they're often the root cause

## Spec-Driven Development (Opt-In)

For complex features, you can use spec-driven development when explicitly requested.

**To enable:** Tell the AI "use spec-driven development" or "follow the spec workflow"

See [SPEC-WORKFLOW.md](SPEC-WORKFLOW.md) for the full workflow documentation.

## Extended Documentation

Link to other relevant agent documentation...

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
