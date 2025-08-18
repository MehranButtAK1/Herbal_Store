/* =========================================================
   Herbal Store — script.js (Stable PRO Build)
   Stack: Vanilla JS + Fetch + localStorage
   Notes:
   - Fully aligned with your CSS theme (variables, classes, ids).
   - Cart fix: each item tracked by a stable cartKey (server id when available).
   - Works with backend (Railway) + local cache fallback.
   - Admin CRUD with x-admin-password header.
   - Wishlist, Cart Drawer, WhatsApp checkout, Modal, Categories, Sort, Search, Price Filter.
   - Deep links (#product-ID), skeletons, toasts, fade-ins, a11y.
========================================================= */

/* ===================== CONFIG ===================== */
const API_URL = "https://herbalbackend-production.up.railway.app";
const WA_NUMBER = "923115121207"; // WhatsApp number (no +)

/* localStorage keys */
const LS_PRODUCTS = "products_v2";
const LS_WISHLIST = "wishlist_v2";
const LS_CART = "cart_v2";
const LS_THEME = "theme";
const LS_ADMIN_MODE = "isAdmin";
const LS_ADMIN_PASS = "adminPassword";

/* ===================== STATE ===================== */
let products = [];
let isAdmin = localStorage.getItem(LS_ADMIN_MODE) === "true";
let wishlist = readJSON(LS_WISHLIST, []);
let cart = readJSON(LS_CART, []); // [{cartKey, id, name, price, image, qty}]
let currentFilterCat = "All";
let currentSearch = "";
let showWishlistOnly = false;
let sortMode = "featured";
let priceMin = "";
let priceMax = "";
let modalProduct = null;
let testiIndex = 0;
let editingId = null;

/* ===================== ELEMENTS ===================== */
// nav / theme
const navToggle = qs("#menu-toggle");
const navLinks = qs("#nav-links");
const darkToggle = qs("#darkToggle");

// products toolbar & grids
const searchInput = qs("#search");
const sortSelect = qs("#sort");
const categoryButtons = qs("#category-buttons");
const productList = qs("#product-list");
const emptyState = qs("#empty-state");
const skels = qs("#skeletons");

// modal
const modal = qs("#product-modal");
const modalClose = qs("#modal-close");
const modalImg = qs("#modal-image");
const modalTitle = qs("#modal-title");
const modalDetails = qs("#modal-details");
const modalPrice = qs("#modal-price");
const modalBuy = qs("#modal-buy");
const modalQtyWrap = qs("#modal-qty");
const modalQtyMinus = modalQtyWrap?.querySelector(".qty-minus");
const modalQtyPlus = modalQtyWrap?.querySelector(".qty-plus");
const modalQtySpan = modalQtyWrap?.querySelector("span");

// admin
const adminGear = qs("#admin-gear");
const adminSidebar = qs("#admin-sidebar");
const adminClose = qs("#admin-close");
const adminLoginWrap = qs("#admin-login");
const adminPass = qs("#admin-pass");
const adminLoginBtn = qs("#admin-login-btn");
const productForm = qs("#product-form");
const adminActionSection = qs("#admin-action-section");
const adminExitBtn = qs("#admin-exit");

// form inputs
const inpId = qs("#prod-id");
const inpName = qs("#prod-name");
const selCategory = qs("#prod-category-select");
const inpNewCategory = qs("#prod-category-new");
const inpPrice = qs("#prod-price");
const inpImageURL = qs("#prod-image-url");
const inpImageFile = qs("#prod-image-file");
const inpDetails = qs("#prod-details");
const formReset = qs("#form-reset");

// cart / wishlist
const cartBtn = qs("#cartBtn");
const wishlistBtn = qs("#wishlistBtn");
const cartDrawer = qs("#cart-drawer");
const cartClose = qs("#cartClose");
const cartItems = qs("#cartItems");
const cartSubtotal = qs("#cartSubtotal");
const cartCheckout = qs("#cartCheckout");
const cartClear = qs("#cartClear");
const cartCount = qs("#cartCount");
const wishlistCount = qs("#wishlistCount");

// toasts
const toastContainer = qs("#toast-container");

