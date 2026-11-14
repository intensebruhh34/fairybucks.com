export const welcome = [
 ["Welcome to Fairybucks", "Turn little teeth into magical adventures. Fairybucks helps your family celebrate milestones while children practice saving, making choices and waiting for a special reward."],
 ["Create your family's magic", "Set up your Family Vault and add an explorer for each child. A first name or nickname is enough; age and gender are optional. Children do not need their own email address or password."],
 ["Choose the tooth reward", "Set a private Parent PIN, then choose how many Fairy Bucks each tooth earns. The starting reward is 5 Fairy Bucks, and you can choose a whole number from 1 to 100. Your choice applies to future tooth entries for every explorer in your family. Past rewards stay unchanged."],
 ["Save, explore and request", "Recording a lost tooth adds Fairy Bucks to that explorer's vault. Children browse treasures and send requests. Pending requests set Fairy Bucks aside; approval deducts them. Children can cancel pending requests, and parents always decide what gets approved."],
 ["You arrange the treasure", "Approving a request does not place an order. You arrange and pay for the purchase separately using the protected purchase details. Confirm the selected product, current total and your budget before approval. You then update the fairy delivery stages manually; they are not automatic shipping updates."],
 ["Keep the magic alive", "Review purchasing and Parent controls away from children. Keep your sign-in and Parent PIN private. Use Hand Over the Magic to open a child's Fairy Vault: it signs this tab out of the parent account. Returning to Parent controls requires signing in again. Don't simply hand over an unlocked parent page."],
 ["Mistakes can be corrected", "Undo an accidental tooth entry in Parent controls to reverse its original reward in Fairy Bucks, provided the vault has enough Fairy Bucks. Before a treasure lands, a parent can cancel an approved request and return its original cost in Fairy Bucks. This does not cancel a retailer order or refund a payment. During the pilot, contact the person who invited you if you need help."]
];
export const faqs = [
 ["What are Fairy Bucks?", "Fairy Bucks are family reward points recorded in each explorer's vault. Parents choose the tooth reward and fund any approved treasures themselves. They are not a prepaid retailer balance."],
 ["Does Fairybucks send treasures or place orders?", "No. Parents arrange purchases separately. Approval deducts FB but does not place an order, take payment or book delivery. Purchase details are available only after unlocking Parent controls."],
 ["Can I change how many FB a tooth earns?", "Yes. Unlock Parent controls and save a whole number from 1 to 100 under Fairy Bucks per tooth. This applies to future entries across your family. Historical rewards do not change."],
 ["What if I record a tooth by mistake?", "Use Correct tooth count in Parent controls. Undoing reverses the original reward, even if your current setting differs. The vault must have enough FB to reverse it."],
 ["Why can't my child spend the full displayed balance?", "Pending requests reserve some FB. The balance is deducted only on approval. Cancelling a pending request releases the reservation without adding a separate credit."],
 ["How do cancellations and FB returns work?", "Children or parents can cancel pending requests. After approval, only a parent with unlocked controls can use Cancel treasure and return FB, before the treasure lands. It returns the original cost once. Landed treasures are completed and cannot be cancelled here. Retailer cancellations and payment refunds must be handled separately."],
 ["How does the fairy delivery tracker work?", "Parents manually advance Workshop, Packaging, In the Air, Arriving Soon and Landed after confirming the real order's progress. Children see magical stage names. The tracker does not receive carrier tracking information."],
 ["How do I switch to a child's vault?", "Open the explorer, unlock Parent controls and choose Hand Over the Magic. It creates a child session for that explorer and signs this tab out of the parent account. Use Return to parent sign-in when finished. Child sessions expire after about an hour."],
 ["What if I forget my password or Parent PIN?", "Use Reset password on the sign-in screen for a password-reset email. Password reset does not reset your Parent PIN. Self-service PIN recovery is not available yet; contact your pilot host for help and keep your PIN somewhere safe."],
 ["How do I get help or request account deletion?", "During the invite-only pilot, contact the person who invited you for support or to request account and family-data deletion. There is no self-service deletion button yet. Please avoid sending passwords or PINs in support messages."],
 ["Can I read the welcome guide again?", "Yes. Select Welcome guide in this Parent Portal. Reading it again does not change your rewards, wallet balances or profiles."]
];

