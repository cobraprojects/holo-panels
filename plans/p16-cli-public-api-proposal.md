# P16 UI publishing and synchronization CLI proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

## Scope

This proposal completes the existing `holo panels:publish-ui` command named in `plans/implementation.md`. It does not add a second command. The first invocation publishes the detected framework's editable UI source. Later invocations preview synchronization from the installed Holo Panels version and require an explicit flag before making changes.

Published UI is application-owned. Holo Panels records a synchronization baseline, but `panels:uninstall` never removes published source and no prepare, development, build, install, or upgrade operation updates it automatically.

## Exact command surface

```text
holo panels:publish-ui
holo panels:publish-ui --confirm
```

Usage:

- `holo panels:publish-ui` publishes immediately only when no publication manifest exists and every destination is absent.
- After the first publication, `holo panels:publish-ui` is preview-only. It prints the complete diff from the currently published source to the source shipped by the installed CLI package and exits without writing.
- `holo panels:publish-ui --confirm` prints the same diff and applies it only after every preflight check succeeds.
- `--confirm` is a boolean flag. A non-boolean value is invalid. It is not an overwrite or conflict-bypass flag.
- Supplying `--confirm` on the first publication is accepted but has no additional effect because new publication already requires all targets to be absent.
- Positional arguments and all other flags are rejected.

There is deliberately no `--force`, target selector, source selector, destination selector, framework selector, or interactive prompt. Framework and installed version come from the existing trusted project detection. Fixed paths keep ownership and conflict decisions deterministic.

## Source and destination

The CLI package contains the canonical editable snapshots at:

```text
publish/next/
publish/nuxt/
publish/sveltekit/
```

Each directory contains a `manifest.json` and a `src/` tree. `manifest.json` is package-owned metadata and is not copied into the application. Each manifest lists every regular source file by POSIX path relative to `src/`, with its SHA-256 checksum. Entries are sorted by path.

The detected framework maps to these fixed application-owned destinations:

| Framework | Packaged source | Application destination |
| --- | --- | --- |
| Next.js | `publish/next/src/` | `resources/panels/ui/next/` |
| Nuxt | `publish/nuxt/src/` | `resources/panels/ui/nuxt/` |
| SvelteKit | `publish/sveltekit/src/` | `resources/panels/ui/sveltekit/` |

Relative source paths are preserved below the destination. The source tree contains framework-native source and local styles needed by that source. It does not contain generated output, package manifests, lockfiles, dependencies, secrets, tests, source maps, or files outside the renderer implementation intended for application customization.

The command locates packaged source relative to its built `dist/index.mjs`, not from the current working directory or an application-controlled package path. It verifies the installed `@holo-js/panels-cli` package name and exact version using the existing exact-version rules.

## Packaged source manifest

Each `publish/<framework>/manifest.json` has this exact schema:

```json
{
  "version": 1,
  "framework": "next",
  "files": [
    {
      "path": "components/Button.tsx",
      "checksum": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ]
}
```

Rules:

- `version` is exactly `1`.
- `framework` is exactly `next`, `nuxt`, or `sveltekit` and must equal the detected framework and containing directory.
- `files` is a non-empty array sorted by `path` with no duplicates.
- `path` uses `/`, is normalized, is relative, contains no empty, `.` or `..` segment, has no NUL byte, and resolves below the framework's `src/` and application destination.
- `checksum` is a lowercase 64-character SHA-256 hexadecimal digest of the exact file bytes.
- Every listed source is an existing regular file, is not a symbolic link, and matches its checksum.
- Every regular file below `src/` must be listed. Unlisted files, directories reached through symbolic links, device files, sockets, and other special files invalidate the package.
- A source file is limited to 2 MiB and the complete source set to 32 MiB before any application write.

## Application publication manifest

The synchronization baseline is stored at:

```text
.holo-js/panels/published-ui.json
```

It has this exact version 1 schema:

```json
{
  "version": 1,
  "framework": "next",
  "source": {
    "package": "@holo-js/panels-cli",
    "version": "1.2.3"
  },
  "destination": "resources/panels/ui/next",
  "files": [
    {
      "path": "components/Button.tsx",
      "publishedChecksum": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ]
}
```

Rules:

- The top-level and nested keys shown above are the complete allowed key sets.
- `source.package` is exactly `@holo-js/panels-cli`.
- `source.version` is an exact semantic version. It records the package that supplied the current baseline; it need not equal the newly installed version during preview.
- `framework` and `destination` must be the fixed pair in the mapping table.
- `files` is sorted and unique and uses the same path and checksum validation as the packaged manifest.
- The manifest records the checksum last published by this command. It does not claim that the application file remains tool-owned.
- Unknown versions, unknown keys, malformed values, framework changes, destination changes, symbolic links in the manifest path, or duplicate paths cause a refusal before writes.
- The manifest is written atomically only after all source mutations succeed. A failed operation restores every changed file and the prior manifest.

## First publication behavior

The command performs all validation and conflict checks before creating a file:

1. Load the existing Holo project and verify the normal Holo Panels activation.
2. Detect exactly one framework with the existing descriptor/dependency rules.
3. Load and validate the matching packaged source manifest and every source checksum.
4. Verify that `.holo-js/panels/published-ui.json` does not exist.
5. Verify that every destination file is absent and that no traversed source, destination, or manifest path is a symbolic link.
6. Atomically copy all source files, preserving exact bytes.
7. Atomically write the application publication manifest with the installed CLI version and copied checksums.

