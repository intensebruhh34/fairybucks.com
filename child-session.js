const key = "fairybucks-child-session";

export function childToken() {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storeChildToken(token) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("Invalid child session");
  sessionStorage.removeItem(key + ":requests");
  sessionStorage.setItem(key, token);
}

export function clearChildToken() {
  sessionStorage.removeItem(key);
  sessionStorage.removeItem(key + ":requests");
}

export function readChildRequests() {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(key + ":requests")) || []);
  } catch {
    return new Map();
  }
}

export function storeChildRequests(requests) {
  try {
    sessionStorage.setItem(key + ":requests", JSON.stringify([...requests]));
  } catch {
    // The open vault still keeps retry IDs in memory.
  }
}
