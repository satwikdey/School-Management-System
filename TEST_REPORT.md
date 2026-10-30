# v2 assessment-integrity and revision verification report

## Final result

Completed on **30 October 2026**. The five confirmed assessment defects are fixed, immutable published-result revisions are implemented, and the administrator correction workflow is operational. Existing Laravel v1 files and data were not changed by this work.

| Check | Final result |
| --- | --- |
| TypeScript | Passed with 0 errors |
| ESLint | Passed with 0 warnings/errors |
| Production build | Passed; all 20 App Router entries generated |
| Unit and normal database integration suite | 27 passed; isolated concurrency test skipped unless its disposable database URL is supplied |
| Isolated simultaneous-publication test | 1 passed; exactly one publisher created revision 2 and the competing request received `STALE_EXAM_DRAFT` |
| Playwright end-to-end suite | 24 passed: 12 scenarios on desktop and mobile |
| Existing-database migration | Passed after a read-only preflight and backup |
| Fresh isolated migration and seed | All 8 migrations and the isolated seed passed |

## Implemented corrections

### Marks and calculation integrity

- Unsaved and cleared cells are `MISSING` with a null score; an explicitly entered `0` remains `PRESENT` and valid.
- The marks action validates UUIDs, statuses, finite nonnegative values, and no more than two decimal places with Zod.
- The transactional PostgreSQL write validates the complete roster/component matrix, exam relationships, component maximum, status/score combination, and draft identifier. Any invalid row rolls back the complete subject submission.
- Direct authenticated writes are protected by the same enrollment, subject, component, configuration, term, class, year, roster, and score-bound trigger.
- Both TypeScript and PostgreSQL calculations require component minima, overall subject threshold, and a passing grade band. Absence contributes zero; mandatory missing marks block publication; untouched optional components do not independently fail a student.
- Component lists and snapshots include only shared components and components belonging to the selected exam term.

### Frozen configurations and compatible exams

- An assessment configuration is locked as soon as an exam references it.
- Locked configuration rules, terms, components, and grade bands cannot be edited, deleted, reassigned, or unlocked. Administrative name/description/active metadata remains editable.
- The existing clone RPC creates an unlocked new version and remaps cloned components to the cloned term identifiers.
- The exam form now filters configurations by class/year and terms by configuration, clearing dependent selections when a parent changes.
- Server validation and a database trigger reject an unassigned or mismatched class/year/configuration/term combination.

### Immutable result revisions and corrections

- Every exam has at most one active draft and an explicit current published revision.
- Initial publication creates revision 1. Only administrators can open a correction, publish a later revision, or discard a correction.
- Opening a correction requires a reason and restores the current immutable revision into a new working draft while preserving the original published roster and assessment version.
- Teachers may edit assigned marks and comments in an open draft. All mutations carry the draft ID, and stale forms cannot modify a later draft.
- Publication serializes on the exam row, recalculates the entire cohort/ranks, freezes complete marks, results, comments, skills, rules, school/student details, annual figures, and source-term revision IDs, then advances the current revision.
- Published snapshot tables reject updates/deletes at the database layer and use restrictive foreign keys. Legacy unpublish requests are rejected.
- Students and parents read only immutable snapshots. An open correction remains staff-only while the current published revision stays visible.
- Revision history shows publication time, reason, and current/superseded status. Report-card and tabulation PDFs accept an optional `revisionId` and render only the selected immutable snapshot.
- Result-PIN, student/parent ownership, and teacher class-assignment checks apply to every historical revision.

## Migration and data preservation

- Created `backups/v2_pre_assessment_revisions.dump` before applying the revision migrations.
- The preflight found 0 invalid scores, 0 incompatible exams, 0 missing published snapshots, and 0 snapshot-total mismatches.
- The existing published exam was imported as revision 1 without recalculation. Its three student snapshots retain the stored totals and original publication metadata.
- Existing zero scores were preserved as zero; no attempt was made to infer whether historical zeroes had originally been blanks.
- Final main-database check: 1 published revision, 3 immutable student snapshots, 0 invalid scores, and no open correction. The seeded Term II exam remains an ordinary initial working draft.
- A separate disposable database was bootstrapped, migrated through all 8 migrations, seeded in external-service-safe isolated mode, used for the concurrent-publication test, and removed afterward.

## Regression coverage

Automated coverage now includes:

- blank versus explicit zero, score boundaries, excessive precision, invalid status/payloads, and full mixed-batch rollback;
- component minima, optional missing components, absence, grade bands, shared ranks, and multi-term weighting;
- locked parents and child rules, clone remapping, and mismatched exam selectors;
- revision 1 immutability after revision 2, stable correction roster, stale saves, discard/restore, and direct snapshot/publication-state mutation rejection;
- simultaneous publication, correction privacy during editing, parent ownership, result-PIN access, and current/historical PDF endpoints;
- desktop and mobile role workflows for administrators, teachers, parents, students, accountants, and librarians.

Run the final checks from `v2/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

The isolated concurrency test is opt-in so normal tests never create a permanent revision in the demo database:

```powershell
$env:REVISION_TEST_DATABASE_URL='<disposable-local-database-url>'
npm.cmd test -- tests/integration/revision-concurrency.test.ts
```
