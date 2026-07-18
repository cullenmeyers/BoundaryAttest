# Experimental benchmark-result-public-v0.1 interop fixture

This example is an experimental benchmark artifact interop fixture. It is not a production SDK, a core schema or verifier change, or a stable BoundaryAttest-wide canonicalization system.

The interop target is `public_canonical_artifact_hash`. The raw artifact's `full_artifact_hash` is byte-sensitive: it must be computed over the exact bytes of `fixture_artifact.json`, not over a parsed and reserialized object.

The raw artifact intentionally contains `runs[]`, while the `benchmark-result-public-v0.1` public canonical form intentionally excludes it. The public form contains `config` without `config.key_file` and `config.out`, plus `agg` with the profile's pinned number formatting.

This fixture exists because v0.1 left open questions about the scope of `runs[]`, recursive field-name formatting, preserving booleans, rejecting non-finite numbers, normalizing `-0`, and including `sha256:` prefixes. Matching the expected bytes and hashes with the external Python implementation is evidence that this artifact hashing rule is reproducible across languages.

That match does not prove benchmark fairness, benchmark or implementation correctness, runtime integrity, or signing authority.

From the repository root, build and run the check with:

```sh
npm run build
npm run example:benchmark-result-public-v0.1
```
