# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` Next.js App Router; `src/app/api/*` contains route handlers (auth, predictions, r2, webhooks).
- `src/backend/` domain logic: `models/`, `service/`, `config/`, `sql/init.sql` for schema bootstrap.
- `src/components/` UI (landing, layout, replicate workers, pricing); `src/providers/`, `src/contexts/` app state.
- `src/config/` app settings; `messages/` i18n; `public/` static assets.

## Build, Test, and Development Commands
- `npm run dev` Start local dev server on port 3000.
- `npm run build` Production build (Next.js); `npm run start` serve built app.
- `npm run build:prod` Force production env build.
- `npm run lint` TypeScript + ESLint checks.
- `npm run postbuild` Generate sitemap after build.
- Database: `psql -U <user> -d <db> -f src/backend/sql/init.sql` to initialize schema.

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode). Indentation: 2 spaces; semicolons optional (follow existing files).
- Components: PascalCase exports; filenames kebab-case (e.g., `img-output.tsx`). Folders kebab-case.
- API routes use descriptive folders (e.g., `app/api/predictions/text_to_image`).
- Imports: prefer alias `@/*` (see `tsconfig.json`). Run `npm run lint` before PRs.
- Styling: Tailwind CSS; keep utility classes readable (group by function) and avoid deep inline duplication.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Place tests next to source or under `__tests__/`; name as `*.test.ts(x)`.
- Aim for critical-path coverage: API route handlers, services, and pricing/credits flows.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `perf:`. Scope optional (e.g., `feat(api): add text-to-image endpoint`).
- PRs include: summary, rationale, screenshots (UI), affected routes, migration notes (`sql/init.sql` changes), and any new env vars.
- Link issues. Keep PRs focused and under ~400 LOC when possible.

## Security & Configuration Tips
- Secrets live in `.env.local` (dev) and platform env (prod). Never commit secrets.
- Required env keys: NextAuth (`NEXTAUTH_SECRET`), Google OAuth, Replicate, Stripe, PostgreSQL, and S3/R2.
- Validate Stripe webhooks in prod; review S3/R2 bucket policies; use parameterized queries via `pg`.
