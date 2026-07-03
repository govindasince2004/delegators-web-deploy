export function isTransientDelegatorsError(message: string): boolean {
  return /HTTP 429|rate.?limit|too many requests|delegators is busy right now/i.test(message);
}

export function isNetworkDelegatorsError(message: string): boolean {
  return /failed to fetch|networkerror|network error|load failed|econnrefused|connection refused|aborterror/i.test(
    message
  );
}

export function friendlyRunError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The artifact could not be completed.';
  if (isNetworkDelegatorsError(message)) {
    return 'Could not reach the Delegators gateway. Check your connection and retry.';
  }
  if (isTransientDelegatorsError(message)) {
    return 'Delegators is busy right now (rate limit). Wait a few seconds and send again.';
  }
  if (/instruction:.*at least 4/i.test(message)) {
    return 'Write at least 4 characters to revise the artifact.';
  }
  if (/sessionKey:.*sess_|API key must start with/i.test(message)) {
    return 'Reconnect a valid sess_ or wb_ API key in Settings.';
  }
  if (/invalid artifact json|did not return json|execution identifier/i.test(message)) {
    return 'I could not finish a valid artifact from the model response. Please retry the request.';
  }
  if (/timed out|timeout/i.test(message)) {
    return 'The model took too long to finish this artifact. Please retry the request.';
  }
  if (/cancelled/i.test(message)) return 'The artifact run was stopped.';
  if (/artifact task was interrupted/i.test(message)) {
    return 'Artifact task was interrupted — usually because the Workbench server restarted. Send your request again, or type "continue" to resume.';
  }
  return message;
}

export function friendlyHttpError(status: number, details?: string): string {
  if (status === 429) {
    return 'Delegators is busy right now (rate limit). Wait a few seconds and send again.';
  }
  if (status >= 500) {
    return 'Delegators is busy right now. Wait a few seconds and send again.';
  }
  if (details?.trim()) return details.trim();
  return `Request failed with HTTP ${status}.`;
}