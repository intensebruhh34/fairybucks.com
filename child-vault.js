import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { childToken, clearChildToken, readChildRequests, storeChildRequests } from "/child-session.js";

const $ = id => document.getElementById(id);
const config = window.FAIRYBUCKS_AUTH_CONFIG;
const client = createClient(config.url, config.publishableKey, {
  auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    storageKey: "fairybucks-child-api"
  }
});
const token = childToken();
const pending = readChildRequests();
const statusLabels = {
  pending: "Awaiting parent review", approved: "Approved", declined: "Declined",
  cancelled: "Cancelled", fulfilled: "Fulfilled"
};
let busy = false;
let viewRequest = 0;

function actionButton(label, action, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = busy;
  if (primary) button.className = "primary";
  button.addEventListener("click", action);
  return button;
}

function render(vault) {
  $("child-title").textContent = "✨ " + vault.nickname + "’s Fairy Vault";
  $("child-balance").textContent = vault.balance + " FB";
  $("child-teeth").textContent = vault.tooth_count;
  $("request-list").replaceChildren(...vault.requests.map(request => {
    const item = document.createElement("li");
    item.textContent = request.name + " · " + request.price + " FB · " +
      (statusLabels[request.status] || request.status);
    if (request.status === "pending") {
      item.append(actionButton("Cancel request", () => cancel(request)));
    }
    return item;
  }));
  if (!vault.requests.length) {
    const empty = document.createElement("li");
    empty.textContent = "No treasure requests yet.";
    $("request-list").append(empty);
  }
  $("child-catalog").replaceChildren(...vault.catalog.map(treasure => {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = treasure.name;
    const detail = document.createElement("p");
    detail.textContent = treasure.category + " · " + treasure.price + " FB";
    card.append(title, detail, actionButton("Request Treasure", () => request(treasure), true));
    return card;
  }));
  $("child-content").hidden = false;
}

function closeVault(message) {
  clearChildToken();
  $("child-content").hidden = true;
  $("request-list").replaceChildren();
  $("child-catalog").replaceChildren();
  $("child-title").textContent = "✨ My Fairy Vault";
  $("child-balance").textContent = "";
  $("child-teeth").textContent = "";
  $("child-status").textContent = message;
  $("child-retry").hidden = true;
}

async function call(action, args = {}) {
  const { data, error } = await client.rpc("fairybucks_child_action", {
    p_token: token, p_action: action, ...args
  });
  if (error || !data) throw error || new Error("Vault unavailable");
  return data;
}

async function load(message = "") {
  const request = ++viewRequest;
  $("child-retry").hidden = true;
  const storedToken = childToken();
  if (!storedToken) {
    closeVault("Ask a grown-up to open your Fairy Vault.");
    return;
  }
  if (storedToken !== token) {
    location.reload();
    return;
  }
  try {
    const data = await call("view");
    if (request !== viewRequest) return;
    if (data.status === "expired") {
      closeVault("This vault session ended. Ask a grown-up to open it again.");
      return;
    }
    if (data.status !== "active") throw new Error("Vault unavailable");
    render(data);
    $("child-status").textContent = message;
  } catch {
    if (request !== viewRequest) return;
    $("child-status").textContent = "Couldn't refresh your Fairy Vault. Try again.";
    $("child-retry").hidden = false;
  }
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll("#child-content button, #child-retry, #child-exit")) {
    button.disabled = value;
  }
}

async function change(action, args, onResult) {
  if (busy) return;
  setBusy(true);
  $("child-status").textContent = "Saving…";
  try {
    const { status } = await call(action, args);
    if (status === "expired") {
      closeVault("This vault session ended. Ask a grown-up to open it again.");
      return;
    }
    await load(onResult(status));
  } catch {
    $("child-status").textContent = "Couldn't confirm the change. Try the same action again.";
  } finally {
    setBusy(false);
  }
}

async function request(treasure) {
  if (busy || !window.confirm("Request " + treasure.name + " for " + treasure.price + " Fairy Bucks?")) return;
  if (!pending.has(treasure.key)) pending.set(treasure.key, crypto.randomUUID());
  storeChildRequests(pending);
  await change("request", {
    p_request_id: pending.get(treasure.key), p_shop_key: treasure.key, p_expected_price: treasure.price
  }, status => {
    const messages = {
      requested: "Request sent for parent review.",
      already_pending: "This treasure already has a pending request.",
      price_changed: "The Fairy Buck price changed. Check the current price before requesting.",
      unavailable: "This treasure is no longer available.",
      insufficient_balance: "There aren't enough available Fairy Bucks. Pending requests set some aside."
    };
    if (!Object.hasOwn(messages, status)) throw new Error("Request not confirmed");
    pending.delete(treasure.key);
    storeChildRequests(pending);
    return messages[status];
  });
}

async function cancel(request) {
  if (busy || !window.confirm("Cancel this treasure request?")) return;
  await change("cancel", { p_request_id: request.id }, status => {
    if (status === "cancelled") return "Treasure request cancelled.";
    if (status === "already_decided") return "This request was already handled.";
    throw new Error("Cancellation not confirmed");
  });
}

$("child-retry").addEventListener("click", () => load());
$("child-refresh").addEventListener("click", () => { if (!busy) load(); });
$("child-exit").addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  ++viewRequest;
  try {
    if (childToken()) await call("end");
    clearChildToken();
    location.replace("/auth.html");
  } catch {
    $("child-status").textContent = "Couldn't close the vault yet. Try again.";
    setBusy(false);
  }
});
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !busy && childToken()) load();
});
load();
