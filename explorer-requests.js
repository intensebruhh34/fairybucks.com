export function explorerRequests(getClient, wallet) {
  const $ = id => document.getElementById(id);
  const statusLabels = {
    pending: "Awaiting parent review", approved: "Approved", declined: "Declined",
    cancelled: "Cancelled", fulfilled: "Fulfilled"
  };
  let active = null;

  function action(label, request, decision) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = Boolean(active?.saving);
    button.addEventListener("click", () => decide(request, decision));
    return button;
  }

  function purchaseDetails(request) {
    const section = document.createElement("div");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "View purchase details";
    const detail = document.createElement("div");
    detail.className = "purchase-details";
    detail.setAttribute("role", "status");
    section.append(button, detail);
    button.addEventListener("click", async () => {
      const view = active;
      const token = view && wallet.unlockToken(view.childId);
      if (!token) return;
      button.disabled = true;
      detail.textContent = "Loading purchase details…";
      try {
        const { data, error } = await getClient().rpc("fairybucks_parent_purchase", {
          p_child_id: view.childId, p_request_id: request.id, p_unlock_token: token
        });
        if (view !== active || wallet.unlockToken(view.childId) !== token || !section.isConnected) return;
        if (error) throw error;
        if (data.status === "unlock_required") {
          wallet.lock(view.childId);
          return;
        }
        if (data.status !== "available") {
          detail.textContent = "Purchase details are unavailable for this request.";
          return;
        }
        // Accept only the retailer URL shape used by the protected catalog.
        if (!/^https:\/\/a\.co\/d\/[A-Za-z0-9]+$/.test(data.url)) throw new Error("Invalid retailer link");
        const version = document.createElement("p");
        version.textContent = data.version;
        const price = document.createElement("p");
        price.textContent = "Previously listed at " + new Intl.NumberFormat("en-US", {
          style: "currency", currency: "USD"
        }).format(data.price_cents / 100) + " (" + data.checked_on + ").";
        const note = document.createElement("p");
        note.textContent = "Parent budget guide: 1 FB = $1. Check the selected version, current price, tax and shipping before approving. Approval uses Fairy Bucks only. You place and pay for the order separately; this site does not place orders or track delivery.";
        const link = document.createElement("a");
        link.className = "fairy-action";
        link.textContent = "View product on Amazon";
        link.href = data.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        detail.replaceChildren(version, price, note, link);
        button.textContent = "Refresh purchase details";
      } catch {
        if (view === active && wallet.unlockToken(view.childId) === token && section.isConnected) {
          detail.textContent = "Couldn't load purchase details. Try again.";
        }
      } finally {
        button.disabled = false;
      }
    });
    return section;
  }

  function renderList(id, rows, parent = false) {
    const items = rows.map(request => {
      const item = document.createElement("li");
      item.className = "request-row";
      const line = document.createElement("p");
      line.textContent = request.name + " · " + request.price + " FB ";
      const badge = document.createElement("span");
      badge.className = "request-status " + request.status;
      badge.textContent = statusLabels[request.status] || request.status;
      line.append(badge);
      item.append(line);
      if (request.status === "pending") {
        const actions = document.createElement("div");
        actions.className = "request-actions";
        if (parent) actions.append(action("Approve", request, "approved"), action("Decline", request, "declined"));
        else actions.append(action("Cancel request", request, "cancelled"));
        item.append(actions);
      }
      if (parent && ["pending", "approved", "fulfilled"].includes(request.status)) {
        item.append(purchaseDetails(request));
      }
      return item;
    });
    if (!items.length) {
      const empty = document.createElement("li");
      empty.textContent = parent ? "No requests to review or purchase." : "No treasure requests yet.";
      items.push(empty);
    }
    $(id).replaceChildren(...items);
  }

  function renderReview() {
    const visible = Boolean(active && wallet.unlockToken(active.childId));
    $("treasure-review").hidden = !visible;
    if (visible && active.rows) {
      renderList("treasure-review-list", active.rows.filter(row => ["pending", "approved", "fulfilled"].includes(row.status)), true);
    } else {
      $("treasure-review-list").replaceChildren();
    }
  }

  async function load(view, loadOffer = false) {
    const request = view.loadRequest = {};
    $("treasure-retry").hidden = true;
    try {
      const [list, offer] = await Promise.all([
        getClient().rpc("fairybucks_list_treasure_requests", { p_child_id: view.childId }),
        loadOffer && view.shopKey
          ? getClient().rpc("fairybucks_treasure_offer", { p_shop_key: view.shopKey })
          : null
      ]);
      if (list.error || offer?.error) throw list.error || offer.error;
      if (view !== active || request !== view.loadRequest) return;
      view.rows = list.data;
      renderList("treasure-requests-list", view.rows);
      renderReview();
      if (offer) {
        view.offer = offer.data[0];
        $("treasure-offer").hidden = !view.offer;
        $("treasure-offer-name").textContent = view.offer
          ? "Request " + view.offer.name + " for " + view.offer.fairy_price + " Fairy Bucks?"
          : "";
        if (!view.offer) $("treasure-request-status").textContent = "This treasure is no longer available.";
      }
    } catch {
      if (view !== active || request !== view.loadRequest) return;
      $("treasure-request-status").textContent = "Couldn't load treasure requests. Try again.";
      $("treasure-retry").hidden = false;
    }
  }

  function setSaving(view, saving) {
    view.saving = saving;
    if (view !== active) return;
    $("treasure-submit").disabled = saving;
    $("treasure-retry").disabled = saving;
    for (const id of ["treasure-requests-list", "treasure-review-list"]) {
      for (const button of $(id).querySelectorAll("button")) button.disabled = saving;
    }
  }

  async function submit() {
    const view = active;
    if (!view?.offer || view.saving) return;
    setSaving(view, true);
    const status = $("treasure-request-status");
    status.textContent = "Sending request…";
    const key = "fairybucks-treasure:" + view.childId + ":" + view.shopKey;
    try {
      try {
        view.requestId ??= sessionStorage.getItem(key);
      } catch {
        // Keep retries in memory when storage is unavailable.
      }
      view.requestId ??= crypto.randomUUID();
      try {
        sessionStorage.setItem(key, view.requestId);
      } catch {
        // The request ID remains available while this screen is open.
      }
      const { data, error } = await getClient().rpc("fairybucks_submit_treasure", {
        p_child_id: view.childId, p_request_id: view.requestId,
        p_shop_key: view.shopKey, p_expected_price: view.offer.fairy_price
      });
      if (error) throw error;
      if (view !== active) return;
      if (data === "price_changed" || data === "unavailable") {
        view.offer = null;
        $("treasure-offer").hidden = true;
        status.textContent = "This treasure has changed. Check the current offer before requesting.";
        await load(view, true);
        return;
      }
      if (data === "insufficient_balance") {
        status.textContent = "There aren't enough available Fairy Bucks for this request. Pending requests set some aside.";
        return;
      }
      if (data !== "requested" && data !== "already_pending") throw new Error("Request not confirmed");
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Storage may be disabled.
      }
      view.offer = null;
      view.shopKey = 0;
      view.requestId = null;
      $("treasure-offer").hidden = true;
      history.replaceState(null, "", "#explorer=" + view.childId);
      status.textContent = data === "requested"
        ? "Request sent for parent review."
        : "This treasure already has a pending request.";
      await load(view);
    } catch {
      if (view === active) status.textContent = "Couldn't confirm the request. Try again.";
    } finally {
      setSaving(view, false);
    }
  }

  async function decide(request, decision) {
    const view = active;
    if (!view || view.saving) return;
    const parent = decision !== "cancelled";
    const token = parent ? wallet.unlockToken(view.childId) : null;
    if (parent && !token) return;
    const prompt = decision === "approved"
      ? "Approve " + request.name + " for " + request.price + " Fairy Bucks?"
      : decision === "declined" ? "Decline this treasure request?" : "Cancel this treasure request?";
    if (!window.confirm(prompt)) return;
    const status = $(parent ? "treasure-review-status" : "treasure-request-status");
    setSaving(view, true);
    status.textContent = "Saving…";
    try {
      const { data, error } = await getClient().rpc("fairybucks_decide_treasure", {
        p_child_id: view.childId, p_request_id: request.id, p_decision: decision, p_unlock_token: token
      });
      if (error) throw error;
      if (view !== active) return;
      if (data === "unlock_required") {
        status.textContent = "";
        wallet.lock(view.childId);
        return;
      }
      const messages = {
        approved: "Treasure request approved.",
        declined: "Treasure request declined.",
        cancelled: "Treasure request cancelled.",
        already_decided: "This request was already handled.",
        insufficient_balance: "This vault doesn't have enough Fairy Bucks to approve this request.",
        unavailable: "This treasure is no longer available."
      };
      if (!Object.hasOwn(messages, data)) throw new Error("Decision not confirmed");
      status.textContent = messages[data];
      await Promise.all([load(view), parent ? wallet.refresh(view.childId) : null]);
    } catch {
      if (view === active) status.textContent = "Couldn't confirm the decision. Try again.";
    } finally {
      setSaving(view, false);
    }
  }

  $("treasure-submit").addEventListener("click", submit);
  $("treasure-retry").addEventListener("click", () => { if (active) load(active, true); });

  return {
    renderReview,
    open(childId, shopKey = 0) {
      if (!childId && !active) return;
      if (active?.childId === childId && active?.shopKey === shopKey) return;
      active = childId ? { childId, shopKey } : null;
      $("treasure-offer").hidden = true;
      $("treasure-submit").disabled = false;
      $("treasure-retry").hidden = true;
      $("treasure-retry").disabled = false;
      $("treasure-requests-list").replaceChildren();
      $("treasure-request-status").textContent = "";
      $("treasure-review-status").textContent = "";
      renderReview();
      if (active) load(active, true);
    }
  };
}
