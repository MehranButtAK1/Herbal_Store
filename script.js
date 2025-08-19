/* =========================================================
   Herbal Store — script.js (JWT + Legacy Admin, Final)
   Stack: Vanilla JS + Fetch + localStorage
   Backend: https://herbalbackend-production.up.railway.app
   Features (kept + enhanced):
   - Theme toggle via :root.dark
   - Smooth nav + sticky header
   - Products: search, categories, sort, price-chip
   - Wishlist (client), Cart drawer + WhatsApp checkout
   - Product Quick View modal with qty
   - Admin panel (sidebar) — NO HTML change required
       • Legacy password-only mode (x-admin-password) — still supported
       • NEW: JWT Login (email+password) via inline modal (auto-added by JS)
         - Token auto-attached to POST/PUT/DELETE
         - 10 min expiry handling + auto re-login prompt on 401
   - Placeholder images, API fallback to cache
   - Debounced search, state persistence
========================================================= */

/* ===================== CONFIG ===================== */
const API_URL = "https://herbalbackend-production.up.railway.app";
const WA_NUMBER = "923115121207"; // WhatsApp number (no +, no spaces)

// localStorage keys
const LS_PRODUCTS = "products_v2";
const LS_WISHLIST = "wishlist_v1";
const LS_CART = "cart_v1";
const LS_THEME = "theme";
const LS_ADMIN_MODE = "isAdmin";        // UI flag only
const LS_ADMIN_PASS = "adminPassword";  // legacy header (optional)
const LS_JWT = "adminJWT";              // NEW: bearer token storage (preferred)

/* ===================== STATE ===================== */
let products = [];
let isAdmin = localStorage.getItem(LS_ADMIN_MODE) === "true";
let wishlist = JSON.parse(localStorage.getItem(LS_WISHLIST) || "[]");
let cart = JSON.parse(localStorage.getItem(LS_CART) || "[]");

let currentFilterCat = "All";
let currentSearch = "";
let showWishlistOnly = false;
let sortMode = "featured";

let priceMin = "";
let priceMax = "";

let modalProduct = null;
let testiIndex = 0;

/* ===================== ELEMENTS ===================== */
// nav / theme
const navToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const darkToggle = document.getElementById("darkToggle");

// products toolbar & grids
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const categoryButtons = document.getElementById("category-buttons");
const productList = document.getElementById("product-list");
const emptyState = document.getElementById("empty-state");
const skels = document.getElementById("skeletons");

// modal
const modal = document.getElementById("product-modal");
const modalClose = document.getElementById("modal-close");
const modalImg = document.getElementById("modal-image");
const modalTitle = document.getElementById("modal-title");
const modalDetails = document.getElementById("modal-details");
const modalPrice = document.getElementById("modal-price");
const modalBuy = document.getElementById("modal-buy");
const modalQtyWrap = document.getElementById("modal-qty");
const modalQtyMinus = modalQtyWrap?.querySelector(".qty-minus");
const modalQtyPlus = modalQtyWrap?.querySelector(".qty-plus");
const modalQtySpan = modalQtyWrap?.querySelector("span");

// admin (existing panel)
const adminGear = document.getElementById("admin-gear");
const adminSidebar = document.getElementById("admin-sidebar");
const adminClose = document.getElementById("admin-close");

const adminLoginWrap = document.getElementById("admin-login");
const adminPass = document.getElementById("admin-pass"); // legacy single password input (kept)
const adminLoginBtn = document.getElementById("admin-login-btn");

const productForm = document.getElementById("product-form");
const adminActionSection = document.getElementById("admin-action-section");
const adminExitBtn = document.getElementById("admin-exit");

// form inputs
const inpId = document.getElementById("prod-id");
const inpName = document.getElementById("prod-name");
const selCategory = document.getElementById("prod-category-select");
const inpNewCategory = document.getElementById("prod-category-new");
const inpPrice = document.getElementById("prod-price");
const inpImageURL = document.getElementById("prod-image-url");
const inpImageFile = document.getElementById("prod-image-file");
const inpDetails = document.getElementById("prod-details");
const formReset = document.getElementById("form-reset");

// cart / wishlist
const cartBtn = document.getElementById("cartBtn");
const wishlistBtn = document.getElementById("wishlistBtn");
const cartDrawer = document.getElementById("cart-drawer");
const cartClose = document.getElementById("cartClose");
const cartItems = document.getElementById("cartItems");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartCheckout = document.getElementById("cartCheckout");
const cartClear = document.getElementById("cartClear");
const cartCount = document.getElementById("cartCount");
const wishlistCount = document.getElementById("wishlistCount");

