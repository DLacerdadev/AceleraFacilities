import { type User } from "@shared/schema";

/**
 * Remove sensitive fields from user object
 */
export function sanitizeUser<T extends Partial<User>>(user: T): Omit<T, 'password'> {
  const { password, ...sanitized } = user;
  return sanitized;
}

/**
 * Remove sensitive fields from array of users
 */
export function sanitizeUsers<T extends Partial<User>>(users: T[]): Omit<T, 'password'>[] {
  return users.map(user => sanitizeUser(user));
}

/**
 * Generate secure random string for tokens/secrets
 */
export function generateSecureToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const crypto = require('crypto');
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return crypto.timingSafeEqual(bufferA, bufferB);
}
