import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }
  
  try {
    return Buffer.from(key, 'base64');
  } catch (error) {
    throw new Error('Invalid ENCRYPTION_KEY format. Must be base64 encoded.');
  }
}

export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decrypt(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null;
  
  if (!isEncrypted(encryptedData)) {
    return encryptedData;
  }
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      console.warn('Invalid encrypted data format - returning as-is (backward compatibility)');
      return encryptedData;
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

export function encryptJSON(obj: any): string | null {
  if (!obj) return null;
  return encrypt(JSON.stringify(obj));
}

export function decryptJSON<T>(encryptedData: string | null): T | null {
  if (!encryptedData) return null;
  
  const decrypted = decrypt(encryptedData);
  if (!decrypted) return null;
  
  try {
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error parsing decrypted JSON:', error);
    return null;
  }
}

export function isEncrypted(data: string | null | undefined): boolean {
  if (!data) return false;
  
  const colonCount = (data.match(/:/g) || []).length;
  return colonCount === 2 && data.split(':').every(part => part.length > 0);
}

export function validateEncryptionKey(): void {
  try {
    const key = getEncryptionKey();
    
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (256 bits). Current length: ${key.length}`);
    }
    
    const testData = 'encryption-test';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted!);
    
    if (decrypted !== testData) {
      throw new Error('Encryption key validation failed - encrypt/decrypt cycle did not match');
    }
    
    console.log('✅ Encryption key validated successfully');
  } catch (error) {
    console.error('❌ Encryption key validation failed:', error);
    throw error;
  }
}
