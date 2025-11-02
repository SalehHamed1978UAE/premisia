import crypto from 'crypto';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

export interface EncryptedPayload {
  dataKeyCiphertext: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

let kmsClient: KMSClient | null = null;

function getKMSClient(): KMSClient {
  if (!kmsClient) {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured. Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    }

    kmsClient = new KMSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log('✅ KMS client initialized for region:', region);
  }

  return kmsClient;
}

function getKMSKeyId(): string {
  const keyId = process.env.PREMISIA_KMS_KEY_ID;
  
  if (!keyId) {
    throw new Error('PREMISIA_KMS_KEY_ID environment variable not set');
  }
  
  return keyId;
}

export async function generateDataKey(): Promise<{ plaintextKey: Buffer; encryptedKey: Buffer }> {
  try {
    const client = getKMSClient();
    const keyId = getKMSKeyId();

    const command = new GenerateDataKeyCommand({
      KeyId: keyId,
      KeySpec: 'AES_256',
    });

    const response = await client.send(command);

    if (!response.Plaintext || !response.CiphertextBlob) {
      throw new Error('KMS GenerateDataKey returned incomplete response');
    }

    const plaintextKey = Buffer.from(response.Plaintext);
    const encryptedKey = Buffer.from(response.CiphertextBlob);

    if (plaintextKey.length !== KEY_LENGTH) {
      throw new Error(`Generated data key has invalid length: ${plaintextKey.length} (expected ${KEY_LENGTH})`);
    }

    return { plaintextKey, encryptedKey };
  } catch (error) {
    console.error('❌ KMS GenerateDataKey failed:', error);
    throw new Error(`Failed to generate data key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function encryptWithDataKey(plaintext: string, dataKey: Buffer): EncryptedPayload {
  try {
    if (dataKey.length !== KEY_LENGTH) {
      throw new Error(`Invalid data key length: ${dataKey.length} (expected ${KEY_LENGTH})`);
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();

    return {
      dataKeyCiphertext: '',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
    };
  } catch (error) {
    console.error('❌ Encryption with data key failed:', error);
    throw new Error(`Failed to encrypt with data key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function decryptDataKey(encryptedKey: Buffer): Promise<Buffer> {
  try {
    const client = getKMSClient();

    const command = new DecryptCommand({
      CiphertextBlob: encryptedKey,
    });

    const response = await client.send(command);

    if (!response.Plaintext) {
      throw new Error('KMS Decrypt returned no plaintext');
    }

    const plaintextKey = Buffer.from(response.Plaintext);

    if (plaintextKey.length !== KEY_LENGTH) {
      throw new Error(`Decrypted data key has invalid length: ${plaintextKey.length} (expected ${KEY_LENGTH})`);
    }

    return plaintextKey;
  } catch (error) {
    console.error('❌ KMS Decrypt failed:', error);
    throw new Error(`Failed to decrypt data key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function decryptWithKMS(payload: EncryptedPayload): Promise<string> {
  let dataKey: Buffer | null = null;
  
  try {
    const encryptedKey = Buffer.from(payload.dataKeyCiphertext, 'base64');
    dataKey = await decryptDataKey(encryptedKey);

    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('❌ Decryption with KMS failed:', error);
    throw new Error(`Failed to decrypt with KMS: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (dataKey) {
      dataKey.fill(0);
      dataKey = null;
    }
  }
}

function isKMSEncryptedFormat(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'dataKeyCiphertext' in parsed &&
      'iv' in parsed &&
      'authTag' in parsed &&
      'ciphertext' in parsed
    );
  } catch {
    return false;
  }
}

function isLegacyEncryptedFormat(data: string): boolean {
  const parts = data.split(':');
  if (parts.length !== 3) return false;
  
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    
    return iv.length === IV_LENGTH && authTag.length > 0 && encrypted.length > 0;
  } catch {
    return false;
  }
}

export async function encryptKMS(text: string | null | undefined): Promise<string | null> {
  if (!text) return null;
  
  let plaintextKey: Buffer | null = null;
  
  try {
    const { plaintextKey: key, encryptedKey } = await generateDataKey();
    plaintextKey = key;

    const payload = encryptWithDataKey(text, plaintextKey);
    payload.dataKeyCiphertext = encryptedKey.toString('base64');

    return JSON.stringify(payload);
  } catch (error) {
    console.error('❌ KMS encryption failed:', error);
    throw new Error(`Failed to encrypt with KMS: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (plaintextKey) {
      plaintextKey.fill(0);
      plaintextKey = null;
    }
  }
}

export async function decryptKMS(encryptedData: string | null | undefined): Promise<string | null> {
  if (!encryptedData) return null;

  if (isKMSEncryptedFormat(encryptedData)) {
    try {
      const payload: EncryptedPayload = JSON.parse(encryptedData);
      return await decryptWithKMS(payload);
    } catch (error) {
      console.error('❌ KMS decryption failed:', error);
      throw error;
    }
  }

  if (isLegacyEncryptedFormat(encryptedData)) {
    console.warn('⚠️  Legacy encryption format detected. This data should be re-encrypted with KMS.');
    const { decrypt } = await import('./encryption.js');
    return decrypt(encryptedData);
  }

  console.warn('⚠️  Unencrypted data detected, returning as-is');
  return encryptedData;
}

export async function encryptJSONKMS(obj: any): Promise<string | null> {
  if (!obj) return null;
  return encryptKMS(JSON.stringify(obj));
}

export async function decryptJSONKMS<T>(encryptedData: string | null): Promise<T | null> {
  if (!encryptedData) return null;
  
  const decrypted = await decryptKMS(encryptedData);
  if (!decrypted) return null;
  
  try {
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('❌ Error parsing decrypted JSON:', error);
    return null;
  }
}

export async function validateKMSSetup(): Promise<void> {
  try {
    const client = getKMSClient();
    const keyId = getKMSKeyId();
    
    console.log('🔐 Validating KMS setup...');
    console.log('  Region:', process.env.AWS_REGION);
    console.log('  Key ID:', keyId);

    const testData = 'kms-encryption-test';
    const encrypted = await encryptKMS(testData);
    
    if (!encrypted) {
      throw new Error('Encryption returned null');
    }

    const decrypted = await decryptKMS(encrypted);
    
    if (decrypted !== testData) {
      throw new Error('Encryption/decryption cycle did not match');
    }
    
    console.log('✅ KMS encryption validated successfully');
  } catch (error) {
    console.error('❌ KMS validation failed:', error);
    throw error;
  }
}
