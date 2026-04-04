/* ═══════════════════════════════════════════════════════════
   BeeHarvest — customer.js  (FIXED: cart totals + coupon)
   ═══════════════════════════════════════════════════════════ */

   const API_URL = "https://beeyond-harvest-admin.onrender.com/api";
   let cart = [];
   let currentProductsPage = 1;
   let totalProductsPages = 1;
   
   /* ─── Init cart from localStorage ─────────────────────── */
   try {
     const saved = localStorage.getItem("cart");
     if (saved) cart = JSON.parse(saved);
   } catch (e) {
     cart = [];
   }
   
   /* ─── Debounce ─────────────────────────────────────────── */
   function debounce(fn, delay) {
     let timer;
     return (...args) => {
       clearTimeout(timer);
       timer = setTimeout(() => fn(...args), delay);
     };
   }
   
   /* ════════════════════════════════════════════════════════════
         API HELPER
      ════════════════════════════════════════════════════════════ */
   async function apiCall(endpoint, options = {}) {
     const response = await fetch(`${API_URL}${endpoint}`, {
       headers: { "Content-Type": "application/json" },
       ...options,
     });
     
     if (response.status === 429) {
       const retryAfter = response.headers.get("Retry-After") || 60;
       const waitSeconds = parseInt(retryAfter) || 60;
       showMaintenanceOverlay(waitSeconds);
       throw new Error(`Rate limit exceeded. Please wait ${waitSeconds} seconds.`);
     }
     
     const ct = response.headers.get("content-type") || "";
     if (!ct.includes("application/json")) {
       throw new Error(`সার্ভার থেকে অপ্রত্যাশিত রেসপন্স (HTTP ${response.status})`);
     }
     const data = await response.json();
     
     if (checkForRateLimit(data)) {
       showMaintenanceOverlay(60);
       throw new Error(data.message || "Too many requests");
     }
     
     if (!response.ok) throw new Error(data.message || "সার্ভার ত্রুটি");
     return data;
   }
   
   /* ════════════════════════════════════════════════════════════
         UTILITY
      ════════════════════════════════════════════════════════════ */
   function escHtml(str) {
     if (!str) return "";
     return String(str)
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;");
   }
   function val(id) {
     return (document.getElementById(id)?.value || "").trim();
   }
   function setText(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text;
   }
   
   function emptyMsg(msg) {
     return `<div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon"><i class="fas fa-box-open"></i></div>
          <h3>${msg}</h3>
        </div>`;
   }
   
   function errorMsg(msg) {
     return `<div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon" style="background:var(--danger-bg);color:var(--danger);">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3>${msg}</h3>
          <button class="btn-primary mt-2" onclick="location.reload()">পুনরায় চেষ্টা করুন</button>
        </div>`;
   }
   
   function skeletonCards(n) {
     return Array(n)
       .fill(0)
       .map(
         () => `
          <div class="product-card" style="pointer-events:none;">
            <div class="product-image-wrap" style="height:220px;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;animation:shimmer 1.4s infinite;"></div>
            <div class="product-info">
              <div style="height:16px;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;border-radius:4px;margin-bottom:8px;animation:shimmer 1.4s infinite;"></div>
              <div style="height:24px;width:60%;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;border-radius:4px;animation:shimmer 1.4s infinite;"></div>
            </div>
          </div>`,
       )
       .join("");
   }
   
   /* ════════════════════════════════════════════════════════════
         MODAL HELPERS
      ════════════════════════════════════════════════════════════ */
   function openModal(id) {
     const m = document.getElementById(id);
     if (m) {
       m.classList.add("active");
       document.body.style.overflow = "hidden";
       document.body.classList.add("modal-open");
     }
   }
   function closeModal(id) {
     const m = document.getElementById(id);
     if (m) {
       m.classList.remove("active");
       document.body.style.overflow = "";
       if (!document.querySelector(".modal.active")) {   
         document.body.classList.remove("modal-open");  
       }
     }
   }
   
   /* ════════════════════════════════════════════════════════════
         LOADING OVERLAY
      ════════════════════════════════════════════════════════════ */
   function showLoadingOverlay() {
     document.getElementById("loadingOverlay")?.classList.add("active");
   }
   function hideLoadingOverlay() {
     document.getElementById("loadingOverlay")?.classList.remove("active");
   }
   
   function setButtonLoading(btn, loading) {
     if (!btn) return;
     if (loading) {
       btn.disabled = true;
       btn.classList.add("btn-loading");
       btn._origHTML = btn.innerHTML;
       btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> প্রক্রিয়াকরণ...';
     } else {
       btn.disabled = false;
       btn.classList.remove("btn-loading");
       if (btn._origHTML) btn.innerHTML = btn._origHTML;
     }
   }
   
   /* ════════════════════════════════════════════════════════════
         TOAST
      ════════════════════════════════════════════════════════════ */
   const TOAST_ICONS = {
     success: "fa-check-circle",
     error: "fa-exclamation-circle",
     info: "fa-info-circle",
   };
   
   function showToast(message, type = "info") {
     document.querySelectorAll(`.toast.${type}`).forEach((t) => t.remove());
     const t = document.createElement("div");
     t.className = `toast ${type}`;
     t.innerHTML = `<i class="fas ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i><span>${escHtml(message)}</span>`;
     document.body.appendChild(t);
     setTimeout(() => t.remove(), 3500);
   }
   
   /* ════════════════════════════════════════════════════════════
         CATEGORIES
      ════════════════════════════════════════════════════════════ */
   async function loadCategories() {
     try {
       const res = await apiCall("/categories");
       if (!res.success || !res.data) return;
       const cats = res.data;
   
       const grid = document.getElementById("categoriesList");
       if (grid) {
         grid.innerHTML =
           cats.length === 0
             ? emptyMsg("কোনো ক্যাটাগরি নেই")
             : cats
                 .map(
                   (c) => `
                  <div class="category-card" onclick="filterByCategory('${c._id}')">
                    <div class="cat-icon"><i class="fas fa-tag"></i></div>
                    <h3>${escHtml(c.name)}</h3>
                  </div>`,
                 )
                 .join("");
       }
   
       const sel = document.getElementById("categoryFilter");
       if (sel) {
         sel.innerHTML =
           '<option value="">সব ক্যাটাগরি</option>' +
           cats
             .map((c) => `<option value="${c._id}">${escHtml(c.name)}</option>`)
             .join("");
       }
     } catch (e) {
       console.error("Categories:", e);
     }
   }
   
   /* ════════════════════════════════════════════════════════════
         PRODUCTS
      ════════════════════════════════════════════════════════════ */
   async function loadFeaturedProducts() {
     const grid = document.getElementById("featuredProducts");
     if (!grid) return;
     grid.innerHTML = skeletonCards(4);
     try {
       const response = await fetch(`${API_URL}/products?isFeatured=true&limit=8`);
       
       if (response.status === 429) {
         const retryAfter = response.headers.get("Retry-After") || 60;
         const waitSeconds = parseInt(retryAfter) || 60;
         showMaintenanceOverlay(waitSeconds);
         return;
       }
       
       const data = await response.json();
       
       if (checkForRateLimit(data)) {
         throw new Error("Rate limit exceeded");
       }
       
       if (!data.success) throw new Error("Invalid response");
       const products = data.data || [];
       grid.innerHTML =
         products.length === 0
           ? emptyMsg("কোনো ফিচার্ড পণ্য নেই")
           : products.map(renderProductCard).join("");

           // ✅ ADD THIS LINE HERE
    initLazyLoading();
     } catch (e) {
       console.error("Featured:", e);
       if (!e.message?.includes("rate limit")) {
         grid.innerHTML = errorMsg("ফিচার্ড পণ্য লোড করতে ব্যর্থ হয়েছে");
       }
     }
   }
   
   async function loadProducts(page = 1) {
     const grid = document.getElementById("allProducts");
     if (!grid) return;
     grid.innerHTML = skeletonCards(6);
   
     try {
       const search = document.getElementById("searchProducts")?.value.trim() || "";
       const category = document.getElementById("categoryFilter")?.value || "";
       const sort = document.getElementById("sortBy")?.value || "-createdAt";
       const priceRange = document.getElementById("priceFilter")?.value || "";
   
       const params = new URLSearchParams({ page, limit: 12 });
       if (search) params.set("search", search);
       if (category) params.set("category", category);
       if (sort) params.set("sort", sort);
       if (priceRange) {
         const [min, max] = priceRange.split("-");
         if (min) params.set("minPrice", min);
         if (max && max !== "100000") params.set("maxPrice", max);
       }
   
       const response = await fetch(`${API_URL}/products?${params}`);
       
       if (response.status === 429) {
         const retryAfter = response.headers.get("Retry-After") || 60;
         const waitSeconds = parseInt(retryAfter) || 60;
         showMaintenanceOverlay(waitSeconds);
         return;
       }
       
       const res = await response.json();
       
       if (!response.ok || checkForRateLimit(res)) {
         throw new Error(res.message || "Failed to load products");
       }
       
       const products = res.data || [];
   
       grid.innerHTML =
         products.length === 0
           ? `<div style="grid-column:1/-1;">${emptyMsg("কোনো পণ্য পাওয়া যায়নি")}</div>`
           : products.map(renderProductCard).join("");

            // ✅ ADD THIS LINE HERE - After setting innerHTML
          initLazyLoading();

       if (res.pagination) {
         totalProductsPages = res.pagination.pages || 1;
         currentProductsPage = page;
         renderPagination(
           "productsPagination",
           page,
           res.pagination.pages,
           "loadProducts",
         );
       }
     } catch (e) {
       console.error("Products:", e);
       if (!e.message?.includes("rate limit") && !e.message?.includes("Too many requests")) {
         grid.innerHTML = errorMsg("পণ্য লোড করতে ব্যর্থ হয়েছে");
         showToast("পণ্য লোড করতে সমস্যা হয়েছে", "error");
       }
     }
   }
   // Add lazy loading for product images
   function initLazyLoading() {
    const images = document.querySelectorAll("img[data-src]");
  
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
  
          // Load real image
          img.src = img.dataset.src;
  
          // Optional: smooth fade-in
          img.onload = () => {
            img.style.opacity = "1";
          };
  
          obs.unobserve(img);
        }
      });
    }, {
      rootMargin: "100px" // load a bit earlier for smooth UX
    });
  
    images.forEach(img => {
      img.style.opacity = "0"; // start hidden
      img.style.transition = "opacity 0.3s ease";
      observer.observe(img);
    });
  }

// Call this after loading products
function renderProductCard(p) {
  if (!p?._id) return "";
  const id = String(p._id);
  const safeName = escHtml(p.name || "");
  const price = p.discountPrice || p.price;
  const imgUrl = p.images?.[0]?.url || "https://via.placeholder.com/400x300?text=No+Image";
  const discount = p.discountPrice ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
  
  // Placeholder SVG for lazy loading
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999'%3E📷%3C/text%3E%3C/svg%3E";
  
  let stockClass = "", stockText = "", stockIcon = "fa-check-circle";
  if (p.stock <= 0) {
    stockClass = "out";
    stockText = "স্টকে নেই";
    stockIcon = "fa-times-circle";
  } else if (p.stock <= 10) {
    stockClass = "low";
    stockText = `শেষ ${p.stock} টি`;
    stockIcon = "fa-exclamation-circle";
  } else {
    stockText = "স্টকে আছে";
  }

  window[`__p_${id}`] = p;

  return `
    <div class="product-card" onclick="viewProduct('${id}')">
      <div class="product-image-wrap">
        <img class="product-image" data-src="${escHtml(imgUrl)}" src="${placeholder}" alt="${safeName}">
        ${discount ? `<div class="product-badge">${discount}% ছাড়</div>` : ""}
        ${p.stock <= 0 ? `<div class="product-badge out">স্টক শেষ</div>` : ""}
        ${p.stock > 0 ? `
          <button class="product-quick-add" onclick="event.stopPropagation(); addToCart('${id}', ${price}, '${escHtml(imgUrl)}')">
            <i class="fas fa-cart-plus"></i> কার্টে যোগ করুন
          </button>
        ` : ""}
      </div>
      <div class="product-info">
        <div class="product-name">${safeName}</div>
        <div class="product-price-row">
          <span class="price-final">৳${price.toLocaleString("bn-BD")}</span>
          ${p.discountPrice ? `<span class="price-original">৳${p.price.toLocaleString("bn-BD")}</span>` : ""}
          ${discount ? `<span class="price-off">${discount}% ছাড়</span>` : ""}
        </div>
        <div class="product-stock-row ${stockClass}">
          <i class="fas ${stockIcon}"></i> ${stockText}
        </div>
        <div class="product-actions">
          ${p.stock > 0 ? `
            <button class="btn-primary btn-block" onclick="event.stopPropagation(); addToCart('${id}', ${price}, '${escHtml(imgUrl)}')">
              <i class="fas fa-cart-plus"></i> কার্টে যোগ করুন
            </button>
          ` : `
            <button class="btn-ghost btn-block" disabled style="opacity:.5; cursor:not-allowed;">
              <i class="fas fa-times"></i> স্টকে নেই
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}
   
   /* ════════════════════════════════════════════════════════════
         DELIVERY CHARGE + CART TOTALS  (FIXED)
      ════════════════════════════════════════════════════════════ */

   /**
    * Fetch dynamic delivery charge from API.
    * Falls back to 60 on any error.
    */
   async function getDeliveryCharge(city, subtotal) {
     try {
       const params = new URLSearchParams();
       if (city && city.trim()) params.append("city", city.trim());
       if (subtotal !== undefined) params.append("subtotal", subtotal);
       const response = await fetch(`${API_URL}/delivery-charges/active?${params}`);
       const data = await response.json();
       if (data.success && data.data && data.data.amount !== undefined) {
         return data.data.amount;
       }
       return 60;
     } catch (error) {
       console.error("Failed to fetch delivery charge:", error);
       return 60;
     }
   }

   /**
    * FIXED cartTotalsAsync — reads from global `cart` array.
    * suppressToast: prevents showing delivery-charge toast on every UI refresh.
    */
   // Add at the top with other variables
