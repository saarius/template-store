// json() already waits for the body. A separate finished() observer can remain
// unresolved under browser interception even when the body is readable.
export async function boundedResponseJson(response, timeoutMs = 5000) {
  let timer;
  try {
    return await Promise.race([
      response.json(),
      new Promise(resolve => { timer = setTimeout(() => resolve(undefined), timeoutMs); }),
    ]);
  } catch {
    // No response diagnostics or body data belong in verification logs.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
