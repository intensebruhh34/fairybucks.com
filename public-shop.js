import { catalog } from "/treasure-catalog.js";

const $ = id => document.getElementById(id);
const dialog = $("treasure-dialog");
const filters = [...document.querySelectorAll("[data-category]")];
const explorerPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
let currentPage;
let explorer = null;

function showTreasure(treasure) {
  $("treasure-emoji").textContent = treasure.emoji;
  $("treasure-title").textContent = treasure.name;
  $("treasure-price").textContent = "🪙 " + treasure.price + " Fairy Bucks";
  $("treasure-message").textContent = treasure.description + " " + (explorer
    ? "Ask a grown-up to review your treasure request."
    : "Ask a grown-up to open your Fairy Vault.");
  $("treasure-next").textContent = explorer ? "✨ Request Treasure" : "Open the Family Vault";
  $("treasure-next").href = explorer
    ? "/auth.html#explorer=" + explorer + "&treasure=" + treasure.id : "/auth.html";
  dialog.showModal();
}

function productCard(treasure) {
  const card = document.createElement("article");
  card.className = "treasure-card";
  const art = document.createElement("div");
  art.className = "treasure-art";
  art.setAttribute("aria-hidden", "true");
  art.textContent = treasure.emoji;
  const body = document.createElement("div");
  body.className = "treasure-body";
  const category = document.createElement("small");
  category.textContent = treasure.category;
  const title = document.createElement("h3");
  title.textContent = treasure.name;
  const price = document.createElement("p");
  price.className = "treasure-price";
  price.textContent = "🪙 " + treasure.price + " FB";
  const button = document.createElement("button");
  button.className = "fairy-action block";
  button.textContent = "View Treasure";
  button.addEventListener("click", () => showTreasure(treasure));
  const description = document.createElement("p");
  description.textContent = treasure.description;
  body.append(category, title, description, price, button);
  card.append(art, body);
  return card;
}

function render() {
  const [route, ...params] = location.hash.slice(1).split("&");
  const query = new URLSearchParams(params.join("&"));
  const page = route === "shop" || route === "treasures" ? "shop" : route === "parents" ? "parents" : "home";
  if (dialog.open) dialog.close();
  $("landing").hidden = page !== "home";
  $("public-shop").hidden = page !== "shop";
  $("public-parents").hidden = page !== "parents";

  if (page === "shop") {
    explorer = explorerPattern.test(query.get("explorer") || "") ? query.get("explorer") : null;
    const category = filters.find(filter => filter.dataset.category === query.get("category"))?.dataset.category || "All";
    $("shop-back").textContent = explorer ? "← Explorer Vault" : "← Home";
    $("shop-back").href = explorer ? "/auth.html#explorer=" + explorer : "/";
    for (const filter of filters) {
      const target = new URLSearchParams();
      if (explorer) target.set("explorer", explorer);
      if (filter.dataset.category !== "All") target.set("category", filter.dataset.category);
      filter.href = "#shop" + (target.size ? "&" + target : "");
      if (filter.dataset.category === category) filter.setAttribute("aria-current", "true");
      else filter.removeAttribute("aria-current");
    }
    $("public-catalog").replaceChildren(...catalog
      .filter(item => category === "All" || item.category === category).map(productCard));
  }

  if (page !== currentPage && page !== "home") {
    window.scrollTo(0, 0);
    $(page === "shop" ? "shop-title" : "parents-title").focus();
  }
  currentPage = page;
}

// Preserve parent account links sent to the original homepage.
const search = new URLSearchParams(location.search);
if (location.hash.includes("access_token=") || search.has("code") || search.has("token_hash")) {
  location.replace("/auth.html" + location.search + location.hash);
} else {
  window.addEventListener("hashchange", render);
  render();
}
