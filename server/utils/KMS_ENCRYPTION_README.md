# AWS KMS Envelope Encryption System

## Overview

This module implements AWS KMS-based envelope encryption for zero-knowledge data protection. Each record gets its own unique data key encrypted by AWS KMS, providing superior security compared to single-key encryption.

## Architecture

### Envelope Encryption Flow

**Encryption:**
1. Generate a unique 32-byte data key via KMS `GenerateDataKey` API
2. Encrypt plaintext with the data key using AES-256-GCM
3. KMS returns both the plaintext data key and encrypted data key
4. Store the encrypted data key alongside the ciphertext
5. Zero/wipe the plaintext data key from memory

**Decryption:**
1. Extract the encrypted data key from the payload
2. Call KMS `Decrypt` API to recover the plaintext data key
3. Use the plaintext data key to decrypt the ciphertext
4. Zero/wipe the plaintext data key from memory

### Storage Format

**New KMS Format (JSON):**
```json
{
  "dataKeyCiphertext": "base64-encoded-encrypted-data-key",
  "iv": "base64-encoded-16-byte-iv",
  "authTag": "base64-encoded-auth-tag",
  "ciphertext": "base64-encoded-ciphertext"
}
```

**Legacy Format (backward compatible):**
```
iv:authTag:ciphertext
```

## API Reference

### Core Functions

#### `encryptKMS(text: string): Promise<string | null>`
High-level encryption function that handles the complete envelope encryption flow.

**Example:**
```typescript
import { encryptKMS } from './utils/kms-encryption';

const encrypted = await encryptKMS('sensitive data');
// Returns: JSON-serialized EncryptedPayload
```

#### `decryptKMS(encryptedData: string): Promise<string | null>`
High-level decryption function with automatic format detection.

**Example:**
```typescript
import { decryptKMS } from './utils/kms-encryption';

const decrypted = await decryptKMS(encrypted);
// Returns: 'sensitive data'
```

#### `encryptJSONKMS(obj: any): Promise<string | null>`
Encrypts JavaScript objects by serializing to JSON first.

**Example:**
```typescript
import { encryptJSONKMS } from './utils/kms-encryption';

const user = { id: 123, email: 'user@example.com' };
const encrypted = await encryptJSONKMS(user);
```

#### `decryptJSONKMS<T>(encryptedData: string): Promise<T | null>`
Decrypts and deserializes JSON objects with type safety.

**Example:**
```typescript
import { decryptJSONKMS } from './utils/kms-encryption';

interface User {
  id: number;
  email: string;
}

const user = await decryptJSONKMS<User>(encrypted);
// Returns: { id: 123, email: 'user@example.com' }
```

### Low-Level Functions

#### `generateDataKey(): Promise<{ plaintextKey: Buffer; encryptedKey: Buffer }>`
Calls KMS GenerateDataKey API to create a new 32-byte AES-256 data key.

#### `encryptWithDataKey(plaintext: string, dataKey: Buffer): EncryptedPayload`
Encrypts data using AES-256-GCM with a provided data key.

#### `decryptDataKey(encryptedKey: Buffer): Promise<Buffer>`
Calls KMS Decrypt API to recover the plaintext data key.

#### `decryptWithKMS(payload: EncryptedPayload): Promise<string>`
Decrypts a complete encrypted payload using KMS.

#### `validateKMSSetup(): Promise<void>`
Validates KMS configuration by performing a complete encrypt/decrypt cycle.

## Environment Variables

Required environment variables:

```bash
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
PREMISIA_KMS_KEY_ID=arn:aws:kms:eu-north-1:369862962223:key/6d647a22-e3ce-440a-82e0-dd5862202f7c
```

## Security Features

1. **Envelope Encryption:** Each record uses a unique data key
2. **AES-256-GCM:** Authenticated encryption with integrity protection
3. **KMS Integration:** Master keys never leave AWS KMS
4. **Memory Safety:** Plaintext keys are zeroed after use
5. **Backward Compatibility:** Safely handles legacy encrypted data

## Migration from Legacy Encryption

The system automatically detects and handles legacy encryption format:

```typescript
// Legacy data encrypted with old system
const legacyEncrypted = "iv:authTag:ciphertext";

// decryptKMS automatically detects format
const decrypted = await decryptKMS(legacyEncrypted);
// ⚠️  Logs warning: "Legacy encryption format detected"
```

To migrate data, simply:
1. Decrypt using `decryptKMS()` (handles both formats)
2. Re-encrypt using `encryptKMS()` (uses new KMS format)

## Error Handling

All functions include comprehensive error handling:

- Missing AWS credentials → Clear error message
- KMS API failures → Detailed logging
- Invalid data formats → Graceful degradation
- Null/undefined inputs → Safe handling

## Testing

Run the test suite:

```bash
npx tsx server/test-kms-encryption.ts
```

Test coverage:
- ✅ KMS client initialization
- ✅ Data key generation (32 bytes)
- ✅ AES-256-GCM encryption with KMS
- ✅ Decryption with KMS
- ✅ JSON serialization/deserialization
- ✅ Backward compatibility with legacy format
- ✅ Null handling
- ✅ Plaintext key wiping

## Performance Considerations

- Each encryption/decryption requires a KMS API call
- KMS has rate limits (varies by region)
- Consider caching strategies for frequently accessed data
- Use batch operations when possible

## Best Practices

1. **Always use high-level functions** (`encryptKMS`, `decryptKMS`) unless you have specific needs
2. **Validate KMS setup** on application startup
3. **Monitor KMS costs** - each API call is billable
4. **Rotate KMS keys** according to your security policy
5. **Handle errors gracefully** - don't expose encryption details to users

## Implementation Details

- **Algorithm:** AES-256-GCM
- **Data Key Size:** 32 bytes (256 bits)
- **IV Size:** 16 bytes (128 bits)
- **Auth Tag:** Automatically generated by GCM mode
- **SDK:** @aws-sdk/client-kms v3

## License

Part of the Premisia application - all rights reserved.
