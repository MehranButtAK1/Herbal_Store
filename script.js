/* ===========================
   CONFIG / STATE
=========================== */
const API_URL = "https://herbalbackend-production.up.railway.app"; // backend base
const WA_NUMBER = "923115121207";

const LS_KEY = "products_v2";
const ADMIN_KEY = "isAdmin";
const THEME_KEY = "theme";
const ADMIN_PASSWORD = "123";

const LS_WISHLIST = "wishlist_v1";
const LS_CART = "cart_v1";

let products = [];
let isAdmin = localStorage.getItem(ADMIN_KEY) === "true";
let currentFilterCat = "All";
let currentSearch = "";

let wishlist = JSON.parse(localStorage.getItem(LS_WISHLIST) || "[]");
let cart = JSON.parse(localStorage.getItem(LS_CART) || "[]");
let showWishlistOnly = false;

/* ===========================
   ELEMENTS
=========================== */
const navToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const darkToggle = document.getElementById("darkToggle");
const searchInput = document.getElementById("search");

const productList = document.getElementById("product-list");
const categoryButtons = document.getElementById("category-buttons");
const skeletonGrid = document.getElementById("skeleton-grid");
const emptyState = document.getElementById("empty-state");

const modal = document.getElementById("product-modal");
const modalClose = document.getElementById("modal-close");
const modalImg = document.getElementById("modal-image");
const modalTitle = document.getElementById("modal-title");
const modalDetails = document.getElementById("modal-details");
const modalPrice = document.getElementById("modal-price");
const modalBuy = document.getElementById("modal-buy");
const modalAddCart = document.getElementById("modal-add-cart");
const modalQtyWrap = document.getElementById("modal-qty");
const modalQtyMinus = modalQtyWrap.querySelector(".qty-minus");
const modalQtyPlus = modalQtyWrap.querySelector(".qty-plus");
const modalQtySpan = modalQtyWrap.querySelector("span");

const adminGear = document.getElementById("admin-gear");
const adminSidebar = document.getElementById("admin-sidebar");
const adminClose = document.getElementById("admin-close");
const adminLoginWrap = document.getElementById("admin-login");
const adminPass = document.getElementById("admin-pass");
const adminLoginBtn = document.getElementById("admin-login-btn");
const productForm = document.getElementById("product-form");
const adminActionSection = document.getElementById("admin-action-section");
const adminExitBtn = document.getElementById("admin-exit");

const inpId = document.getElementById("prod-id");
const inpName = document.getElementById("prod-name");
const selCategory = document.getElementById("prod-category-select");
const inpNewCategory = document.getElementById("prod-category-new");
const inpPrice = document.getElementById("prod-price");
const inpImageURL = document.getElementById("prod-image-url");
const inpImageFile = document.getElementById("prod-image-file");
const inpDetails = document.getElementById("prod-details");
const formReset = document.getElementById("form-reset");

const toastContainer = document.getElementById("toast-container");

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

/* Testimonials */
const testiTrack = document.getElementById("testiTrack");
const testiPrev = document.getElementById("testiPrev");
const testiNext = document.getElementById("testiNext");

/* ===========================
   THEME
=========================== */
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved === "dark") document.documentElement.classList.add("dark");
})();
darkToggle.addEventListener("click", ()=>{
  document.documentElement.classList.toggle("dark");
  localStorage.setItem(THEME_KEY,
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
});

/* ===========================
   NAV MOBILE TOGGLE
=========================== */
navToggle.addEventListener("click", ()=> {
  navLinks.classList.toggle("show");
});
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', function() {
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    this.classList.add('active');
    navLinks.classList.remove("show");
  });
});

/* ===========================
   HELPERS
=========================== */
function showToast(msg){
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(()=>{ t.remove(); }, 2600);
}
function saveWishlist(){ localStorage.setItem(LS_WISHLIST, JSON.stringify(wishlist)); }
function saveCart(){ localStorage.setItem(LS_CART, JSON.stringify(cart)); }
function formatRs(x){ return "Rs " + Number(x||0).toLocaleString(); }