// toasts
const toastContainer = document.getElementById("toast-container");

// testimonials
const testiTrack = document.getElementById("testiTrack");
const testiPrev = document.getElementById("testiPrev");
const testiNext = document.getElementById("testiNext");

/* ===================== THEME ===================== */
(function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  if (saved === "dark") document.documentElement.classList.add("dark");
})();
darkToggle?.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem(
    LS_THEME,
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
});

/* ===================== NAV ===================== */
navToggle?.addEventListener("click", () => navLinks?.classList.toggle("show"));
[...document.querySelectorAll(".nav-links a")].forEach((a) => {
  a.addEventListener("click", () => {
    document.querySelectorAll(".nav-links a").forEach((x) => x.classList.remove("active"));
    a.classList.add("active");
    navLinks?.classList.remove("show");
  });
});

/* ===================== TOAST ===================== */
function showToast(msg) {
  if (!toastContainer) return alert(msg);
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ===================== STORAGE HELPERS ===================== */
const saveProductsLocal = () =>
  localStorage.setItem(LS_PRODUCTS, JSON.stringify(products));
const saveWishlist = () =>
  localStorage.setItem(LS_WISHLIST, JSON.stringify(wishlist));
const saveCart = () =>
  localStorage.setItem(LS_CART, JSON.stringify(cart));

/* ===================== MONEY / CATS ===================== */
const formatRs = (x) => "Rs " + Number(x || 0).toLocaleString();
const uniqueCategories = () =>
  [...new Set(products.map((p) => p.category).filter(Boolean))].sort();

/* ===================== UTIL ===================== */
const debounce = (fn, wait = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
};

/* ===================== AUTH (JWT + Legacy) ===================== */
// Token utils
function getJWT() {
  return localStorage.getItem(LS_JWT) || "";
}
function setJWT(token) {
  if (token) localStorage.setItem(LS_JWT, token);
  else localStorage.removeItem(LS_JWT);
}
// Optional decode (to show remaining time or auto logout)
function parseJWT(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
function jwtExpired() {
  const t = getJWT();
  if (!t) return true;
  const p = parseJWT(t);
  if (!p?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= p.exp;
}

// Centralized headers for protected calls
function adminHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getJWT();
  if (token && !jwtExpired()) {
    headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }
  // fallback legacy header (if admin password stored)
  const pwd = localStorage.getItem(LS_ADMIN_PASS) || "";
  if (pwd) headers["x-admin-password"] = pwd;
  return headers;
}

/* ----- JWT Login Modal (no HTML change needed) ----- */
let jwtModalEl = null;
function ensureJwtModal() {
  if (jwtModalEl) return jwtModalEl;
  const wrap = document.createElement("div");
  wrap.id = "jwt-login-modal";
  wrap.style.cssText = `
    position:fixed; inset:0; display:none; align-items:center; justify-content:center;
    background:rgba(0,0,0,.45); z-index:4000; padding:16px;
  `;
  wrap.innerHTML = `
    <div style="background:var(--card); color:var(--text); width:95%; max-width:420px; border-radius:16px; padding:16px; box-shadow:var(--shadow-2); position:relative">
      <button id="jwtClose" style="position:absolute; right:12px; top:8px; background:transparent; border:none; color:var(--muted); font-size:20px; cursor:pointer">&times;</button>
      <h3 style="margin:4px 0 10px">Admin Login (JWT)</h3>
      <div style="display:flex; flex-direction:column; gap:10px">
        <input id="jwtEmail" type="email" placeholder="Admin email" style="padding:10px 12px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:var(--bg); color:var(--text)">
        <input id="jwtPass" type="password" placeholder="Password" style="padding:10px 12px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:var(--bg); color:var(--text)">
        <button id="jwtDoLogin" class="buy-now" style="width:100%">Login</button>
        <div class="hint" style="font-size:.85rem; color:var(--muted)">Tip: You can still use the old password-only login if you like.</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  jwtModalEl = wrap;

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) jwtModalHide();
  });
  wrap.querySelector("#jwtClose").onclick = jwtModalHide;
  wrap.querySelector("#jwtDoLogin").onclick = doJwtLogin;
  return wrap;
}
function jwtModalShow() {
  ensureJwtModal();
  jwtModalEl.style.display = "flex";
}
function jwtModalHide() {
  if (jwtModalEl) jwtModalEl.style.display = "none";
}
async function doJwtLogin() {
  const email = jwtModalEl.querySelector("#jwtEmail").value.trim();
  const pwd = jwtModalEl.querySelector("#jwtPass").value.trim();
  if (!email || !pwd) {
    showToast("Email & password are required.");
    return;
  }
  try {
    const res = await safeFetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pwd })
    });
    if (!res?.token) throw new Error("Login failed");
    setJWT(res.token);
    // (optional) also keep isAdmin flag for UI
    isAdmin = true;
    localStorage.setItem(LS_ADMIN_MODE, "true");
    showToast("Logged in (JWT).");
    jwtModalHide();
    refreshAdminUI();
    // re-render so edit/delete overlay appears
    renderProducts();
  } catch (e) {
    console.error(e);
    showToast("JWT login failed.");
  }
}

/* ===================== SAFE FETCH (401 auto-login) ===================== */
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const err = new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    // handle no content
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return await res.json();
  } catch (e) {
    // If protected route got 401 and we had a token → ask to login again
    if (e?.status === 401 && (getJWT() || localStorage.getItem(LS_ADMIN_PASS))) {
      // clear bad token
      setJWT("");
      // Note: keep legacy password; server may still allow header path.
      // Ask admin to login (JWT recommended)
      jwtModalShow();
      showToast("Session expired / unauthorized. Please login.");
    }
    throw e;
  }
}

/* ===================== API + FALLBACK ===================== */
async function apiGetProducts() {
  const localSeed = JSON.parse(localStorage.getItem(LS_PRODUCTS) || "null");
  try {
    if (skels) skels.style.display = "grid";
    const data = await safeFetch(`${API_URL}/products`, { cache: "no-store" });
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(data || []));
    return data || [];
  } catch (e) {
    console.warn("API failed, falling back to local cache.", e);
    if (localSeed?.length) return localSeed;
    // minimal seed
    return [
      { id: 1, name: "Marsea Herbal Oil (150 ml)", category: "Hair Oil", price: 800, image: "marsea-oil.jpg", details: "100% pure herbal hair oil — coconut, castor, olive + amla, bhringraj, methi, hibiscus, neem, kalonji, aloe, rosemary." },
      { id: 2, name: "Apricot Kernel Oil (100 ml)", category: "Hair Oil", price: 700, image: "apricot.jpg", details: "Light, vitamin-rich oil for scalp nourishment & shine." },
      { id: 3, name: "Natural Teeth Whitening Powder", category: "Teeth Whitener", price: 500, image: "teeth.jpg", details: "Charcoal + gentle abrasives for stain removal." },
      { id: 4, name: "Aloe Vera Skin Toner", category: "Skin Toners", price: 750, image: "face-toner.jpg", details: "Aloe, cucumber, honey & rose water for hydration." }
    ];
  } finally {
    if (skels) skels.style.display = "none";
  }
}

async function apiCreateProduct(p) {
  return safeFetch(`${API_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(p)
  });
}

async function apiUpdateProduct(id, p) {
  return safeFetch(`${API_URL}/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders()
    },
    body: JSON.stringify(p)
  });
}

async function apiDeleteProduct(id) {
  return safeFetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
    headers: { ...adminHeaders() }
  });
}

/* ===================== SEARCH ===================== */
const onSearch = debounce((v) => {
  currentSearch = (v || "").toLowerCase();
  renderProducts();
}, 220);
searchInput?.addEventListener("input", (e) => onSearch(e.target.value));

/* ===================== SORT ===================== */
sortSelect?.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderProducts();
});
function applySort(list) {
  const L = [...list];
  switch (sortMode) {
    case "price-asc": return L.sort((a, b) => (+a.price || 0) - (+b.price || 0));
    case "price-desc": return L.sort((a, b) => (+b.price || 0) - (+a.price || 0));
    case "name-asc": return L.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    case "name-desc": return L.sort((a, b) => String(b.name).localeCompare(String(a.name)));
    default: return L; // featured
  }
}

/* ===================== CATEGORY CHIPS ===================== */
function populateCategoryChips(active = "All") {
  currentFilterCat = active;
  categoryButtons.innerHTML = "";
  const base = ["All", ...uniqueCategories()];
  const cats = showWishlistOnly ? ["Wishlist"] : base;

  cats.forEach((cat) => {
    const b = document.createElement("button");
    b.textContent = cat;
    if (cat === active) b.classList.add("active");
    b.onclick = () => {
      if (cat === "Wishlist") {
        showWishlistOnly = true;
        currentFilterCat = "All";
      } else {
        showWishlistOnly = false;
        currentFilterCat = cat;
      }
      populateCategoryChips(showWishlistOnly ? "Wishlist" : currentFilterCat);
      renderProducts();
    };
    categoryButtons.appendChild(b);
  });
}

/* ===================== PRICE CHIP ===================== */
function hookPriceChip() {
  const chip = document.getElementById("priceChip");
  if (!chip) return;
  const minI = chip.querySelector(".min");
  const maxI = chip.querySelector(".max");
  const apply = chip.querySelector(".price-apply");
  const clear = chip.querySelector(".price-clear");

  minI.value = priceMin;
  maxI.value = priceMax;

  apply.onclick = () => {
    priceMin = minI.value;
    priceMax = maxI.value;
    renderProducts();
  };
  clear.onclick = () => {
    priceMin = priceMax = "";
    minI.value = "";
    maxI.value = "";
    renderProducts();
  };
  [minI, maxI].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply.click();
    })
  );
}

/* ===================== FILTERED LIST ===================== */
function filteredList() {
  let list = [...products];

  if (showWishlistOnly) list = list.filter((p) => wishlist.includes(p.id));
  else if (currentFilterCat !== "All") list = list.filter((p) => p.category === currentFilterCat);

  if (currentSearch) {
    const s = currentSearch;
    list = list.filter(
      (p) =>
        p.name?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s) ||
        (p.details || "").toLowerCase().includes(s)
    );
  }

  const min = priceMin !== "" ? Number(priceMin) : null;
  const max = priceMax !== "" ? Number(priceMax) : null;
  if (min !== null) list = list.filter((p) => (+p.price || 0) >= min);
  if (max !== null) list = list.filter((p) => (+p.price || 0) <= max);

  return applySort(list);
}

/* ===================== RENDER PRODUCTS ===================== */
function renderProducts() {
  hookPriceChip();

  const list = filteredList();
  productList.innerHTML = "";
  emptyState && (emptyState.style.display = list.length ? "none" : "block");

  list.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.id = `product-${product.id}`;

    const imgWrap = document.createElement("div");
    imgWrap.className = "product-image";

    // overlay actions: heart + admin
    const overlay = document.createElement("div");
    overlay.className = "overlay-actions";
    const left = document.createElement("div");
    left.className = "overlay-left";
    const right = document.createElement("div");
    right.className = "overlay-right";

    // wishlist heart
    const heart = document.createElement("button");
    heart.className = "overlay-btn heart";
    heart.innerHTML = '<i class="fa-regular fa-heart"></i>';
    if (wishlist.includes(product.id)) heart.classList.add("active");
    heart.onclick = (e) => {
      e.stopPropagation();
      if (wishlist.includes(product.id)) {
        wishlist = wishlist.filter((id) => id !== product.id);
        heart.classList.remove("active");
        showToast("Removed from wishlist");
      } else {
        wishlist.push(product.id);
        heart.classList.add("active");
        showToast("Added to wishlist");
      }
      saveWishlist();
      updateBadges();
      if (showWishlistOnly) renderProducts();
    };
    left.appendChild(heart);

    // admin edit/delete (appear only if isAdmin flag ON)
    if (isAdmin) {
      const edit = document.createElement("button");
      edit.className = "overlay-btn";
      edit.innerHTML = '<i class="fa-solid fa-pen"></i>';
      const del = document.createElement("button");
      del.className = "overlay-btn danger";
      del.innerHTML = '<i class="fa-solid fa-trash"></i>';

      edit.onclick = (e) => {
        e.stopPropagation();
        startEdit(product);
      };
      del.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${product.name}"?`)) return;
        try {
          await apiDeleteProduct(product.id);
          products = products.filter((p) => p.id !== product.id);
          saveProductsLocal();
          populateCategoryChips(currentFilterCat);
          renderProducts();
          populateCategoryDropdown();
          showToast("Product deleted");
        } catch (err) {
          if (err?.status === 401) showToast("Unauthorized — login required.");
          else showToast("Delete failed.");
        }
      };

      right.append(edit, del);
    }

    overlay.append(left, right);

    const img = document.createElement("img");
    img.src = product.image;
    img.alt = product.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => {
      img.src = "placeholder.png";
    };

    imgWrap.append(overlay, img);
    imgWrap.onclick = () => showDetails(product);

    const content = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "title";
    h3.textContent = product.name;
    h3.onclick = () => showDetails(product);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formatRs(product.price);

    const qty = document.createElement("div");
    qty.className = "quantity-control";
    const minus = document.createElement("button");
    minus.className = "qty-minus";
    minus.textContent = "-";
    const val = document.createElement("span");
    val.textContent = "1";
    const plus = document.createElement("button");
    plus.className = "qty-plus";
    plus.textContent = "+";
    minus.onclick = () => { val.textContent = String(Math.max(1, +val.textContent - 1)); };
    plus.onclick = () => { val.textContent = String(+val.textContent + 1); };
    qty.append(minus, val, plus);

    const actions = document.createElement("div");
    actions.className = "actions";

    const add = document.createElement("button");
    add.className = "btn btn-ghost";
    add.textContent = "Add to Cart";

    const buy = document.createElement("button");
    buy.className = "btn btn-primary";
    buy.textContent = "Buy on WhatsApp";

    add.onclick = () => {
      addToCart(product, +val.textContent);
      renderCart();
      updateBadges();
      showToast("Added to cart");
    };
    buy.onclick = () => {
      const q = +val.textContent;
      const msg = `Hello, I want to buy ${q} x ${product.name} for Rs ${product.price * q}`;
      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    actions.append(add, buy);

    content.append(h3, price, qty, actions);
    card.append(imgWrap, content);
    productList.appendChild(card);
  });
}

