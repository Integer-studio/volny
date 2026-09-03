import { ApiError } from './api';

/**
 * First field-level message for any of the given field names (case as
 * produced by ApiError - already normalized to camelCase). Field names are
 * tried in order, so pass every alias a form might use for the same value
 * (e.g. BE "newPassword" vs a form's own state key).
 */
export function fieldError(e: unknown, ...fields: string[]): string | null {
  if (!(e instanceof ApiError) || !e.fieldErrors) return null;
  for (const field of fields) {
    const messages = e.fieldErrors[field];
    if (messages && messages.length > 0) return messages[0];
  }
  return null;
}

/**
 * A message safe to show the user for any error: the server's own business-
 * rule message, else the first validation message from any field, else the
 * caller-provided fallback. Never surfaces raw exception text.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.serverMessage) return e.serverMessage;
    if (e.fieldErrors) {
      for (const messages of Object.values(e.fieldErrors)) {
        if (messages.length > 0) return messages[0];
      }
    }
  }
  return fallback;
}
