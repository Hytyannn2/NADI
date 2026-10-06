# NADI Codebase Audit — Unused Code, Ghost Files & Name Mismatches

**Date:** 2026-10-07
**Scope:** Entire codebase (`src/`, `supabase/migrations/`, `public/`, `scripts/`, root config), version 4.10.1 plus the uncommitted admin/RLS work
**Tools:** `tsc --noUnusedLocals --noUnusedParameters`, `knip`, then a manual check of every finding (callers, table names, env vars, localStorage keys)

---

## 1. Already fixed (no deletions needed)

| Issue | Where | Fix |
| :--- | :--- | :--- |
| Code reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but `.env.local` only defines `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `src/lib/dialect/engine.ts`, `src/app/api/bencana/sensors/route.ts` | Renamed to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| "Export Aduan" in Settings read `nadi_aduan_records`, a key nothing writes, so it always said "Tiada rekod" | `src/components/SettingsModal.tsx` | Now reads `nadi_local_potholes`, which AduanView writes |
| `/api/komuniti` ignored DB read errors (`jobsError`, `vendorsError`) | `src/app/api/komuniti/route.ts` | Errors are now logged |

> **Note:** no migration creates `nadi_jobs` or `nadi_vendors`. They only exist if someone made them in the Supabase dashboard. Add a migration for them, or confirm they exist in the live DB.

---

## 2. Corrections to migration `016_admin_audit_and_rls_gaps.sql` (not applied yet)

- [x] **Remove step 1 (whistleblower policy).** Migration `012` already dropped `nadi_whistleblower_reports`, so the leak this step targets doesn't exist in the current schema. The step does nothing.
- [x] **Drop `award_xp` instead of revoking it.** It writes to `nadi_profiles`, which migration `009` dropped, so the function is dead.

---

## 3. Removals (done 2026-10-07)

Everything below was checked first: nothing calls it. Verified afterwards with `next build` and `tsc --noUnusedLocals --noUnusedParameters`, both clean.

### 3.1 Dead files
- [x] `src/app/api/infra/analyze/route.ts`: no callers. Replaced by `/api/suara/parse` plus `/api/infra/vision`.
- [x] `src/app/api/bencana/sensors/readings/route.ts`: no callers. Replaced by `/api/bencana/sensors`.
- [x] `src/context/FamilyContext.tsx`: the localStorage XP/streak system. `useFamily` is never called. Also remove `<FamilyProvider>` and its import from `src/app/layout.tsx`, and update that file's header comment.

### 3.2 Dead code inside files
- [x] `lookup()` + `LookupResult` + `clustersOf()` + `THRESHOLD` and the `normalizePhonetic`/`computeSimilarity` import in `src/lib/dialect/engine.ts`
  - Knock-on: `normalizePhonetic`, `extractConsonantSkeleton`, `computeSimilarity` and `RULES` in `src/lib/dialect/phonetics.ts` had no other caller, so they went too. Only `levenshteinDistance` is left.
- [x] `FALLBACK_PPS_CENTERS` + `FallbackPpsCenter` in `src/data/fallbacks.ts`
- [x] `getJpsStation()` in `src/data/jpsKelantanStations.ts`
- [x] The unused re-export `export { levenshteinDistance }` in `src/lib/search/fuzzySearch.ts`
- [x] `checkInfraAnalyzeLimit` in `src/lib/rateLimit.ts`: only the dead analyze route uses it

### 3.3 Ghost UI
- [x] "Export LoRaWAN" button and `handleExportLoRaWAN` in `src/components/SettingsModal.tsx`: it reads `nadi_lorawan_records`, which nothing writes, so it has never worked

### 3.4 Unused variables
| File | Variable | Action |
| :--- | :--- | :--- |
| `src/views/BantuanView.tsx` | `locationLabel` from `useWeather()` | Remove the hook call. It runs a GPS lookup and a weather fetch for nothing |
| `src/views/BantuanView.tsx` | `filterLocation` / `setFilterLocation` | Never set, always `'all'`. Remove the state and the `matchesLoc` check |
| `src/components/SensorTrendChart.tsx` | `sensorId`, `riseRate` props | Remove from the props interface and from the caller in `BencanaView.tsx` |
| `src/app/api/suara/transcribe/route.ts` | `lastError` | Remove |
| `src/app/api/suara/parse/route.ts` | `dialectRegion` | Remove, along with `dialectRegion: 'kelantan'` in `AduanView.tsx`, which sends it |
| `src/views/AuthView.tsx` | `isMobile` param of `ParticleGlobe` | Remove |

### 3.5 Unused packages (`package.json`)
- [x] `clsx`
- [x] `fuse.js`
- [x] `tailwind-merge`
- [x] `concurrently` (dev)

### 3.6 Stale `.gitignore` lines
- [x] The `dialect-engine/*` entries: that folder doesn't exist
- [x] `neural_network_plan.md`: listed three times

---

## 4. Needs a decision

| Item | Problem | Options |
| :--- | :--- | :--- |
| `src/app/api/infra/cluster/route.ts` | The "3 devices confirm a pothole" verification is **never called** by the app. It's a pitch claim that doesn't run. **Done 2026-10-07:** connected. `PotholeDetectorContext` calls it after each insert. The route now reads lat/lng from the stored report and checks ownership. The RPC (patched in 016) counts distinct `user_id`, not client-chosen fingerprints |
| Files tracked despite `.gitignore` | `NADI - URIIS 2026.pdf`, `URIIS_2026_Final_Pitch_Deck_Template.pptx`, `PITCH_DEFENSE_PLAYBOOK.md`, `neural_network_plan.md`, `.vscode/` were committed before the ignore rule, so git still tracks them | `git rm --cached <file>` stops tracking and keeps local copies. Keep them tracked if teammates get them from the repo |

---

## 5. Checked and fine

- `public/sw.js`: registered from `src/app/layout.tsx` by string path (`knip` false positive).
- `scripts/format.check.mjs`: a runnable self-check, not dead code.
- **Database tables:** every table used in code exists in the migrations (except `nadi_jobs`/`nadi_vendors`, see §1). No code references a dropped table.
- **`public/` assets:** every image, icon and manifest is referenced.
- **localStorage keys:** consistent everywhere, apart from the two export keys above. `nadi_remembered_pass` is only ever *removed*, which is correct: it cleans up a password that old app versions stored.
- **Exports used only inside their own file** (~20, e.g. `CIVIC_CATEGORIES`, `matchJajahan`, `INITIAL_SENSOR_DATA`, plus many exported types): harmless, left alone.
- **Local tool folders:** `strix-env/`, `strix_runs/`, `.venv/`, `.kilo/`, `.agents/`, `scratch_read_com.ps1` are already git-ignored and aren't part of the codebase.

---

## 6. Env vars the code reads that `.env.local` doesn't define

These belong to optional features. Make sure they're set in Vercel if those features are used:

`TTN_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ALLOW_DEV_SIMULATION`, `ALLOW_UNAUTHENTICATED_WEBHOOK_DEV`
