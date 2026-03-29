/* ═══════════════════════════════════════════════════════════
   BeeHarvest — customer.js
   Clean, production-ready. All bugs fixed.
   ═══════════════════════════════════════════════════════════ */

   const API_URL = 'https://beeyond-harvest-admin.onrender.com/api';
   let cart = [];
   let currentProductsPage = 1;
   let totalProductsPages  = 1;
   
   /* ─── Init cart from localStorage ─────────────────────── */
   try {
     const saved = localStorage.getItem('cart');
     if (saved) cart = JSON.parse(saved);
   } catch(e) { cart = []; }
   
   /* ════════════════════════════════════════════════════════════
      API HELPER
   ════════════════════════════════════════════════════════════ */
   async function apiCall(endpoint, options = {}) {
     const res = await fetch(`${API_URL}${endpoint}`, {
       headers: { 'Content-Type': 'application/json' },
       ...options,
     });
     const ct = res.headers.get('content-type') || '';
     if (!ct.includes('application/json')) {
       throw new Error(`সার্ভার থেকে অপ্রত্যাশিত রেসপন্স (HTTP ${res.status})`);
     }
     const data = await res.json();
     if (!res.ok) throw new Error(data.message || 'সার্ভার ত্রুটি');
     return data;
   }
   
   /* ════════════════════════════════════════════════════════════
      CATEGORIES
   ════════════════════════════════════════════════════════════ */
   async function loadCategories() {
     try {
       const res = await apiCall('/categories');
       if (!res.success || !res.data) return;
       const cats = res.data;
   
       // Grid on home
       const grid = document.getElementById('categoriesList');
       if (grid) {
         grid.innerHTML = cats.length === 0
           ? emptyMsg('কোনো ক্যাটাগরি নেই')
           : cats.map(c => `
               <div class="category-card" onclick="filterByCategory('${c._id}')">
                 <div class="cat-icon"><i class="fas fa-tag"></i></div>
                 <h3>${escHtml(c.name)}</h3>
               </div>`).join('');
       }
   
       // Filter dropdown
       const sel = document.getElementById('categoryFilter');
       if (sel) {
         sel.innerHTML = '<option value="">সব ক্যাটাগরি</option>'
           + cats.map(c => `<option value="${c._id}">${escHtml(c.name)}</option>`).join('');
       }
     } catch(e) {
       console.error('Categories:', e);
     }
   }
   
   /* ════════════════════════════════════════════════════════════
      PRODUCTS
   ════════════════════════════════════════════════════════════ */
   async function loadFeaturedProducts() {
     const grid = document.getElementById('featuredProducts');
     if (!grid) return;
     grid.innerHTML = skeletonCards(4);
     try {
       const res = await fetch(`${API_URL}/products?isFeatured=true&limit=8`);
       const data = await res.json();
       if (!data.success) throw new Error('Invalid response');
       const products = data.data || [];
       grid.innerHTML = products.length === 0
         ? emptyMsg('কোনো ফিচার্ড পণ্য নেই')
         : products.map(renderProductCard).join('');
     } catch(e) {
       console.error('Featured:', e);
       grid.innerHTML = errorMsg('ফিচার্ড পণ্য লোড করতে ব্যর্থ হয়েছে');
     }
   }
   
   async function loadProducts(page = 1) {
     const grid = document.getElementById('allProducts');
     if (!grid) return;
     grid.innerHTML = skeletonCards(6);
   
     try {
       const search   = document.getElementById('searchProducts')?.value.trim() || '';
       const category = document.getElementById('categoryFilter')?.value || '';
       const sort     = document.getElementById('sortBy')?.value || '-createdAt';
       const priceRange = document.getElementById('priceFilter')?.value || '';
   
       const params = new URLSearchParams({ page, limit: 12 });
       if (search)   params.set('search', search);
       if (category) params.set('category', category);
       if (sort)     params.set('sort', sort);
       if (priceRange) {
         const [min, max] = priceRange.split('-');
         if (min) params.set('minPrice', min);
         if (max && max !== '100000') params.set('maxPrice', max);
       }
   
       const res = await apiCall(`/products?${params}`);
       const products = res.data || [];
   
       grid.innerHTML = products.length === 0
         ? `<div style="grid-column:1/-1;">${emptyMsg('কোনো পণ্য পাওয়া যায়নি')}</div>`
         : products.map(renderProductCard).join('');
   
       if (res.pagination) {
         totalProductsPages = res.pagination.pages || 1;
         currentProductsPage = page;
         renderPagination('productsPagination', page, res.pagination.pages, 'loadProducts');
       }
     } catch(e) {
       console.error('Products:', e);
       grid.innerHTML = errorMsg('পণ্য লোড করতে ব্যর্থ হয়েছে');
       showToast('পণ্য লোড করতে সমস্যা হয়েছে', 'error');
     }
   }
   
   /* ─── Render Product Card ────────────────────────────── */
   function renderProductCard(p) {
     if (!p?._id) return '';
   
     const id        = String(p._id);
     const safeName  = escHtml(p.name || '');
     const price     = p.discountPrice || p.price;
     const imgUrl    = p.images?.[0]?.url || 'https://via.placeholder.com/400x300?text=No+Image';
     const discount  = p.discountPrice
       ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
   
     let stockClass = '', stockText = '', stockIcon = 'fa-check-circle';
     if (p.stock <= 0) {
       stockClass = 'out'; stockText = 'স্টকে নেই'; stockIcon = 'fa-times-circle';
     } else if (p.stock <= 10) {
       stockClass = 'low'; stockText = `শেষ ${p.stock} টি`; stockIcon = 'fa-exclamation-circle';
     } else {
       stockText = 'স্টকে আছে';
     }
   
     // Store product data for inline access
     window[`__p_${id}`] = p;
   
     return `
       <div class="product-card" onclick="viewProduct('${id}')">
         <div class="product-image-wrap">
           <img class="product-image" src="${escHtml(imgUrl)}" alt="${safeName}" loading="lazy"
                onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
           ${discount ? `<div class="product-badge">${discount}% ছাড়</div>` : ''}
           ${p.stock <= 0 ? `<div class="product-badge out">স্টক শেষ</div>` : ''}
           ${p.stock > 0 ? `
             <button class="product-quick-add" onclick="event.stopPropagation(); addToCart('${id}', ${price}, '${escHtml(imgUrl)}')">
               <i class="fas fa-cart-plus"></i> কার্টে যোগ করুন
             </button>` : ''}
         </div>
         <div class="product-info">
           <div class="product-name">${safeName}</div>
           <div class="product-price-row">
             <span class="price-final">৳${price.toLocaleString('bn-BD')}</span>
             ${p.discountPrice ? `<span class="price-original">৳${p.price.toLocaleString('bn-BD')}</span>` : ''}
             ${discount ? `<span class="price-off">${discount}% ছাড়</span>` : ''}
           </div>
           <div class="product-stock-row ${stockClass}">
             <i class="fas ${stockIcon}"></i> ${stockText}
           </div>
           <div class="product-actions">
             ${p.stock > 0
               ? `<button class="btn-primary btn-block" onclick="event.stopPropagation(); addToCart('${id}', ${price}, '${escHtml(imgUrl)}')">
                   <i class="fas fa-cart-plus"></i> কার্টে যোগ করুন
                  </button>`
               : `<button class="btn-ghost btn-block" disabled style="opacity:.5; cursor:not-allowed;">
                   <i class="fas fa-times"></i> স্টকে নেই
                  </button>`
             }
           </div>
         </div>
       </div>`;
   }
   
   /* ════════════════════════════════════════════════════════════
      CART
   ════════════════════════════════════════════════════════════ */
   function addToCart(productId, price, imageUrl) {
     const pData = window[`__p_${productId}`];
     const name  = pData?.name || 'পণ্য';
   
     const existing = cart.find(i => i.productId === productId);
     if (existing) {
       existing.quantity++;
     } else {
       cart.push({ productId, name, price, image: imageUrl, quantity: 1 });
     }
   
     saveCart();
     updateCartUI();
     showToast(`"${name}" কার্টে যোগ হয়েছে`, 'success');
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
     showToast('পণ্য কার্ট থেকে সরানো হয়েছে', 'info');
   }
   
   function saveCart() {
     localStorage.setItem('cart', JSON.stringify(cart));
   }
   
   function cartTotals() {
     const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
     const shipping = subtotal > 0 ? 60 : 0;
     return { subtotal, shipping, total: subtotal + shipping };
   }
   
   function renderCartItem(item, index) {
     return `
       <div class="cart-item">
         <img class="cart-item-image" src="${escHtml(item.image || 'https://via.placeholder.com/80')}"
              alt="${escHtml(item.name)}" onerror="this.src='https://via.placeholder.com/80'">
         <div class="cart-item-info">
           <div class="cart-item-name">${escHtml(item.name)}</div>
           <div class="cart-item-price">৳${item.price.toLocaleString('bn-BD')}</div>
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
   
   function updateCartUI() {
     const count = cart.reduce((s, i) => s + i.quantity, 0);
     const { subtotal, shipping, total } = cartTotals();
   
     // Navbar count
     const cc = document.getElementById('cartCount');
     if (cc) cc.textContent = count;
   
     // Mobile count
     const mc = document.getElementById('mobileCartCount');
     if (mc) mc.textContent = count;
   
     // Desktop cart items
     const ci = document.getElementById('cartItems');
     if (ci) {
       ci.innerHTML = cart.length === 0
         ? `<div class="cart-empty">
              <i class="fas fa-shopping-cart"></i>
              <p>আপনার কার্ট এখন খালি</p>
            </div>`
         : cart.map(renderCartItem).join('');
     }
   
     // Desktop totals
     setText('cartSubtotal', `৳${subtotal.toLocaleString('bn-BD')}`);
     setText('cartShipping', `৳${shipping.toLocaleString('bn-BD')}`);
     setText('cartTotal',    `৳${total.toLocaleString('bn-BD')}`);
   
     // Mobile cart items
     const mi = document.getElementById('mobileCartItems');
     if (mi) {
       mi.innerHTML = cart.length === 0
         ? `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>কার্ট খালি</p></div>`
         : cart.map(renderCartItem).join('');
     }
     setText('mobileCartTotal', `৳${total.toLocaleString('bn-BD')}`);
   }
   
   /* ════════════════════════════════════════════════════════════
      CHECKOUT
   ════════════════════════════════════════════════════════════ */
   function openCheckout() {
     if (cart.length === 0) {
       showToast('কার্ট খালি! আগে পণ্য যোগ করুন', 'error');
       return;
     }
   
     // Populate order summary
     const list = document.getElementById('checkoutItems');
     if (list) {
       list.innerHTML = cart.map(item => `
         <div class="checkout-item">
           <img src="${escHtml(item.image || 'https://via.placeholder.com/60')}" alt="${escHtml(item.name)}"
                onerror="this.src='https://via.placeholder.com/60'">
           <div class="checkout-item-details">
             <div class="checkout-item-name">${escHtml(item.name)}</div>
             <div class="checkout-item-meta">৳${item.price.toLocaleString()} × ${item.quantity}</div>
           </div>
           <div class="checkout-item-total">৳${(item.price * item.quantity).toLocaleString()}</div>
         </div>`).join('');
     }
   
     const { subtotal, shipping, total } = cartTotals();
     setText('summarySubtotal', `৳${subtotal.toLocaleString()}`);
     setText('summaryShipping', `৳${shipping.toLocaleString()}`);
     setText('summaryTotal',    `৳${total.toLocaleString()}`);
   
     openModal('checkoutModal');
   }
   
   /* ════════════════════════════════════════════════════════════
   UPDATE ORDER PLACEMENT FUNCTION
   ════════════════════════════════════════════════════════════ */

async function placeOrder(e) {
  if (e) e.preventDefault();
  
  if (cart.length === 0) {
    showToast('কার্ট খালি!', 'error');
    return;
  }
  
  // Get values
  const fullName  = val('checkoutName');
  const email     = val('checkoutEmail');
  const phone     = val('checkoutPhone');
  const address   = val('checkoutAddress');
  const city      = val('checkoutCity');
  const zipCode   = val('checkoutZipCode');
  const notes     = val('checkoutNotes');
  const payMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';
  const accepted  = document.getElementById('acceptTerms')?.checked;
  
  // Validation
  if (!fullName || !email || !phone || !address || !city) {
    showToast('সব প্রয়োজনীয় তথ্য পূরণ করুন (*)', 'error');
    return;
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('সঠিক ইমেইল ঠিকানা দিন', 'error');
    return;
  }
  
  if (!/^01[3-9]\d{8}$/.test(phone)) {
    showToast('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)', 'error');
    return;
  }
  
  if (!accepted) {
    showToast('শর্তাবলী মেনে নিন', 'error');
    return;
  }
  
  const pmMap = { COD: 'cash_on_delivery', bkash: 'bkash', nagad: 'nagad', card: 'card' };
  
  const orderData = {
    items: cart.map(i => ({ 
      product: i.productId, 
      name: i.name,
      price: i.price,
      quantity: i.quantity 
    })),
    customer: {
      name: fullName,
      email,
      phone,
      address: {
        street: address,
        city, area: city, district: city, division: city,
        postalCode: zipCode || '',
      },
    },
    paymentMethod: pmMap[payMethod] || 'cash_on_delivery',
    deliveryCharge: 60,
    notes: notes || '',
  };
  
  // Show loading
  showLoadingOverlay();
  const btn = document.getElementById('confirmOrderBtn');
  setButtonLoading(btn, true);
  
  try {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'অর্ডার দেওয়া যায়নি');
    if (!data.success) throw new Error(data.message || 'অর্ডার ব্যর্থ');
    
    // Success!
    const orderNum = data.data?.orderNumber || data.data?._id?.slice(-8) || 'SUCCESS';
    const { subtotal, shipping, total } = cartTotals();
    
    // Clear cart
    cart = [];
    saveCart();
    updateCartUI();
    closeModal('checkoutModal');
    hideLoadingOverlay();
    
    // Set order number in success modal
    setText('orderNumber', `#${orderNum}`);
    
    // Store order data for slip generation
    window.lastOrderData = {
      orderNumber: orderNum,
      customer: orderData.customer,
      items: orderData.items,
      subtotal,
      shipping,
      total,
      paymentMethod: orderData.paymentMethod
    };
    
    // Setup download button
    const downloadBtn = document.getElementById('downloadSlipBtn');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        generateOrderSlipPNG(window.lastOrderData);
      };
    }
    
    // Show success modal
    setTimeout(() => {
      openModal('successModal');
      startConfetti();
      setTimeout(stopConfetti, 4000);
    }, 400);
    
    showToast('অর্ডার সফল হয়েছে! 🎉', 'success');
    document.getElementById('checkoutForm')?.reset();
    
  } catch(err) {
    hideLoadingOverlay();
    showToast(err.message || 'অর্ডার দেওয়া যায়নি। আবার চেষ্টা করুন।', 'error');
    console.error('Order error:', err);
  } finally {
    setButtonLoading(btn, false);
  }
}
   
   /* ════════════════════════════════════════════════════════════
      NAVIGATION
   ════════════════════════════════════════════════════════════ */
   function navigateTo(page) {
     // Update desktop nav links
     document.querySelectorAll('.nav-link').forEach(l => {
       l.classList.toggle('active', l.dataset.page === page);
     });
   
     // Update mobile nav items
     document.querySelectorAll('.mobile-nav-item[data-page]').forEach(l => {
       l.classList.toggle('active', l.dataset.page === page);
     });
   
     // Show/hide pages
     document.querySelectorAll('.page-content').forEach(el => {
       el.classList.toggle('active', el.id === `${page}Page`);
     });
   
     // Load data
     switch (page) {
       case 'home':
         loadFeaturedProducts();
         loadCategories();
         break;
       case 'products':
         loadCategories();
         loadProducts(1);
         break;
       case 'orders':
         renderOrdersPage();
         break;
       case 'profile':
         renderProfilePage();
         break;
     }
   
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }
   
   function renderOrdersPage() {
     const el = document.getElementById('userOrders');
     if (!el) return;
     el.innerHTML = `
       <div class="empty-state">
         <div class="empty-state-icon"><i class="fas fa-shopping-bag"></i></div>
         <h3>কোনো অর্ডার নেই</h3>
         <p>পণ্য কার্টে যোগ করুন এবং অর্ডার করুন।</p>
         <button class="btn-primary" onclick="navigateTo('products')">
           <i class="fas fa-box"></i> পণ্য দেখুন
         </button>
       </div>`;
   }
   
   function renderProfilePage() {
     const el = document.getElementById('profileContainer');
     if (!el) return;
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
         <div class="profile-card">
           <div class="profile-card-header">
             <h3>দ্রুত লিংক</h3>
           </div>
           <div class="profile-card-body" style="display:flex;flex-direction:column;gap:.75rem;">
             <button class="btn-ghost btn-block" onclick="navigateTo('orders')">
               <i class="fas fa-shopping-bag"></i> আমার অর্ডার
             </button>
             <button class="btn-ghost btn-block" onclick="navigateTo('products')">
               <i class="fas fa-box"></i> সব পণ্য
             </button>
           </div>
         </div>
       </div>`;
   }
   
   /* ════════════════════════════════════════════════════════════
      VIEW PRODUCT (navigate to detail page)
   ════════════════════════════════════════════════════════════ */
   function viewProduct(productId) {
     if (!productId || productId === 'undefined') {
       showToast('পণ্যের তথ্য পাওয়া যায়নি', 'error');
       return;
     }
     const id = String(productId).trim();
     localStorage.setItem('lastViewedProductId', id);
     window.location.href = `product-detail.html?id=${encodeURIComponent(id)}`;
   }
   
   function filterByCategory(categoryId) {
     navigateTo('products');
     setTimeout(() => {
       const sel = document.getElementById('categoryFilter');
       if (sel) { sel.value = categoryId; loadProducts(1); }
     }, 150);
   }
   
   /* ════════════════════════════════════════════════════════════
      PAGINATION
   ════════════════════════════════════════════════════════════ */
   function renderPagination(containerId, current, total, fnName) {
     const el = document.getElementById(containerId);
     if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
   
     const pages = [];
     pages.push(`<button onclick="${fnName}(${current - 1})" ${current === 1 ? 'disabled' : ''}>
       <i class="fas fa-chevron-left"></i></button>`);
   
     const start = Math.max(1, current - 2);
     const end   = Math.min(total, current + 2);
     if (start > 1) pages.push(`<button onclick="${fnName}(1)">1</button>`);
     if (start > 2) pages.push(`<button disabled>…</button>`);
   
     for (let i = start; i <= end; i++) {
       pages.push(`<button onclick="${fnName}(${i})" class="${i === current ? 'active' : ''}">${i}</button>`);
     }
   
     if (end < total - 1) pages.push(`<button disabled>…</button>`);
     if (end < total)     pages.push(`<button onclick="${fnName}(${total})">${total}</button>`);
   
     pages.push(`<button onclick="${fnName}(${current + 1})" ${current === total ? 'disabled' : ''}>
       <i class="fas fa-chevron-right"></i></button>`);
   
     el.innerHTML = pages.join('');
   }
   
   /* ════════════════════════════════════════════════════════════
      MODAL HELPERS
   ════════════════════════════════════════════════════════════ */
   function openModal(id) {
     const m = document.getElementById(id);
     if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
   }
   
   function closeModal(id) {
     const m = document.getElementById(id);
     if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
   }
   
   /* ════════════════════════════════════════════════════════════
      LOADING OVERLAY
   ════════════════════════════════════════════════════════════ */
   function showLoadingOverlay() {
     document.getElementById('loadingOverlay')?.classList.add('active');
   }
   
   function hideLoadingOverlay() {
     document.getElementById('loadingOverlay')?.classList.remove('active');
   }
   
   function setButtonLoading(btn, loading) {
     if (!btn) return;
     if (loading) {
       btn.disabled = true;
       btn.classList.add('btn-loading');
       btn._origHTML = btn.innerHTML;
       btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> প্রক্রিয়াকরণ...';
     } else {
       btn.disabled = false;
       btn.classList.remove('btn-loading');
       if (btn._origHTML) btn.innerHTML = btn._origHTML;
     }
   }
   
   /* ════════════════════════════════════════════════════════════
      TOAST
   ════════════════════════════════════════════════════════════ */
   const TOAST_ICONS = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
   
   function showToast(message, type = 'info') {
     // Remove existing toasts of same type
     document.querySelectorAll(`.toast.${type}`).forEach(t => t.remove());
   
     const t = document.createElement('div');
     t.className = `toast ${type}`;
     t.innerHTML = `<i class="fas ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i><span>${escHtml(message)}</span>`;
     document.body.appendChild(t);
     setTimeout(() => t.remove(), 3500);
   }
   
   /* ════════════════════════════════════════════════════════════
      CONFETTI
   ════════════════════════════════════════════════════════════ */
   let _confettiRaf = null;
   
   function startConfetti() {
     const canvas = document.getElementById('confettiCanvas');
     if (!canvas) return;
     canvas.classList.add('active');
     canvas.width  = window.innerWidth;
     canvas.height = window.innerHeight;
     const ctx = canvas.getContext('2d');
   
     const colors = ['#F5A623','#FDD882','#C47F11','#0D1B3E','#1A2E5A','#28a745','#ff6b6b'];
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
         p.y += p.vy; p.x += p.vx; p.rot += p.rotV;
         if (p.y < canvas.height) alive++;
         ctx.save();
         ctx.translate(p.x, p.y);
         ctx.rotate(p.rot * Math.PI / 180);
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
     const canvas = document.getElementById('confettiCanvas');
     if (canvas) {
       canvas.classList.remove('active');
       canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
     }
     if (_confettiRaf) { cancelAnimationFrame(_confettiRaf); _confettiRaf = null; }
   }
   
   /* ════════════════════════════════════════════════════════════
      UTILITY
   ════════════════════════════════════════════════════════════ */
   function escHtml(str) {
     if (!str) return '';
     return String(str)
       .replace(/&/g,'&amp;').replace(/</g,'&lt;')
       .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
   }
   
   function val(id) {
     return (document.getElementById(id)?.value || '').trim();
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
     return Array(n).fill(0).map(() => `
       <div class="product-card" style="pointer-events:none;">
         <div class="product-image-wrap" style="height:220px;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;animation:shimmer 1.4s infinite;"></div>
         <div class="product-info">
           <div style="height:16px;background:#eee;border-radius:4px;margin-bottom:8px;animation:shimmer 1.4s infinite;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;"></div>
           <div style="height:24px;width:60%;background:#eee;border-radius:4px;animation:shimmer 1.4s infinite;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;"></div>
         </div>
       </div>`).join('');
   }
   
   /* ════════════════════════════════════════════════════════════
      MOBILE CART SHEET
   ════════════════════════════════════════════════════════════ */
   function openMobileCart() {
     updateCartUI();
     document.getElementById('mobileCartSheet')?.classList.add('open');
   }
   
   function closeMobileCart() {
     document.getElementById('mobileCartSheet')?.classList.remove('open');
   }
   
   /* ════════════════════════════════════════════════════════════
      EVENT LISTENERS
   ════════════════════════════════════════════════════════════ */
   document.addEventListener('DOMContentLoaded', () => {
   
     /* ── Shimmer animation ── */
     const style = document.createElement('style');
     style.textContent = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
     document.head.appendChild(style);
   
     /* ── Desktop cart ── */
     document.getElementById('cartBtn')?.addEventListener('click', () => {
       document.getElementById('cartSidebar').classList.add('open');
       document.getElementById('cartBackdrop').classList.add('show');
       updateCartUI();
     });
   
     document.getElementById('closeCart')?.addEventListener('click', () => {
       document.getElementById('cartSidebar').classList.remove('open');
       document.getElementById('cartBackdrop').classList.remove('show');
     });
   
     document.getElementById('cartBackdrop')?.addEventListener('click', () => {
       document.getElementById('cartSidebar').classList.remove('open');
       document.getElementById('cartBackdrop').classList.remove('show');
     });
   
     /* ── Checkout ── */
     document.getElementById('checkoutBtn')?.addEventListener('click', () => {
       document.getElementById('cartSidebar').classList.remove('open');
       document.getElementById('cartBackdrop').classList.remove('show');
       openCheckout();
     });
   
     const form = document.getElementById('checkoutForm');
     if (form) form.addEventListener('submit', placeOrder);
   
     document.getElementById('confirmOrderBtn')?.addEventListener('click', placeOrder);
   
     /* ── Mobile nav ── */
     document.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
       item.addEventListener('click', e => {
         e.preventDefault();
         navigateTo(item.dataset.page);
       });
     });
   
     document.getElementById('mobileCartBtn')?.addEventListener('click', e => {
       e.preventDefault();
       openMobileCart();
     });
   
     document.getElementById('closeMobileCart')?.addEventListener('click', closeMobileCart);
   
     document.getElementById('mobileCheckoutBtn')?.addEventListener('click', () => {
       closeMobileCart();
       openCheckout();
     });
   
     /* ── Desktop nav links ── */
     document.querySelectorAll('.nav-link[data-page]').forEach(link => {
       link.addEventListener('click', e => {
         e.preventDefault();
         navigateTo(link.dataset.page);
       });
     });
   
     /* ── Filters ── */
     document.getElementById('searchProducts')?.addEventListener('input',
       debounce(() => loadProducts(1), 400));
     document.getElementById('categoryFilter')?.addEventListener('change', () => loadProducts(1));
     document.getElementById('sortBy')?.addEventListener('change', () => loadProducts(1));
     document.getElementById('priceFilter')?.addEventListener('change', () => loadProducts(1));
   
     /* ── Close modal on backdrop click ── */
     document.querySelectorAll('.modal').forEach(m => {
       m.addEventListener('click', e => {
         if (e.target === m) closeModal(m.id);
       });
     });
   
     /* ── Escape key ── */
     document.addEventListener('keydown', e => {
       if (e.key === 'Escape') {
         document.querySelectorAll('.modal.active').forEach(m => closeModal(m.id));
         document.getElementById('cartSidebar')?.classList.remove('open');
         document.getElementById('cartBackdrop')?.classList.remove('show');
         closeMobileCart();
       }
     });
   
     /* ── Resize confetti ── */
     window.addEventListener('resize', () => {
       const c = document.getElementById('confettiCanvas');
       if (c?.classList.contains('active')) {
         c.width = window.innerWidth;
         c.height = window.innerHeight;
       }
     });
   
     /* ── Init ── */
     updateCartUI();
     navigateTo('home');
   });
   
   /* ─── Debounce ─────────────────────────────────────────── */
   function debounce(fn, delay) {
     let timer;
     return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
   }
   /* ═══════════════════════════════════════════════════════════
   BEEHARVEST FOOTER JS
   Add this to the bottom of customer.js (or a separate footer.js)
   ═══════════════════════════════════════════════════════════ */