An existing destination file without a valid publication manifest is unmanaged and causes the entire publication to fail. Byte equality does not permit the CLI to adopt or overwrite it. An existing publication destination directory is allowed only when none of the listed target files exists; unrelated files and directories are preserved.

No ownership header is inserted into published source because the application owns and may edit it immediately. Ownership is recorded only as a baseline in `published-ui.json`.

## Synchronization preview and diff

When a valid application publication manifest exists, the command compares three sets:

- Previous: paths and `publishedChecksum` values in `published-ui.json`.
- Local: current application files at the fixed destination.
- Incoming: paths, bytes, and checksums in the installed package's source manifest.

A local path is clean only when it is a regular non-symbolic-link file and its current checksum equals `publishedChecksum`. The complete operation is refused if any previous path is missing, has changed type, is a symbolic link, or has a different checksum. The command never tries to merge a locally edited file.

After successful preflight, preview prints one deterministic unified diff, sorted by relative path:

```diff
--- a/resources/panels/ui/next/components/Button.tsx
+++ b/resources/panels/ui/next/components/Button.tsx
@@ ... @@
...
```

Diff behavior:

- Changed clean files show normal unified hunks with three context lines and LF diff control lines. Original file bytes are not normalized when checksums are calculated.
- Incoming additions use `/dev/null` as the old path. An addition is safe only when its destination is absent. Any existing addition target is an unmanaged-file refusal, even if bytes match.
- Incoming deletions use `/dev/null` as the new path. A deletion is safe only when the local file still matches its recorded checksum.
- Binary files are not permitted in the packaged editable source. Invalid UTF-8 or NUL-containing source is rejected during package validation.
- An unchanged source set prints `[Holo Panels] Published UI is current; no changes.` and performs no write, with or without `--confirm`.
- A preview with changes ends with `[Holo Panels] Preview only. Re-run holo panels:publish-ui --confirm to apply this exact synchronization after reviewing the diff.`
- A refusal identifies every conflicting application-relative path and its reason, prints no misleading confirmation instruction, and performs no write.

The preview never updates checksums or the publication manifest.

## Confirmed synchronization

`holo panels:publish-ui --confirm` repeats source validation, local checksum validation, conflict detection, and diff computation in the same process immediately before mutation. Confirmation is all-or-nothing:

- Clean changed files are atomically replaced with exact incoming bytes.
- Safe additions are atomically created.
- Safe deletions remove only the individual previously recorded regular files. The command does not recursively delete directories; it may remove an empty destination subdirectory after verifying it contains no other entries.
- Unrelated files and directories below or outside the destination are never changed.
- The updated publication manifest replaces its source version and file list with the incoming package baseline only after all file operations succeed.
- If a write, rename, or deletion fails, the command restores every touched file and the previous manifest from in-memory byte snapshots. A restoration failure is reported together with the original error.

The command refuses the complete synchronization without mutation when:

- any previously published file has local changes or is missing;
- an incoming addition collides with any existing path;
- any relevant path is or traverses a symbolic link;
- the framework or fixed destination differs from the recorded manifest;
- either manifest is malformed or has an unsupported version;
- source bytes do not match the packaged checksum;
- source or destination path validation fails;
- the diff changed between preview and the confirmed invocation because package or local state changed.

The final item is enforced by revalidation, not by trusting a prior preview. `--confirm` means approval of the diff printed by that invocation; it never means overwrite conflicts.

## Package and build implications

`packages/cli/package.json` changes from shipping only `dist` to shipping both:

```json
{
  "files": [
    "dist",
    "publish"
  ]
}
```

The `publish/` snapshots and manifests are checked-in CLI package assets. The TypeScript bundle remains rooted at `src/index.ts`; `tsup` does not transform or copy the editable framework source. Runtime resolution from `dist/index.mjs` uses `../publish/<framework>/manifest.json`.

A package validation script runs before packing and verifies path safety, exact manifest coverage, UTF-8 text constraints, size limits, and all source checksums. Packed-package smoke tests install the tarball in an isolated project and prove that the command reads assets from the package rather than the repository checkout.

The command contribution remains in the existing default command array with:

```text
name: panels:publish-ui
usage: holo panels:publish-ui [--confirm]
```

No new exported TypeScript symbol is required. Internal implementation modules may be imported directly by isolated CLI tests but are not re-exported from `packages/cli/src/index.ts`.

## Required implementation tests after approval

Filesystem behavior tests must cover:

- command discovery and exact usage;
- each framework's fixed source/destination mapping;
- first publication and exact byte/checksum recording;
- idempotent current state;
- changed-file, addition, and deletion diffs;
- preview making no filesystem changes;
- confirmed atomic update, addition, deletion, and manifest advance;
- local edits, missing prior files, unmanaged addition collisions, malformed/tampered manifests, package checksum mismatch, traversal, duplicate paths, symlinked parents/targets, invalid UTF-8, NUL bytes, and size limits;
- rollback after injected write and deletion failures;
- preservation of unrelated and user-authored files;
- uninstall preservation of published UI and its baseline;
- packed installation source availability and public declaration stability.

Required validation is strict CLI TypeScript, ESLint with `--fix`, focused JSON-reported Vitest, the full CLI JSON-reported suite, package build, packed-package smoke tests, and final diff review.
