export function explorerWallet(getClient) {
  const $ = id => document.getElementById(id);
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
  let active = null;

  function setList(id, items, empty) {
    $(id).replaceChildren(...(items.length ? items : [empty]).map(text => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
  }

  async function loadWallet(view) {
    $("wallet-status").textContent = "Opening your wallet…";
    $("wallet-retry").hidden = true;
    try {
      const { data, error } = await getClient().rpc("fairybucks_explorer_summary", {
        p_child_id: view.childId
      });
      if (error || !data) throw error || new Error("Explorer is unavailable");
      if (view !== active) return;
      $("wallet-balance").textContent = data.balance + " FB";
      $("tooth-count").textContent = String(data.tooth_count);
      setList("wallet-transactions", data.transactions.map(row =>
        row.description + " · " + (row.amount > 0 ? "+" : "") + row.amount + " FB"
      ), "Your Fairy Buck adventures will appear here.");
      setList("tooth-history", data.teeth.map(day =>
        dateFormat.format(new Date(day + "T12:00:00Z"))
      ), "No lost teeth recorded yet.");
      $("wallet-history").hidden = false;
      $("wallet-status").textContent = "";
    } catch {
      if (view !== active) return;
      $("wallet-status").textContent = "We couldn't load this wallet. Try again.";
      $("wallet-retry").hidden = false;
    }
  }

  function resetPin(view) {
    if (view) {
      clearTimeout(view.expiry);
      view.token = null;
    }
    $("pin-form").reset();
    $("pin-submit").disabled = false;
    $("pin-form").hidden = true;
    $("pin-retry").hidden = true;
    $("tooth-controls").hidden = true;
    $("record-tooth").disabled = false;
    $("pin-status").textContent = "";
    $("tooth-status").textContent = "";
  }

  function showPin(view, status) {
    view.setup = status === "setup_required";
    $("pin-confirm-area").hidden = !view.setup;
    $("parent-pin-confirm").required = view.setup;
    $("pin-submit").textContent = view.setup ? "Set PIN and unlock" : "Unlock";
    $("pin-form").hidden = status === "locked";
    $("pin-retry").hidden = status !== "locked";
    const prompts = {
      setup_required: "Set a Parent PIN to protect tooth rewards. Keep it somewhere safe.",
      pin_required: "Enter your Parent PIN to record a lost tooth.",
      incorrect_pin: "That PIN didn't match. Try again.",
      invalid_pin: "Enter six digits.",
      locked: "Too many tries. Wait 15 minutes before trying again."
    };
    $("pin-status").textContent = prompts[status] || prompts.pin_required;
  }

  async function checkPin(view) {
    $("pin-status").textContent = "Checking Parent PIN…";
    $("pin-retry").hidden = true;
    try {
      const { data, error } = await getClient().rpc("fairybucks_parent_pin");
      if (error || !data) throw error || new Error("PIN status unavailable");
      if (view === active) showPin(view, data.status);
    } catch {
      if (view !== active) return;
      $("pin-status").textContent = "Parent controls couldn't load. Try again.";
      $("pin-retry").hidden = false;
    }
  }

  async function submitPin(event) {
    event.preventDefault();
    const view = active;
    if (!view || $("pin-form").hidden || $("pin-submit").disabled) return;
    const pin = $("parent-pin").value;
    if (view.setup && pin !== $("parent-pin-confirm").value) {
      $("pin-status").textContent = "The two PIN entries need to match.";
      return;
    }
    $("pin-submit").disabled = true;
    $("pin-form").reset();
    try {
      const { data, error } = await getClient().rpc("fairybucks_parent_pin", {
        p_pin: pin, p_setup: view.setup
      });
      if (error || !data) throw error || new Error("PIN response unavailable");
      if (view !== active) return;
      if (data.status !== "unlocked") {
        showPin(view, data.status);
        return;
      }
      view.token = data.token;
      $("pin-form").hidden = true;
      $("pin-status").textContent = "Parent controls unlocked for up to five minutes.";
      $("tooth-controls").hidden = false;
      view.expiry = setTimeout(() => {
        if (view !== active) return;
        view.token = null;
        $("tooth-controls").hidden = true;
        showPin(view, "pin_required");
      }, 5 * 60 * 1000);
    } catch {
      if (view === active) $("pin-status").textContent = "Couldn't check the PIN. Try again.";
    } finally {
      if (view === active) $("pin-submit").disabled = false;
    }
  }

  function pendingTooth(view) {
    const key = "fairybucks-tooth:" + view.childId;
    if (!view.pending) {
      try {
        view.pending = JSON.parse(sessionStorage.getItem(key));
      } catch {
        // Continue with an in-memory retry ID when storage is unavailable.
      }
    }
    if (!view.pending) {
      const now = new Date();
      const localDay = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      view.pending = { id: crypto.randomUUID(), date: localDay };
      try {
        sessionStorage.setItem(key, JSON.stringify(view.pending));
      } catch {
        // The in-memory ID still handles retries while this vault is open.
      }
    }
    return view.pending;
  }

  async function recordTooth() {
    const view = active;
    if (!view?.token || $("record-tooth").disabled) return;
    $("record-tooth").disabled = true;
    $("tooth-status").textContent = "Saving tooth and reward…";
    try {
      const pending = pendingTooth(view);
      const { data, error } = await getClient().rpc("fairybucks_record_tooth", {
        p_child_id: view.childId, p_request_id: pending.id, p_lost_on: pending.date,
        p_unlock_token: view.token
      });
      if (error) throw error;
      if (data === "unlock_required") {
        if (view === active) {
          resetPin(view);
          showPin(view, "pin_required");
        }
        return;
      }
      if (data !== "saved") throw new Error("Tooth save not confirmed");
      try {
        const key = "fairybucks-tooth:" + view.childId;
        if (JSON.parse(sessionStorage.getItem(key))?.id === pending.id) sessionStorage.removeItem(key);
      } catch {
        // Storage may be disabled.
      }
      view.pending = null;
      if (view !== active) return;
      $("tooth-status").textContent = "Tooth recorded. 5 Fairy Bucks earned!";
      await loadWallet(view);
    } catch {
      if (view === active) $("tooth-status").textContent = "Couldn't confirm the save. Try again to finish this tooth reward.";
    } finally {
      if (view === active) $("record-tooth").disabled = false;
    }
  }

  $("wallet-retry").addEventListener("click", () => { if (active) loadWallet(active); });
  $("parent-controls").addEventListener("toggle", () => {
    if (active && $("parent-controls").open && !active.pinChecked) {
      active.pinChecked = true;
      checkPin(active);
    }
  });
  $("pin-retry").addEventListener("click", () => { if (active) checkPin(active); });
  $("pin-form").addEventListener("submit", submitPin);
  $("record-tooth").addEventListener("click", recordTooth);

  return {
    open(childId) {
      if (childId === active?.childId) return;
      resetPin(active);
      $("parent-controls").open = false;
      $("wallet-balance").textContent = "—";
      $("tooth-count").textContent = "—";
      $("wallet-status").textContent = "";
      $("wallet-history").hidden = true;
      $("wallet-retry").hidden = true;
      $("wallet-transactions").replaceChildren();
      $("tooth-history").replaceChildren();
      active = childId ? { childId } : null;
      if (active) loadWallet(active);
    }
  };
}