const POLICIES = {
    delivery: {
      title: '<i class="fas fa-truck"></i> ডেলিভারি পলিসি',
      body: `
        <div class="policy-section">
          <div class="policy-highlight">ঢাকার ভিতরে ১–২ কার্যদিবস, ঢাকার বাইরে ২–৫ কার্যদিবসের মধ্যে ডেলিভারি।</div>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-map-marker-alt"></i> ডেলিভারি এলাকা</h4>
          <p>আমরা বাংলাদেশের সকল জেলায় ডেলিভারি প্রদান করি। প্রত্যন্ত অঞ্চলে ডেলিভারি সময় কিছুটা বেশি লাগতে পারে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-taka-sign"></i> ডেলিভারি চার্জ</h4>
          <p>ঢাকার মধ্যে: ৳৬০ | ঢাকার বাইরে: ৳১০০–৳১৫০। ৳৩,০০০ বা তার বেশি অর্ডারে ঢাকায় বিনামূল্যে ডেলিভারি।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-box-open"></i> অর্ডার ট্র্যাকিং</h4>
          <p>অর্ডার নিশ্চিত হলে আপনার মোবাইলে SMS এবং ইমেইলে আপডেট পাঠানো হবে। যেকোনো সমস্যায় আমাদের হটলাইনে যোগাযোগ করুন।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-triangle-exclamation"></i> গুরুত্বপূর্ণ তথ্য</h4>
          <p>ডেলিভারির সময় পণ্য গ্রহণ করে বাক্স খুলে যাচাই করুন। পণ্যে সমস্যা থাকলে ডেলিভারি ম্যানের সামনেই জানান।</p>
        </div>
      `
    },
  
    return: {
      title: '<i class="fas fa-rotate-left"></i> রিটার্ন ও রিফান্ড পলিসি',
      body: `
        <div class="policy-section">
          <div class="policy-highlight">পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করা যাবে — কোনো প্রশ্ন ছাড়াই।</div>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-check-circle"></i> রিটার্নযোগ্য পণ্য</h4>
          <p>যেসব পণ্য ত্রুটিপূর্ণ, ভুল বা বর্ণনার সাথে মেলে না সেগুলো রিটার্ন করা যাবে। পণ্য অবশ্যই অব্যবহৃত, মূল প্যাকেজিংসহ হতে হবে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-times-circle"></i> রিটার্ন হবে না</h4>
          <p>ব্যবহৃত পণ্য, ভাঙা সিল বা প্যাকেজিং ছাড়া পণ্য, ডিজিটাল পণ্য এবং অর্ডারের ৭ দিন পরে রিটার্ন গ্রহণযোগ্য নয়।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-money-bill-wave"></i> রিফান্ড প্রক্রিয়া</h4>
          <p>রিটার্ন অনুমোদনের পর ৩–৫ কার্যদিবসের মধ্যে রিফান্ড প্রদান করা হবে। bKash বা Nagad এ রিফান্ড পাঠানো হবে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-phone"></i> রিটার্ন শুরু করতে</h4>
          <p>আমাদের হটলাইনে কল করুন অথবা WhatsApp এ মেসেজ করুন। অর্ডার নম্বর এবং সমস্যার বিবরণ জানান।</p>
        </div>
      `
    },
  
    privacy: {
      title: '<i class="fas fa-lock"></i> গোপনীয়তা নীতি',
      body: `
        <div class="policy-section">
          <div class="policy-highlight">আপনার ব্যক্তিগত তথ্য সুরক্ষিত রাখা আমাদের সর্বোচ্চ অগ্রাধিকার।</div>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-database"></i> আমরা কী তথ্য সংগ্রহ করি</h4>
          <p>নাম, ঠিকানা, মোবাইল নম্বর, ইমেইল এবং অর্ডার সংক্রান্ত তথ্য। পেমেন্টের কোনো তথ্য আমাদের সার্ভারে সংরক্ষিত হয় না।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-share-nodes"></i> তথ্য ব্যবহার</h4>
          <p>আপনার তথ্য শুধুমাত্র অর্ডার প্রসেস, ডেলিভারি এবং কাস্টমার সার্ভিসের জন্য ব্যবহার করা হয়। তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-shield-halved"></i> নিরাপত্তা</h4>
          <p>SSL এনক্রিপশন ব্যবহার করে সকল তথ্য সুরক্ষিত রাখা হয়। নিয়মিত নিরাপত্তা অডিট পরিচালনা করা হয়।</p>
        </div>
      `
    },
  
    terms: {
      title: '<i class="fas fa-scroll"></i> শর্তাবলী',
      body: `
        <div class="policy-section">
          <div class="policy-highlight">BeeHarvest ব্যবহার করে আপনি নিচের শর্তসমূহ মেনে নিচ্ছেন।</div>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-user-check"></i> ব্যবহারকারীর দায়িত্ব</h4>
          <p>সঠিক তথ্য দিয়ে অর্ডার করুন। ভুল ঠিকানা বা নম্বরের কারণে ডেলিভারি ব্যর্থ হলে আমরা দায়ী নই।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-ban"></i> নিষিদ্ধ কার্যক্রম</h4>
          <p>ভুয়া অর্ডার, জালিয়াতি বা সিস্টেম অপব্যবহার কঠোরভাবে নিষিদ্ধ। এই ধরনের কার্যক্রমে আইনি ব্যবস্থা নেওয়া হবে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-pen"></i> পরিবর্তনের অধিকার</h4>
          <p>BeeHarvest যেকোনো সময় পলিসি পরিবর্তন করার অধিকার রাখে। পরিবর্তন ওয়েবসাইটে প্রকাশিত হবে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-gavel"></i> আইনি এখতিয়ার</h4>
          <p>যেকোনো বিরোধ বাংলাদেশের আইন অনুযায়ী নিষ্পত্তি করা হবে।</p>
        </div>
      `
    },
  
    payment: {
      title: '<i class="fas fa-credit-card"></i> পেমেন্ট নীতি',
      body: `
        <div class="policy-section">
          <div class="policy-highlight">আমরা ক্যাশ অন ডেলিভারি, bKash এবং Nagad গ্রহণ করি।</div>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-hand-holding-usd"></i> ক্যাশ অন ডেলিভারি (COD)</h4>
          <p>পণ্য পেয়ে হাতে হাতে পেমেন্ট করুন। ডেলিভারি ম্যানকে সঠিক পরিমাণ প্রস্তুত রাখুন।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-mobile-alt"></i> মোবাইল ব্যাংকিং</h4>
          <p>bKash বা Nagad এ পেমেন্ট করলে অর্ডার নম্বর উল্লেখ করে Send Money করুন। স্ক্রিনশট আমাদের WhatsApp এ পাঠান।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-triangle-exclamation"></i> পেমেন্ট নিরাপত্তা</h4>
          <p>আমাদের কোনো প্রতিনিধি কখনো OTP বা পিন চাইবে না। এই ধরনের অনুরোধ সম্পূর্ণ প্রতারণা।</p>
        </div>
      `
    },
  
    faq: {
      title: '<i class="fas fa-circle-question"></i> সাধারণ প্রশ্নোত্তর (FAQ)',
      body: `
        <div class="policy-section">
          <h4><i class="fas fa-clock"></i> অর্ডার কতদিনে পাব?</h4>
          <p>ঢাকার মধ্যে ১–২ দিন এবং ঢাকার বাইরে ৩–৫ কার্যদিবস। উইকেন্ড বা সরকারি ছুটিতে ডেলিভারি নাও হতে পারে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-rotate-left"></i> কীভাবে রিটার্ন করব?</h4>
          <p>পণ্য পাওয়ার ৭ দিনের মধ্যে আমাদের হটলাইনে কল করুন। আমাদের টিম আপনাকে গাইড করবে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-box-open"></i> পণ্য নষ্ট এলে কী করব?</h4>
          <p>ডেলিভারি ম্যানের সামনেই বাক্স খুলে চেক করুন। সমস্যা দেখলে তাৎক্ষণিকভাবে জানান এবং আমাদের ফোন করুন।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-location-dot"></i> কোন কোন জেলায় ডেলিভারি করেন?</h4>
          <p>বাংলাদেশের সকল ৬৪ জেলায় আমরা ডেলিভারি দিই। তবে প্রত্যন্ত অঞ্চলে কিছুটা বেশি সময় লাগতে পারে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-taka-sign"></i> ন্যূনতম অর্ডার কত?</h4>
          <p>কোনো ন্যূনতম অর্ডার সীমা নেই। যেকোনো পরিমাণে অর্ডার করা যাবে।</p>
        </div>
        <div class="policy-section">
          <h4><i class="fas fa-gift"></i> অর্ডার বাতিল করা যাবে?</h4>
          <p>অর্ডার শিপ হওয়ার আগে বাতিল করা যাবে। শিপমেন্টের পরে বাতিল সম্ভব নয়, তবে রিটার্ন করা যাবে।</p>
        </div>
      `
    }
  };

  /* ════════════════════════════════════════════════════════════
   ORDER SLIP GENERATOR
   ════════════════════════════════════════════════════════════ */