/* ===================== MODAL ===================== */
function showDetails(p) {
  modalProduct = p;
  modalImg.src = p.image;
  modalImg.alt = p.name;
  modalTitle.textContent = p.name;
  modalDetails.textContent = p.details || "";
  modalPrice.textContent = formatRs(p.price);
  if (modalQtySpan) modalQtySpan.textContent = "1";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modalProduct = null;
}
modalClose?.addEventListener("click", closeModal);
window.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
modalQtyMinus?.addEventListener("click", () => {
  modalQtySpan.textContent = String(Math.max(1, +modalQtySpan.textContent - 1));
});
modalQtyPlus?.addEventListener("click", () => {
  modalQtySpan.textContent = String(+modalQtySpan.textContent + 1);
});
modalBuy?.addEventListener("click", () => {
  if (!modalProduct) return;
  const q = +modalQtySpan.textContent;
  const msg = `Hello, I want to buy ${q} x ${modalProduct.name} for Rs ${modalProduct.price * q}`;
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
});

/* ===================== ADMIN UI ===================== */
function refreshAdminUI() {
  if (isAdmin) {
    adminLoginWrap.style.display = "none";
    productForm.style.display = "flex";
    adminActionSection.style.display = "block";
  } else {
    adminLoginWrap.style.display = "flex";
    productForm.style.display = "none";
    adminActionSection.style.display = "none";
  }
  // re-render for overlay buttons
  renderProducts();
}

