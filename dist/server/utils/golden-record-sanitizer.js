import { encryptJSONKMS } from './kms-encryption.js';
/**
 * Sensitive field patterns to redact from payloads
 */
const SENSITIVE_PATTERNS = {
    // Auth & Secrets
    tokens: ['token', 'authorization', 'auth', 'bearer', 'jwt', 'session'],
    apiKeys: ['api_key', 'apikey', 'api-key', 'secret', 'password', 'pwd'],
    // Personal Data
    pii: ['email', 'phone', 'ssn', 'social_security', 'credit_card', 'address'],
    // Business Sensitive
    business: ['revenue', 'profit', 'salary', 'compensation', 'pricing_strategy'],
};
/**
 * Check if a field name matches any sensitive pattern
 */
function isSensitiveField(fieldName) {
    const lowerField = fieldName.toLowerCase();
    const allPatterns = [
        ...SENSITIVE_PATTERNS.tokens,
        ...SENSITIVE_PATTERNS.apiKeys,
        ...SENSITIVE_PATTERNS.pii,
        ...SENSITIVE_PATTERNS.business,
    ];
    return allPatterns.some(pattern => lowerField.includes(pattern));
}
/**
 * Sanitize a single object by redacting sensitive fields
 */
function sanitizeObject(obj, depth = 0) {
    // Prevent infinite recursion
    if (depth > 10)
        return '[REDACTED: MAX_DEPTH]';
    if (obj === null || obj === undefined)
        return obj;
    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }
    // Handle plain objects
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value, depth + 1);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    return obj;
}
/**
 * Sanitize request payload before storing in golden record
 * Redacts auth tokens, API keys, and other sensitive data
 */
export function sanitizeRequestPayload(payload) {
    if (!payload)
        return null;
    const sanitized = sanitizeObject(payload);
    // Remove common auth headers
    if (sanitized.headers) {
        delete sanitized.headers.authorization;
        delete sanitized.headers.Authorization;
        delete sanitized.headers.cookie;
        delete sanitized.headers.Cookie;
    }
    return sanitized;
}
/**
 * Sanitize response payload before storing in golden record
 * Redacts sensitive business data and personal information
 */
export function sanitizeResponsePayload(payload) {
    if (!payload)
        return null;
    return sanitizeObject(payload);
}
/**
 * Sanitize database snapshot before storing in golden record
 * Removes sensitive columns and encrypts remaining data
 */
export async function sanitizeDbSnapshot(snapshot) {
    if (!snapshot)
        return null;
    // Sanitize the snapshot structure
    const sanitized = sanitizeObject(snapshot);
    // Encrypt the sanitized snapshot using KMS
    const encrypted = await encryptJSONKMS(sanitized);
    return encrypted;
}
/**
 * List of DB column patterns that should always be excluded from snapshots
 */
const SENSITIVE_DB_COLUMNS = [
    'password',
    'password_hash',
    'hashed_password',
    'salt',
    'api_key',
    'secret',
    'token',
    'session_token',
    'refresh_token',
    'access_token',
    'credit_card',
    'ssn',
    'social_security',
];
/**
 * Check if a database column should be excluded from snapshots
 */
export function isSensitiveDbColumn(columnName) {
    const lowerColumn = columnName.toLowerCase();
    return SENSITIVE_DB_COLUMNS.some(pattern => lowerColumn.includes(pattern));
}
/**
 * Filter sensitive columns from a database row
 */
export function filterSensitiveColumns(row) {
    const filtered = {};
    for (const [key, value] of Object.entries(row)) {
        if (!isSensitiveDbColumn(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}
/**
 * Sanitize multiple database rows
 */
export function sanitizeDbRows(rows) {
    return rows.map(row => filterSensitiveColumns(row));
}
/**
 * Sanitize a complete golden record step before persistence
 */
export async function sanitizeGoldenRecordStep(step) {
    return {
        stepName: step.stepName,
        expectedUrl: step.expectedUrl,
        screenshotPath: step.screenshotPath,
        requestPayload: step.requestPayload ? sanitizeRequestPayload(step.requestPayload) : null,
        responsePayload: step.responsePayload ? sanitizeResponsePayload(step.responsePayload) : null,
        dbSnapshot: step.dbSnapshot ? await sanitizeDbSnapshot(step.dbSnapshot) : null,
        observations: step.observations || null,
    };
}
/**
 * Sanitize all steps in a golden record
 */
export async function sanitizeGoldenRecordSteps(steps) {
    return Promise.all(steps.map(step => sanitizeGoldenRecordStep(step)));
}
//# sourceMappingURL=golden-record-sanitizer.js.map