function generateOrderSlipPNG(orderData) {
  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas dimensions
  canvas.width = 800;
  canvas.height = 1000;
  
  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Colors
  const colors = {
    primary: '#0D1B3E',
    secondary: '#1A2E5A',
    accent: '#F5A623',
    text: '#333333',
    muted: '#666666',
    border: '#e0e0e0'
  };
  
  // Helper function to wrap text
  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;
    
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, lineY);
        line = words[n] + ' ';
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, lineY);
    return lineY + lineHeight;
  }
  
  // Header
  ctx.fillStyle = colors.primary;
  ctx.fillRect(0, 0, canvas.width, 120);
  
  // Logo/Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Hind Siliguri", sans-serif';
  ctx.fillText('BeeHarvest', 50, 50);
  ctx.font = '14px "Hind Siliguri", sans-serif';
  ctx.fillText('বাংলাদেশের বিশ্বস্ত অনলাইন শপ', 50, 80);
  
  // Order Info Section
  let yPos = 160;
  
  // Order Number
  ctx.fillStyle = colors.accent;
  ctx.font = 'bold 24px "Hind Siliguri", sans-serif';
  ctx.fillText(`অর্ডার নম্বর: ${orderData.orderNumber}`, 50, yPos);
  yPos += 40;
  
  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  
  ctx.fillStyle = colors.muted;
  ctx.font = '16px "Hind Siliguri", sans-serif';
  ctx.fillText(`তারিখ: ${dateStr}`, 50, yPos);
  yPos += 30;
  
  // Separator
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, yPos);
  ctx.lineTo(canvas.width - 50, yPos);
  ctx.stroke();
  yPos += 40;
  
  // Customer Info
  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 20px "Hind Siliguri", sans-serif';
  ctx.fillText('গ্রাহক তথ্য', 50, yPos);
  yPos += 30;
  
  ctx.fillStyle = colors.text;
  ctx.font = '16px "Hind Siliguri", sans-serif';
  ctx.fillText(`নাম: ${orderData.customer.name}`, 50, yPos);
  yPos += 25;
  ctx.fillText(`মোবাইল: ${orderData.customer.phone}`, 50, yPos);
  yPos += 25;
  ctx.fillText(`ইমেইল: ${orderData.customer.email}`, 50, yPos);
  yPos += 25;
  
  // Address
  ctx.font = '15px "Hind Siliguri", sans-serif';
  yPos = wrapText(`ঠিকানা: ${orderData.customer.address.street}, ${orderData.customer.address.city}`, 50, yPos, 700, 22);
  yPos += 10;
  
  // Separator
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(50, yPos);
  ctx.lineTo(canvas.width - 50, yPos);
  ctx.stroke();
  yPos += 40;
  
  // Order Items Header
  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 20px "Hind Siliguri", sans-serif';
  ctx.fillText('অর্ডার আইটেমসমূহ', 50, yPos);
  yPos += 40;
  
  // Table Header
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(50, yPos, 700, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Hind Siliguri", sans-serif';
  ctx.fillText('পণ্যের নাম', 70, yPos + 25);
  ctx.fillText('পরিমাণ', 450, yPos + 25);
  ctx.fillText('মূল্য', 550, yPos + 25);
  ctx.fillText('মোট', 650, yPos + 25);
  yPos += 50;
  
  // Order Items
  ctx.fillStyle = colors.text;
  ctx.font = '15px "Hind Siliguri", sans-serif';
  
  orderData.items.forEach((item, index) => {
    if (yPos > 750) return; // Prevent overflow
    
    // Alternate row colors
    if (index % 2 === 0) {
      ctx.fillStyle = '#f9f9f9';
      ctx.fillRect(50, yPos - 10, 700, 40);
    }
    
    ctx.fillStyle = colors.text;
    
    // Product name (truncate if too long)
    let productName = item.name;
    if (productName.length > 40) {
      productName = productName.substring(0, 37) + '...';
    }
    ctx.fillText(productName, 70, yPos + 15);
    
    // Quantity
    ctx.fillText(`x${item.quantity}`, 450, yPos + 15);
    
    // Price
    ctx.fillText(`৳${item.price.toLocaleString('bn-BD')}`, 550, yPos + 15);
    
    // Total
    const itemTotal = item.price * item.quantity;
    ctx.fillText(`৳${itemTotal.toLocaleString('bn-BD')}`, 650, yPos + 15);
    
    yPos += 40;
  });
  
  yPos += 20;
  
  // Separator
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(50, yPos);
  ctx.lineTo(canvas.width - 50, yPos);
  ctx.stroke();
  yPos += 40;
  
  // Summary
  ctx.fillStyle = colors.text;
  ctx.font = '16px "Hind Siliguri", sans-serif';
  ctx.fillText('সারসংক্ষেপ', 50, yPos);
  yPos += 30;
  
  ctx.fillText('পণ্যের মূল্য:', 100, yPos);
  ctx.fillText(`৳${orderData.subtotal.toLocaleString('bn-BD')}`, 650, yPos);
  yPos += 25;
  
  ctx.fillText('ডেলিভারি চার্জ:', 100, yPos);
  ctx.fillText(`৳${orderData.shipping.toLocaleString('bn-BD')}`, 650, yPos);
  yPos += 25;
  
  // Total
  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 18px "Hind Siliguri", sans-serif';
  ctx.fillText('মোট প্রদেয়:', 100, yPos);
  ctx.fillText(`৳${orderData.total.toLocaleString('bn-BD')}`, 650, yPos);
  yPos += 40;
  
  // Payment Method
  ctx.fillStyle = colors.text;
  ctx.font = '16px "Hind Siliguri", sans-serif';
  const paymentMethodText = {
    'cash_on_delivery': 'ক্যাশ অন ডেলিভারি',
    'bkash': 'bKash',
    'nagad': 'Nagad',
    'card': 'কার্ড পেমেন্ট'
  };
  ctx.fillText(`পেমেন্ট পদ্ধতি: ${paymentMethodText[orderData.paymentMethod] || orderData.paymentMethod}`, 50, yPos);
  yPos += 30;
  
  // Footer
  ctx.fillStyle = colors.muted;
  ctx.font = '14px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ধন্যবাদ, BeeHarvest এ কেনাকাটা করার জন্য', canvas.width / 2, yPos + 40);
  ctx.fillText('যেকোনো সহায়তার জন্য কল করুন: 01700-000000', canvas.width / 2, yPos + 65);
  
  // Generate PNG and trigger download
  canvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beeharvest_order_${orderData.orderNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('অর্ডার স্লিপ ডাউনলোড হয়েছে!', 'success');
  });
}
  
  function showPolicy(key) {
    const policy = POLICIES[key];
    if (!policy) return;
  
    document.getElementById('policyModalTitle').innerHTML = policy.title;
  
    const body = document.getElementById('policyModalBody');
    body.innerHTML = policy.body;
  
    openModal('policyModal');
  }
  
  // Make globally available
  window.showPolicy = showPolicy;
   
   /* ── Global exports ─────────────────────────────────────── */
   window.navigateTo    = navigateTo;
   window.viewProduct   = viewProduct;
   window.addToCart     = addToCart;
   window.updateQuantity = updateQuantity;
   window.removeFromCart = removeFromCart;
   window.openCheckout  = openCheckout;
   window.placeOrder    = placeOrder;
   window.closeModal    = closeModal;
   window.loadProducts  = loadProducts;
   window.filterByCategory = filterByCategory;