adminGear?.addEventListener("click", () => {
  adminSidebar.classList.add("open");
  adminSidebar.setAttribute("aria-hidden", "false");
  refreshAdminUI();
});

adminClose?.addEventListener("click", () => {
  adminSidebar.classList.remove("open");
  adminSidebar.setAttribute("aria-hidden", "true");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    adminSidebar.classList.remove("open");
    adminSidebar.setAttribute("aria-hidden", "true");
  }
});

/* 
   Existing login button behavior kept:
   - If password entered in the single field => legacy mode (x-admin-password)
   - PLUS: we show a JWT login modal so you can login securely with email+password too.
*/
adminLoginBtn?.addEventListener("click", () => {
  const pwd = (adminPass.value || "").trim();
  if (pwd) {
    // Legacy mode (still supported)
    localStorage.setItem(LS_ADMIN_PASS, pwd);
    isAdmin = true;
    localStorage.setItem(LS_ADMIN_MODE, "true");
    adminPass.value = "";
    refreshAdminUI();
    showToast("Admin mode ON (legacy).");
  } else {
    // Encourage JWT login if no legacy password entered
    jwtModalShow();
  }
});

adminExitBtn?.addEventListener("click", () => {
  isAdmin = false;
  localStorage.setItem(LS_ADMIN_MODE, "false");
  localStorage.removeItem(LS_ADMIN_PASS);
  setJWT("");
  refreshAdminUI();
  showToast("Admin mode OFF");
});