/* ===========================
   BACKEND SYNC
=========================== */
async function apiGetProducts(){
  try{
    const res = await fetch(`${API_URL}/products`, { cache: "no-store" });
    if(!res.ok) throw new Error("Failed");
    return await res.json();
  }catch(err){
    console.error(err);
    showToast("Failed to load products, showing local items.");
    return JSON.parse(localStorage.getItem(LS_KEY)) || [
      {
        id: "p1",
        name: "Marsea Herbal Oil (150 ml)",
        category: "Hair Oil",
        price: 800,
        image: "marsea-oil.jpg",
        details: "100% pure herbal hair oil, crafted with coconut oil, castor oil, and olive oil, enriched with amla, bhringraj, fenugreek, hibiscus, neem, black seeds, aloe vera, and rosemary. Strengthens roots, promotes hair growth, soothes the scalp, and is suitable for all hair types."
      },
      {
        id: "p2",
        name: "Apricot Kernel Oil (100ml)",
        category: "Hair Oil",
        price: 700,
        image: "apricot.jpg",
        details: "Lightweight oil rich in vitamins A, C, and E; nourishes the scalp, improves shine, and strengthens hair follicles."
      },
      {
        id: "p3",
        name: "Natural Teeth Whitening Powder",
        category: "Teeth Whitener",
        price: 500,
        image: "teeth.jpg",
        details: "Herbal formula for naturally whiter teeth without harsh chemicals."
      }
    ];
  }
}
async function apiCreateProduct(p){
  const res = await fetch(`${API_URL}/products`,{
    method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(p)
  });
  if(!res.ok) throw new Error("Create failed");
  return res.json();
}
async function apiUpdateProduct(id,p){
  const res = await fetch(`${API_URL}/products/${id}`,{
    method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(p)
  });
  if(!res.ok) throw new Error("Update failed");
  return res.json();
}
async function apiDeleteProduct(id){
  const res = await fetch(`${API_URL}/products/${id}`,{ method:"DELETE" });
  if(!res.ok) throw new Error("Delete failed");
  return res.json();
}

/* ===========================
   LOCAL PERSIST (fallback)
=========================== */
function saveProductsLocal(){
  localStorage.setItem(LS_KEY, JSON.stringify(products));
}
function uniqueCategories(){
  return [...new Set(products.map(p => p.category))].sort();
}

/* ===========================
   CATEGORY CHIPS + DROPDOWN
=========================== */
function populateCategoryChips(active = "All"){
  currentFilterCat = active;
  categoryButtons.innerHTML = "";
  const base = ["All", ...uniqueCategories()];
  const cats = showWishlistOnly ? ["Wishlist"] : base;

  cats.forEach(cat=>{
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.className = cat === active ? "active" : "";
    btn.addEventListener("click", ()=> {
      if(cat === "Wishlist"){
        showWishlistOnly = true;
        currentFilterCat = "All";
      }else{
        showWishlistOnly = false;
        populateCategoryChips(cat);
      }
      renderProducts();
    });
    categoryButtons.appendChild(btn);
  });

  if(!showWishlistOnly){
    [...categoryButtons.children].forEach(b=>{
      if(b.textContent === active) b.classList.add("active");
    });
  }
}
function populateCategoryDropdown(){
  selCategory.innerHTML = '<option value="">Select a category</option>';
  uniqueCategories().forEach(cat=>{
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    selCategory.appendChild(opt);
  });
}

/* ===========================
   SEARCH
=========================== */
searchInput.addEventListener("input", ()=>{
  currentSearch = (searchInput.value || "").toLowerCase();
  renderProducts();
});

/* ===========================
   RENDER PRODUCTS
=========================== */
function filteredList(){
  let list = products;

  if(showWishlistOnly){
    list = list.filter(p => wishlist.includes(p.id));
  }else if(currentFilterCat !== "All"){
    list = list.filter(p => p.category === currentFilterCat);
  }
  if(currentSearch){
    list = list.filter(p =>
      p.name.toLowerCase().includes(currentSearch) ||
      p.category.toLowerCase().includes(currentSearch) ||
      (p.details||"").toLowerCase().includes(currentSearch)
    );
  }
  return list;
}

function setSkeletons(n=6){
  if(!skeletonGrid) return;
  skeletonGrid.innerHTML = "";
  for(let i=0;i<n;i++){
    const s = document.createElement("div");
    s.className = "skel-card";
    s.innerHTML = `<div class="skel-img"></div><div class="skel-line"></div><div class="skel-line" style="width:60%"></div>`;
    skeletonGrid.appendChild(s);
  }
}
function clearSkeletons(){
  if(skeletonGrid) skeletonGrid.innerHTML = "";
}

