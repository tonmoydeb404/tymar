#!/usr/bin/env node
// @ts-check
/**
 * Composes the GitHub release body and the Tauri updater notes from the
 * changelog entry in apps/web/src/content/changelog.ts.
 *
 * `changelog.ts` is the editorial source for release notes: when you tag,
 * the entry for that version must already exist there (release-tag-sync
 * enforces it). This script reads it with Node's native type stripping,
 * so no transpile step is needed.
 *
 * Outputs:
 *   1. Release body (markdown): curated summary + highlights on top, with
 *      GitHub's auto-generated "What's Changed" (PR list) preserved below.
 *   2. Updater notes (plain text): the same entry shaped for the update
 *      dialog — no markdown, no links. `latest.json` notes are user-facing,
 *      so they must stay compact and readable.
 *
 * Usage:
 *   node scripts/compose-release-notes.mjs <tag> <current-body.md> <release-body.md> <updater-notes.txt>
 *
 * Falls back to mirroring the existing release body when no entry exists
 * (old tags re-runs) so the job never fails the release over a note.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [tag, currentBodyPath, releaseBodyPath, updaterNotesPath] =
  process.argv.slice(2);

if (!tag || !currentBodyPath || !releaseBodyPath || !updaterNotesPath) {
  console.error(
    "Usage: node scripts/compose-release-notes.mjs <tag> <current-body.md> <release-body.md> <updater-notes.txt>",
  );
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const entryPattern = new RegExp(
  `^v${version.replace(/\./g, "\\.")}(\\s|—|$)`,
);

const { changelog } = await import(
  new URL("../apps/web/src/content/changelog.ts", import.meta.url).href
);

const entry = changelog.find((e) => entryPattern.test(e.version));
const currentBody = readFileSync(currentBodyPath, "utf8").trim();

if (!entry) {
  // No curated entry (e.g. re-running an old tag): keep the auto-generated
  // body and mirror it into the manifest so notes are never empty.
  writeFileSync(releaseBodyPath, `${currentBody}\n`);
  writeFileSync(updaterNotesPath, currentBody);
  console.log(
    `No changelog entry for ${tag} in apps/web/src/content/changelog.ts — using the existing release body for both.`,
  );
  process.exit(0);
}

const curated = [
  `## ${entry.version}`,
  "",
  entry.summary,
  "",
  "### Highlights",
  ...entry.highlights.map((h) => `- ${h}`),
].join("\n");

// GitHub release page: curated notes + GitHub's PR list / compare footer.
writeFileSync(releaseBodyPath, `${curated}\n\n---\n\n${currentBody}\n`);

// Updater dialog: plain text only — macOS renders markdown symbols literally.
const updaterNotes = [
  entry.version,
  "",
  entry.summary,
  "",
  ...entry.highlights.map((h) => `• ${h}`),
].join("\n");
writeFileSync(updaterNotesPath, `${updaterNotes}\n`);

console.log(
  `Composed notes for ${entry.version} (release body ${releaseBodyPath}, updater notes ${updaterNotesPath}).`,
);