// testimonials
const testiTrack = qs("#testiTrack");
const testiPrev = qs("#testiPrev");
const testiNext = qs("#testiNext");

/* ===================== THEME (via :root.dark) ===================== */
(() => {
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
document.querySelectorAll(".nav-links a").forEach((a) => {
  a.addEventListener("click", () => {
    document.querySelectorAll(".nav-links a").forEach((x) =>
      x.classList.remove("active")
    );
    a.classList.add("active");
    navLinks?.classList.remove("show");
  });
});

/* ===================== HELPERS ===================== */
function qs(sel, root = document) {
  return root.querySelector(sel);
}
function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
function readJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, v) {
  localStorage.setItem(key, JSON.stringify(v));
}
function showToast(msg) {
  if (!toastContainer) return alert(msg);
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
const formatRs = (x) => "Rs " + Number(x || 0).toLocaleString();

function debounce(fn, wait = 300) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

/* Stable unique key for cart items:
   - Prefer numeric/string server id if present
   - else derive from name+price+image (hashed-ish) */
function makeCartKey(p) {
  if (p.id !== undefined && p.id !== null && p.id !== "") {
    return `id:${String(p.id)}`;
  }
  const raw = `${p.name}__${p.price}__${p.image || ""}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `vk:${hash}`;
}

/* Attach admin header if available */
function adminHeaders(extra = {}) {
  const pwd = localStorage.getItem(LS_ADMIN_PASS) || "";
  const headers = { ...extra };
  if (pwd) headers["x-admin-password"] = pwd;
  return headers;
}

/* Safe fetch wrapper */
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const err = new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return await res.json();
  } catch (e) {
    console.error("Fetch error:", e);
    throw e;
  }
}

/* ===================== API + FALLBACK ===================== */
async function apiGetProducts() {
  const fromLS = readJSON(LS_PRODUCTS, null);
  try {
    skels && (skels.style.display = "grid");
    const data = await safeFetch(`${API_URL}/products`, { cache: "no-store" });
    saveJSON(LS_PRODUCTS, data || []);
    return data || [];
  } catch (e) {
    console.warn("API failed, using cache/local seed.", e);
    if (fromLS && fromLS.length) return fromLS;
    return [
      {
        id: 1,
        name: "Marsea Herbal Oil (150 ml)",
        category: "Hair Oil",
        price: 800,
        image: "marsea-oil.jpg",
        details:
          "100% pure herbal hair oil — coconut, castor, olive + amla, bhringraj, methi, hibiscus, neem, kalonji, aloe, rosemary."
      },
      {
        id: 2,
        name: "Apricot Kernel Oil (100 ml)",
        category: "Hair Oil",
        price: 700,
        image: "apricot.jpg",
        details: "Light, vitamin-rich oil for scalp nourishment & shine."
      },
      {
        id: 3,
        name: "Natural Teeth Whitening Powder",
        category: "Teeth Whitener",
        price: 500,
        image: "teeth.jpg",
        details: "Charcoal + gentle abrasives for stain removal."
      },
      {
        id: 4,
        name: "Aloe Vera Skin Toner",
        category: "Skin Toners",
        price: 750,
        image: "face-toner.jpg",
        details: "Aloe, cucumber, honey & rose water for hydration."
      }
    ];
  } finally {
    skels && (skels.style.display = "none");
  }
}

async function apiCreateProduct(p) {
  return safeFetch(`${API_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(p)
  });
}
async function apiUpdateProduct(id, p) {
  return safeFetch(`${API_URL}/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(p)
  });
}
async function apiDeleteProduct(id) {
  return safeFetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
}

/* ===================== PRODUCTS / FILTERS ===================== */
function uniqueCategories() {
  return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
}

const onSearch = debounce((v) => {
  currentSearch = (v || "").toLowerCase();
  renderProducts();
}, 220);
searchInput?.addEventListener("input", (e) => onSearch(e.target.value));

sortSelect?.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderProducts();
});
function applySort(list) {
  const L = [...list];
  switch (sortMode) {
    case "price-asc":
      return L.sort((a, b) => (+a.price || 0) - (+b.price || 0));
    case "price-desc":
      return L.sort((a, b) => (+b.price || 0) - (+a.price || 0));
    case "name-asc":
      return L.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    case "name-desc":
      return L.sort((a, b) => String(b.name).localeCompare(String(a.name)));
    default:
      return L;
  }
}

function populateCategoryChips(active = "All") {
  currentFilterCat = active;
  if (!categoryButtons) return;
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

function hookPriceChip() {
  const chip = qs("#priceChip");
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

function filteredList() {
  let list = [...products];

  if (showWishlistOnly) list = list.filter((p) => wishlist.includes(safeId(p)));
  else if (currentFilterCat !== "All")
    list = list.filter((p) => p.category === currentFilterCat);

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

function safeId(p) {
  return p.id ?? makeCartKey(p); // prefer server id, else derived
}

/* ===================== RENDER PRODUCTS ===================== */
function renderProducts() {
  hookPriceChip();

  const list = filteredList();
  if (!productList) return;
  productList.innerHTML = "";
  if (emptyState) emptyState.style.display = list.length ? "none" : "block";

  list.forEach((product) => {
    const pid = safeId(product);

    const card = document.createElement("div");
    card.className = "product-card";
    card.id = `product-${pid}`;

    // image area
    const imgWrap = document.createElement("div");
    imgWrap.className = "product-image";

    // overlay actions container
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
    if (wishlist.includes(pid)) heart.classList.add("active");
    heart.onclick = (e) => {
      e.stopPropagation();
      if (wishlist.includes(pid)) {
        wishlist = wishlist.filter((id) => id !== pid);
        heart.classList.remove("active");
        showToast("Removed from wishlist");
      } else {
        wishlist.push(pid);
        heart.classList.add("active");
        showToast("Added to wishlist");
      }
      saveJSON(LS_WISHLIST, wishlist);
      updateBadges();
      if (showWishlistOnly) renderProducts();
    };
    left.appendChild(heart);

    if (isAdmin) {
      const edit = document.createElement("button");
      edit.className = "overlay-btn";
      edit.innerHTML = '<i class="fa-solid fa-pen"></i>';
      edit.onclick = (e) => {
        e.stopPropagation();
        startEdit(product);
      };

      const del = document.createElement("button");
      del.className = "overlay-btn danger";
      del.innerHTML = '<i class="fa-solid fa-trash"></i>';
      del.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${product.name}"?`)) return;
        try {
          const r = await apiDeleteProduct(product.id);
          if (r && r.success) {
            products = products.filter((p) => p.id !== product.id);
            saveJSON(LS_PRODUCTS, products);
            populateCategoryChips(currentFilterCat);
            renderProducts();
            populateCategoryDropdown();
            showToast("Product deleted");
          } else {
            showToast("Delete failed (server).");
          }
        } catch (err) {
          if (err?.status === 401) showToast("Unauthorized — wrong admin password.");
          else showToast("Delete failed.");
        }
      };

      right.append(edit, del);
    }

    overlay.append(left, right);

    // image element
    const img = document.createElement("img");
    img.src = product.image;
    img.alt = product.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => (img.src = "placeholder.png");

    imgWrap.append(overlay, img);
    imgWrap.onclick = () => showDetails(product);

    /* content */
    const content = document.createElement("div");

    const h3 = document.createElement("h3");
    h3.className = "title";
    h3.textContent = product.name;
    h3.onclick = () => showDetails(product);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formatRs(product.price);

    // qty chooser
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
    minus.onclick = () => (val.textContent = String(Math.max(1, +val.textContent - 1)));
    plus.onclick = () => (val.textContent = String(+val.textContent + 1));
    qty.append(minus, val, plus);

    // actions
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
  if (modalImg) {
    modalImg.src = p.image;
    modalImg.alt = p.name;
  }
  if (modalTitle) modalTitle.textContent = p.name;
  if (modalDetails) modalDetails.textContent = p.details || "";
  if (modalPrice) modalPrice.textContent = formatRs(p.price);
  if (modalQtySpan) modalQtySpan.textContent = "1";
  if (modal) {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
}
function closeModal() {
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modalProduct = null;
}
modalClose?.addEventListener("click", closeModal);
window.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
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