function populateCategoryDropdown() {
  selCategory.innerHTML = `<option value="">Select a category</option>`;
  uniqueCategories().forEach((cat) => {
    const o = document.createElement("option");
    o.value = cat;
    o.textContent = cat;
    selCategory.appendChild(o);
  });
}

let editingId = null;

productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return alert("Login as admin first.");
  const idVal = inpId.value ? +inpId.value : null;
  const name = (inpName.value || "").trim();
  const categorySelect = selCategory.value;
  const newCategory = (inpNewCategory.value || "").trim();
  const price = parseFloat(inpPrice.value);
  const details = (inpDetails.value || "").trim();
  const url = (inpImageURL.value || "").trim();
  const file = inpImageFile.files[0];

  if (!name || (!categorySelect && !newCategory) || isNaN(price) || (!url && !file)) {
    alert("Fill all required fields (name, category, price, image).");
    return;
  }
  const category = newCategory || categorySelect;

  let imageData = url;
  if (file) {
    try {
      imageData = await fileToBase64(file);
    } catch {
      showToast("Image read failed.");
      return;
    }
  }

  const payload = { name, category, price, image: imageData, details };

  try {
    if (idVal || editingId) {
      const id = idVal || editingId;
      const updated = await apiUpdateProduct(id, payload);
      const idx = products.findIndex((p) => p.id === id);
      if (idx > -1 && updated) products[idx = idx] = updated; // ensure assignment
      showToast("Product updated");
    } else {
      const created = await apiCreateProduct(payload);
      if (created) products.push(created);
      showToast("Product added");
    }

    saveProductsLocal();
    productForm.reset();
    inpId.value = "";
    selCategory.value = "";
    inpNewCategory.value = "";

    populateCategoryDropdown();
    populateCategoryChips(currentFilterCat);
    renderProducts();
  } catch (err) {
    if (err?.status === 401) {
      showToast("Unauthorized — please login.");
      jwtModalShow();
    } else {
      alert("Save failed (API).");
    }
  } finally {
    editingId = null;
  }
});

