# Perimeter rehearsal fixtures

Without an override, the shared helper loads the nine committed fixtures here.
To load a separately prepared set, set one option **before importing the helper
or `phase2Stack.js`**:

```sh
PERIMETER_FIXTURE_DIR=/absolute/packet/fixtures <isolated test command>
```

An explicit directory never falls back to committed files. Each external fixture
must have its expected contract name, ABI and creation/runtime bytes, a full
40-character source commit, `_provenance.artifactSha256` and
`_provenance.inputSha256`, and an adjacent `<name>.artifact.json` containing the
original raw artifact bytes. Those bytes and the ABI/bytecode/reference fields
they supply must match the fixture. One repository family cannot mix source pins.
Hardhat raw artifacts may omit immutable-reference maps. The loader resolves
these fields through `MANIFEST.json` in the fixture directory, or the parent
candidate-packet directory. Hardhat artifacts require this evidence even if
someone adds an immutable-reference field to the raw file. Whenever a manifest
is present, every loaded artifact is checked against its exact artifact/input/
build-info digests, source pin and complete compiler output. Missing, malformed
or mismatched evidence refuses; neither the raw artifact nor fixture is changed.
Frozen packet inputs are checked against exact Git blobs; newer tracked checkout
files do not redefine that pin. Untracked package inputs still require contained
local bytes and sealed hashes. Installed-runtime verification remains separate.

The helper and stack share the same selected queue fixture. The other ten lending
artifacts and swap dependency in a 19-fixture candidate packet still come from
the separately selected, validated lending artifact root; this generator handles
the four core and five Zero fixtures only.

## Generate to an independent directory

```sh
node tests-onchain/perimeter/fixtures/regenerate.js \
  --perimeter /absolute/core/source \
  --zero /absolute/zero/source \
  --perimeter-artifacts /absolute/core/out \
  --zero-artifacts /absolute/zero/artifacts \
  --perimeter-commit <full-40-hex-core-pin> \
  --zero-commit <full-40-hex-zero-pin> \
  --provenance /absolute/MANIFEST.json \
  --output /absolute/new-fixtures
```

Defaults remain `out`/`artifacts` under the selected source checkouts and this
fixture directory for output. `--only perimeter` or `--only zero` selects one
whole family and refuses flags for the other. Omitted commit flags use the sealed
manifest pin, otherwise the source HEAD. Branch names are checkout labels; the
full commit is authoritative. For generation, older pins are accepted only when every compiler
source still matches both its exact Git blob and the current checkout. All
source checkouts must have clean tracked state.

Native Hardhat `.dbg.json` references and complete Foundry `build-info` are
supported. Metadata-only Foundry records cannot establish provenance and refuse;
supply the full proof through `--provenance`. Compiler inputs require embedded
source contents. Gitlink sources are checked at the parent pin's Gitlink commit.
Untracked scoped-package/Hardhat dependency inputs additionally require sealed
source hashes; their digest evidence is not an independent package-tarball audit.
Source and Gitlink reads must remain within the canonical source checkout.

All selected inputs are validated before any directory creation or fixture write.
Selected symlink output directories, symlink files and multiply linked output
files are refused; existing parent directories are canonicalized. Explicit external output also
copies the original `.artifact.json` files and emits a `MANIFEST.json`; default
output adds neither. The generated manifest references the original complete
build-info files and canonical source roots, which must remain available. The
output directory is not a self-contained compiler-proof archive. Updating one
family with `--only` preserves the other family's existing manifest evidence.
Generated provenance records the full pin, artifact/build-info/input SHA256,
compiler version and `generatedAt` as an ISO UTC `Z` timestamp. Source fixture
notes are retained; the obsolete template pin-date field is omitted.

## Provenance manifest

The existing candidate `MANIFEST.json` format is accepted; no new packet layout
is required. For each selected family it must contain:

- `pins.core` / `pins.zero`: full source commits.
- `roots[]`: `name` (`core` or `zero`) and the exact canonical source `canonical`.
- `fixtures[]`: `filename`, compiled contract `name`, `repo`, `sourceCommit`,
  `artifactFile`, `artifactSha256`, `sourceProof`, `sourceInputSha256`.
- `sourceChecks[]`: `name`, `buildInfoFile`, `buildInfoSha256`, `inputSha256`,
  and complete `sources[]` entries `{source, sha256}`.

`sourceProof` selects exactly one compiler proof by its raw-file SHA256.
`inputSha256` is SHA256 of `JSON.stringify(parsedBuildInfo.input)`, preserving
the recorded input object order. The build-info file must include complete
`input` and `output`; booleans claiming a source check passed are not evidence.
Artifact paths must match the fixed fixture targets within the selected artifact
root. ABI, full creation/runtime bytecode, link/immutable maps, metadata source
hashes and declared compiler settings are checked against compiler output.
Omitted settings are compared using compiler defaults; the default EVM targets
for Solidity 0.8.20 and 0.6.11 are supported. Other versions require an explicit
`evmVersion`. The fixtures support the standard CBOR-appending metadata policy;
`appendCBOR: false` refuses. Metadata hash and literal-content policy must match.
Verify the sealed manifest's own digest using the producer's trusted handoff.
This validates producer evidence and source consistency; it does not independently
recompile a potentially fabricated compiler output. Validation failures precede
all writes; an I/O failure during publication may leave partial output.

Focused tests, with no provider access or secret loaders:

```sh
node --test tests-onchain/perimeter/fixtures/fixtures.unit.test.js
PERIMETER_TEST_PACKET=/absolute/packet/fixtures \
  node --test tests-onchain/perimeter/fixtures/fixtures.unit.test.js
```

These checks do not execute governance or establish release clearance. A replay
must consume the chosen packet and compare actual installed runtimes with its
sealed artifacts, resolved links and constructor immutables.