/* ===================== ADMIN ===================== */
function refreshAdminUI() {
  if (!adminLoginWrap || !productForm || !adminActionSection) return;
  if (isAdmin) {
    adminLoginWrap.style.display = "none";
    productForm.style.display = "flex";
    adminActionSection.style.display = "block";
  } else {
    adminLoginWrap.style.display = "flex";
    productForm.style.display = "none";
    adminActionSection.style.display = "none";
  }
  renderProducts(); // so edit/delete overlay updates
}

adminGear?.addEventListener("click", () => {
  adminSidebar?.classList.add("open");
  adminSidebar?.setAttribute("aria-hidden", "false");
  refreshAdminUI();
});
adminClose?.addEventListener("click", () => {
  adminSidebar?.classList.remove("open");
  adminSidebar?.setAttribute("aria-hidden", "true");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    adminSidebar?.classList.remove("open");
    adminSidebar?.setAttribute("aria-hidden", "true");
  }
});

adminLoginBtn?.addEventListener("click", () => {
  const pwd = (adminPass.value || "").trim();
  if (!pwd) return alert("Enter admin password.");
  localStorage.setItem(LS_ADMIN_PASS, pwd);
  isAdmin = true;
  localStorage.setItem(LS_ADMIN_MODE, "true");
  adminPass.value = "";
  refreshAdminUI();
  showToast("Admin mode ON");
});