formReset?.addEventListener("click", () => {
  editingId = null;
  productForm.reset();
  inpId.value = "";
  selCategory.value = "";
});

function startEdit(p) {
  editingId = p.id;
  inpId.value = p.id;
  inpName.value = p.name;
  inpPrice.value = p.price;
  inpDetails.value = p.details;

  if (uniqueCategories().includes(p.category)) {
    selCategory.value = p.category;
    inpNewCategory.value = "";
  } else {
    selCategory.value = "";
    inpNewCategory.value = p.category;
  }
  inpImageURL.value = p.image && !String(p.image).startsWith("data:") ? p.image : "";
  adminSidebar.classList.add("open");
  refreshAdminUI();
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ===================== CART ===================== */
function addToCart(p, qty = 1) {
  // ensure unique per product id
  const ex = cart.find((i) => i.id === p.id);
  if (ex) ex.qty += qty;
  else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty });
  saveCart();
}
function removeFromCart(id) {
  cart = cart.filter((i) => i.id !== id);
  saveCart();
}
function updateCartQty(id, delta) {
  const it = cart.find((i) => i.id === id);
  if (!it) return;
  it.qty = Math.max(1, it.qty + delta);
  saveCart();
}
const cartTotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);

function renderCart() {
  cartItems.innerHTML = "";
  if (!cart.length) {
    cartItems.innerHTML = '<div class="empty">Your cart is empty.</div>';
  } else {
    cart.forEach((it) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <img src="${it.image}" alt="${it.name}" onerror="this.src='placeholder.png'">
        <div class="cart-info">
          <div class="cart-title">${it.name}</div>
          <div class="cart-price">${formatRs(it.price)}</div>
          <div class="quantity-control sm">
            <button class="c-minus" aria-label="Decrease">-</button>
            <span>${it.qty}</span>
            <button class="c-plus" aria-label="Increase">+</button>
          </div>
        </div>
        <button class="c-remove" title="Remove" aria-label="Remove">&times;</button>`;
      row.querySelector(".c-minus").onclick = () => {
        updateCartQty(it.id, -1);
        renderCart();
        updateBadges();
      };
      row.querySelector(".c-plus").onclick = () => {
        updateCartQty(it.id, 1);
        renderCart();
        updateBadges();
      };
      row.querySelector(".c-remove").onclick = () => {
        removeFromCart(it.id);
        renderCart();
        updateBadges();
      };
      cartItems.appendChild(row);
    });
  }
  cartSubtotal.textContent = formatRs(cartTotal());
}

const openCart = () => cartDrawer.classList.add("open");
const closeCart = () => cartDrawer.classList.remove("open");

cartBtn?.addEventListener("click", () => {
  renderCart();
  openCart();
});
cartClose?.addEventListener("click", closeCart);
cartClear?.addEventListener("click", () => {
  if (cart.length && confirm("Clear cart?")) {
    cart = [];
    saveCart();
    renderCart();
    updateBadges();
  }
});
cartCheckout?.addEventListener("click", () => {
  if (!cart.length) return;
  const lines = cart.map((i) => `• ${i.qty} x ${i.name} — Rs ${i.price * i.qty}`);
  const msg = `Hello! I want to order:\n${lines.join("\n")}\n\nTotal: Rs ${cartTotal()}`;
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
});

/* ===================== WISHLIST TOGGLE ===================== */
wishlistBtn?.addEventListener("click", () => {
  showWishlistOnly = !showWishlistOnly;
  showToast(showWishlistOnly ? "Showing Wishlist" : "Showing All Products");
  currentFilterCat = "All";
  populateCategoryChips(showWishlistOnly ? "Wishlist" : "All");
  renderProducts();
});
function updateBadges() {
  const cartQty = cart.reduce((a, b) => a + b.qty, 0);
  if (cartCount) cartCount.textContent = String(cartQty);
  if (wishlistCount) wishlistCount.textContent = String(wishlist.length);
}

/* ===================== TESTIMONIALS ===================== */
function slideTestimonials(d) {
  if (!testiTrack) return;
  const cards = testiTrack.querySelectorAll(".testi-card");
  if (!cards.length) return;
  testiIndex = (testiIndex + d + cards.length) % cards.length;
  const w = cards[0].offsetWidth + 16;
  testiTrack.style.transform = `translateX(${-testiIndex * w}px)`;
}
testiPrev?.addEventListener("click", () => slideTestimonials(-1));
testiNext?.addEventListener("click", () => slideTestimonials(+1));
setInterval(() => slideTestimonials(1), 6000);

/* ===================== SCROLL FX ===================== */
document.addEventListener("scroll", () => {
  document.querySelectorAll(".fade-in").forEach((s) => {
    const t = s.getBoundingClientRect().top;
    if (t < window.innerHeight - 100) s.classList.add("show");
  });
});
document.dispatchEvent(new Event("scroll"));

/* ===================== DEEP LINK ===================== */
window.addEventListener("hashchange", () => {
  const id = location.hash.replace("#product-", "");
  if (id) {
    const el = document.getElementById(`product-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("pulse");
      setTimeout(() => el.classList.remove("pulse"), 1000);
    }
  }
});