export const printableSheets = [
 {key:"1",label:"1 Fairy Buck sheet (PDF)"},
 {key:"2",label:"2 Fairy Bucks sheet (PDF)"},
 {key:"5",label:"5 Fairy Bucks sheet (PDF)"},
 {key:"10",label:"10 Fairy Bucks sheet (PDF)"},
 {key:"mixed",label:"Mixed starter sheet (PDF)"}
];

export function parentGuide(getClient, onReady) {
 const $ = id => document.getElementById(id);
 let active = null;
 function clear() {
  active = null;
  $("parent-help").hidden = true;
  $("welcome-copy").replaceChildren();
  $("faq-copy").replaceChildren();
  $("printable-links").replaceChildren();
  $("print-fairy-bucks").open = false;
  $("welcome-status").textContent = "";
 }
 function showGuide() {
  $("welcome-panel").hidden = false;
  $("welcome-title").focus();
 }
 function render() {
  $("printable-links").replaceChildren(...printableSheets.map(sheet => {
   const item = document.createElement("li");
   const name = document.createElement("strong");
   name.textContent = sheet.label.replace(" (PDF)", "");
   const actions = document.createElement("div");
   actions.className = "printable-actions";
   const open = document.createElement("a");
   open.textContent = "Open PDF to print";
   open.className = "fairy-action";
   open.href = "/printables/fairy-bucks-" + sheet.key + ".pdf";
   open.target = "_blank";
   open.rel = "noopener noreferrer";
   open.setAttribute("aria-label", "Open " + name.textContent + " PDF to print");
   const download = document.createElement("a");
   download.textContent = "Download PDF";
   download.className = "fairy-action ghost";
   download.href = open.href;
   download.download = "fairy-bucks-" + sheet.key + ".pdf";
   download.target = "_blank";
   download.rel = "noopener noreferrer";
   download.setAttribute("aria-label", "Download " + name.textContent + " PDF");
   actions.append(open, download);
   item.append(name, actions); return item;
  }));
  $("welcome-copy").replaceChildren(...welcome.map(([title,copy]) => {
   const section = document.createElement("section");
   const h = document.createElement("h3"); h.textContent = title;
   const p = document.createElement("p"); p.textContent = copy;
   section.append(h,p); return section;
  }));
  $("faq-copy").replaceChildren(...faqs.map(([question,answer]) => {
   const details = document.createElement("details");
   const summary = document.createElement("summary"); summary.textContent = question;
   const p = document.createElement("p"); p.textContent = answer;
   details.append(summary,p); return details;
  }));
 }
 async function check(view, complete = false) {
  if (!view || view !== active || view.saving || (complete && !view.loaded)) return;
  view.saving = true;
  $("welcome-continue").disabled = true;
  $("welcome-retry").hidden = true;
  $("welcome-status").textContent = complete ? "Saving your guide progress…" : "Loading your parent guide…";
  try {
   const {data,error} = await getClient().rpc("fairybucks_parent_guide", {p_complete:complete});
   if (view !== active) return;
   if (error || data?.version !== 1 || typeof data?.completed !== "boolean") throw error || new Error("Guide unavailable");
   view.loaded = true;
   render();
   $("welcome-status").textContent = "";
   $("welcome-panel").hidden = data.completed;
   if (!data.completed) showGuide();
   if (data.completed && !view.ready) { view.ready = true; onReady(view.ownerId); }
  } catch {
   if (view !== active) return;
   $("welcome-status").textContent = "Couldn't confirm guide progress. Try again. Your vault has not been changed.";
   $("welcome-retry").hidden = false;
  } finally {
   if (view === active) { view.saving = false; $("welcome-continue").disabled = !view.loaded; }
  }
 }
 $("welcome-open").addEventListener("click", () => { if (active) showGuide(); });
 $("welcome-continue").addEventListener("click", () => check(active,true));
 $("welcome-retry").addEventListener("click", () => check(active));
 return {clear, open(ownerId) {
  clear(); active = {ownerId};
  $("parent-help").hidden = false;
  $("welcome-panel").hidden = false;
  check(active);
 }};
}