adminExitBtn?.addEventListener("click", () => {
  isAdmin = false;
  localStorage.setItem(LS_ADMIN_MODE, "false");
  localStorage.removeItem(LS_ADMIN_PASS);
  refreshAdminUI();
  showToast("Admin mode OFF");
});

function populateCategoryDropdown() {
  if (!selCategory) return;
  selCategory.innerHTML = `<option value="">Select a category</option>`;
  uniqueCategories().forEach((cat) => {
    const o = document.createElement("option");
    o.value = cat;
    o.textContent = cat;
    selCategory.appendChild(o);
  });
}

productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return alert("Login as admin first (password required).");

  const idVal = inpId.value ? +inpId.value : null;
  const name = (inpName.value || "").trim();
  const categorySelect = selCategory.value;
  const newCategory = (inpNewCategory.value || "").trim();
  const price = parseFloat(inpPrice.value);
  const details = (inpDetails.value || "").trim();
  const url = (inpImageURL.value || "").trim();
  const file = inpImageFile.files[0];

  if (!name || (!categorySelect && !newCategory) || isNaN(price) || !details || (!url && !file)) {
    alert("Fill all fields and at least one image (URL or Upload).");
    return;
  }

  const category = newCategory || categorySelect;
  let imageData = url;
  if (file) {
    try {
      imageData = await fileToBase64(file);
    } catch {
      return showToast("Image read failed.");
    }
  }

  const payload = { name, category, price, image: imageData, details };

  try {
    if (idVal || editingId) {
      const id = idVal || editingId;
      const updated = await apiUpdateProduct(id, payload);
      const idx = products.findIndex((p) => p.id === id);
      if (idx > -1 && updated) products[idx] = updated;
      showToast("Product updated");
    } else {
      const created = await apiCreateProduct(payload);
      if (created) products.push(created);
      showToast("Product added");
    }

    saveJSON(LS_PRODUCTS, products);
    productForm.reset();
    inpId.value = "";
    selCategory.value = "";
    inpNewCategory.value = "";

    populateCategoryDropdown();
    populateCategoryChips(currentFilterCat);
    renderProducts();
  } catch (err) {
    if (err?.status === 401) showToast("Unauthorized — wrong admin password.");
    else alert("Save failed (API).");
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
  inpId.value = p.id ?? "";
  inpName.value = p.name ?? "";
  inpPrice.value = p.price ?? "";
  inpDetails.value = p.details ?? "";

  if (uniqueCategories().includes(p.category)) {
    selCategory.value = p.category;
    inpNewCategory.value = "";
  } else {
    selCategory.value = "";
    inpNewCategory.value = p.category || "";
  }
  inpImageURL.value =
    p.image && !String(p.image).startsWith("data:") ? p.image : "";

  adminSidebar?.classList.add("open");
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

/* ===================== CART (FIXED UNIQUE ITEMS) ===================== */
function addToCart(p, qty = 1) {
  const cartKey = makeCartKey(p); // stable per product
  const existing = cart.find((i) => i.cartKey === cartKey);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      cartKey,
      id: p.id ?? null,
      name: p.name,
      price: +p.price || 0,
      image: p.image,
      qty: Math.max(1, qty)
    });
  }
  saveJSON(LS_CART, cart);
}
function removeFromCart(cartKey) {
  cart = cart.filter((i) => i.cartKey !== cartKey);
  saveJSON(LS_CART, cart);
}
function updateCartQty(cartKey, delta) {
  const it = cart.find((i) => i.cartKey === cartKey);
  if (!it) return;
  it.qty = Math.max(1, it.qty + delta);
  saveJSON(LS_CART, cart);
}
const cartTotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);