/* ===================== INIT ===================== */
async function init() {
  try {
    products = await apiGetProducts();
    // Normalize Mongo _id -> id if backend sends _id
    products = products.map((p) => ({
      ...p,
      id: p.id ?? p._id ?? p.id
    }));
    saveProductsLocal();
  } catch (e) {
    console.error(e);
  }
  populateCategoryDropdown();
  populateCategoryChips("All");
  hookPriceChip();
  renderProducts();
  refreshAdminUI();
  updateBadges();
}
init();

/* ===================== EXTRAS ===================== */
// Ctrl+/ toggle admin sidebar (desktop)
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    const open = adminSidebar.classList.contains("open");
    if (open) {
      adminSidebar.classList.remove("open");
      adminSidebar.setAttribute("aria-hidden", "true");
    } else {
      adminSidebar.classList.add("open");
      adminSidebar.setAttribute("aria-hidden", "false");
      refreshAdminUI();
    }
  }
});

// offline/online toast
window.addEventListener("offline", () => showToast("You are offline. Some features may not work."));
window.addEventListener("online", () => showToast("Back online!"));

// ensure badges even if DOM delayed
setTimeout(updateBadges, 0);

// warn if admin UI on but no credential
if (isAdmin && !getJWT() && !localStorage.getItem(LS_ADMIN_PASS)) {
  console.warn("Admin mode ON but no JWT or legacy password stored.");
                                                      }
