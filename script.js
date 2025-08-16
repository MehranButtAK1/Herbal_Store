/* ===========================
   BACKEND + PERSISTENCE
=========================== */
// ✅ Correct base to avoid /api/api
const API_BASE = "https://herbalbackend-production.up.railway.app";
const API_PRODUCTS = `${API_BASE}/api/products`;

// LocalStorage keys (keep your existing behavior)
const LS_KEY = "products_v2";
const ADMIN_KEY = "isAdmin";
const THEME_KEY = "theme";
const ADMIN_PASSWORD = "123";

// Fallback seed (same as yours)
let products = JSON.parse(localStorage.getItem(LS_KEY)) || [
  {
    id: 1,
    name: "Marsea Herbal Oil (150 ml)",
    category: "Hair Oil",
    price: 800,
    image: "marsea-oil.jpg",
    details: "100% pure herbal hair oil, crafted with coconut oil, castor oil, and olive oil, enriched with amla, bhringraj, fenugreek, hibiscus, neem, black seeds, aloe vera, and rosemary. Strengthens roots, promotes hair growth, soothes the scalp, and is suitable for all hair types."
  },
  {
    id: 2,
    name: "Apricot Kernel Oil (100ml)",
    category: "Hair Oil",
    price: 700,
    image: "apricot.jpg",
    details: "Lightweight oil rich in vitamins A, C, and E; nourishes the scalp, improves shine, and strengthens hair follicles. Ideal for daily use, sensitive scalps, and those seeking a non-greasy, hydrating treatment that promotes softness and reduces frizz."
  },
  {
    id: 3,
    name: "Natural Teeth Whitening Powder",
    category: "Teeth Whitener",
    price: 500,
    image: "teeth.jpg",
    details: "Herbal formula for naturally whiter teeth without harsh chemicals, crafted with activated charcoal and gentle natural abrasives. Safe for daily use, removes stains, promotes gum health, and leaves a fresh, clean feel with a subtle mint flavor."
  },
  {
    id: 4,
    name: "Aloe Vera Skin Toner",
    category: "Skin Toners",
    price: 750,
    image: "face-toner.jpg",
    details: "Hydrates skin and soothes irritation with a gentle, all-natural formula crafted from aloe vera, cucumber, honey, and rose water. Aloe vera calms redness, cucumber refreshes and tightens pores, honey locks in moisture, and rose water balances skin tone. Suitable for all skin types."
  },
];

let isAdmin = localStorage.getItem(ADMIN_KEY) === "true";
let currentFilterCat = "All";
let currentSearch = "";

/* ===========================
   ELEMENTS (same as yours)
=========================== */
const navToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const darkToggle = document.getElementById("darkToggle");
const searchInput = document.getElementById("search");

const productList = document.getElementById("product-list");
const categoryButtons = document.getElementById("category-buttons");

const modal = document.getElementById("product-modal");
const modalClose = document.getElementById("modal-close");
const modalImg = document.getElementById("modal-image");
const modalTitle = document.getElementById("modal-title");
const modalDetails = document.getElementById("modal-details");
const modalPrice = document.getElementById("modal-price");
const modalBuy = document.getElementById("modal-buy");
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

/* ===========================
   THEME (unchanged)
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
function saveProductsLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(products)); }
function uniqueCategories(){ return [...new Set(products.map(p => p.category))].sort(); }
function normalize(p){
  // Ensure backend/LS shapes align
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    image: p.image,
    details: p.details
  };
}

/* ===========================
   API WRAPPER (with graceful fallback)
=========================== */
async function apiGetAll(){
  try{
    const res = await fetch(API_PRODUCTS, {headers:{Accept:"application/json"}});
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if(Array.isArray(data)){
      products = data.map(normalize);
      saveProductsLocal(); // cache
    }
  }catch(err){
    console.warn("GET failed, using localStorage cache:", err);
    products = JSON.parse(localStorage.getItem(LS_KEY)) || products;
  }
}