function renderCart() {
  if (!cartItems) return;
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
        <button class="c-remove" title="Remove" aria-label="Remove">&times;</button>
      `;
      row.querySelector(".c-minus").onclick = () => {
        updateCartQty(it.cartKey, -1);
        renderCart();
        updateBadges();
      };
      row.querySelector(".c-plus").onclick = () => {
        updateCartQty(it.cartKey, 1);
        renderCart();
        updateBadges();
      };
      row.querySelector(".c-remove").onclick = () => {
        removeFromCart(it.cartKey);
        renderCart();
        updateBadges();
      };
      cartItems.appendChild(row);
    });
  }
  if (cartSubtotal) cartSubtotal.textContent = formatRs(cartTotal());
}

const openCart = () => cartDrawer?.classList.add("open");
const closeCart = () => cartDrawer?.classList.remove("open");

cartBtn?.addEventListener("click", () => {
  renderCart();
  openCart();
});
cartClose?.addEventListener("click", closeCart);
cartClear?.addEventListener("click", () => {
  if (cart.length && confirm("Clear cart?")) {
    cart = [];
    saveJSON(LS_CART, cart);
    renderCart();
    updateBadges();
  }
});
cartCheckout?.addEventListener("click", () => {
  if (!cart.length) return;
  const lines = cart.map(
    (i) => `• ${i.qty} x ${i.name} — Rs ${i.price * i.qty}`
  );
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

/* ===================== TESTIMONIALS SLIDER ===================== */
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

/* ===================== SCROLL FADE-IN ===================== */
document.addEventListener("scroll", () => {
  qsa(".fade-in").forEach((s) => {
    const t = s.getBoundingClientRect().top;
    if (t < window.innerHeight - 100) s.classList.add("show");
  });
});
document.dispatchEvent(new Event("scroll"));

/* ===================== DEEP LINK (#product-ID) ===================== */
window.addEventListener("hashchange", () => {
  const id = decodeURIComponent(location.hash.replace("#product-", ""));
  if (!id) return;
  const el = document.getElementById(`product-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("pulse");
    setTimeout(() => el.classList.remove("pulse"), 1000);
  }
});

/* ===================== INIT ===================== */
async function init() {
  try {
    products = await apiGetProducts();
    // Persist cache
    saveJSON(LS_PRODUCTS, products);
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
// Ctrl+/ toggles admin sidebar
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    const open = adminSidebar?.classList.contains("open");
    if (open) {
      adminSidebar?.classList.remove("open");
      adminSidebar?.setAttribute("aria-hidden", "true");
    } else {
      adminSidebar?.classList.add("open");
      adminSidebar?.setAttribute("aria-hidden", "false");
      refreshAdminUI();
    }
  }
});
// Offline/online toasts
window.addEventListener("offline", () =>
  showToast("You are offline. Some features may not work.")
);
window.addEventListener("online", () => showToast("Back online!"));
// Defensive initial badges
setTimeout(updateBadges, 0);
// Warn if admin on but no password saved
if (isAdmin && !localStorage.getItem(LS_ADMIN_PASS)) {
  console.warn(
    "Admin mode ON but no password stored — server writes will fail (401)."
  );
}

/* ===================== UTILS ===================== */
function assertNumber(v, def = 0) {
  const n = +v;
  return Number.isFinite(n) ? n : def;
}
/* END */
