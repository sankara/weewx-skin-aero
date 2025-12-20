---
description: Auto-infer version bump (Minor/Patch), update changelog, and push release tag
---

1. **Commit Changes**
    * Commit any changes that haven't been committed with an appropriate commit message with the conventional format.

2. **Get Context**:
    * Current Version: Read `version` from `pyproject.toml`.
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
    * **Commit**:
      ```bash
      git commit -am "chore: release v<new_version>"
      ```
    * **Summarize**: Create a concise, categorized release note from the git log (e.g., "## Features", "## Fixes").
    * **Tag**:
      ```bash
      git tag -s v<new_version> -m "<summarized_release_notes>"
      ```
    * **Push**:
      ```bash
      git push origin v<new_version>
      ```