function renderProducts(){
  const list = filteredList();
  productList.innerHTML = "";
  if(emptyState) emptyState.style.display = list.length ? "none" : "block";

  list.forEach((product)=>{
    const card = document.createElement("div");
    card.className = "product-card";
    card.setAttribute("data-id", product.id);

    card.innerHTML = `
      <div class="card-actions" style="${isAdmin?'':'display:none'}">
        <button class="edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn danger" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>

      <button class="wish-btn" title="Add to wishlist"><i class="fa-regular fa-heart"></i></button>

      <div class="product-image">
        <img src="${product.image}" alt="${product.name}">
      </div>

      <h3 class="title">${product.name}</h3>
      <div class="price">${formatRs(product.price)}</div>

      <div class="quantity-control">
        <button class="qty-minus" aria-label="Decrease">-</button>
        <span>1</span>
        <button class="qty-plus" aria-label="Increase">+</button>
      </div>

      <button class="buy-now">Buy on WhatsApp</button>
    `;

    // Wishlist state
    const wishBtn = card.querySelector(".wish-btn");
    if(wishlist.includes(product.id)) wishBtn.classList.add("active");
    wishBtn.addEventListener("click", ()=>{
      if(wishlist.includes(product.id)){
        wishlist = wishlist.filter(id => id !== product.id);
        wishBtn.classList.remove("active");
        showToast("Removed from wishlist");
      }else{
        wishlist.push(product.id);
        wishBtn.classList.add("active");
        showToast("Added to wishlist");
      }
      saveWishlist();
      updateBadges();
      if(showWishlistOnly) renderProducts();
    });

    // Image fallback
    const img = card.querySelector("img");
    img.addEventListener("error", ()=>{
      img.src = "placeholder.png";
      img.alt = product.name + " (image missing)";
    });

    // Open modal on image/title click
    card.querySelector(".product-image").addEventListener("click", ()=> showDetails(product));
    card.querySelector(".title").addEventListener("click", ()=> showDetails(product));

    // Quantity controls
    const qtySpan = card.querySelector(".quantity-control span");
    card.querySelector(".qty-minus").addEventListener("click", ()=>{
      qtySpan.textContent = Math.max(1, parseInt(qtySpan.textContent) - 1);
    });
    card.querySelector(".qty-plus").addEventListener("click", ()=>{
      qtySpan.textContent = parseInt(qtySpan.textContent) + 1;
    });

    // Buy on WhatsApp from card
    card.querySelector(".buy-now").addEventListener("click", ()=>{
      const qty = parseInt(qtySpan.textContent);
      const message = `Hello, I want to buy ${qty} x ${product.name} for Rs ${product.price * qty}`;
      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
    });

    // Admin actions
    const editBtn = card.querySelector(".edit-btn");
    const delBtn = card.querySelector(".delete-btn");
    if(editBtn){
      editBtn.addEventListener("click", ()=> startEdit(product));
    }
    if(delBtn){
      delBtn.addEventListener("click", async ()=>{
        if(confirm(`Delete "${product.name}"?`)){
          try{
            await apiDeleteProduct(product.id);
            products = products.filter(p => p.id !== product.id);
            saveProductsLocal();
            populateCategoryChips(currentFilterCat);
            renderProducts();
            populateCategoryDropdown();
            showToast("Product deleted");
          }catch(e){
            console.error(e);
            showToast("Delete failed");
          }
        }
      });
    }

    productList.appendChild(card);
  });
}

/* ===========================
   MODAL
=========================== */
let modalProduct = null;

function showDetails(product){
  modalProduct = product;
  modalImg.src = product.image;
  modalTitle.textContent = product.name;
  modalDetails.textContent = product.details;
  modalPrice.textContent = formatRs(product.price);
  modalQtySpan.textContent = "1";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modalProduct = null;
}
modalClose.addEventListener("click", closeModal);
window.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });
window.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeModal(); });

// modal qty + buy + add-to-cart
modalQtyMinus.addEventListener("click", ()=>{
  modalQtySpan.textContent = Math.max(1, parseInt(modalQtySpan.textContent) - 1);
});
modalQtyPlus.addEventListener("click", ()=>{
  modalQtySpan.textContent = parseInt(modalQtySpan.textContent) + 1;
});
modalBuy.addEventListener("click", ()=>{
  if(!modalProduct) return;
  const qty = parseInt(modalQtySpan.textContent);
  const message = `Hello, I want to buy ${qty} x ${modalProduct.name} for Rs ${modalProduct.price * qty}`;
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
});
modalAddCart.addEventListener("click", ()=>{
  if(!modalProduct) return;
  const qty = parseInt(modalQtySpan.textContent);
  addToCart(modalProduct, qty);
  showToast("Added to cart");
  updateBadges();
  renderCart();
});

