# Public Repository Publication Instructions

## T-010 artifact handoff

This artifact includes the closed teaching Lab, eight synthetic user logins with
separate club attributes, session trace history and same-site simulated HTTP
receipts in V4–V6. Preserve demo-sinks/analytics.json and ads.json at each version's
relative path; these are static simulations, not vendor services.
Before a new live V5/V6 smoke, update all four canonical Apps Script files from
the private source, run additive setupClassroom and version the existing Web App,
keeping the same /exec and Sheet columns. Four club decision rows are added;
HOME prioritizes recovery over club over running. The prior T-009 human smoke
does not establish post-T010 readiness. Publication is manual; no Google evidence
is generated or claimed by this artifact. Follow the private T010 validation guide.

This repository is a **generated publication artifact** for the Bondlabs MarTech Sandbox.

The private source repository remains the source of truth. Do not treat this public repository as a second development source.

## Goal

Publish the static files in this repository with GitHub Pages and verify the real public URL.

## Rules

- Keep the exported site structure at repository root.
- Do not redesign or refactor V1–V6.
- Only make publication-path fixes if required.
- Do not add analytics, tracking, vendor SDKs, secrets or unrelated infrastructure.
- Do not copy private docs, tasks, teacher tooling or validation history into this repository.

## GitHub Pages

Prefer the simplest supported setup:

1. deploy from `main` and repository root if GitHub exposes that option for this public repository;
2. otherwise add/use the official GitHub Pages Actions workflow.

After publication, verify the actual public URL.

## Smoke test

Check at least:

- landing page;
- V1–V6 entry routes;
- CSS and JavaScript;
- catalogs;
- local SVG product images;
- representative catalog → product → cart navigation;
- V6 standard/fallback experience when live activation is unavailable;
- no 404s caused by project-subpath hosting.

Report the final Pages URL and any publication-only change required.

## T-009 classroom refresh

This export includes an optional **Traza docente** Console toggle in V2–V6 and
local `js/classroom-config.js` copies. V1 has only contextual help, no trace/tracking. The same public /exec
URL, when provisioned/configured in the private source, serves all collectors and
V6 activation. Empty configuration runs offline with the V6 static snapshot.
Do not insert credentials or configure five separate services in this artifact.

Refresh by copying the complete regenerated export from the private source,
including the configuration scripts; this is a manual publication step.
Tests in the private repository do not prove real Google provisioning. Do not
claim CLASSROOM_READY merely from successful publication or an opaque POST.
The teacher must correlate IDs with actual Sheet rows and validate a live V6
decision using the private canonical provisioning guide/evidence record.

The current T-009 refresh includes the teacher-provided real /exec URL. Its
health check passed on 2026-10-09, but actual published-site/Sheet smoke is pending.
Copy the complete artifact, publish and report the actual Pages URL and commit.
Preserve the supplied configuration and distinguish health from received event
rows. CLASSROOM_READY still requires the remaining end-to-end evidence.

This refresh also contains local “Cómo probar esta versión” dialogs in V1–V6,
four synthetic groups in V5/V6 and V6 home/cart/confirmation activation.
The real /exec URL is unchanged. **The teacher must update all four canonical
classroom .gs files, run setupClassroom and redeploy a new version of the existing
Web App before publication.** The four-column decision Sheet is preserved; setup
adds missing decision IDs without overwriting teacher edits. The new read contract
requires surface and echoes it in the callback. An old deployment stays standard.
This artifact cannot update Google. Report pending final human smoke, including
group isolation and live surface decisions; never claim CLASSROOM_READY here.
