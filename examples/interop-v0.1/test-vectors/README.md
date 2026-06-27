# Interop v0.1 test vectors

- `valid-receipt.json` with `public-key.pem`: expected pass
- `tampered-claim.json` with `public-key.pem`: expected `invalid_signature`
- `valid-receipt.json` with `wrong-public-key.pem`: expected `public_key_id_mismatch`
- `unsupported-version.json` with `public-key.pem`: expected `unsupported_version`
- `missing-required-field.json` with `public-key.pem`: expected `missing_claim_field:status`

The keys and receipts are static demo material. No private key is included.