/* ===========================
   ADMIN SIDEBAR
=========================== */
adminGear.addEventListener("click", ()=>{
  adminSidebar.classList.add("open");
  adminSidebar.setAttribute("aria-hidden","false");
  refreshAdminUI();
});
adminClose.addEventListener("click", ()=>{
  adminSidebar.classList.remove("open");
  adminSidebar.setAttribute("aria-hidden","true");
});
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") {
    adminSidebar.classList.remove("open");
    adminSidebar.setAttribute("aria-hidden","true");
  }
});
function refreshAdminUI(){
  if(isAdmin){
    adminLoginWrap.style.display = "none";
    productForm.style.display = "flex";
    adminActionSection.style.display = "block";
    document.querySelectorAll(".card-actions").forEach(el => el.style.display = "flex");
  }else{
    adminLoginWrap.style.display = "flex";
    productForm.style.display = "none";
    adminActionSection.style.display = "none";
    document.querySelectorAll(".card-actions").forEach(el => el.style.display = "none");
  }
}
adminLoginBtn.addEventListener("click", ()=>{
  const val = (adminPass.value || "").trim();
  if(val === ADMIN_PASSWORD){
    isAdmin = true;
    localStorage.setItem(ADMIN_KEY, "true");
    adminPass.value = "";
    refreshAdminUI();
    showToast("Admin mode ON");
  }else{
    alert("Incorrect password!");
  }
});
adminExitBtn && adminExitBtn.addEventListener("click", ()=>{
  isAdmin = false;
  localStorage.setItem(ADMIN_KEY, "false");
  refreshAdminUI();
  showToast("Admin mode OFF");
});

/* ===========================
   ADD / EDIT PRODUCT (CRUD)
=========================== */
let editingId = null;

productForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!isAdmin){ alert("Login as admin first."); return; }

  const idVal = inpId.value ? inpId.value : null; // keep string ids from backend
  const name = inpName.value.trim();
  const categorySelect = selCategory.value;
  const newCategory = inpNewCategory.value.trim();
  const price = parseFloat(inpPrice.value);
  const details = inpDetails.value.trim();
  const url = inpImageURL.value.trim();
  const file = inpImageFile.files[0];

  if(!name || (!categorySelect && !newCategory) || isNaN(price) || !details || (!url && !file)){
    alert("Fill all required fields and provide an image (filename/URL or upload).");
    return;
  }
  const category = newCategory || categorySelect;

  let imageData = url;
  if(file){
    imageData = await fileToBase64(file);
  }

  const payload = { name, category, price, image: imageData, details };

  try{
    if(idVal || editingId){
      const idToUse = idVal || editingId;
      const updated = await apiUpdateProduct(idToUse, payload);
      const idx = products.findIndex(p=> p.id === idToUse);
      if(idx !== -1) products[idx] = updated;
      showToast("Product updated");
    }else{
      const created = await apiCreateProduct(payload);
      products.push(created);
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
  }catch(err){
    console.error(err);
    alert("Save failed. Please try again.");
  }
});

formReset.addEventListener("click", ()=>{
  editingId = null;
  productForm.reset();
  inpId.value = "";
  selCategory.value = "";
});

function startEdit(product){
  editingId = product.id;
  inpId.value = product.id;
  inpName.value = product.name;
  inpPrice.value = product.price;
  inpDetails.value = product.details;

  if(uniqueCategories().includes(product.category)){
    selCategory.value = product.category;
    inpNewCategory.value = "";
  }else{
    selCategory.value = "";
    inpNewCategory.value = product.category;
  }
  inpImageURL.value = product.image && !product.image.startsWith("data:") ? product.image : "";

  adminSidebar.classList.add("open");
  refreshAdminUI();
}

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ===========================
   CART (✅ DISTINCT ITEMS FIX)