async function apiCreate(body){
  try{
    const res = await fetch(API_PRODUCTS, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error(await res.text());
    return await res.json();
  }catch(err){
    console.warn("POST failed, saving locally:", err);
    // Local fallback
    const newId = products.length ? Math.max(...products.map(p=>p.id||0))+1 : 1;
    const local = {...body, id:newId};
    products.push(local);
    saveProductsLocal();
    return local;
  }
}

async function apiUpdate(id, body){
  try{
    const res = await fetch(`${API_PRODUCTS}/${id}`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error(await res.text());
    return await res.json();
  }catch(err){
    console.warn("PUT failed, updating locally:", err);
    const idx = products.findIndex(p=>p.id===id);
    if(idx>-1){ products[idx] = {...body, id}; saveProductsLocal(); }
    return products.find(p=>p.id===id);
  }
}

async function apiDelete(id){
  try{
    const res = await fetch(`${API_PRODUCTS}/${id}`, { method:"DELETE" });
    if(!res.ok) throw new Error(await res.text());
  }catch(err){
    console.warn("DELETE failed, removing locally:", err);
  }finally{
    products = products.filter(p=>p.id!==id);
    saveProductsLocal();
  }
}

/* ===========================
   CATEGORY CHIPS + DROPDOWN
=========================== */
function populateCategoryChips(active = "All"){
  currentFilterCat = active;
  categoryButtons.innerHTML = "";
  const cats = ["All", ...uniqueCategories()];
  cats.forEach(cat=>{
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.className = cat === active ? "active" : "";
    btn.addEventListener("click", ()=> {
      populateCategoryChips(cat);
      renderProducts();
    });
    categoryButtons.appendChild(btn);
  });
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
   FILTER + RENDER
=========================== */
function filteredList(){
  let list = products;
  if(currentFilterCat !== "All"){
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

function renderProducts(){
  productList.innerHTML = "";
  const list = filteredList();

  list.forEach((product)=>{
    const card = document.createElement("div");
    card.className = "product-card";
    card.setAttribute("data-id", product.id);

    card.innerHTML = `
      <div class="card-actions" style="${isAdmin?'':'display:none'}">
        <button class="edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn danger" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>

      <div class="product-image">
        <img src="${product.image}" alt="${product.name}">
      </div>

      <h3 class="title">${product.name}</h3>
      <div class="price">Rs ${Number(product.price).toLocaleString()}</div>

      <div class="quantity-control">
        <button class="qty-minus" aria-label="Decrease">-</button>
        <span>1</span>
        <button class="qty-plus" aria-label="Increase">+</button>
      </div>

      <button class="buy-now">Buy on WhatsApp</button>
    `;

    // fallback image
    const img = card.querySelector("img");
    img.addEventListener("error", ()=>{
      img.src = "placeholder.png";
      img.alt = product.name + " (image missing)";
    });

    // open modal
    card.querySelector(".product-image").addEventListener("click", ()=> showDetails(product));
    card.querySelector(".title").addEventListener("click", ()=> showDetails(product));

    // qty
    const qtySpan = card.querySelector(".quantity-control span");
    card.querySelector(".qty-minus").addEventListener("click", ()=>{
      qtySpan.textContent = Math.max(1, parseInt(qtySpan.textContent) - 1);
    });
    card.querySelector(".qty-plus").addEventListener("click", ()=>{
      qtySpan.textContent = parseInt(qtySpan.textContent) + 1;
    });

    // WhatsApp
    card.querySelector(".buy-now").addEventListener("click", ()=>{
      const qty = parseInt(qtySpan.textContent);
      const message = `Hello, I want to buy ${qty} x ${product.name} for Rs ${product.price * qty}`;
      window.open(`https://wa.me/923115121207?text=${encodeURIComponent(message)}`, "_blank");
    });

    // admin buttons
    const editBtn = card.querySelector(".edit-btn");
    const delBtn = card.querySelector(".delete-btn");
    if(editBtn){
      editBtn.addEventListener("click", ()=> startEdit(product));
    }
    if(delBtn){
      delBtn.addEventListener("click", async ()=>{
        if(confirm(`Delete "${product.name}"?`)){
          await apiDelete(product.id);   // backend + local fallback
          populateCategoryChips(currentFilterCat);
          renderProducts();
          populateCategoryDropdown();
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
  modalPrice.textContent = `Rs ${Number(product.price).toLocaleString()}`;
  modalQtySpan.textContent = "1";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}
modalClose.addEventListener("click", closeModal);
window.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });
window.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeModal(); });
function closeModal(){
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modalProduct = null;
}
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
  window.open(`https://wa.me/923115121207?text=${encodeURIComponent(message)}`, "_blank");
});

/* ===========================
   ADMIN SIDEBAR OPEN/CLOSE
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

/* ===========================
   ADMIN LOGIN / EXIT
=========================== */
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
    alert("Admin mode enabled");
  }else{
    alert("Incorrect password!");
  }
});
adminExitBtn && adminExitBtn.addEventListener("click", ()=>{
  isAdmin = false;
  localStorage.setItem(ADMIN_KEY, "false");
  refreshAdminUI();
});

/* ===========================
   ADD / EDIT PRODUCT
=========================== */
let editingId = null;

productForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!isAdmin){ alert("Login as admin first."); return; }

  const idVal = inpId.value ? parseInt(inpId.value) : null;
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

  // Prefer file -> base64, else use URL/filename
  let imageData = url;
  if(file){
    imageData = await fileToBase64(file);
  }

  const body = { name, category, price, image: imageData, details };

  if(idVal || editingId){
    const idToUse = idVal || editingId;
    await apiUpdate(idToUse, body);
    editingId = null;
  }else{
    await apiCreate(body);
  }

  saveProductsLocal();
  productForm.reset();
  inpId.value = "";
  selCategory.value = "";
  inpNewCategory.value = "";

  await apiGetAll(); // refresh from backend if available
  populateCategoryDropdown();
  populateCategoryChips(currentFilterCat);
  renderProducts();

  alert("Saved!");
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
  inpImageURL.value = product.image && !String(product.image).startsWith("data:") ? product.image : "";

  adminSidebar.classList.add("open");
  refreshAdminUI();
}

/* Base64 helper */
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ===========================
   INIT
=========================== */
async function init(){
  await apiGetAll(); // try backend first; falls back to LS if needed
  populateCategoryDropdown();
  populateCategoryChips("All");
  renderProducts();
  refreshAdminUI();
}
init();

/* ===== Home/About fade-in animation ===== */
document.addEventListener("scroll", () => {
  document.querySelectorAll(".fade-in").forEach(section => {
    const sectionTop = section.getBoundingClientRect().top;
    const windowHeight = window.innerHeight;
    if (sectionTop < windowHeight - 100) section.classList.add("show");
  });
});
document.dispatchEvent(new Event("scroll"));