let deliveryChargeCache = {
  city: null,
  subtotal: null,
  charge: 60,
  timestamp: 0
};
const CACHE_DURATION = 30000; // 30 seconds

// Replace cartTotalsAsync with cached version
async function cartTotalsAsync(city = null, suppressToast = false) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  let shipping = 0;
  const now = Date.now();
  
  // Check cache first
  if (deliveryChargeCache.city === city && 
      deliveryChargeCache.subtotal === subtotal &&
      now - deliveryChargeCache.timestamp < CACHE_DURATION) {
    shipping = deliveryChargeCache.charge;
  } else if (subtotal > 0) {
    try {
      const params = new URLSearchParams();
      if (city && city.trim()) params.append("city", city.trim());
      params.append("subtotal", subtotal);
      const response = await fetch(`${API_URL}/delivery-charges/active?${params}`);
      const data = await response.json();
      if (data.success && data.data && data.data.amount !== undefined) {
        shipping = data.data.amount;
        // Update cache
        deliveryChargeCache = {
          city: city,
          subtotal: subtotal,
          charge: shipping,
          timestamp: now
        };
        if (!suppressToast && city) {
          showToast(
            city.toLowerCase() === "dhaka"
              ? `ঢাকার জন্য ডেলিভারি চার্জ: ৳${shipping}`
              : `ঢাকার বাইরের জন্য ডেলিভারি চার্জ: ৳${shipping}`,
            "info"
          );
        }
      } else {
        shipping = 60;
      }
    } catch (error) {
      console.error("Failed to fetch delivery charge:", error);
      shipping = 60;
    }
  }

  const discount = checkoutAppliedCoupon?.discount || 0;
  const total = Math.max(0, subtotal + shipping - discount);
  return { subtotal, shipping, discount, total };
}
   /* ════════════════════════════════════════════════════════════
         CART
      ════════════════════════════════════════════════════════════ */
   function addToCart(productId, price, imageUrl) {
     const pData = window[`__p_${productId}`];
     const name = pData?.name || "পণ্য";
     const existing = cart.find((i) => i.productId === productId);
     if (existing) {
       existing.quantity++;
     } else {
       cart.push({ productId, name, price, image: imageUrl, quantity: 1 });
     }
     saveCart();
     updateCartUI();
     showToast(`"${name}" কার্টে যোগ হয়েছে`, "success");
   }
   
   function updateQuantity(index, delta) {
     if (!cart[index]) return;
     const newQty = cart[index].quantity + delta;
     if (newQty <= 0) {
       removeFromCart(index);
     } else {
       cart[index].quantity = newQty;
       saveCart();
       updateCartUI();
     }
   }
   
   function removeFromCart(index) {
     cart.splice(index, 1);
     saveCart();
     updateCartUI();
     showToast("পণ্য কার্ট থেকে সরানো হয়েছে", "info");
   }
   
   function saveCart() {
     localStorage.setItem("cart", JSON.stringify(cart));
   }

   function renderCartItem(item, index) {
     return `
          <div class="cart-item">
            <img class="cart-item-image" src="${escHtml(item.image || "https://via.placeholder.com/80")}"
                 alt="${escHtml(item.name)}" onerror="this.src='https://via.placeholder.com/80'">
            <div class="cart-item-info">
              <div class="cart-item-name">${escHtml(item.name)}</div>
              <div class="cart-item-price">৳${item.price.toLocaleString("bn-BD")}</div>
              <div class="cart-item-quantity">
                <button class="qty-btn" onclick="updateQuantity(${index}, -1)">−</button>
                <span class="qty-display">${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
              </div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})" title="সরান">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>`;
   }

/**
 * FIXED updateCartUI — updates BOTH desktop and mobile cart totals
 */
