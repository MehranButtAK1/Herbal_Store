/* =========================================================
   Herbal Store — script.js (Final PRO Build)
   Stack: Vanilla JS + Fetch + localStorage
   Features:
   - Theme toggle via :root.dark
   - Smooth nav + sticky header
   - Products: search, categories, sort, price-chip
   - Wishlist (client)
   - Cart drawer + WhatsApp checkout (client)
   - Product Quick View modal with qty
   - Admin panel (sidebar): login (client), CRUD, base64 upload
   - Backend integration (Railway):
       • GET /products
       • POST /products   (requires x-admin-password)
       • PUT  /products/:id (requires x-admin-password)
       • DELETE /products/:id (requires x-admin-password)
   - Skeletons, toasts, deep links (#product-ID), a11y
   - Defensive fallbacks (placeholder.png; API fallback to cache)
   - Clean helpers, debounced search, state persistence
========================================================= */

/* ===================== CONFIG ===================== */
const API_URL = "https://herbalbackend-production.up.railway.app"; // backend base
const WA_NUMBER = "923115121207"; // WhatsApp number (no +, no spaces)

// localStorage keys
const LS_PRODUCTS = "products_v2";
const LS_WISHLIST = "wishlist_v1";
const LS_CART = "cart_v1";
const LS_THEME = "theme";
const LS_ADMIN_MODE = "isAdmin";
const LS_ADMIN_PASS = "adminPassword"; // stores the password for x-admin-password header

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

// admin
const adminGear = document.getElementById("admin-gear");
const adminSidebar = document.getElementById("admin-sidebar");
const adminClose = document.getElementById("admin-close");

const adminLoginWrap = document.getElementById("admin-login");
const adminPass = document.getElementById("admin-pass");
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

/* ===================== THEME (via :root.dark) ===================== */
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

/* ===================== HELPERS ===================== */
function showToast(msg) {
  if (!toastContainer) return alert(msg);
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const saveProductsLocal = () =>
  localStorage.setItem(LS_PRODUCTS, JSON.stringify(products));

const saveWishlist = () =>
  localStorage.setItem(LS_WISHLIST, JSON.stringify(wishlist));

const saveCart = () =>
  localStorage.setItem(LS_CART, JSON.stringify(cart));

const formatRs = (x) => "Rs " + Number(x || 0).toLocaleString();

const uniqueCategories = () =>
  [...new Set(products.map((p) => p.category).filter(Boolean))].sort();

const debounce = (fn, wait = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
};

// Attach admin password header from localStorage (for mutating routes)
function adminHeaders(extra = {}) {
  const pwd = localStorage.getItem(LS_ADMIN_PASS) || "";
  const headers = { ...extra };
  if (pwd) headers["x-admin-password"] = pwd;
  return headers;
}

// Generic safe fetch wrapper with JSON + error handling
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const err = new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    // 204 no content guard
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
  const localSeed = JSON.parse(localStorage.getItem(LS_PRODUCTS) || "null");
  try {
    if (skels) skels.style.display = "grid";
    const data = await safeFetch(`${API_URL}/products`, { cache: "no-store" });
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(data || []));
    return data || [];
  } catch (e) {
    console.warn("API failed, falling back to local cache.", e);
    if (localSeed?.length) return localSeed;
    // very small initial seed
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
    headers: adminHeaders()
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
    case "price-asc":
      return L.sort((a, b) => (+a.price || 0) - (+b.price || 0));
    case "price-desc":
      return L.sort((a, b) => (+b.price || 0) - (+a.price || 0));
    case "name-asc":
      return L.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    case "name-desc":
      return L.sort((a, b) => String(b.name).localeCompare(String(a.name)));
    default:
      return L; // featured
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

/* ===================== PRICE CHIP (inside toolbar) ===================== */
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

  // wishlist or category filter
  if (showWishlistOnly) list = list.filter((p) => wishlist.includes(p.id));
  else if (currentFilterCat !== "All") list = list.filter((p) => p.category === currentFilterCat);

  // search
  if (currentSearch) {
    const s = currentSearch;
    list = list.filter(
      (p) =>
        p.name?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s) ||
        (p.details || "").toLowerCase().includes(s)
    );
  }

  // price
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

    // image wrapper
    const imgWrap = document.createElement("div");
    imgWrap.className = "product-image";

    // overlay: wishlist (left) + admin (right)
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

    // admin edit/delete (only if isAdmin flag ON)
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
          const r = await apiDeleteProduct(product.id);
          if (r && r.success) {
            products = products.filter((p) => p.id !== product.id);
            saveProductsLocal();
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

    // image
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

    // content
    const content = document.createElement("div");

    const h3 = document.createElement("h3");
    h3.className = "title";
    h3.textContent = product.name;
    h3.onclick = () => showDetails(product);

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formatRs(product.price);

    // qty chooser (in card)
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
    minus.onclick = () => {
      val.textContent = String(Math.max(1, +val.textContent - 1));
    };
    plus.onclick = () => {
      val.textContent = String(+val.textContent + 1);
    };
    qty.append(minus, val, plus);

    // actions row
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
// We do not hard-check password on client. We only store whatever user enters in localStorage,
// and the server validates it on POST/PUT/DELETE using "x-admin-password".
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
  // re-render so edit/delete overlay appears/disappears
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

adminLoginBtn?.addEventListener("click", () => {
  const pwd = (adminPass.value || "").trim();
  if (!pwd) {
    alert("Enter admin password.");
    return;
  }
  // Save to localStorage and enable admin UI.
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
  // clear stored password for extra safety
  localStorage.removeItem(LS_ADMIN_PASS);
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
      if (idx > -1 && updated) products[idx] = updated;
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
      showToast("Unauthorized — wrong admin password.");
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
  // Only put URL back if it wasn't base64
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
  document.querySelectorAll(".fade-in").forEach((s) => {
    const t = s.getBoundingClientRect().top;
    if (t < window.innerHeight - 100) s.classList.add("show");
  });
});
document.dispatchEvent(new Event("scroll"));

/* ===================== DEEP LINK (scroll to product-{id}) ===================== */
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

/* ===================== OPTIONAL: SMALL UTIL EXTRAS ===================== */
/* Not strictly required for core features, but helpful for UX/debug */

// Ctrl+/ to quickly toggle admin sidebar (desktop only)
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

// Basic network offline/online toasts
window.addEventListener("offline", () => showToast("You are offline. Some features may not work."));
window.addEventListener("online", () => showToast("Back online!"));

// Defensive: ensure counts visible even if DOM delayed
setTimeout(updateBadges, 0);

// Warn if admin mode is on but password is missing
if (isAdmin && !localStorage.getItem(LS_ADMIN_PASS)) {
  console.warn("Admin mode ON but no password stored — server writes will fail (401).");
}

/* ===================== END OF FILE ===================== */
