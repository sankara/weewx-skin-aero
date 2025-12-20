---
description: Auto-infer version bump (Minor/Patch), update changelog, and push release tag
---

1. **Commit Changes**
    * Commit any changes that haven't been committed with an appropriate commit message with the conventional format.

2. **Get Context**:
    * Current Version: Read `version` from `pyproject.toml`.
    * **README & Packaging**: Note that `uv run aero-bump` automatically updates the versioned download link in `README.md`. Also, `uv run aero-package` generates both a versioned zip (e.g., `weewx-aero-v1.4.0.zip`) and a generic `weewx-aero.zip` to support stable "latest" links.
    * Git Log & Last Tag:
      ```bash
      git log $(git describe --tags --match "v*" --abbrev=0)..HEAD --pretty=format:"- %s"
      ```

3. **Analyze & Infer**:
    * **Scan the log**:
        * If it contains "BREAKING CHANGE" or `!:` -> **STOP**. Ask the user if they want to bump the MAJOR version. Do
          not proceed automatically.
        * If it contains `feat:` -> **MINOR** bump.
        * Otherwise (fix, chore, docs, etc.) -> **PATCH** bump.
    * **Calculate**: Compute the new version number based on the current version and the inferred bump type.

4. **Execute Release**:
    * **Bump**: Run `uv run aero-bump <new_version>` (updates `pyproject.toml`).
    * **Lock**: Run `uv lock` to synchronize `uv.lock` with the new version.
    * **Summarize**: Create a concise, categorized release note from the git log (e.g., "## Features", "## Fixes").
    * **Changelog**: Prepend the summarized release notes to `CHANGELOG.md` under a new `## [<new_version>] - <YYYY-MM-DD>` header.
    * **Commit**:
      ```bash
      git commit -am "chore: release v<new_version>"
      ```
    * **Tag**:
      ```bash
      git tag -s v<new_version> -m "<summarized_release_notes>"
      ```
    * **Push**:
      ```bash
      git push origin v<new_version> && git push origin trunk
      ```
