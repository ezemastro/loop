# Build and Release Specification

## Purpose

Defines one reproducible path from source to a running production image. Today there are five build
paths and two of them reference a file that does not exist: root `package.json:27`
(`build:server`) and `scripts/docker-build.js:53` both pass `-f api.Dockerfile`, while the real
files are `Dockerfile.api`, `Dockerfile.web` and `Dockerfile.admin`. Both also tag
`ezemastro/loop`, which nothing consumes — `compose.yml:18,46,54` consumes
`ezemastro/loop-api`, `loop-web` and `loop-admin`, produced by three near-duplicate `publish.js`
scripts. None of the five passes `--platform`, and the deployment host is ARM64.

## Requirements

### Requirement: A Single Build Path Produces All Deployable Images

The repository MUST expose exactly one supported command that builds and publishes the API, web and
admin images. All other build entry points MUST be removed, including root `build:server`
(`package.json:27`), `scripts/docker-build.js`, `scripts/docker-push.js`, and the three per-package
`publish.js` scripts (`server/api/publish.js`, `client/publish.js`, `adminClient/publish.js`).

The build command MUST produce image names that `compose.yml` actually consumes, and MUST tag each
image with both its package version and `latest`.

The build command MUST NOT modify tracked files. `scripts/docker-build.js:43` rewrites the root
`package.json` on disk before building, and `:63-69` runs `git add package.json` followed by
`git commit`, staging and committing a release bump on top of whatever else is staged — and it does
so after the version has already been written even when the build then fails at `:60`. No
replacement may create a commit.

Build arguments MUST be passed without unquoted shell interpolation. `client/publish.js:38-39`
interpolates `EXPO_PUBLIC_API_URL` and the Google client id directly into a shell command string,
so a value containing a space or `;` breaks or injects.

#### Scenario: One command builds every deployable image

- GIVEN a clean checkout
- WHEN the single build command is invoked
- THEN images for the API, web client and admin panel are built and published, and no other build
  script is required

#### Scenario: Built image names match what production consumes

- GIVEN the build has completed
- WHEN the produced image references are compared against `compose.yml`
- THEN they are `ezemastro/loop-api`, `ezemastro/loop-web` and `ezemastro/loop-admin`, and no
  `ezemastro/loop` image is produced

#### Scenario: A failed build leaves the working tree unchanged

- GIVEN a build that fails partway through
- WHEN the working tree is inspected afterwards
- THEN no tracked file has been modified, nothing has been staged, and no commit has been created

#### Scenario: A build argument containing shell metacharacters is passed intact

- GIVEN a build argument value containing a space and a semicolon
- WHEN the build command runs
- THEN the value reaches the Docker build verbatim and no shell command is injected

### Requirement: Images Are Multi-Architecture

Every published image MUST be built for both `linux/amd64` and `linux/arm64` and published as a
multi-architecture manifest, because the production host is ARM64 while development and CI machines
are commonly x86-64. The build MUST use `docker buildx`.

Native dependencies MUST be verified present for the ARM64 variant before publication. The API
re-encodes every upload with `sharp` (`server/api/src/services/uploads.ts:44-53`), and `sharp`
distributes its native binaries as per-platform optional dependencies, so an image built by
resolving dependencies on the wrong architecture can build successfully and then fail at the first
upload.

#### Scenario: The published manifest lists both architectures

- GIVEN a published image tag
- WHEN its manifest is inspected
- THEN it advertises both `linux/amd64` and `linux/arm64`

#### Scenario: The ARM64 image can load its native image library

- GIVEN the `linux/arm64` variant of the API image
- WHEN the native image library is required inside a container from that image
- THEN it loads without error

#### Scenario: An image runs on the ARM64 host without emulation

- GIVEN the ARM64 production host
- WHEN it pulls and starts the published API image
- THEN the container starts natively and no platform-mismatch warning is emitted

### Requirement: Dependencies Are Installed Reproducibly From Committed Lockfiles

Every package MUST have a lockfile committed to the repository, and every image build MUST install
with `npm ci` rather than `npm install`.

`.gitignore:4` (`/server/**/package-lock.json`) and `server/api/.gitignore:3` both exclude the API
lockfile, so the one deployable that runs migrations and holds database credentials is the only
package whose dependency tree is not reproducible. `adminClient` has no lockfile at all.

#### Scenario: All four packages have tracked lockfiles

- GIVEN a fresh clone
- WHEN the repository is inspected
- THEN lockfiles are present and tracked for the root, `server/api`, `client` and `adminClient`

#### Scenario: An image build fails loudly on lockfile drift

- GIVEN a `package.json` whose dependencies do not match its lockfile
- WHEN the image is built
- THEN `npm ci` fails with a lockfile-mismatch error rather than silently resolving a different tree

### Requirement: Runtime Versions Are Pinned and Consistent

The repository MUST declare a single Node major version for development, build and production, via
an `.nvmrc` file and an `engines` field in each package. Today `Dockerfile.api:2,23` build on
Node 20, `Dockerfile.api:49` runs production on `node:22-alpine`, and
`.devcontainer/devcontainer.json:3` uses `node:24-bookworm`, with no `.nvmrc` and no `engines`
anywhere.

#### Scenario: Development, build and production agree on a Node major

- GIVEN `.nvmrc`, every Dockerfile stage, and the CI workflow
- WHEN their declared Node major versions are compared
- THEN they are identical

### Requirement: Deployed Images Are Traceable and Reversible

`compose.yml` MUST reference images by an immutable, version-specific tag rather than `latest`, so
that the running revision is identifiable and a previous revision can be redeployed. The deploy
procedure MUST NOT depend on `--pull always` against a mutable `latest` tag, which leaves no record
of what was actually running.

Publication of images MUST be gated on an explicit release trigger rather than happening on every
change.

#### Scenario: The running revision is identifiable

- GIVEN a running production stack
- WHEN its image references are inspected
- THEN each names a specific version, not `latest`

#### Scenario: A previous release can be redeployed

- GIVEN a release that must be rolled back
- WHEN the previous version tag is set and the stack is brought up
- THEN the earlier image is deployed without needing a rebuild

#### Scenario: Images publish only on a release tag

- GIVEN a pull request or a push that is not a version tag
- WHEN CI runs
- THEN no image is pushed to the registry

### Requirement: Obsolete Delivery Artifacts Are Removed With Evidence

Files removed by this capability MUST have no remaining references outside documentation, and the
absence of references MUST be verified and recorded at removal time.

`server/docker-compose.prod.yml` MUST be removed: it references the orphan image
`ezemastro/loop:latest` (`:16`), publishes the database port to the host (`:6-7`), and duplicates a
Caddy service (`:36-48`).

#### Scenario: Every removal is evidence-backed

- GIVEN a file scheduled for deletion
- WHEN the repository is searched for its name, excluding dependency and version-control
  directories
- THEN the only remaining matches are documentation, and that search result is recorded alongside
  the deletion

#### Scenario: No script references a missing file after cleanup

- GIVEN the repository after cleanup
- WHEN every path referenced by every npm script is resolved
- THEN each one exists