=========================== */
function addToCart(product, qty=1){
  // ensure unique per product.id
  const existing = cart.find(i => i.id === product.id);
  if(existing){
    existing.qty += qty;
  }else{
    cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, qty });
  }
  saveCart();
}
function removeFromCart(id){
  cart = cart.filter(i => i.id !== id);
  saveCart();
}
function updateCartQty(id, delta){
  const item = cart.find(i => i.id === id);
  if(!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
}
function cartTotal(){
  return cart.reduce((sum,i)=> sum + (i.price * i.qty), 0);
}
function renderCart(){
  cartItems.innerHTML = "";
  if(cart.length === 0){
    cartItems.innerHTML = `<div class="empty">Your cart is empty.</div>`;
  }else{
    cart.forEach(item=>{
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <img src="${item.image}" alt="${item.name}" onerror="this.src='placeholder.png'">
        <div class="cart-info">
          <div class="cart-title">${item.name}</div>
          <div class="cart-price">${formatRs(item.price)}</div>
          <div class="quantity-control sm">
            <button class="c-minus">-</button>
            <span>${item.qty}</span>
            <button class="c-plus">+</button>
          </div>
        </div>
        <button class="c-remove" title="Remove">&times;</button>
      `;
      row.querySelector(".c-minus").addEventListener("click", ()=>{
        updateCartQty(item.id, -1); renderCart(); updateBadges();
      });
      row.querySelector(".c-plus").addEventListener("click", ()=>{
        updateCartQty(item.id, +1); renderCart(); updateBadges();
      });
      row.querySelector(".c-remove").addEventListener("click", ()=>{
        removeFromCart(item.id); renderCart(); updateBadges();
      });
      cartItems.appendChild(row);
    });
  }
  cartSubtotal.textContent = formatRs(cartTotal());
}
function openCart(){ cartDrawer.classList.add("open"); }
function closeCart(){ cartDrawer.classList.remove("open"); }

cartBtn && cartBtn.addEventListener("click", ()=>{ renderCart(); openCart(); });
cartClose && cartClose.addEventListener("click", closeCart);
cartClear && cartClear.addEventListener("click", ()=>{
  if(cart.length && confirm("Clear cart?")){
    cart = [];
    saveCart();
    renderCart();
    updateBadges();
  }
});
cartCheckout && cartCheckout.addEventListener("click", ()=>{
  if(!cart.length) return;
  const lines = cart.map(i => `• ${i.qty} x ${i.name} — Rs ${i.price * i.qty}`);
  const total = cartTotal();
  const msg = `Hello! I want to order:\n${lines.join("\n")}\n\nTotal: Rs ${total}`;
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
});

/* ===========================
   WISHLIST
=========================== */
wishlistBtn && wishlistBtn.addEventListener("click", ()=>{
  showWishlistOnly = !showWishlistOnly;
  if(showWishlistOnly){
    showToast("Showing Wishlist");
    currentFilterCat = "All";
  }else{
    showToast("Showing All Products");
  }
  populateCategoryChips(currentFilterCat);
  renderProducts();
});
function updateBadges(){
  const cartQty = cart.reduce((a,b)=> a + b.qty, 0);
  if(cartCount) cartCount.textContent = cartQty;
  if(wishlistCount) wishlistCount.textContent = wishlist.length;
}

/* ===========================
   TESTIMONIALS SLIDER
=========================== */
let testiIndex = 0;
function slideTestimonials(dir){
  if(!testiTrack) return;
  const cards = testiTrack.querySelectorAll(".testi-card");
  if(!cards.length) return;
  testiIndex = (testiIndex + dir + cards.length) % cards.length;
  const w = cards[0].offsetWidth + 16; // gap
  testiTrack.style.transform = `translateX(${-testiIndex * w}px)`;
}
testiPrev && testiPrev.addEventListener("click", ()=> slideTestimonials(-1));
testiNext && testiNext.addEventListener("click", ()=> slideTestimonials(+1));
setInterval(()=> slideTestimonials(1), 6000);

/* ===========================
   INIT
=========================== */
async function init(){
  try{
    setSkeletons();
    products = await apiGetProducts();

    // 🔒 Ensure each product has a stable unique id (string allowed)
    products = products.map(p => ({ ...p, id: (p.id ?? cryptoRandomId()) }));

    saveProductsLocal();
  }catch(e){
    console.error(e);
  }finally{
    clearSkeletons();
  }
  populateCategoryDropdown();
  populateCategoryChips("All");
  renderProducts();
  refreshAdminUI();
  updateBadges();

  // Home/About Fade-in on scroll
  document.addEventListener("scroll", () => {
    document.querySelectorAll(".fade-in").forEach(section => {
      const sectionTop = section.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      if (sectionTop < windowHeight - 100) section.classList.add("show");
    });
  });
  document.dispatchEvent(new Event("scroll"));
}
init();

function cryptoRandomId(){
  return 'p-' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
}
