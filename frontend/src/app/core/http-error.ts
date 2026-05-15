import { HttpErrorResponse } from '@angular/common/http';

export function getHttpErrorMessage(error: unknown, fallback = 'Request failed.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body = typeof error.error === 'string' ? parseErrorBody(error.error) : error.error;
  const message = body?.error ?? body?.message ?? error.message;

  if (message) {
    return String(message);
  }

  return error.status ? `${fallback} Status ${error.status}.` : fallback;
}

function parseErrorBody(body: string): { error?: string; message?: string } | null {
  try {
    return JSON.parse(body);
  } catch {
    return body ? { error: body } : null;
  }
}
