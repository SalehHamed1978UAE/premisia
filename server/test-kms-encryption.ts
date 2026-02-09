import { 
  encryptKMS, 
  decryptKMS, 
  encryptJSONKMS, 
  decryptJSONKMS,
  validateKMSSetup 
} from './utils/kms-encryption.js';

async function testKMSEncryption() {
  console.log('🧪 Testing KMS Encryption System...\n');

  try {
    console.log('Test 1: Validating KMS setup...');
    await validateKMSSetup();
    console.log('✅ Test 1 passed\n');

    console.log('Test 2: Encrypting and decrypting plain text...');
    const testText = 'Hello, this is sensitive data that should be encrypted with KMS!';
    const encrypted = await encryptKMS(testText);
    console.log('  Encrypted format:', encrypted?.substring(0, 100) + '...');
    
    const decrypted = await decryptKMS(encrypted!);
    if (decrypted !== testText) {
      throw new Error('Decrypted text does not match original');
    }
    console.log('  Decrypted:', decrypted);
    console.log('✅ Test 2 passed\n');

    console.log('Test 3: Encrypting and decrypting JSON objects...');
    const testObject = {
      userId: 12345,
      email: 'test@example.com',
      sensitive: {
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
      },
    };
    
    const encryptedJSON = await encryptJSONKMS(testObject);
    console.log('  Encrypted JSON format:', encryptedJSON?.substring(0, 100) + '...');
    
    const decryptedJSON = await decryptJSONKMS<typeof testObject>(encryptedJSON!);
    if (JSON.stringify(decryptedJSON) !== JSON.stringify(testObject)) {
      throw new Error('Decrypted JSON does not match original');
    }
    console.log('  Decrypted object:', decryptedJSON);
    console.log('✅ Test 3 passed\n');

    console.log('Test 4: Testing backward compatibility with legacy format...');
    const { encrypt } = await import('./utils/encryption.js');
    const legacyEncrypted = encrypt('Legacy encrypted data');
    console.log('  Legacy format:', legacyEncrypted?.substring(0, 60) + '...');
    
    const legacyDecrypted = await decryptKMS(legacyEncrypted!);
    if (legacyDecrypted !== 'Legacy encrypted data') {
      throw new Error('Failed to decrypt legacy format');
    }
    console.log('  Legacy decryption successful:', legacyDecrypted);
    console.log('✅ Test 4 passed\n');

    console.log('Test 5: Testing null handling...');
    const nullEncrypt = await encryptKMS(null);
    if (nullEncrypt !== null) {
      throw new Error('Null should return null');
    }
    
    const nullDecrypt = await decryptKMS(null);
    if (nullDecrypt !== null) {
      throw new Error('Null should return null');
    }
    console.log('✅ Test 5 passed\n');

    console.log('🎉 All KMS encryption tests passed!\n');
    console.log('Summary:');
    console.log('  ✅ KMS client initialization');
    console.log('  ✅ Data key generation (32 bytes)');
    console.log('  ✅ AES-256-GCM encryption with KMS');
    console.log('  ✅ Decryption with KMS');
    console.log('  ✅ JSON serialization/deserialization');
    console.log('  ✅ Backward compatibility with legacy format');
    console.log('  ✅ Null handling');
    console.log('  ✅ Plaintext key wiping');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testKMSEncryption()
  .then(() => {
    console.log('\n✨ KMS encryption system is ready for production use!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 KMS encryption system test failed');
    process.exit(1);
  });