// Optimized updateCartUI with batch DOM updates
async function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  // Batch DOM updates using requestAnimationFrame
  const updates = [];
  
  // Count badges
  const cc = document.getElementById("cartCount");
  if (cc) updates.push(() => cc.textContent = count);
  const mc = document.getElementById("mobileCartCount");
  if (mc) updates.push(() => mc.textContent = count);

  // Render cart items (only if changed)
  const cartEmpty = `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>আপনার কার্ট এখন খালি</p></div>`;
  const cartHtml = cart.length === 0 ? cartEmpty : cart.map(renderCartItem).join("");
  
  const ci = document.getElementById("cartItems");
  if (ci && ci.innerHTML !== cartHtml) updates.push(() => ci.innerHTML = cartHtml);
  
  const mi = document.getElementById("mobileCartItems");
  const mobileCartHtml = cart.length === 0
    ? `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>কার্ট খালি</p></div>`
    : cart.map(renderCartItem).join("");
  if (mi && mi.innerHTML !== mobileCartHtml) updates.push(() => mi.innerHTML = mobileCartHtml);

  // Fetch totals (cached)
  const citySelect = document.getElementById("checkoutCity");
  const city = citySelect ? citySelect.value : null;
  const { subtotal, shipping, discount, total } = await cartTotalsAsync(city, true);

  // Format numbers once
  const subtotalFormatted = `৳${subtotal.toLocaleString("bn-BD")}`;
  const shippingFormatted = `৳${shipping.toLocaleString("bn-BD")}`;
  const totalFormatted = `৳${total.toLocaleString("bn-BD")}`;

  // Desktop cart
  updates.push(() => setText("cartSubtotal", subtotalFormatted));
  updates.push(() => setText("cartShipping", shippingFormatted));
  updates.push(() => setText("cartTotal", totalFormatted));
  
  // Mobile cart
  updates.push(() => setText("mobileCartSubtotal", subtotalFormatted));
  updates.push(() => setText("mobileCartShipping", shippingFormatted));
  updates.push(() => setText("mobileCartTotal", totalFormatted));

  // Apply all updates in next frame
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

   /* ════════════════════════════════════════════════════════════
         COUPON — CHECKOUT MODAL  (NEW — mirrors details.js)
      ════════════════════════════════════════════════════════════ */

   let checkoutAppliedCoupon = null; // { code, discount, discountType, discountValue }

   async function applyCheckoutCoupon() {
     const input  = document.getElementById("checkoutCouponInput");
     const btn    = document.getElementById("couponApplyBtn");
     const msgEl  = document.getElementById("checkoutCouponMsg");
     const code   = (input?.value || "").trim().toUpperCase();

     if (!code) {
       _setCheckoutCouponMsg(msgEl, "কুপন কোড লিখুন", "error");
       return;
     }

     if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; }

     const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

     try {
       const res = await fetch(`${API_URL}/coupons/validate`, {
         method:  "POST",
         headers: { "Content-Type": "application/json" },
         body:    JSON.stringify({ code, subtotal }),
       });
       const data = await res.json();

       if (!data.success) {
         _setCheckoutCouponMsg(msgEl, data.message || "কুপন প্রয়োগ হয়নি", "error");
         checkoutAppliedCoupon = null;
         return;
       }

       checkoutAppliedCoupon = {
         code:          data.data.code,
         discount:      data.data.discount,
         discountType:  data.data.discountType,
         discountValue: data.data.discountValue,
       };

       const label = data.data.discountType === "percentage"
         ? `${data.data.discountValue}% ছাড়`
         : `৳${data.data.discountValue} ছাড়`;

       _setCheckoutCouponMsg(msgEl,
         `✅ "${checkoutAppliedCoupon.code}" — ${label} প্রয়োগ হয়েছে! আপনি ৳${checkoutAppliedCoupon.discount} বাঁচাচ্ছেন`,
         "success"
       );

       if (input)  { input.disabled = true; input.style.opacity = "0.6"; }
       if (btn)    { btn.style.display = "none"; }

       const removeBtn = document.getElementById("couponRemoveBtn");
       if (removeBtn) removeBtn.style.display = "inline-flex";

       _refreshCheckoutSummary();

     } catch (err) {
       _setCheckoutCouponMsg(msgEl, "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", "error");
     } finally {
       if (btn) { btn.disabled = false; btn.innerHTML = "প্রয়োগ করুন"; }
     }
   }

   function removeCheckoutCoupon() {
     checkoutAppliedCoupon = null;

     const input     = document.getElementById("checkoutCouponInput");
     const applyBtn  = document.getElementById("couponApplyBtn");
     const removeBtn = document.getElementById("couponRemoveBtn");
     const msgEl     = document.getElementById("checkoutCouponMsg");

     if (input)     { input.value = ""; input.disabled = false; input.style.opacity = "1"; }
     if (applyBtn)  { applyBtn.style.display = "inline-flex"; }
     if (removeBtn) { removeBtn.style.display = "none"; }
     if (msgEl)     { msgEl.textContent = ""; msgEl.className = "coupon-msg"; }

     _refreshCheckoutSummary();
   }

   function _setCheckoutCouponMsg(el, text, type) {
     if (!el) return;
     el.textContent = text;
     el.className = `coupon-msg coupon-msg-${type}`;
   }

   /**
    * Re-reads subtotal + shipping from displayed summary and recalculates total
    * accounting for coupon discount.
    */
   async function _refreshCheckoutSummary() {
     const citySelect = document.getElementById("checkoutCity");
     const city = citySelect ? citySelect.value : null;
     const { subtotal, shipping, discount, total } = await cartTotalsAsync(city, true);

     setText("summarySubtotal", `৳${subtotal.toLocaleString()}`);
     setText("summaryShipping", `৳${shipping.toLocaleString()}`);
     setText("summaryTotal", `৳${total.toLocaleString()}`);

     // Coupon discount row
     const discountRow = document.getElementById("summaryDiscountRow");
     const discountEl  = document.getElementById("summaryDiscount");
     if (discountRow) discountRow.style.display = discount > 0 ? "flex" : "none";
     if (discountEl && discount > 0) {
       discountEl.textContent = `-৳${discount.toLocaleString()}`;
       const labelEl = discountRow?.querySelector("span:first-child");
       if (labelEl && checkoutAppliedCoupon?.code) {
         labelEl.textContent = `কুপন ছাড় (${checkoutAppliedCoupon.code})`;
       }
     }
   }

   /* ════════════════════════════════════════════════════════════
         CHECKOUT
      ════════════════════════════════════════════════════════════ */
      async function openCheckout() {
        if (cart.length === 0) {
          showToast("কার্ট খালি! আগে পণ্য যোগ করুন", "error");
          return;
        }
      
        // Reset coupon state whenever checkout opens
        removeCheckoutCoupon();
      
        // ✅ ADD THIS — always start at step 1
        checkoutGoTo(1);
      
        const list = document.getElementById("checkoutItems");
        if (list) {
          list.innerHTML = cart
            .map(
              (item) => `
              <div class="checkout-item">
                <img src="${escHtml(item.image || "https://via.placeholder.com/60")}" alt="${escHtml(item.name)}"
                     onerror="this.src='https://via.placeholder.com/60'">
                <div class="checkout-item-details">
                  <div class="checkout-item-name">${escHtml(item.name)}</div>
                  <div class="checkout-item-meta">৳${item.price.toLocaleString()} × ${item.quantity}</div>
                </div>
                <div class="checkout-item-total">৳${(item.price * item.quantity).toLocaleString()}</div>
              </div>`,
            )
            .join("");
        }
      
        const citySelect = document.getElementById("checkoutCity");
        const selectedCity = citySelect ? citySelect.value : null;
        const { subtotal, shipping, discount, total } = await cartTotalsAsync(selectedCity, true);
        
        setText("summarySubtotal", `৳${subtotal.toLocaleString()}`);
        setText("summaryShipping", `৳${shipping.toLocaleString()}`);
        setText("summaryTotal", `৳${total.toLocaleString()}`);
      
        const discountRow = document.getElementById("summaryDiscountRow");
        if (discountRow) discountRow.style.display = "none";
      
        openModal("checkoutModal");
      }
   
   async function placeOrder(e) {
    if (e) e.preventDefault();
    if (cart.length === 0) {
      showToast("কার্ট খালি!", "error");
      return;
    }
    
    const fullName = val("checkoutName");
    const email = val("checkoutEmail");
    const phone = val("checkoutPhone");
    const address = val("checkoutAddress");
    const city = val("checkoutCity");
    const zipCode = val("checkoutZipCode");
    const notes = val("checkoutNotes");
    const payMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "COD";
    const accepted = document.getElementById("acceptTerms")?.checked;
    
    // Validation checks...
    if (!fullName || !email || !phone || !address || !city) {
      showToast("সব প্রয়োজনীয় তথ্য পূরণ করুন (*)", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("সঠিক ইমেইল ঠিকানা দিন", "error");
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      showToast("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)", "error");
      return;
    }
    if (!accepted) {
      showToast("শর্তাবলী মেনে নিন", "error");
      return;
    }
    
    // Close modal immediately for instant feedback
    closeModal("checkoutModal");
    
    // Show loading
    showLoadingOverlay();
    const btn = document.getElementById("confirmOrderBtn");
    setButtonLoading(btn, true);
    
    // Get cached totals
    const { subtotal, shipping, discount, total } = await cartTotalsAsync(city, true);
    
    const pmMap = {
      COD: "cash_on_delivery",
      bkash: "bkash",
      nagad: "nagad",
      card: "card",
    };
    
    const orderData = {
      items: cart.map((i) => ({
        product: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      customer: {
        name: fullName,
        email,
        phone,
        address: {
          street: address,
          city,
          area: city,
          district: city,
          division: city,
          postalCode: zipCode || "",
        },
      },
      paymentMethod: pmMap[payMethod] || "cash_on_delivery",
      deliveryCharge: shipping,
      discount: discount || 0,
      couponCode: checkoutAppliedCoupon?.code || undefined,
      notes: notes || "",
    };
  
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "অর্ডার দেওয়া যায়নি");
      if (!data.success) throw new Error(data.message || "অর্ডার ব্যর্থ");
  
      // Fire coupon usage increment (fire-and-forget)
      if (checkoutAppliedCoupon?.code) {
        fetch(`${API_URL}/coupons/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: checkoutAppliedCoupon.code, subtotal }),
        }).catch((err) => console.warn("Coupon apply error:", err.message));
        checkoutAppliedCoupon = null;
      }
  
      const orderNum = data.data?.orderNumber || data.data?._id?.slice(-8) || "SUCCESS";
  
      window.lastOrderData = {
        orderNumber: orderNum,
        customer: orderData.customer,
        items: orderData.items,
        subtotal,
        shipping,
        total,
        paymentMethod: orderData.paymentMethod,
      };
  
      cart = [];
      saveCart();
      await updateCartUI();
      hideLoadingOverlay();
  
      setText("orderNumber", `#${orderNum}`);
  
      const downloadBtn = document.getElementById("downloadSlipBtn");
      if (downloadBtn) {
        downloadBtn.onclick = () => generateOrderSlipPNG(window.lastOrderData);
      }
  
      const trackBtn = document.getElementById("trackSuccessOrderBtn");
      if (trackBtn) {
        trackBtn.onclick = () => {
          closeModal("successModal");
          openTrackingModal(orderNum);
        };
      }
  
      // Faster success modal (200ms instead of 400ms)
      setTimeout(() => {
        openModal("successModal");
        startConfetti();
        setTimeout(stopConfetti, 4000);
      }, 200);
  
      showToast("অর্ডার সফল হয়েছে! 🎉", "success");
      document.getElementById("checkoutForm")?.reset();
    } catch (err) {
      hideLoadingOverlay();
      showToast(err.message || "অর্ডার দেওয়া যায়নি। আবার চেষ্টা করুন।", "error");
      console.error("Order error:", err);
    } finally {
      setButtonLoading(btn, false);
    }
  }
   
   /* ════════════════════════════════════════════════════════════
         NAVIGATION
      ════════════════════════════════════════════════════════════ */
   function navigateTo(page) {
     document.querySelectorAll(".nav-link").forEach((l) => {
       l.classList.toggle("active", l.dataset.page === page);
     });
     document.querySelectorAll(".mobile-nav-item[data-page]").forEach((l) => {
       l.classList.toggle("active", l.dataset.page === page);
     });
     document.querySelectorAll(".page-content").forEach((el) => {
       el.classList.toggle("active", el.id === `${page}Page`);
     });
   
     switch (page) {
       case "home":
         loadFeaturedProducts();
         loadCategories();
         break;
       case "products":
         loadCategories();
         loadProducts(1);
         break;
       case "orders":
         renderOrdersPage();
         break;
       case "profile":
         renderProfilePage();
         break;
     }
     window.scrollTo({ top: 0, behavior: "smooth" });
   }
   
   function renderOrdersPage() {
     const el = document.getElementById("userOrders");
     if (!el) return;
     el.innerHTML = `
       <div class="orders-track-cta">
         <h3>
           <i class="fas fa-satellite-dish" style="color:var(--honey);margin-right:10px;font-size:1.1rem;"></i>
           আপনার অর্ডার ট্র্যাক করুন
         </h3>
         <p>অর্ডার নম্বর দিয়ে রিয়েল-টাইম ডেলিভারি স্ট্যাটাস, পেমেন্ট তথ্য ও সকল বিবরণ দেখুন।</p>
         <div class="orders-track-input-row">
           <input type="text" id="ordersTrackInput"
                  placeholder="ORD-2025XX-00001"
                  autocomplete="off" spellcheck="false"
                  onkeydown="if(event.key==='Enter') quickTrackFromOrders()">
           <button onclick="quickTrackFromOrders()">
             <i class="fas fa-magnifying-glass"></i> ট্র্যাক করুন
           </button>
         </div>
         <div class="track-feature-pills">
           <span class="track-pill"><i class="fas fa-clock"></i> রিয়েল-টাইম স্ট্যাটাস</span>
           <span class="track-pill"><i class="fas fa-truck"></i> ডেলিভারি আপডেট</span>
           <span class="track-pill"><i class="fas fa-shield-halved"></i> নিরাপদ ট্র্যাকিং</span>
         </div>
       </div>`;
   }

   function quickTrackFromOrders() {
     const v = document.getElementById("ordersTrackInput")?.value.trim() || "";
     openTrackingModal(v);
   }
   
   function renderProfilePage() {
     const el = document.getElementById("profileContainer");
     if (!el) return;
   
     loadStoredMobileOrders();
     renderStoredNumberBadges();
   
     el.innerHTML = `
       <div class="profile-container">
         <div class="profile-card">
           <div class="profile-card-header">
             <div class="profile-avatar-icon"><i class="fas fa-user"></i></div>
             <h3>অতিথি ব্যবহারকারী</h3>
             <p>Guest Mode</p>
           </div>
           <div class="profile-card-body">
             <p class="text-muted" style="margin-bottom:1.5rem;">আপনি অতিথি হিসেবে ব্রাউজ করছেন। অর্ডার করতে চেকআউটে তথ্য দিন।</p>
             <button class="btn-primary btn-block" onclick="navigateTo('products')">
               <i class="fas fa-shopping-cart"></i> কেনাকাটা শুরু করুন
             </button>
           </div>
         </div>
         
         <div class="mobile-orders-section" id="mobileOrdersSection">
           <div class="mobile-orders-header">
             <i class="fas fa-phone-alt"></i>
             <h3>আমার মোবাইল নম্বরের অর্ডার সমূহ</h3>
           </div>
           
           <div class="mobile-input-group">
             <input type="tel" id="mobileNumberInput" placeholder="মোবাইল নম্বর লিখুন (01XXXXXXXXX)" autocomplete="off">
             <button onclick="handleMobileNumberSubmit()">
               <i class="fas fa-search"></i> অর্ডার খুঁজুন
             </button>
           </div>
           
           <div class="stored-numbers" id="storedNumbersContainer"></div>
           
           <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border);">
             <span style="font-size:0.7rem; color:var(--text-muted);">
               <i class="fas fa-database"></i> সংরক্ষিত নম্বর: <span id="mobileOrdersCount">0</span>
             </span>
             <span style="font-size:0.7rem; color:var(--text-muted);">
               বর্তমান: <strong id="currentMobileDisplay">—</strong>
             </span>
           </div>
           
           <div id="mobileOrdersList" class="orders-list-by-mobile">
             <div class="mobile-orders-empty">
               <i class="fas fa-search"></i>
               <p>উপরের বক্সে মোবাইল নম্বর দিয়ে আপনার সকল অর্ডার দেখুন</p>
               <small style="display:block; margin-top:8px;">📱 অর্ডারগুলো লোকালি সংরক্ষিত হবে, পরবর্তীতে দ্রুত দেখতে পারবেন</small>
             </div>
           </div>
         </div>
         
         <div class="profile-card">
           <div class="profile-card-header"><h3>দ্রুত লিংক</h3></div>
           <div class="profile-card-body" style="display:flex;flex-direction:column;gap:.75rem;">
             <button class="btn-ghost btn-block" onclick="navigateTo('orders')">
               <i class="fas fa-satellite-dish"></i> অর্ডার ট্র্যাক করুন
             </button>
             <button class="btn-ghost btn-block" onclick="navigateTo('products')">
               <i class="fas fa-box"></i> সব পণ্য
             </button>
             <button class="btn-ghost btn-block" onclick="clearAllStoredOrdersCache()">
               <i class="fas fa-trash-alt"></i> ক্যাশ সাফ করুন
             </button>
           </div>
         </div>
       </div>`;
   
     const mobileInput = document.getElementById("mobileNumberInput");
     if (mobileInput) {
       mobileInput.addEventListener("keypress", (e) => {
         if (e.key === "Enter") handleMobileNumberSubmit();
       });
     }
   
     const lastDisplayedNumber = localStorage.getItem("last_displayed_mobile");
     if (lastDisplayedNumber && cachedOrdersByMobile[lastDisplayedNumber]) {
       renderMobileOrdersList(
         lastDisplayedNumber,
         cachedOrdersByMobile[lastDisplayedNumber].orders,
       );
       document.getElementById("currentMobileDisplay").textContent = lastDisplayedNumber;
       const input = document.getElementById("mobileNumberInput");
       if (input) input.value = lastDisplayedNumber;
     }
   }
   
   /* ════════════════════════════════════════════════════════════
         VIEW PRODUCT
      ════════════════════════════════════════════════════════════ */
   function viewProduct(productId) {
     if (!productId || productId === "undefined") {
       showToast("পণ্যের তথ্য পাওয়া যায়নি", "error");
       return;
     }
     const id = String(productId).trim();
     localStorage.setItem("lastViewedProductId", id);
     window.location.href = `product-detail.html?id=${encodeURIComponent(id)}`;
   }
   
   function filterByCategory(categoryId) {
     navigateTo("products");
     setTimeout(() => {
       const sel = document.getElementById("categoryFilter");
       if (sel) {
         sel.value = categoryId;
         loadProducts(1);
       }
     }, 150);
   }
   // Add throttle utility
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Replace scroll listener with throttled version
window.addEventListener('scroll', throttle(() => {
  // Any scroll-based logic here
}, 100));
   /* ════════════════════════════════════════════════════════════
         PAGINATION
      ════════════════════════════════════════════════════════════ */
   function renderPagination(containerId, current, total, fnName) {
     const el = document.getElementById(containerId);
     if (!el || total <= 1) {
       if (el) el.innerHTML = "";
       return;
     }
   
     const pages = [];
     pages.push(
       `<button onclick="${fnName}(${current - 1})" ${current === 1 ? "disabled" : ""}><i class="fas fa-chevron-left"></i></button>`,
     );
   
     const start = Math.max(1, current - 2);
     const end = Math.min(total, current + 2);
     if (start > 1) pages.push(`<button onclick="${fnName}(1)">1</button>`);
     if (start > 2) pages.push(`<button disabled>…</button>`);
   
     for (let i = start; i <= end; i++) {
       pages.push(
         `<button onclick="${fnName}(${i})" class="${i === current ? "active" : ""}">${i}</button>`,
       );
     }
   
     if (end < total - 1) pages.push(`<button disabled>…</button>`);
     if (end < total)
       pages.push(`<button onclick="${fnName}(${total})">${total}</button>`);
     pages.push(
       `<button onclick="${fnName}(${current + 1})" ${current === total ? "disabled" : ""}><i class="fas fa-chevron-right"></i></button>`,
     );
   
     el.innerHTML = pages.join("");
   }
   
   /* ════════════════════════════════════════════════════════════
         MOBILE CART SHEET
      ════════════════════════════════════════════════════════════ */
   // Optimized mobile cart with RAF
function openMobileCart() {
  const sheet = document.getElementById("mobileCartSheet");
  if (!sheet) return;
  
  updateCartUI();
  
  requestAnimationFrame(() => {
    sheet.classList.add("open");
    document.body.classList.add("cart-open");
    document.body.style.overflow = "hidden";
  });
}

function closeMobileCart() {
  const sheet = document.getElementById("mobileCartSheet");
  if (!sheet) return;
  
  requestAnimationFrame(() => {
    sheet.classList.remove("open");
    document.body.classList.remove("cart-open");
    setTimeout(() => {
      if (!document.body.classList.contains("cart-open") && 
          !document.body.classList.contains("modal-open")) {
        document.body.style.overflow = "";
      }
    }, 250);
  });
}

   
   /* ════════════════════════════════════════════════════════════
         CONFETTI
      ════════════════════════════════════════════════════════════ */
   let _confettiRaf = null;
   
   function startConfetti() {
     const canvas = document.getElementById("confettiCanvas");
     if (!canvas) return;
     canvas.classList.add("active");
     canvas.width = window.innerWidth;
     canvas.height = window.innerHeight;
     const ctx = canvas.getContext("2d");
     const colors = [
       "#F5A623","#FDD882","#C47F11","#0D1B3E","#1A2E5A","#28a745","#ff6b6b",
     ];
     const particles = Array.from({ length: 180 }, () => ({
       x: Math.random() * canvas.width,
       y: -20 - Math.random() * canvas.height,
       size: Math.random() * 9 + 4,
       color: colors[Math.floor(Math.random() * colors.length)],
       vy: Math.random() * 5 + 3,
       vx: (Math.random() - 0.5) * 3,
       rot: Math.random() * 360,
       rotV: (Math.random() - 0.5) * 8,
     }));
     function draw() {
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       let alive = 0;
       for (const p of particles) {
         p.y += p.vy;
         p.x += p.vx;
         p.rot += p.rotV;
         if (p.y < canvas.height) alive++;
         ctx.save();
         ctx.translate(p.x, p.y);
         ctx.rotate((p.rot * Math.PI) / 180);
         ctx.fillStyle = p.color;
         ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
         ctx.restore();
       }
       if (alive > 0) _confettiRaf = requestAnimationFrame(draw);
       else stopConfetti();
     }
     draw();
   }
   
   function stopConfetti() {
     const canvas = document.getElementById("confettiCanvas");
     if (canvas) {
       canvas.classList.remove("active");
       canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
     }
     if (_confettiRaf) {
       cancelAnimationFrame(_confettiRaf);
       _confettiRaf = null;
     }
   }
   
   /* ════════════════════════════════════════════════════════════
         ORDER TRACKING
      ════════════════════════════════════════════════════════════ */
   const ORDER_STATUS_STEPS = [
     { key: "pending",   icon: "fa-clock",             label: "অর্ডার প্রাপ্ত",    desc: "অর্ডারটি সফলভাবে গ্রহণ হয়েছে" },
     { key: "confirmed", icon: "fa-circle-check",      label: "কনফার্মড",           desc: "অর্ডার নিশ্চিত করা হয়েছে" },
     { key: "processing",icon: "fa-box-open",          label: "প্রস্তুত হচ্ছে",    desc: "পণ্য প্যাক করা হচ্ছে" },
     { key: "shipped",   icon: "fa-truck-fast",        label: "পাঠানো হয়েছে",     desc: "পণ্যটি কুরিয়ারে দেওয়া হয়েছে" },
     { key: "delivered", icon: "fa-house-circle-check",label: "ডেলিভারি সম্পন্ন", desc: "পণ্য সফলভাবে পৌঁছে গেছে" },
   ];
   
   function getStatusIndex(status) {
     return ORDER_STATUS_STEPS.findIndex((s) => s.key === status);
   }
   
   function openTrackingModal(prefillOrderNumber = "") {
     const input = document.getElementById("trackOrderInput");
     const result = document.getElementById("trackResult");
     if (input) {
       input.value = prefillOrderNumber || "";
       _toggleClearBtn();
     }
     if (result) result.innerHTML = "";
     openModal("trackingModal");
     if (prefillOrderNumber) {
       setTimeout(trackOrder, 350);
     } else {
       setTimeout(() => input?.focus(), 350);
     }
   }
   
   function clearTracking() {
     const input = document.getElementById("trackOrderInput");
     const result = document.getElementById("trackResult");
     if (input) { input.value = ""; input.focus(); }
     if (result) result.innerHTML = "";
     _toggleClearBtn();
   }
   
   function _toggleClearBtn() {
     const input = document.getElementById("trackOrderInput");
     const btn = document.getElementById("trackClearBtn");
     if (btn) btn.style.display = input?.value.trim() ? "flex" : "none";
   }
   
   async function trackOrder() {
     const input = document.getElementById("trackOrderInput");
     const orderNum = (input?.value || "").trim().toUpperCase();
     const resultEl = document.getElementById("trackResult");
     const btn = document.getElementById("trackBtn");
   
     if (!orderNum) {
       _showTrackError(resultEl, "অর্ডার নম্বর দিন", "অনুগ্রহ করে আপনার অর্ডার নম্বরটি উপরের বক্সে টাইপ করুন।");
       return;
     }
   
     if (btn) {
       btn.querySelector(".track-btn-text").style.display = "none";
       btn.querySelector(".track-btn-loading").style.display = "inline-flex";
       btn.disabled = true;
     }
   
     resultEl.innerHTML = `
         <div class="track-skeleton">
           <div class="ts-header"></div>
           <div class="ts-bar"></div>
           <div class="ts-steps">${[1,2,3,4,5].map(() => `<div class="ts-step"></div>`).join("")}</div>
           <div class="ts-info"></div>
         </div>`;
   
     try {
       const res = await apiCall(`/orders/track/${encodeURIComponent(orderNum)}`);
       if (!res.success || !res.data) {
         _showTrackError(resultEl, "অর্ডার পাওয়া যায়নি", `"${orderNum}" নম্বরে কোনো অর্ডার পাওয়া যায়নি। নম্বরটি সঠিকভাবে লিখুন।`);
         return;
       }
       _renderTrackingResult(resultEl, res.data);
     } catch (err) {
       _showTrackError(resultEl, "সংযোগ সমস্যা", "সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
       console.error("Tracking error:", err);
     } finally {
       if (btn) {
         btn.querySelector(".track-btn-text").style.display = "inline-flex";
         btn.querySelector(".track-btn-loading").style.display = "none";
         btn.disabled = false;
       }
     }
   }
   
   function _showTrackError(el, title, msg) {
     if (!el) return;
     el.innerHTML = `
          <div class="track-error-state">
            <div class="track-err-icon"><i class="fas fa-circle-xmark"></i></div>
            <h4>${escHtml(title)}</h4>
            <p>${escHtml(msg)}</p>
          </div>`;
   }
   
   function _renderTrackingResult(el, order) {
     if (!el) return;
     const isCancelled = order.orderStatus === "cancelled";
     const currentIdx = isCancelled ? -1 : getStatusIndex(order.orderStatus);
   
     const displayDate = (d) => {
       if (!d) return "—";
       return new Date(d).toLocaleString("en-BD", {
         day: "2-digit", month: "short", year: "numeric",
         hour: "2-digit", minute: "2-digit",
       });
     };
   
     const payMethodLabel = {
       cash_on_delivery: "ক্যাশ অন ডেলিভারি",
       bkash: "bKash",
       nagad: "Nagad",
       card: "কার্ড পেমেন্ট",
     };
   
     const statusColorMap = {
       pending:    { bg: "#FEF3CD", color: "#B7770D", border: "#F5C518" },
       confirmed:  { bg: "#E8F5EE", color: "#1E8A4A", border: "#2ECC71" },
       processing: { bg: "#EEF2FF", color: "#4338CA", border: "#6366F1" },
       shipped:    { bg: "#E0F2FE", color: "#0369A1", border: "#0EA5E9" },
       delivered:  { bg: "#ECFDF5", color: "#059669", border: "#10B981" },
       cancelled:  { bg: "#FDEDEC", color: "#C0392B", border: "#E74C3C" },
     };
     const sc = statusColorMap[order.orderStatus] || statusColorMap.pending;
   
     const statusBn = {
       cancelled:  "বাতিল",
       delivered:  "ডেলিভারি সম্পন্ন",
       shipped:    "পাঠানো হয়েছে",
       processing: "প্রস্তুত হচ্ছে",
       confirmed:  "কনফার্মড",
       pending:    "অপেক্ষায়",
     };
   
     const stepsHTML = ORDER_STATUS_STEPS.map((step, i) => {
       let state = "future";
       if (!isCancelled) {
         if (i < currentIdx) state = "done";
         else if (i === currentIdx) state = "active";
       }
       return `
            <div class="tl-step tl-${state}" style="--step-delay:${i * 0.08}s">
              <div class="tl-dot-wrap">
                <div class="tl-dot">
                  <i class="fas ${step.icon}"></i>
                  ${state === "active" ? '<span class="tl-pulse"></span>' : ""}
                </div>
                ${i < ORDER_STATUS_STEPS.length - 1 ? `<div class="tl-connector"></div>` : ""}
              </div>
              <div class="tl-label">
                <div class="tl-step-name">${step.label}</div>
                <div class="tl-step-desc">${step.desc}</div>
              </div>
            </div>`;
     }).join("");
   
     const cancelledHTML = isCancelled
       ? `<div class="track-cancelled-banner">
            <i class="fas fa-ban"></i>
            <div>
              <strong>এই অর্ডারটি বাতিল করা হয়েছে।</strong>
              <span>যেকোনো সহায়তার জন্য আমাদের সাথে যোগাযোগ করুন।</span>
            </div>
          </div>`
       : "";
   
     const itemsHTML = (order.items || [])
       .map((item) => `
          <div class="track-item">
            <div class="track-item-name">${escHtml(item.name || "পণ্য")}</div>
            <div class="track-item-meta">x${item.quantity} × ৳${(item.price || 0).toLocaleString()}</div>
            <div class="track-item-total">৳${(item.total || item.price * item.quantity || 0).toLocaleString()}</div>
          </div>`)
       .join("");
   
     el.innerHTML = `
          <div class="track-result" style="animation:trackResultIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;">
            <div class="track-status-header" style="background:${sc.bg};border-color:${sc.border};">
              <div class="track-status-left">
                <div class="track-order-num">${escHtml(order.orderNumber || "—")}</div>
                <div class="track-order-date">অর্ডারের তারিখ: ${displayDate(order.createdAt)}</div>
              </div>
              <div class="track-status-badge" style="background:${sc.color};color:#fff;">
                ${statusBn[order.orderStatus] || "অপেক্ষায়"}
              </div>
            </div>
            ${cancelledHTML}
            <div class="track-section">
              <div class="track-section-title"><i class="fas fa-route"></i> অর্ডারের অগ্রগতি</div>
              <div class="track-timeline ${isCancelled ? "tl-cancelled" : ""}">${stepsHTML}</div>
            </div>
            <div class="track-info-grid">
              <div class="track-info-card">
                <div class="track-card-title"><i class="fas fa-user"></i> গ্রাহক তথ্য</div>
                <div class="track-info-row"><span class="ti-label">নাম</span><span class="ti-val">${escHtml(order.customer?.name || "—")}</span></div>
                <div class="track-info-row"><span class="ti-label">মোবাইল</span><span class="ti-val">${escHtml(order.customer?.phone || "—")}</span></div>
                <div class="track-info-row">
                  <span class="ti-label">ঠিকানা</span>
                  <span class="ti-val">${escHtml([order.customer?.address?.street, order.customer?.address?.city].filter(Boolean).join(", ") || "—")}</span>
                </div>
                ${order.trackingNumber ? `<div class="track-info-row highlight-row"><span class="ti-label"><i class="fas fa-barcode"></i> ট্র্যাকিং ID</span><span class="ti-val ti-mono">${escHtml(order.trackingNumber)}</span></div>` : ""}
                ${order.deliveryPartner ? `<div class="track-info-row"><span class="ti-label">কুরিয়ার</span><span class="ti-val">${escHtml(order.deliveryPartner)}</span></div>` : ""}
              </div>
              <div class="track-info-card">
                <div class="track-card-title"><i class="fas fa-wallet"></i> পেমেন্ট তথ্য</div>
                <div class="track-info-row"><span class="ti-label">পেমেন্ট পদ্ধতি</span><span class="ti-val">${payMethodLabel[order.paymentMethod] || escHtml(order.paymentMethod || "—")}</span></div>
                <div class="track-info-row">
                  <span class="ti-label">পেমেন্ট স্ট্যাটাস</span>
                  <span class="ti-val">
                    ${order.paymentStatus === "paid"
                      ? '<span class="pay-badge pay-paid"><i class="fas fa-check"></i> পরিশোধিত</span>'
                      : '<span class="pay-badge pay-pending"><i class="fas fa-clock"></i> বাকি</span>'}
                  </span>
                </div>
                <div class="track-info-row"><span class="ti-label">পণ্যের মূল্য</span><span class="ti-val">৳${(order.subtotal || 0).toLocaleString()}</span></div>
                <div class="track-info-row"><span class="ti-label">ডেলিভারি চার্জ</span><span class="ti-val">৳${(order.deliveryCharge || 0).toLocaleString()}</span></div>
                ${(order.discount > 0) ? `<div class="track-info-row"><span class="ti-label">কুপন ছাড়</span><span class="ti-val" style="color:#059669">-৳${order.discount.toLocaleString()}</span></div>` : ""}
                <div class="track-info-row track-total-row"><span class="ti-label">মোট</span><span class="ti-val ti-total">৳${(order.total || 0).toLocaleString()}</span></div>
              </div>
            </div>
            <div class="track-section">
              <div class="track-section-title"><i class="fas fa-box"></i> অর্ডার আইটেম</div>
              <div class="track-items-list">
                <div class="track-items-head"><span>পণ্য</span><span></span><span style="text-align:right;">মোট</span></div>
                ${itemsHTML}
              </div>
            </div>
            <div class="track-help-bar">
              <i class="fas fa-headset"></i>
              <span>সমস্যা হচ্ছে? কল করুন: <strong>01700-000000</strong> অথবা WhatsApp করুন</span>
              <button class="track-help-btn" onclick="closeModal('trackingModal')"><i class="fas fa-times"></i></button>
            </div>
          </div>`;
   }
   
   /* ════════════════════════════════════════════════════════════
         ORDER SLIP GENERATOR
      ════════════════════════════════════════════════════════════ */
   function generateOrderSlipPNG(orderData) {
     const canvas = document.createElement("canvas");
     const ctx = canvas.getContext("2d");
     canvas.width = 800;
     canvas.height = 1000;
   
     ctx.fillStyle = "#ffffff";
     ctx.fillRect(0, 0, canvas.width, canvas.height);
   
     const colors = {
       primary: "#0D1B3E", secondary: "#1A2E5A", accent: "#F5A623",
       text: "#333333", muted: "#666666", border: "#e0e0e0",
     };
   
     function wrapText(text, x, y, maxWidth, lineHeight) {
       const words = text.split(" ");
       let line = "", lineY = y;
       for (let n = 0; n < words.length; n++) {
         const testLine = line + words[n] + " ";
         if (ctx.measureText(testLine).width > maxWidth && n > 0) {
           ctx.fillText(line, x, lineY);
           line = words[n] + " ";
           lineY += lineHeight;
         } else { line = testLine; }
       }
       ctx.fillText(line, x, lineY);
       return lineY + lineHeight;
     }
   
     ctx.fillStyle = colors.primary;
     ctx.fillRect(0, 0, canvas.width, 120);
     ctx.fillStyle = "#ffffff";
     ctx.font = "bold 28px sans-serif";
     ctx.fillText("BeeHarvest", 50, 55);
     ctx.font = "14px sans-serif";
     ctx.fillText("Bangladesh Trusted Online Shop", 50, 85);
   
     let yPos = 160;
     ctx.fillStyle = colors.accent;
     ctx.font = "bold 22px sans-serif";
     ctx.fillText(`Order: ${orderData.orderNumber}`, 50, yPos);
     yPos += 40;
     ctx.fillStyle = colors.muted;
     ctx.font = "14px sans-serif";
     ctx.fillText(`Date: ${new Date().toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}`, 50, yPos);
     yPos += 30;
   
     ctx.strokeStyle = colors.border;
     ctx.lineWidth = 1;
     ctx.beginPath(); ctx.moveTo(50, yPos); ctx.lineTo(750, yPos); ctx.stroke();
     yPos += 30;
   
     ctx.fillStyle = colors.primary; ctx.font = "bold 18px sans-serif";
     ctx.fillText("Customer Info", 50, yPos); yPos += 30;
     ctx.fillStyle = colors.text; ctx.font = "15px sans-serif";
     ctx.fillText(`Name: ${orderData.customer.name}`, 50, yPos); yPos += 25;
     ctx.fillText(`Phone: ${orderData.customer.phone}`, 50, yPos); yPos += 25;
     ctx.fillText(`Email: ${orderData.customer.email}`, 50, yPos); yPos += 25;
     yPos = wrapText(`Address: ${orderData.customer.address.street}, ${orderData.customer.address.city}`, 50, yPos, 700, 22);
     yPos += 10;
   
     ctx.strokeStyle = colors.border;
     ctx.beginPath(); ctx.moveTo(50, yPos); ctx.lineTo(750, yPos); ctx.stroke();
     yPos += 30;
   
     ctx.fillStyle = colors.primary; ctx.font = "bold 18px sans-serif";
     ctx.fillText("Order Items", 50, yPos); yPos += 30;
     ctx.fillStyle = colors.secondary;
     ctx.fillRect(50, yPos, 700, 38);
     ctx.fillStyle = "#fff"; ctx.font = "bold 14px sans-serif";
     ctx.fillText("Product", 70, yPos + 24);
     ctx.fillText("Qty", 460, yPos + 24);
     ctx.fillText("Price", 540, yPos + 24);
     ctx.fillText("Total", 650, yPos + 24);
     yPos += 48;
   
     ctx.font = "14px sans-serif";
     (orderData.items || []).forEach((item, i) => {
       if (yPos > 780) return;
       if (i % 2 === 0) { ctx.fillStyle = "#f9f9f9"; ctx.fillRect(50, yPos - 8, 700, 36); }
       ctx.fillStyle = colors.text;
       let name = item.name || "Product";
       if (name.length > 42) name = name.substring(0, 39) + "...";
       ctx.fillText(name, 70, yPos + 14);
       ctx.fillText(`x${item.quantity}`, 460, yPos + 14);
       ctx.fillText(`${(item.price || 0).toLocaleString()} BDT`, 540, yPos + 14);
       ctx.fillText(`${((item.price || 0) * item.quantity).toLocaleString()} BDT`, 640, yPos + 14);
       yPos += 36;
     });
   
     yPos += 20;
     ctx.strokeStyle = colors.border;
     ctx.beginPath(); ctx.moveTo(50, yPos); ctx.lineTo(750, yPos); ctx.stroke();
     yPos += 30;
   
     ctx.fillStyle = colors.text; ctx.font = "15px sans-serif";
     ctx.fillText("Subtotal:", 100, yPos); ctx.fillText(`${(orderData.subtotal || 0).toLocaleString()} BDT`, 640, yPos); yPos += 25;
     ctx.fillText("Delivery:", 100, yPos); ctx.fillText(`${(orderData.shipping || 0).toLocaleString()} BDT`, 640, yPos); yPos += 25;
     ctx.fillStyle = colors.primary; ctx.font = "bold 17px sans-serif";
     ctx.fillText("Total:", 100, yPos); ctx.fillText(`${(orderData.total || 0).toLocaleString()} BDT`, 640, yPos); yPos += 40;
   
     ctx.fillStyle = colors.muted; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
     ctx.fillText("Thank you for shopping with BeeHarvest!", canvas.width / 2, yPos + 30);
     ctx.fillText("Support: 01700-000000", canvas.width / 2, yPos + 55);
   
     canvas.toBlob((blob) => {
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `beeharvest_order_${orderData.orderNumber}.png`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
       showToast("অর্ডার স্লিপ ডাউনলোড হয়েছে!", "success");
     });
   }
   
   /* ════════════════════════════════════════════════════════════
         POLICIES
      ════════════════════════════════════════════════════════════ */
   const POLICIES = {
     delivery: {
       title: '<i class="fas fa-truck"></i> ডেলিভারি পলিসি',
       body: `
            <div class="policy-section"><div class="policy-highlight">ঢাকার ভিতরে ১–২ কার্যদিবস, ঢাকার বাইরে ২–৫ কার্যদিবসের মধ্যে ডেলিভারি।</div></div>
            <div class="policy-section"><h4><i class="fas fa-map-marker-alt"></i> ডেলিভারি এলাকা</h4><p>আমরা বাংলাদেশের সকল জেলায় ডেলিভারি প্রদান করি।</p></div>
            <div class="policy-section"><h4><i class="fas fa-taka-sign"></i> ডেলিভারি চার্জ</h4><p>ঢাকার মধ্যে: ৳৬০ | ঢাকার বাইরে: ৳১০০–৳১৫০।</p></div>
            <div class="policy-section"><h4><i class="fas fa-triangle-exclamation"></i> গুরুত্বপূর্ণ তথ্য</h4><p>ডেলিভারির সময় পণ্য গ্রহণ করে বাক্স খুলে যাচাই করুন।</p></div>`,
     },
     return: {
       title: '<i class="fas fa-rotate-left"></i> রিটার্ন ও রিফান্ড পলিসি',
       body: `
            <div class="policy-section"><div class="policy-highlight">পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করা যাবে।</div></div>
            <div class="policy-section"><h4><i class="fas fa-money-bill-wave"></i> রিফান্ড প্রক্রিয়া</h4><p>রিটার্ন অনুমোদনের পর ৩–৫ কার্যদিবসের মধ্যে রিফান্ড প্রদান করা হবে।</p></div>`,
     },
     privacy: {
       title: '<i class="fas fa-lock"></i> গোপনীয়তা নীতি',
       body: `
            <div class="policy-section"><div class="policy-highlight">আপনার ব্যক্তিগত তথ্য সুরক্ষিত রাখা আমাদের সর্বোচ্চ অগ্রাধিকার।</div></div>
            <div class="policy-section"><h4><i class="fas fa-database"></i> আমরা কী তথ্য সংগ্রহ করি</h4><p>নাম, ঠিকানা, মোবাইল নম্বর, ইমেইল এবং অর্ডার সংক্রান্ত তথ্য।</p></div>`,
     },
     terms: {
       title: '<i class="fas fa-scroll"></i> শর্তাবলী',
       body: `
            <div class="policy-section"><div class="policy-highlight">BeeHarvest ব্যবহার করে আপনি নিচের শর্তসমূহ মেনে নিচ্ছেন।</div></div>
            <div class="policy-section"><h4><i class="fas fa-gavel"></i> আইনি এখতিয়ার</h4><p>যেকোনো বিরোধ বাংলাদেশের আইন অনুযায়ী নিষ্পত্তি করা হবে।</p></div>`,
     },
     payment: {
       title: '<i class="fas fa-credit-card"></i> পেমেন্ট নীতি',
       body: `
            <div class="policy-section"><div class="policy-highlight">আমরা ক্যাশ অন ডেলিভারি, bKash এবং Nagad গ্রহণ করি।</div></div>
            <div class="policy-section"><h4><i class="fas fa-triangle-exclamation"></i> পেমেন্ট নিরাপত্তা</h4><p>আমাদের কোনো প্রতিনিধি কখনো OTP বা পিন চাইবে না।</p></div>`,
     },
     faq: {
       title: '<i class="fas fa-circle-question"></i> সাধারণ প্রশ্নোত্তর (FAQ)',
       body: `
            <div class="policy-section"><h4><i class="fas fa-clock"></i> অর্ডার কতদিনে পাব?</h4><p>ঢাকার মধ্যে ১–২ দিন এবং ঢাকার বাইরে ৩–৫ কার্যদিবস।</p></div>
            <div class="policy-section"><h4><i class="fas fa-rotate-left"></i> কীভাবে রিটার্ন করব?</h4><p>পণ্য পাওয়ার ৭ দিনের মধ্যে আমাদের হটলাইনে কল করুন।</p></div>
            <div class="policy-section"><h4><i class="fas fa-gift"></i> অর্ডার বাতিল করা যাবে?</h4><p>অর্ডার শিপ হওয়ার আগে বাতিল করা যাবে।</p></div>`,
     },
   };
   
   function showPolicy(key) {
     const policy = POLICIES[key];
     if (!policy) return;
     document.getElementById("policyModalTitle").innerHTML = policy.title;
     document.getElementById("policyModalBody").innerHTML = policy.body;
     openModal("policyModal");
   }

   /* ════════════════════════════════════════════════════════════
         MAINTENANCE / RATE LIMIT HANDLER
      ════════════════════════════════════════════════════════════ */
   let maintenanceActive = false;
   let maintenanceCountdownInterval = null;
   let pendingRequestsQueue = [];
   
   function checkForRateLimit(data) {
     if (!data) return false;
     const msg = (data.message || "").toLowerCase();
     if (
       msg.includes("too many requests") ||
       msg.includes("rate limit") ||
       msg.includes("429") ||
       data.statusCode === 429 ||
       data.error === "Too Many Requests" ||
       data.code === "RATE_LIMIT"
     ) { return true; }
     return false;
   }
   
   function showMaintenanceOverlay(seconds = 60) {
     if (maintenanceActive) return;
     maintenanceActive = true;
     const overlay = document.getElementById("maintenanceOverlay");
     if (!overlay) { console.error("Maintenance overlay element not found!"); return; }
     overlay.style.display = "flex";
     overlay.style.opacity = "1";
     let remainingSeconds = seconds;
     const countdownEl = document.getElementById("countdownNumber");
     const progressFill = document.getElementById("progressRingFill");
     const progressPercent = document.getElementById("progressPercent");
     if (maintenanceCountdownInterval) clearInterval(maintenanceCountdownInterval);
     maintenanceCountdownInterval = setInterval(() => {
       remainingSeconds--;
       if (countdownEl) countdownEl.textContent = remainingSeconds;
       const angle = (remainingSeconds / seconds) * 360;
       if (progressFill) progressFill.style.background = `conic-gradient(#c6f135 ${angle}deg, rgba(198, 241, 53, 0.2) ${angle}deg)`;
       const percentage = (remainingSeconds / seconds) * 100;
       if (progressPercent) progressPercent.textContent = `${Math.floor(percentage)}%`;
       if (remainingSeconds <= 0) {
         clearInterval(maintenanceCountdownInterval);
         hideMaintenanceOverlay();
         retryPendingRequests();
       }
     }, 1000);
   }
   
   function hideMaintenanceOverlay() {
     const overlay = document.getElementById("maintenanceOverlay");
     if (overlay) {
       overlay.style.opacity = "0";
       setTimeout(() => { overlay.style.display = "none"; overlay.style.opacity = ""; }, 300);
     }
     maintenanceActive = false;
     if (maintenanceCountdownInterval) { clearInterval(maintenanceCountdownInterval); maintenanceCountdownInterval = null; }
   }
   
   function retryAfterMaintenance() {
     hideMaintenanceOverlay();
     retryPendingRequests();
   }
   
   function retryPendingRequests() {
     if (pendingRequestsQueue.length > 0) {
       showToast(`${pendingRequestsQueue.length}টি রিকোয়েস্ট রিট্রাই করা হচ্ছে...`, "info");
       const queue = [...pendingRequestsQueue];
       pendingRequestsQueue = [];
       queue.forEach(({ url, options, resolve, reject }) => {
         fetch(url, options).then(resolve).catch(reject);
       });
     } else {
       window.location.reload();
     }
   }

   /* ════════════════════════════════════════════════════════════
         FETCH OVERRIDE — rate-limit guard
         NOTE: We no longer try to clone + parse JSON in the
         interceptor to avoid consuming the body before the
         caller reads it. Instead we rely on HTTP 429 status only.
      ════════════════════════════════════════════════════════════ */
   const originalFetch = window.fetch;
   window.fetch = function (url, options = {}) {
     return originalFetch(url, options).then((response) => {
       if (response.status === 429) {
         console.log("⚠️ Rate limit detected (429)");
         const retryAfter = response.headers.get("Retry-After") || 60;
         const waitSeconds = parseInt(retryAfter) || 60;
         showMaintenanceOverlay(waitSeconds);
         return new Promise((resolve, reject) => {
           pendingRequestsQueue.push({ url, options, resolve, reject });
         });
       }
       return response;
     });
   };

   /* ════════════════════════════════════════════════════════════
         MY ORDERS BY MOBILE NUMBER FEATURE
      ════════════════════════════════════════════════════════════ */
   const STORAGE_KEY = "beeharvest_orders_by_mobile";
   let cachedOrdersByMobile = {};
   
   function loadStoredMobileOrders() {
     try {
       const stored = localStorage.getItem(STORAGE_KEY);
       if (stored) { cachedOrdersByMobile = JSON.parse(stored); }
       else { cachedOrdersByMobile = {}; }
     } catch (e) { cachedOrdersByMobile = {}; }
   }
   
   function saveStoredMobileOrders() {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedOrdersByMobile));
   }
   
   async function fetchOrdersByMobile(phoneNumber) {
     const cleanPhone = phoneNumber.trim();
     if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
       showToast("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)", "error");
       return null;
     }
     showLoadingOverlay();
     try {
       if (cachedOrdersByMobile[cleanPhone] && Date.now() - cachedOrdersByMobile[cleanPhone].lastFetched < 300000) {
         hideLoadingOverlay();
         return cachedOrdersByMobile[cleanPhone].orders;
       }
       const response = await fetch(`${API_URL}/orders/phone/${encodeURIComponent(cleanPhone)}`);
       if (response.status === 429) {
         hideLoadingOverlay();
         const retryAfter = response.headers.get("Retry-After") || 60;
         showMaintenanceOverlay(parseInt(retryAfter) || 60);
         return null;
       }
       const data = await response.json();
       if (checkForRateLimit(data)) { hideLoadingOverlay(); showMaintenanceOverlay(60); return null; }
       if (!response.ok) throw new Error(data.message || "Failed to fetch orders");
       const orders = data.data || [];
       cachedOrdersByMobile[cleanPhone] = { orders, lastFetched: Date.now(), phone: cleanPhone };
       saveStoredMobileOrders();
       hideLoadingOverlay();
       if (orders.length === 0) { showToast(`${cleanPhone} নম্বরে কোনো অর্ডার পাওয়া যায়নি`, "info"); }
       else { showToast(`${orders.length}টি অর্ডার পাওয়া গেছে`, "success"); }
       return orders;
     } catch (err) {
       hideLoadingOverlay();
       if (cachedOrdersByMobile[cleanPhone]?.orders?.length > 0) {
         showToast(`নেটওয়ার্ক সমস্যা! ক্যাশ থেকে ${cachedOrdersByMobile[cleanPhone].orders.length}টি অর্ডার দেখানো হচ্ছে`, "info");
         return cachedOrdersByMobile[cleanPhone].orders;
       }
       showToast(err.message || "অর্ডার লোড করতে ব্যর্থ হয়েছে", "error");
       return null;
     }
   }
   
   function renderMobileOrdersList(phoneNumber, orders) {
     const container = document.getElementById("mobileOrdersList");
     if (!container) return;
     if (!orders || orders.length === 0) {
       container.innerHTML = `<div class="mobile-orders-empty"><i class="fas fa-inbox"></i><p>${phoneNumber} নম্বরে কোনো অর্ডার পাওয়া যায়নি</p></div>`;
       return;
     }
     const statusBnMap = { pending:"pending", confirmed:"confirmed", processing:"processing", shipped:"shipped", delivered:"delivered", cancelled:"cancelled" };
     container.innerHTML = orders.map((order) => `
       <div class="order-item-mini" onclick="viewOrderDetails('${order.orderNumber || order._id}')">
         <div class="order-item-header">
           <span class="order-num-mini"><i class="fas fa-hashtag"></i> ${order.orderNumber || order._id?.slice(-8) || "N/A"}</span>
           <span class="order-status-mini ${order.orderStatus || "pending"}">${statusBnMap[order.orderStatus] || order.orderStatus || "অপেক্ষায়"}</span>
           <span class="order-total-mini">৳${(order.total || 0).toLocaleString()}</span>
         </div>
         <div class="order-item-header">
           <span class="order-date-mini"><i class="fas fa-calendar"></i> ${new Date(order.createdAt).toLocaleDateString("bn-BD")}</span>
           <span class="order-date-mini"><i class="fas fa-box"></i> ${order.items?.length || 0}টি পণ্য</span>
         </div>
       </div>`).join("");
     const countSpan = document.getElementById("mobileOrdersCount");
     if (countSpan) countSpan.textContent = orders.length;
   }
   
   async function handleMobileNumberSubmit() {
     const input = document.getElementById("mobileNumberInput");
     const phoneNumber = input?.value.trim();
     if (!phoneNumber) { showToast("মোবাইল নম্বর লিখুন", "error"); return; }
     if (!/^01[3-9]\d{8}$/.test(phoneNumber)) { showToast("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)", "error"); return; }
     addToStoredNumbers(phoneNumber);
     localStorage.setItem("last_displayed_mobile", phoneNumber);
     const orders = await fetchOrdersByMobile(phoneNumber);
     if (orders) {
       renderMobileOrdersList(phoneNumber, orders);
       document.getElementById("currentMobileDisplay").textContent = phoneNumber;
     }
   }
   
   function addToStoredNumbers(phoneNumber) {
     let storedNumbers = JSON.parse(localStorage.getItem("beeharvest_stored_numbers") || "[]");
     storedNumbers = storedNumbers.filter((num) => num !== phoneNumber);
     storedNumbers.unshift(phoneNumber);
     storedNumbers = storedNumbers.slice(0, 5);
     localStorage.setItem("beeharvest_stored_numbers", JSON.stringify(storedNumbers));
     renderStoredNumberBadges();
   }
   
   function removeStoredNumber(phoneNumber, event) {
     if (event) event.stopPropagation();
     let storedNumbers = JSON.parse(localStorage.getItem("beeharvest_stored_numbers") || "[]");
     storedNumbers = storedNumbers.filter((num) => num !== phoneNumber);
     localStorage.setItem("beeharvest_stored_numbers", JSON.stringify(storedNumbers));
     renderStoredNumberBadges();
     const currentDisplay = document.getElementById("currentMobileDisplay")?.textContent;
     if (currentDisplay === phoneNumber) {
       document.getElementById("mobileOrdersList").innerHTML = `<div class="mobile-orders-empty"><i class="fas fa-search"></i><p>একটি মোবাইল নম্বর দিয়ে অর্ডার সার্চ করুন</p></div>`;
       document.getElementById("currentMobileDisplay").textContent = "—";
       localStorage.removeItem("last_displayed_mobile");
     }
   }
   
   function renderStoredNumberBadges() {
     const container = document.getElementById("storedNumbersContainer");
     if (!container) return;
     const storedNumbers = JSON.parse(localStorage.getItem("beeharvest_stored_numbers") || "[]");
     if (storedNumbers.length === 0) {
       container.innerHTML = '<span style="font-size:0.7rem;color:var(--text-muted);">কোনো সংরক্ষিত নম্বর নেই</span>';
       return;
     }
     container.innerHTML = storedNumbers.map((num) => `
       <span class="stored-number-badge" onclick="fetchAndDisplayOrdersByNumber('${num}')">
         <i class="fas fa-phone"></i> ${num}
         <i class="fas fa-times-circle remove-num" onclick="removeStoredNumber('${num}', event)"></i>
       </span>`).join("");
     if (storedNumbers.length > 0) {
       const clearBtn = document.createElement("button");
       clearBtn.className = "clear-stored-btn";
       clearBtn.innerHTML = '<i class="fas fa-trash-alt"></i> সব';
       clearBtn.onclick = () => {
         if (confirm("সব সংরক্ষিত নম্বর মুছে ফেলতে চান?")) {
           localStorage.setItem("beeharvest_stored_numbers", "[]");
           renderStoredNumberBadges();
           document.getElementById("mobileOrdersList").innerHTML = `<div class="mobile-orders-empty"><i class="fas fa-search"></i><p>একটি মোবাইল নম্বর দিয়ে অর্ডার সার্চ করুন</p></div>`;
           document.getElementById("currentMobileDisplay").textContent = "—";
         }
       };
       container.appendChild(clearBtn);
     }
   }
   
   async function fetchAndDisplayOrdersByNumber(phoneNumber) {
     const input = document.getElementById("mobileNumberInput");
     if (input) input.value = phoneNumber;
     localStorage.setItem("last_displayed_mobile", phoneNumber);
     const orders = await fetchOrdersByMobile(phoneNumber);
     if (orders) {
       renderMobileOrdersList(phoneNumber, orders);
       document.getElementById("currentMobileDisplay").textContent = phoneNumber;
     }
   }
   
   function clearAllStoredOrdersCache() {
     if (confirm("সব সংরক্ষিত অর্ডার ক্যাশ মুছে ফেলতে চান? এটি শুধু লোকাল স্টোরেজ ক্লিয়ার করবে।")) {
       localStorage.removeItem(STORAGE_KEY);
       cachedOrdersByMobile = {};
       renderStoredNumberBadges();
       showToast("ক্যাশ সাফ করা হয়েছে", "success");
     }
   }

   /* ════════════════════════════════════════════════════════════
         STATS ANIMATION
      ════════════════════════════════════════════════════════════ */
   function animateStats() {
     const statCells = document.querySelectorAll(".stat-cell");
     const observer = new IntersectionObserver((entries) => {
       entries.forEach((entry) => {
         if (entry.isIntersecting) {
           const cell = entry.target;
           const numElement = cell.querySelector(".stat-num");
           const targetText = numElement.textContent;
           numElement.classList.add("count-animate");
           let targetNumber = parseInt(targetText);
           if (isNaN(targetNumber)) {
             if (targetText.includes("১০ক")) targetNumber = 10000;
             else if (targetText.includes("২৪ঘ")) targetNumber = 24;
             else if (targetText.includes("৪.৯")) targetNumber = 4.9;
             else targetNumber = 500;
           }
           if (!isNaN(targetNumber) && !targetText.includes("★") && !targetText.includes("ক")) {
             let current = 0;
             const suffix = targetText.includes("+") ? "+" : "";
             const increment = targetNumber / 50;
             const timer = setInterval(() => {
               current += increment;
               if (current >= targetNumber) { numElement.textContent = Math.floor(targetNumber) + suffix; clearInterval(timer); }
               else { numElement.textContent = Math.floor(current) + suffix; }
             }, 20);
           }
           observer.unobserve(cell);
         }
       });
     }, { threshold: 0.3 });
     statCells.forEach((cell) => observer.observe(cell));
   }
   
   function viewOrderDetails(orderId) {
     openTrackingModal(orderId);
   }

   /* ════════════════════════════════════════════════════════════
         CHATBOT
      ════════════════════════════════════════════════════════════ */
   const BeeChat = {
     open: false,
     sessionId: 'bee_' + Math.random().toString(36).slice(2),
     history: [],
     typing: false,
     toggle() {
       this.open = !this.open;
       const win = document.getElementById('beeChatWindow');
       const fab = document.getElementById('beeChatFab');
       win.classList.toggle('bee-open', this.open);
       fab.classList.toggle('chat-open', this.open);
       if (this.open) {
         this._hideBadge();
         if (this.history.length === 0) this._showWelcome();
         setTimeout(() => document.getElementById('beeChatInput')?.focus(), 400);
       }
     },
     _showWelcome() {
       const msgs = document.getElementById('beeChatMessages');
       if (!msgs) return;
       msgs.innerHTML = '';
       const card = document.createElement('div');
       card.innerHTML = `<div class="bee-welcome"><span class="bee-welcome-emoji">🐝</span><div class="bee-welcome-title">আস্সালামু আলাইকুম!</div><div class="bee-welcome-sub">আমি Bee সহকারী। অর্ডার ট্র্যাক, পণ্যের দাম, ডেলিভারি — সব বিষয়ে সাহায্য করতে পারি।</div></div>`;
       msgs.appendChild(card);
       this._loadSuggestions();
     },
     async _loadSuggestions(custom = null) {
       const chips = document.getElementById('beeSuggestions');
       if (!chips) return;
       const defaults = ['আমার অর্ডার ট্র্যাক করুন', 'ডেলিভারি চার্জ কত?', 'কুপন আছে?', 'পেমেন্ট পদ্ধতি'];
       let suggestions = custom || defaults;
       if (!custom) {
         try {
           const res = await fetch(`${API_URL}/chatbot/suggestions`);
           const data = await res.json();
           if (data.success && data.suggestions?.length) suggestions = data.suggestions.slice(0, 5);
         } catch (e) {}
       }
       chips.innerHTML = suggestions.map(s => `<button class="bee-chip" onclick="BeeChat._quickSend('${s.replace(/'/g, "\\'")}')"> ${s} </button>`).join('');
     },
     _quickSend(text) {
       const input = document.getElementById('beeChatInput');
       if (input) input.value = text;
       this.send();
     },
     async send() {
       const input = document.getElementById('beeChatInput');
       const msg = (input?.value || '').trim();
       if (!msg || this.typing) return;
       input.value = '';
       document.getElementById('beeSuggestions').innerHTML = '';
       this._appendUserBubble(msg);
       this.history.push({ role: 'user', content: msg });
       this._showTyping();
       this.typing = true;
       try {
         const res = await fetch(`${API_URL}/chatbot/message`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ message: msg, sessionId: this.sessionId }),
         });
         const data = await res.json();
         this._hideTyping();
         if (data.success) {
           this._renderBotResponse(data.response, data.intent);
           if (data.response?.suggestions?.length) this._loadSuggestions(data.response.suggestions);
         } else {
           this._appendBotBubble('😔 কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।');
           this._loadSuggestions();
         }
       } catch (err) {
         this._hideTyping();
         this._appendBotBubble('🌐 সংযোগ সমস্যা। ইন্টারনেট চেক করুন।');
       } finally { this.typing = false; }
     },
     _renderBotResponse(r, intent) {
       if (!r) return;
       const mainText = r.text?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '';
       let extraHTML = '';
       if (r.order) {
         const o = r.order;
         extraHTML += `<div class="bee-order-header"><div><div class="bee-order-num">${o.number || ''}</div><div style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:2px">${o.customerName || ''}</div></div><div class="bee-order-badge bee-status-${o.status || 'pending'}">${o.statusEmoji || '📦'} ${o.statusBn || o.status}</div></div>${o.trackingNumber ? `<div class="bee-rich-card"><div class="bee-card-row"><span class="bee-card-label">ট্র্যাকিং</span><span class="bee-card-value honey">${o.trackingNumber}</span></div></div>` : ''}${o.total ? `<div class="bee-rich-card"><div class="bee-card-row"><span class="bee-card-label">মোট</span><span class="bee-card-value honey">৳${o.total.toLocaleString()}</span></div></div>` : ''}`;
       }
       if (r.orders?.length) {
         extraHTML += `<div style="margin-top:8px;display:flex;flex-direction:column;gap:5px;">`;
         r.orders.slice(0, 5).forEach(o => { extraHTML += `<div class="bee-product-tag" style="cursor:pointer" onclick="openTrackingModal('${o.number}');toggleBeeChat()"><span class="bee-product-name" style="font-size:0.75rem;font-family:monospace">${o.number}</span><span class="bee-order-badge bee-status-${o.status || 'pending'}" style="font-size:0.65rem">${o.status}</span><span class="bee-product-price">৳${(o.total||0).toLocaleString()}</span></div>`; });
         extraHTML += `</div>`;
       }
       if (r.products?.length) {
         r.products.slice(0, 4).forEach(p => { const inStock = p.inStock !== false; extraHTML += `<div class="bee-product-tag"><span class="bee-product-name">${p.name}</span><span class="bee-product-price">৳${(p.price||0).toLocaleString()}</span><span class="bee-product-stock ${inStock ? 'in' : 'out'}">${inStock ? `✓ ${p.stock || ''}টি` : '✗ শেষ'}</span></div>`; });
       }
       if (r.charges) { extraHTML += `<div class="bee-rich-card" style="margin-top:8px"><div class="bee-delivery-row"><span class="bee-card-label">🏙️ ঢাকার ভেতরে</span><span class="bee-card-value honey">৳${r.charges.insideDhaka}</span></div><div class="bee-delivery-row"><span class="bee-card-label">🚚 ঢাকার বাইরে</span><span class="bee-card-value honey">৳${r.charges.outsideDhaka}</span></div>${r.charges.special ? `<div class="bee-delivery-row"><span class="bee-card-label">🎁 বিশেষ (min ৳${r.charges.special.minOrder})</span><span class="bee-card-value" style="color:#22C55E">৳${r.charges.special.amount}</span></div>` : ''}</div><div style="margin-top:6px;font-size:0.72rem;color:#6B7A99">⏱️ ${r.deliveryTime?.insideDhaka || '১–২ কার্যদিবস'} ঢাকায় · ${r.deliveryTime?.outsideDhaka || '২–৪ কার্যদিবস'} বাইরে</div>`; }
       if (r.coupons?.length) { r.coupons.slice(0, 3).forEach(c => { const disc = c.type === 'percentage' ? `${c.value}%` : `৳${c.value}`; extraHTML += `<div class="bee-coupon-card"><div><div class="bee-coupon-code">${c.code}</div>${c.minOrder > 0 ? `<div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-top:2px">min ৳${c.minOrder}</div>` : ''}</div><div class="bee-coupon-val">${disc} OFF</div></div>`; }); }
       if (r.coupon) { const c = r.coupon; const disc = c.type === 'percentage' ? `${c.value}%` : `৳${c.value}`; extraHTML += `<div class="bee-coupon-card"><div><div class="bee-coupon-code">${c.code}</div><div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-top:2px">${c.valid ? '✓ বৈধ কুপন' : '✗ অবৈধ'}</div></div><div class="bee-coupon-val">${disc} OFF</div></div>`; }
       if (r.methods?.length) { extraHTML += `<div class="bee-method-grid">`; r.methods.forEach(m => { extraHTML += `<div class="bee-method-chip"><span>${m.name}</span><small>${m.desc}</small></div>`; }); extraHTML += `</div>`; }
       if (r.points?.length) { extraHTML += `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">`; r.points.forEach(p => { extraHTML += `<div style="font-size:0.78rem;color:#374151;padding:2px 0">${p}</div>`; }); extraHTML += `</div>`; }
       if (r.channels?.length) { extraHTML += `<div class="bee-rich-card" style="margin-top:8px">`; r.channels.forEach(ch => { extraHTML += `<div class="bee-card-row"><span class="bee-card-label">${ch.icon} ${ch.label}</span><span class="bee-card-value">${ch.value}</span></div>`; }); if (r.hours) extraHTML += `<div class="bee-card-row"><span class="bee-card-label">🕐 সময়</span><span class="bee-card-value">${r.hours}</span></div>`; extraHTML += `</div>`; }
       if (r.topics?.length) { extraHTML += `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">`; r.topics.forEach(t => { extraHTML += `<div style="font-size:0.78rem;color:#374151;padding:3px 0;display:flex;align-items:center;gap:6px">${t}</div>`; }); extraHTML += `</div>`; }
       const intentLabel = intent && intent !== 'UNKNOWN' ? `<div class="bee-intent-tag">✦ ${intent.replace('_', ' ')}</div>` : '';
       this._appendBotBubble(mainText + extraHTML + intentLabel);
     },
     _appendUserBubble(text) {
       const msgs = document.getElementById('beeChatMessages');
       if (!msgs) return;
       const row = document.createElement('div');
       row.className = 'bee-msg-row user-row';
       row.innerHTML = `<div><div class="bee-bubble user-bubble">${this._escHtml(text)}</div><div class="bee-ts">${this._time()}</div></div>`;
       msgs.appendChild(row);
       this._scroll();
     },
     _appendBotBubble(html) {
       const msgs = document.getElementById('beeChatMessages');
       if (!msgs) return;
       const row = document.createElement('div');
       row.className = 'bee-msg-row';
       row.innerHTML = `<div class="bee-msg-av">🐝</div><div><div class="bee-bubble bot-bubble">${html}</div><div class="bee-ts">${this._time()}</div></div>`;
       msgs.appendChild(row);
       this._scroll();
     },
     _showTyping() {
       const msgs = document.getElementById('beeChatMessages');
       if (!msgs) return;
       const el = document.createElement('div');
       el.className = 'bee-typing';
       el.id = 'beeTypingIndicator';
       el.innerHTML = `<div class="bee-msg-av">🐝</div><div class="bee-typing-bubble"><div class="bee-typing-dot"></div><div class="bee-typing-dot"></div><div class="bee-typing-dot"></div></div>`;
       msgs.appendChild(el);
       this._scroll();
     },
     _hideTyping() { document.getElementById('beeTypingIndicator')?.remove(); },
     _scroll() { const msgs = document.getElementById('beeChatMessages'); if (msgs) setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50); },
     _time() { return new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' }); },
     _escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
     _hideBadge() { const b = document.getElementById('beeFabBadge'); if (b) b.style.display = 'none'; },
     clear() { this.history = []; this.sessionId = 'bee_' + Math.random().toString(36).slice(2); this._showWelcome(); },
   };
   
   window.toggleBeeChat  = () => BeeChat.toggle();
   window.sendBeeMessage = () => BeeChat.send();
   window.clearBeeChat   = () => BeeChat.clear();
   
   setTimeout(() => {
     if (!BeeChat.open) {
       const badge = document.getElementById('beeFabBadge');
       if (badge) { badge.style.display = 'flex'; badge.textContent = '1'; }
     }
   }, 4000);

   /* ════════════════════════════════════════════════════════════
     COUPON FUNCTIONS for CART SIDEBAR (if needed)
  ════════════════════════════════════════════════════════════ */
let cartAppliedCoupon = null;

async function applyCouponFromUI() {
  const input = document.getElementById("couponInput");
  const msgEl = document.getElementById("couponMessage");
  const code = (input?.value || "").trim().toUpperCase();
  
  if (!code) {
    if (msgEl) {
      msgEl.textContent = "কুপন কোড লিখুন";
      msgEl.className = "coupon-msg coupon-msg-error";
    }
    showToast("কুপন কোড লিখুন", "error");
    return;
  }
  
  const btn = document.getElementById("applyCouponBtn");
  if (btn) setButtonLoading(btn, true);
  
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  
  try {
    const res = await fetch(`${API_URL}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();
    
    if (!data.success) {
      if (msgEl) {
        msgEl.textContent = data.message || "কুপন প্রয়োগ হয়নি";
        msgEl.className = "coupon-msg coupon-msg-error";
      }
      cartAppliedCoupon = null;
      return;
    }
    
    cartAppliedCoupon = {
      code: data.data.code,
      discount: data.data.discount,
      discountType: data.data.discountType,
      discountValue: data.data.discountValue,
    };
    
    if (msgEl) {
      const label = data.data.discountType === "percentage" 
        ? `${data.data.discountValue}% ছাড়` 
        : `৳${data.data.discountValue} ছাড়`;
      msgEl.textContent = `✅ "${cartAppliedCoupon.code}" — ${label} প্রয়োগ হয়েছে!`;
      msgEl.className = "coupon-msg coupon-msg-success";
    }
    
    if (input) input.disabled = true;
    
    // Also apply to checkout if it's open
    if (typeof checkoutAppliedCoupon !== 'undefined') {
      checkoutAppliedCoupon = cartAppliedCoupon;
      const checkoutInput = document.getElementById("checkoutCouponInput");
      if (checkoutInput) {
        checkoutInput.value = code;
        checkoutInput.disabled = true;
      }
      const removeBtn = document.getElementById("couponRemoveBtn");
      if (removeBtn) removeBtn.style.display = "inline-flex";
      const applyBtn = document.getElementById("checkoutCouponApplyBtn");
      if (applyBtn) applyBtn.style.display = "none";
    }
    
    await updateCartUI();
    showToast(`কুপন "${cartAppliedCoupon.code}" প্রয়োগ হয়েছে!`, "success");
    
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।";
      msgEl.className = "coupon-msg coupon-msg-error";
    }
  } finally {
    if (btn) setButtonLoading(btn, false);
  }
}

async function removeCouponFromUI() {
  cartAppliedCoupon = null;
  
  const input = document.getElementById("couponInput");
  const msgEl = document.getElementById("couponMessage");
  const applyBtn = document.getElementById("applyCouponBtn");
  const removeBtn = document.getElementById("removeCouponBtn");
  
  if (input) {
    input.value = "";
    input.disabled = false;
  }
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.className = "coupon-msg";
  }
  if (applyBtn) applyBtn.style.display = "inline-flex";
  if (removeBtn) removeBtn.style.display = "none";
  
  // Also remove from checkout
  if (typeof removeCheckoutCoupon === 'function') {
    removeCheckoutCoupon();
  }
  
  await updateCartUI();
  showToast("কুপন সরানো হয়েছে", "info");
}

/* ── Checkout step navigation ─────────────────────────── */
function checkoutGoTo(step) {
  const validateStep1 = () => {
    const name  = val("checkoutName");
    const email = val("checkoutEmail");
    const phone = val("checkoutPhone");
    const addr  = val("checkoutAddress");
    const city  = val("checkoutCity");
    if (!name || !email || !phone || !addr || !city) {
      showToast("সব প্রয়োজনীয় তথ্য পূরণ করুন (*)", "error");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("সঠিক ইমেইল ঠিকানা দিন", "error");
      return false;
    }
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      showToast("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)", "error");
      return false;
    }
    return true;
  };

  if (step === 2 && !validateStep1()) return;

  [1, 2, 3].forEach(i => {
    document.getElementById("coPanel" + i)?.classList.toggle("active", i === step);
    const dot  = document.getElementById("coStep" + i);
    const line = document.getElementById("coLine"  + i);
    if (!dot) return;
    dot.classList.remove("active", "done");
    if (i <  step) { dot.classList.add("done"); dot.querySelector(".co-dot").innerHTML = '<i class="fas fa-check" style="font-size:0.6rem"></i>'; }
    if (i === step) { dot.classList.add("active"); dot.querySelector(".co-dot").textContent = i; }
    if (i >  step)  { dot.querySelector(".co-dot").textContent = i; }
    if (line) line.classList.toggle("done", i < step);
  });

  // refresh summary when entering step 2
  if (step === 2) _refreshCheckoutSummary();
  document.querySelector(".co-body")?.scrollTo(0, 0);
}

window.checkoutGoTo = checkoutGoTo;

// Export the functions
window.applyCouponFromUI = applyCouponFromUI;
window.removeCouponFromUI = removeCouponFromUI;

   /* ════════════════════════════════════════════════════════════
         GLOBAL EXPORTS
      ════════════════════════════════════════════════════════════ */
   window.navigateTo = navigateTo;
   window.viewProduct = viewProduct;
   window.addToCart = addToCart;
   window.updateQuantity = updateQuantity;
   window.removeFromCart = removeFromCart;
   window.openCheckout = openCheckout;
   window.placeOrder = placeOrder;
   window.closeModal = closeModal;
   window.loadProducts = loadProducts;
   window.filterByCategory = filterByCategory;
   window.showPolicy = showPolicy;
   window.openTrackingModal = openTrackingModal;
   window.trackOrder = trackOrder;
   window.clearTracking = clearTracking;
   window.quickTrackFromOrders = quickTrackFromOrders;
   window.showMaintenanceOverlay = showMaintenanceOverlay;
   window.hideMaintenanceOverlay = hideMaintenanceOverlay;
   window.retryAfterMaintenance = retryAfterMaintenance;
   window.applyCheckoutCoupon = applyCheckoutCoupon;
   window.removeCheckoutCoupon = removeCheckoutCoupon;
   window.handleMobileNumberSubmit = handleMobileNumberSubmit;
   window.fetchOrdersByMobile = fetchOrdersByMobile;
   window.removeStoredNumber = removeStoredNumber;
   window.fetchAndDisplayOrdersByNumber = fetchAndDisplayOrdersByNumber;
   window.viewOrderDetails = viewOrderDetails;
   window.clearAllStoredOrdersCache = clearAllStoredOrdersCache;
   
   /* ════════════════════════════════════════════════════════════
         DOM READY
      ════════════════════════════════════════════════════════════ */
   document.addEventListener("DOMContentLoaded", () => {
     loadStoredMobileOrders();
     renderStoredNumberBadges();
   });

   document.addEventListener("DOMContentLoaded", () => {
     const style = document.createElement("style");
     style.textContent = `
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          @keyframes trackResultIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        `;
     document.head.appendChild(style);
   
     /* Desktop cart */
     document.getElementById("cartBtn")?.addEventListener("click", () => {
       document.getElementById("cartSidebar").classList.add("open");
       document.getElementById("cartBackdrop").classList.add("show");
       document.body.classList.add("cart-open"); 
       updateCartUI();
     });
     document.getElementById("closeCart")?.addEventListener("click", () => {
       document.getElementById("cartSidebar").classList.remove("open");
       document.getElementById("cartBackdrop").classList.remove("show");
       document.body.classList.remove("cart-open");
     });
     document.getElementById("cartBackdrop")?.addEventListener("click", () => {
       document.getElementById("cartSidebar").classList.remove("open");
       document.getElementById("cartBackdrop").classList.remove("show");
       document.body.classList.remove("cart-open");
     });
   
     /* Checkout */
     document.getElementById("checkoutBtn")?.addEventListener("click", () => {
       document.getElementById("cartSidebar").classList.remove("open");
       document.getElementById("cartBackdrop").classList.remove("show");
       openCheckout();
     });
     document.getElementById("checkoutForm")?.addEventListener("submit", placeOrder);
     document.getElementById("confirmOrderBtn")?.addEventListener("click", placeOrder);
   
     /* Mobile nav */
     document.querySelectorAll(".mobile-nav-item[data-page]").forEach((item) => {
       item.addEventListener("click", (e) => { e.preventDefault(); navigateTo(item.dataset.page); });
     });
     document.getElementById("mobileCartBtn")?.addEventListener("click", (e) => { e.preventDefault(); openMobileCart(); });
     document.getElementById("closeMobileCart")?.addEventListener("click", closeMobileCart);
     document.getElementById("mobileCheckoutBtn")?.addEventListener("click", () => { closeMobileCart(); openCheckout(); });
   
     /* Desktop nav */
     document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
       link.addEventListener("click", (e) => { e.preventDefault(); navigateTo(link.dataset.page); });
     });
   
     /* Filters */
     document.getElementById("searchProducts")?.addEventListener("input", debounce(() => loadProducts(1), 400));
     document.getElementById("categoryFilter")?.addEventListener("change", () => loadProducts(1));
     document.getElementById("sortBy")?.addEventListener("change", () => loadProducts(1));
     document.getElementById("priceFilter")?.addEventListener("change", () => loadProducts(1));
   
     /* Tracking input */
     document.getElementById("trackOrderInput")?.addEventListener("input", _toggleClearBtn);

     /* City select — dynamic shipping in checkout */
     const citySelect = document.getElementById("checkoutCity");
     if (citySelect) {
       citySelect.addEventListener("change", async () => {
         const city = citySelect.value;
         if (cart.length > 0) {
           const { subtotal, shipping, discount, total } = await cartTotalsAsync(city, false);
           setText("summarySubtotal", `৳${subtotal.toLocaleString()}`);
           setText("summaryShipping", `৳${shipping.toLocaleString()}`);
           setText("summaryTotal", `৳${total.toLocaleString()}`);
         }
       });
     }

     /* Coupon input — enter key */
     document.getElementById("checkoutCouponInput")?.addEventListener("keypress", (e) => {
       if (e.key === "Enter") applyCheckoutCoupon();
     });
   
     /* Close modal on backdrop */
     document.querySelectorAll(".modal").forEach((m) => {
       m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); });
     });
   
     /* Escape key */
     document.addEventListener("keydown", (e) => {
       if (e.key === "Escape") {
         document.querySelectorAll(".modal.active").forEach((m) => closeModal(m.id));
         document.getElementById("cartSidebar")?.classList.remove("open");
         document.getElementById("cartBackdrop")?.classList.remove("show");
         closeMobileCart();
       }
     });
   
     window.addEventListener("resize", () => {
       const c = document.getElementById("confettiCanvas");
       if (c?.classList.contains("active")) { c.width = window.innerWidth; c.height = window.innerHeight; }
     });
   
     updateCartUI();
     navigateTo("home");
   });
