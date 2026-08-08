# Lattice

Lattice is a private, local research library driven by Codex. The webpage collects research signals and organizes recommendations; Codex processes the profile, searches arXiv on demand, scores papers, and writes math-aware English reports.

The repository also publishes a sanitized, read-only snapshot to GitHub Pages. Raw profile submissions, uploads, local reading state, tags, notes, and the complete `research-data` directory remain on this computer.

## Start locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4310`. The server intentionally binds only to the local loopback interface. `pnpm dev` builds and serves the production application so it does not rely on a filesystem watcher.

## Workflow

1. Open **Research profile** and submit a note, arXiv link, or PDF.
2. In the Codex task named **Update research profile**, send `Process profile inbox`.
3. In **Search arXiv and generate reports**, send `Run an arXiv scan using my current profile`.
4. Refresh the webpage to browse up to five new reports.

The profile and scan skills publish the sanitized snapshot automatically after a successful local update. If a GitHub push fails, the local update remains intact and Codex reports the publishing error.

## Public dashboard

The public site is built from `public-site/data/dashboard.json`, not directly from `research-data`.

```bash
pnpm export:public
pnpm build:pages
```

After the GitHub repository is configured, this command validates the local library, regenerates only the public snapshot, commits that one file, and pushes `main`:

```bash
pnpm publish:dashboard
```

The GitHub Actions workflow deploys `public-site/out` to the stable project Pages URL. The hosted UI is read-only; use the local webpage and Codex tasks for changes.

The scan excludes every base arXiv ID already in `research-data/library.json`, only considers the preceding two years, and never fills below the 60-point score threshold.

## Local data

- `research-data/profile.json`: complete profile version history.
- `research-data/inbox/`: submitted profile update records.
- `research-data/library.json`: recommendation history and personal organization state.
- `research-data/reports/`: equation-aware report JSON.
- `research-data/activity.json`: profile and scan activity.
- `research-data/uploads/`: raw PDFs, kept on this computer and excluded from Git.

All of `research-data` is excluded from Git. Only the sanitized public snapshot is committed.

No OpenAI API key, Supabase account, database, worker, scheduler, or cloud deployment is used.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:pages
node scripts/lattice-data.mjs validate
```
