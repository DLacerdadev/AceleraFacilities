/**
 * Recursively converts Date objects and other non-JSON-safe types to JSON-safe values.
 * Prevents "toISOString is not a function" errors when serializing data for API responses.
 * 
 * @param value - Any value (object, array, primitive, Date, etc.)
 * @param seen - Internal set to prevent circular references
 * @returns JSON-safe version of the value
 */
export function serializeForAI(value: any, seen = new WeakSet()): any {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives (string, number, boolean)
  if (typeof value !== 'object') {
    return value;
  }

  // Handle circular references
  if (seen.has(value)) {
    return '[Circular]';
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    seen.add(value); // Protect against circular references in arrays
    return value.map(item => serializeForAI(item, seen));
  }

  // Handle Objects
  seen.add(value);
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = serializeForAI(val, seen);
  }
  return result;
}
