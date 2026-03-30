/* ═══════════════════════════════════════════════════════════
   BeeHarvest — customer.js  (COMPLETE + ORDER TRACKING FIXED)
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
   
   /* ─── Debounce ─────────────────────────────────────────── */
   function debounce(fn, delay) {
     let timer;
     return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
   }
   
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
      UTILITY
   ════════════════════════════════════════════════════════════ */
   function escHtml(str) {
     if (!str) return '';
     return String(str)
       .replace(/&/g,'&amp;').replace(/</g,'&lt;')
       .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
   }
   function val(id) { return (document.getElementById(id)?.value || '').trim(); }
   function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
   
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
           <div style="height:16px;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;border-radius:4px;margin-bottom:8px;animation:shimmer 1.4s infinite;"></div>
           <div style="height:24px;width:60%;background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);background-size:200%;border-radius:4px;animation:shimmer 1.4s infinite;"></div>
         </div>
       </div>`).join('');
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
   function showLoadingOverlay() { document.getElementById('loadingOverlay')?.classList.add('active'); }
   function hideLoadingOverlay() { document.getElementById('loadingOverlay')?.classList.remove('active'); }
   
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
     document.querySelectorAll(`.toast.${type}`).forEach(t => t.remove());
     const t = document.createElement('div');
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
       const res = await apiCall('/categories');
       if (!res.success || !res.data) return;
       const cats = res.data;
   
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
       const search     = document.getElementById('searchProducts')?.value.trim() || '';
       const category   = document.getElementById('categoryFilter')?.value || '';
       const sort       = document.getElementById('sortBy')?.value || '-createdAt';
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
         totalProductsPages  = res.pagination.pages || 1;
         currentProductsPage = page;
         renderPagination('productsPagination', page, res.pagination.pages, 'loadProducts');
       }
     } catch(e) {
       console.error('Products:', e);
       grid.innerHTML = errorMsg('পণ্য লোড করতে ব্যর্থ হয়েছে');
       showToast('পণ্য লোড করতে সমস্যা হয়েছে', 'error');
     }
   }
   
   function renderProductCard(p) {
     if (!p?._id) return '';
     const id       = String(p._id);
     const safeName = escHtml(p.name || '');
     const price    = p.discountPrice || p.price;
     const imgUrl   = p.images?.[0]?.url || 'https://via.placeholder.com/400x300?text=No+Image';
     const discount = p.discountPrice ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
   
     let stockClass = '', stockText = '', stockIcon = 'fa-check-circle';
     if (p.stock <= 0) {
       stockClass = 'out'; stockText = 'স্টকে নেই'; stockIcon = 'fa-times-circle';
     } else if (p.stock <= 10) {
       stockClass = 'low'; stockText = `শেষ ${p.stock} টি`; stockIcon = 'fa-exclamation-circle';
     } else {
       stockText = 'স্টকে আছে';
     }
   
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
     if (existing) { existing.quantity++; }
     else { cart.push({ productId, name, price, image: imageUrl, quantity: 1 }); }
     saveCart();
     updateCartUI();
     showToast(`"${name}" কার্টে যোগ হয়েছে`, 'success');
   }
   
   function updateQuantity(index, delta) {
     if (!cart[index]) return;
     const newQty = cart[index].quantity + delta;
     if (newQty <= 0) { removeFromCart(index); }
     else { cart[index].quantity = newQty; saveCart(); updateCartUI(); }
   }
   
   function removeFromCart(index) {
     cart.splice(index, 1);
     saveCart();
     updateCartUI();
     showToast('পণ্য কার্ট থেকে সরানো হয়েছে', 'info');
   }
   
   function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }
   
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
   
     const cc = document.getElementById('cartCount');
     if (cc) cc.textContent = count;
     const mc = document.getElementById('mobileCartCount');
     if (mc) mc.textContent = count;
   
     const ci = document.getElementById('cartItems');
     if (ci) {
       ci.innerHTML = cart.length === 0
         ? `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>আপনার কার্ট এখন খালি</p></div>`
         : cart.map(renderCartItem).join('');
     }
   
     setText('cartSubtotal', `৳${subtotal.toLocaleString('bn-BD')}`);
     setText('cartShipping',  `৳${shipping.toLocaleString('bn-BD')}`);
     setText('cartTotal',     `৳${total.toLocaleString('bn-BD')}`);
   
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
     if (cart.length === 0) { showToast('কার্ট খালি! আগে পণ্য যোগ করুন', 'error'); return; }
   
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
     setText('summaryShipping',  `৳${shipping.toLocaleString()}`);
     setText('summaryTotal',     `৳${total.toLocaleString()}`);
   
     openModal('checkoutModal');
   }
   
   async function placeOrder(e) {
     if (e) e.preventDefault();
     if (cart.length === 0) { showToast('কার্ট খালি!', 'error'); return; }
   
     const fullName  = val('checkoutName');
     const email     = val('checkoutEmail');
     const phone     = val('checkoutPhone');
     const address   = val('checkoutAddress');
     const city      = val('checkoutCity');
     const zipCode   = val('checkoutZipCode');
     const notes     = val('checkoutNotes');
     const payMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';
     const accepted  = document.getElementById('acceptTerms')?.checked;
   
     if (!fullName || !email || !phone || !address || !city) {
       showToast('সব প্রয়োজনীয় তথ্য পূরণ করুন (*)', 'error'); return;
     }
     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
       showToast('সঠিক ইমেইল ঠিকানা দিন', 'error'); return;
     }
     if (!/^01[3-9]\d{8}$/.test(phone)) {
       showToast('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)', 'error'); return;
     }
     if (!accepted) { showToast('শর্তাবলী মেনে নিন', 'error'); return; }
   
     const pmMap = { COD: 'cash_on_delivery', bkash: 'bkash', nagad: 'nagad', card: 'card' };
     const orderData = {
       items: cart.map(i => ({ product: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
       customer: {
         name: fullName, email, phone,
         address: { street: address, city, area: city, district: city, division: city, postalCode: zipCode || '' },
       },
       paymentMethod: pmMap[payMethod] || 'cash_on_delivery',
       deliveryCharge: 60,
       notes: notes || '',
     };
   
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
   
       const orderNum = data.data?.orderNumber || data.data?._id?.slice(-8) || 'SUCCESS';
       const { subtotal, shipping, total } = cartTotals();
   
       // Store for slip and tracking
       window.lastOrderData = {
         orderNumber: orderNum,
         customer: orderData.customer,
         items: orderData.items,
         subtotal, shipping, total,
         paymentMethod: orderData.paymentMethod
       };
   
       cart = [];
       saveCart();
       updateCartUI();
       closeModal('checkoutModal');
       hideLoadingOverlay();
   
       setText('orderNumber', `#${orderNum}`);
   
       // Wire up download slip button
       const downloadBtn = document.getElementById('downloadSlipBtn');
       if (downloadBtn) {
         downloadBtn.onclick = () => generateOrderSlipPNG(window.lastOrderData);
       }
   
       // ★ Wire up track order button in success modal
       const trackBtn = document.getElementById('trackSuccessOrderBtn');
       if (trackBtn) {
         trackBtn.onclick = () => {
           closeModal('successModal');
           openTrackingModal(orderNum);
         };
       }
   
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
     document.querySelectorAll('.nav-link').forEach(l => {
       l.classList.toggle('active', l.dataset.page === page);
     });
     document.querySelectorAll('.mobile-nav-item[data-page]').forEach(l => {
       l.classList.toggle('active', l.dataset.page === page);
     });
     document.querySelectorAll('.page-content').forEach(el => {
       el.classList.toggle('active', el.id === `${page}Page`);
     });
   
     switch (page) {
       case 'home':     loadFeaturedProducts(); loadCategories(); break;
       case 'products': loadCategories(); loadProducts(1); break;
       case 'orders':   renderOrdersPage(); break;
       case 'profile':  renderProfilePage(); break;
     }
     window.scrollTo({ top: 0, behavior: 'smooth' });
   }
   
   /* ★ FIXED renderOrdersPage — shows tracking CTA */
   function renderOrdersPage() {
     const el = document.getElementById('userOrders');
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
     const v = document.getElementById('ordersTrackInput')?.value.trim() || '';
     openTrackingModal(v);
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
           <div class="profile-card-header"><h3>দ্রুত লিংক</h3></div>
           <div class="profile-card-body" style="display:flex;flex-direction:column;gap:.75rem;">
             <button class="btn-ghost btn-block" onclick="navigateTo('orders')">
               <i class="fas fa-satellite-dish"></i> অর্ডার ট্র্যাক করুন
             </button>
             <button class="btn-ghost btn-block" onclick="navigateTo('products')">
               <i class="fas fa-box"></i> সব পণ্য
             </button>
           </div>
         </div>
       </div>`;
   }
   
   /* ════════════════════════════════════════════════════════════
      VIEW PRODUCT
   ════════════════════════════════════════════════════════════ */
   function viewProduct(productId) {
     if (!productId || productId === 'undefined') { showToast('পণ্যের তথ্য পাওয়া যায়নি', 'error'); return; }
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
     pages.push(`<button onclick="${fnName}(${current - 1})" ${current === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`);
   
     const start = Math.max(1, current - 2);
     const end   = Math.min(total, current + 2);
     if (start > 1) pages.push(`<button onclick="${fnName}(1)">1</button>`);
     if (start > 2) pages.push(`<button disabled>…</button>`);
   
     for (let i = start; i <= end; i++) {
       pages.push(`<button onclick="${fnName}(${i})" class="${i === current ? 'active' : ''}">${i}</button>`);
     }
   
     if (end < total - 1) pages.push(`<button disabled>…</button>`);
     if (end < total)     pages.push(`<button onclick="${fnName}(${total})">${total}</button>`);
     pages.push(`<button onclick="${fnName}(${current + 1})" ${current === total ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`);
   
     el.innerHTML = pages.join('');
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
       x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height,
       size: Math.random() * 9 + 4, color: colors[Math.floor(Math.random() * colors.length)],
       vy: Math.random() * 5 + 3, vx: (Math.random() - 0.5) * 3,
       rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 8,
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
     if (canvas) { canvas.classList.remove('active'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
     if (_confettiRaf) { cancelAnimationFrame(_confettiRaf); _confettiRaf = null; }
   }
   
   /* ════════════════════════════════════════════════════════════
      ORDER TRACKING
   ════════════════════════════════════════════════════════════ */
   const ORDER_STATUS_STEPS = [
     { key: 'pending',    icon: 'fa-clock',             label: 'অর্ডার প্রাপ্ত',    desc: 'আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে' },
     { key: 'confirmed',  icon: 'fa-circle-check',       label: 'কনফার্মড',          desc: 'আমাদের টিম আপনার অর্ডার নিশ্চিত করেছে' },
     { key: 'processing', icon: 'fa-box-open',           label: 'প্রস্তুত হচ্ছে',    desc: 'পণ্য প্যাক করা হচ্ছে' },
     { key: 'shipped',    icon: 'fa-truck-fast',         label: 'পাঠানো হয়েছে',     desc: 'পণ্যটি কুরিয়ারে দেওয়া হয়েছে' },
     { key: 'delivered',  icon: 'fa-house-circle-check', label: 'ডেলিভারি সম্পন্ন', desc: 'পণ্য সফলভাবে পৌঁছে গেছে' },
   ];
   
   function getStatusIndex(status) {
     return ORDER_STATUS_STEPS.findIndex(s => s.key === status);
   }
   
   function openTrackingModal(prefillOrderNumber = '') {
     const input  = document.getElementById('trackOrderInput');
     const result = document.getElementById('trackResult');
     if (input)  { input.value = prefillOrderNumber || ''; _toggleClearBtn(); }
     if (result) { result.innerHTML = ''; }
     openModal('trackingModal');
     if (prefillOrderNumber) {
       setTimeout(trackOrder, 350);
     } else {
       setTimeout(() => input?.focus(), 350);
     }
   }
   
   function clearTracking() {
     const input  = document.getElementById('trackOrderInput');
     const result = document.getElementById('trackResult');
     if (input)  { input.value = ''; input.focus(); }
     if (result) { result.innerHTML = ''; }
     _toggleClearBtn();
   }
   
   function _toggleClearBtn() {
     const input = document.getElementById('trackOrderInput');
     const btn   = document.getElementById('trackClearBtn');
     if (btn) btn.style.display = input?.value.trim() ? 'flex' : 'none';
   }
   
   async function trackOrder() {
    const input    = document.getElementById('trackOrderInput');
    const orderNum = (input?.value || '').trim().toUpperCase();
    const resultEl = document.getElementById('trackResult');
    const btn      = document.getElementById('trackBtn');
  
    if (!orderNum) {
      _showTrackError(resultEl, 'অর্ডার নম্বর দিন', 'অনুগ্রহ করে আপনার অর্ডার নম্বরটি উপরের বক্সে টাইপ করুন।');
      return;
    }
  
    // Loading state
    if (btn) {
      btn.querySelector('.track-btn-text').style.display = 'none';
      btn.querySelector('.track-btn-loading').style.display = 'inline-flex';
      btn.disabled = true;
    }
  
    resultEl.innerHTML = `
      <div class="track-skeleton">
        <div class="ts-header"></div>
        <div class="ts-bar"></div>
        <div class="ts-steps">${[1,2,3,4,5].map(() => `<div class="ts-step"></div>`).join('')}</div>
        <div class="ts-info"></div>
      </div>`;
  
    try {
      // ✅ FIXED: Changed from /order/track/ to /orders/track/
      const res = await apiCall(`/orders/track/${encodeURIComponent(orderNum)}`);
  
      if (!res.success || !res.data) {
        _showTrackError(resultEl, 'অর্ডার পাওয়া যায়নি',
          `"${orderNum}" নম্বরে কোনো অর্ডার পাওয়া যায়নি। নম্বরটি সঠিকভাবে লিখুন।`);
        return;
      }
  
      _renderTrackingResult(resultEl, res.data);
  
    } catch (err) {
      _showTrackError(resultEl, 'সংযোগ সমস্যা', 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      console.error('Tracking error:', err);
    } finally {
      if (btn) {
        btn.querySelector('.track-btn-text').style.display = 'inline-flex';
        btn.querySelector('.track-btn-loading').style.display = 'none';
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
     const isCancelled = order.orderStatus === 'cancelled';
     const currentIdx  = isCancelled ? -1 : getStatusIndex(order.orderStatus);
   
     const displayDate = d => {
       if (!d) return '—';
       return new Date(d).toLocaleString('en-BD', {
         day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
       });
     };
   
     const payMethodLabel = {
       cash_on_delivery: 'ক্যাশ অন ডেলিভারি',
       bkash: 'bKash', nagad: 'Nagad', card: 'কার্ড পেমেন্ট'
     };
   
     const statusColorMap = {
       pending:    { bg: '#FEF3CD', color: '#B7770D', border: '#F5C518' },
       confirmed:  { bg: '#E8F5EE', color: '#1E8A4A', border: '#2ECC71' },
       processing: { bg: '#EEF2FF', color: '#4338CA', border: '#6366F1' },
       shipped:    { bg: '#E0F2FE', color: '#0369A1', border: '#0EA5E9' },
       delivered:  { bg: '#ECFDF5', color: '#059669', border: '#10B981' },
       cancelled:  { bg: '#FDEDEC', color: '#C0392B', border: '#E74C3C' },
     };
     const sc = statusColorMap[order.orderStatus] || statusColorMap.pending;
   
     const statusBn = {
       cancelled: 'বাতিল', delivered: 'ডেলিভারি সম্পন্ন', shipped: 'পাঠানো হয়েছে',
       processing: 'প্রস্তুত হচ্ছে', confirmed: 'কনফার্মড', pending: 'অপেক্ষায়'
     };
   
     const stepsHTML = ORDER_STATUS_STEPS.map((step, i) => {
       let state = 'future';
       if (!isCancelled) {
         if (i < currentIdx) state = 'done';
         else if (i === currentIdx) state = 'active';
       }
       return `
         <div class="tl-step tl-${state}" style="--step-delay:${i * 0.08}s">
           <div class="tl-dot-wrap">
             <div class="tl-dot">
               <i class="fas ${step.icon}"></i>
               ${state === 'active' ? '<span class="tl-pulse"></span>' : ''}
             </div>
             ${i < ORDER_STATUS_STEPS.length - 1 ? `<div class="tl-connector"></div>` : ''}
           </div>
           <div class="tl-label">
             <div class="tl-step-name">${step.label}</div>
             <div class="tl-step-desc">${step.desc}</div>
           </div>
         </div>`;
     }).join('');
   
     const cancelledHTML = isCancelled ? `
       <div class="track-cancelled-banner">
         <i class="fas fa-ban"></i>
         <div>
           <strong>এই অর্ডারটি বাতিল করা হয়েছে।</strong>
           <span>যেকোনো সহায়তার জন্য আমাদের সাথে যোগাযোগ করুন।</span>
         </div>
       </div>` : '';
   
     const itemsHTML = (order.items || []).map(item => `
       <div class="track-item">
         <div class="track-item-name">${escHtml(item.name || 'পণ্য')}</div>
         <div class="track-item-meta">x${item.quantity} × ৳${(item.price || 0).toLocaleString()}</div>
         <div class="track-item-total">৳${(item.total || (item.price * item.quantity) || 0).toLocaleString()}</div>
       </div>`).join('');
   
     el.innerHTML = `
       <div class="track-result" style="animation:trackResultIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;">
   
         <div class="track-status-header" style="background:${sc.bg};border-color:${sc.border};">
           <div class="track-status-left">
             <div class="track-order-num">${escHtml(order.orderNumber || '—')}</div>
             <div class="track-order-date">অর্ডারের তারিখ: ${displayDate(order.createdAt)}</div>
           </div>
           <div class="track-status-badge" style="background:${sc.color};color:#fff;">
             ${statusBn[order.orderStatus] || 'অপেক্ষায়'}
           </div>
         </div>
   
         ${cancelledHTML}
   
         <div class="track-section">
           <div class="track-section-title"><i class="fas fa-route"></i> অর্ডারের অগ্রগতি</div>
           <div class="track-timeline ${isCancelled ? 'tl-cancelled' : ''}">${stepsHTML}</div>
         </div>
   
         <div class="track-info-grid">
           <div class="track-info-card">
             <div class="track-card-title"><i class="fas fa-user"></i> গ্রাহক তথ্য</div>
             <div class="track-info-row"><span class="ti-label">নাম</span><span class="ti-val">${escHtml(order.customer?.name || '—')}</span></div>
             <div class="track-info-row"><span class="ti-label">মোবাইল</span><span class="ti-val">${escHtml(order.customer?.phone || '—')}</span></div>
             <div class="track-info-row">
               <span class="ti-label">ঠিকানা</span>
               <span class="ti-val">${escHtml([order.customer?.address?.street, order.customer?.address?.city].filter(Boolean).join(', ') || '—')}</span>
             </div>
             ${order.trackingNumber ? `
             <div class="track-info-row highlight-row">
               <span class="ti-label"><i class="fas fa-barcode"></i> ট্র্যাকিং ID</span>
               <span class="ti-val ti-mono">${escHtml(order.trackingNumber)}</span>
             </div>` : ''}
             ${order.deliveryPartner ? `
             <div class="track-info-row"><span class="ti-label">কুরিয়ার</span><span class="ti-val">${escHtml(order.deliveryPartner)}</span></div>` : ''}
           </div>
   
           <div class="track-info-card">
             <div class="track-card-title"><i class="fas fa-wallet"></i> পেমেন্ট তথ্য</div>
             <div class="track-info-row"><span class="ti-label">পেমেন্ট পদ্ধতি</span><span class="ti-val">${payMethodLabel[order.paymentMethod] || escHtml(order.paymentMethod || '—')}</span></div>
             <div class="track-info-row">
               <span class="ti-label">পেমেন্ট স্ট্যাটাস</span>
               <span class="ti-val">
                 ${order.paymentStatus === 'paid'
                   ? '<span class="pay-badge pay-paid"><i class="fas fa-check"></i> পরিশোধিত</span>'
                   : '<span class="pay-badge pay-pending"><i class="fas fa-clock"></i> বাকি</span>'}
               </span>
             </div>
             <div class="track-info-row"><span class="ti-label">পণ্যের মূল্য</span><span class="ti-val">৳${(order.subtotal || 0).toLocaleString()}</span></div>
             <div class="track-info-row"><span class="ti-label">ডেলিভারি চার্জ</span><span class="ti-val">৳${(order.deliveryCharge || 0).toLocaleString()}</span></div>
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
     const canvas = document.createElement('canvas');
     const ctx    = canvas.getContext('2d');
     canvas.width  = 800;
     canvas.height = 1000;
   
     ctx.fillStyle = '#ffffff';
     ctx.fillRect(0, 0, canvas.width, canvas.height);
   
     const colors = { primary: '#0D1B3E', secondary: '#1A2E5A', accent: '#F5A623', text: '#333333', muted: '#666666', border: '#e0e0e0' };
   
     function wrapText(text, x, y, maxWidth, lineHeight) {
       const words = text.split(' ');
       let line = '', lineY = y;
       for (let n = 0; n < words.length; n++) {
         const testLine = line + words[n] + ' ';
         if (ctx.measureText(testLine).width > maxWidth && n > 0) {
           ctx.fillText(line, x, lineY); line = words[n] + ' '; lineY += lineHeight;
         } else { line = testLine; }
       }
       ctx.fillText(line, x, lineY);
       return lineY + lineHeight;
     }
   
     ctx.fillStyle = colors.primary;
     ctx.fillRect(0, 0, canvas.width, 120);
     ctx.fillStyle = '#ffffff';
     ctx.font = 'bold 28px sans-serif';
     ctx.fillText('BeeHarvest', 50, 55);
     ctx.font = '14px sans-serif';
     ctx.fillText('Bangladesh Trusted Online Shop', 50, 85);
   
     let yPos = 160;
     ctx.fillStyle = colors.accent;
     ctx.font = 'bold 22px sans-serif';
     ctx.fillText(`Order: ${orderData.orderNumber}`, 50, yPos);
     yPos += 40;
   
     ctx.fillStyle = colors.muted;
     ctx.font = '14px sans-serif';
     ctx.fillText(`Date: ${new Date().toLocaleDateString('en-BD', { year:'numeric', month:'long', day:'numeric' })}`, 50, yPos);
     yPos += 30;
   
     ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
     ctx.beginPath(); ctx.moveTo(50, yPos); ctx.lineTo(750, yPos); ctx.stroke();
     yPos += 30;
   
     ctx.fillStyle = colors.primary; ctx.font = 'bold 18px sans-serif';
     ctx.fillText('Customer Info', 50, yPos); yPos += 30;
     ctx.fillStyle = colors.text; ctx.font = '15px sans-serif';
     ctx.fillText(`Name: ${orderData.customer.name}`, 50, yPos); yPos += 25;
     ctx.fillText(`Phone: ${orderData.customer.phone}`, 50, yPos); yPos += 25;
     ctx.fillText(`Email: ${orderData.customer.email}`, 50, yPos); yPos += 25;
     yPos = wrapText(`Address: ${orderData.customer.address.street}, ${orderData.customer.address.city}`, 50, yPos, 700, 22);
     yPos += 10;
   
     ctx.strokeStyle = colors.border;
     ctx.beginPath(); ctx.moveTo(50, yPos); ctx.lineTo(750, yPos); ctx.stroke();
     yPos += 30;
   
     ctx.fillStyle = colors.primary; ctx.font = 'bold 18px sans-serif';
     ctx.fillText('Order Items', 50, yPos); yPos += 30;
   
     ctx.fillStyle = colors.secondary;
     ctx.fillRect(50, yPos, 700, 38);
     ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
     ctx.fillText('Product', 70, yPos + 24);
     ctx.fillText('Qty', 460, yPos + 24);
     ctx.fillText('Price', 540, yPos + 24);
     ctx.fillText('Total', 650, yPos + 24);
     yPos += 48;
   
     ctx.font = '14px sans-serif';
     (orderData.items || []).forEach((item, i) => {
       if (yPos > 780) return;
       if (i % 2 === 0) { ctx.fillStyle = '#f9f9f9'; ctx.fillRect(50, yPos - 8, 700, 36); }
       ctx.fillStyle = colors.text;
       let name = item.name || 'Product';
       if (name.length > 42) name = name.substring(0, 39) + '...';
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
   
     ctx.fillStyle = colors.text; ctx.font = '15px sans-serif';
     ctx.fillText('Subtotal:', 100, yPos); ctx.fillText(`${(orderData.subtotal || 0).toLocaleString()} BDT`, 640, yPos); yPos += 25;
     ctx.fillText('Delivery:', 100, yPos); ctx.fillText(`${(orderData.shipping || 0).toLocaleString()} BDT`, 640, yPos); yPos += 25;
     ctx.fillStyle = colors.primary; ctx.font = 'bold 17px sans-serif';
     ctx.fillText('Total:', 100, yPos); ctx.fillText(`${(orderData.total || 0).toLocaleString()} BDT`, 640, yPos); yPos += 40;
   
     ctx.fillStyle = colors.muted; ctx.font = '14px sans-serif';
     ctx.textAlign = 'center';
     ctx.fillText('Thank you for shopping with BeeHarvest!', canvas.width / 2, yPos + 30);
     ctx.fillText('Support: 01700-000000', canvas.width / 2, yPos + 55);
   
     canvas.toBlob(blob => {
       const url = URL.createObjectURL(blob);
       const a   = document.createElement('a');
       a.href = url; a.download = `beeharvest_order_${orderData.orderNumber}.png`;
       document.body.appendChild(a); a.click(); document.body.removeChild(a);
       URL.revokeObjectURL(url);
       showToast('অর্ডার স্লিপ ডাউনলোড হয়েছে!', 'success');
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
         <div class="policy-section"><h4><i class="fas fa-triangle-exclamation"></i> গুরুত্বপূর্ণ তথ্য</h4><p>ডেলিভারির সময় পণ্য গ্রহণ করে বাক্স খুলে যাচাই করুন।</p></div>`
     },
     return: {
       title: '<i class="fas fa-rotate-left"></i> রিটার্ন ও রিফান্ড পলিসি',
       body: `
         <div class="policy-section"><div class="policy-highlight">পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করা যাবে।</div></div>
         <div class="policy-section"><h4><i class="fas fa-money-bill-wave"></i> রিফান্ড প্রক্রিয়া</h4><p>রিটার্ন অনুমোদনের পর ৩–৫ কার্যদিবসের মধ্যে রিফান্ড প্রদান করা হবে।</p></div>`
     },
     privacy: {
       title: '<i class="fas fa-lock"></i> গোপনীয়তা নীতি',
       body: `
         <div class="policy-section"><div class="policy-highlight">আপনার ব্যক্তিগত তথ্য সুরক্ষিত রাখা আমাদের সর্বোচ্চ অগ্রাধিকার।</div></div>
         <div class="policy-section"><h4><i class="fas fa-database"></i> আমরা কী তথ্য সংগ্রহ করি</h4><p>নাম, ঠিকানা, মোবাইল নম্বর, ইমেইল এবং অর্ডার সংক্রান্ত তথ্য।</p></div>`
     },
     terms: {
       title: '<i class="fas fa-scroll"></i> শর্তাবলী',
       body: `
         <div class="policy-section"><div class="policy-highlight">BeeHarvest ব্যবহার করে আপনি নিচের শর্তসমূহ মেনে নিচ্ছেন।</div></div>
         <div class="policy-section"><h4><i class="fas fa-gavel"></i> আইনি এখতিয়ার</h4><p>যেকোনো বিরোধ বাংলাদেশের আইন অনুযায়ী নিষ্পত্তি করা হবে।</p></div>`
     },
     payment: {
       title: '<i class="fas fa-credit-card"></i> পেমেন্ট নীতি',
       body: `
         <div class="policy-section"><div class="policy-highlight">আমরা ক্যাশ অন ডেলিভারি, bKash এবং Nagad গ্রহণ করি।</div></div>
         <div class="policy-section"><h4><i class="fas fa-triangle-exclamation"></i> পেমেন্ট নিরাপত্তা</h4><p>আমাদের কোনো প্রতিনিধি কখনো OTP বা পিন চাইবে না।</p></div>`
     },
     faq: {
       title: '<i class="fas fa-circle-question"></i> সাধারণ প্রশ্নোত্তর (FAQ)',
       body: `
         <div class="policy-section"><h4><i class="fas fa-clock"></i> অর্ডার কতদিনে পাব?</h4><p>ঢাকার মধ্যে ১–২ দিন এবং ঢাকার বাইরে ৩–৫ কার্যদিবস।</p></div>
         <div class="policy-section"><h4><i class="fas fa-rotate-left"></i> কীভাবে রিটার্ন করব?</h4><p>পণ্য পাওয়ার ৭ দিনের মধ্যে আমাদের হটলাইনে কল করুন।</p></div>
         <div class="policy-section"><h4><i class="fas fa-gift"></i> অর্ডার বাতিল করা যাবে?</h4><p>অর্ডার শিপ হওয়ার আগে বাতিল করা যাবে।</p></div>`
     }
   };
   
   function showPolicy(key) {
     const policy = POLICIES[key];
     if (!policy) return;
     document.getElementById('policyModalTitle').innerHTML = policy.title;
     document.getElementById('policyModalBody').innerHTML  = policy.body;
     openModal('policyModal');
   }
   
   /* ════════════════════════════════════════════════════════════
      EVENT LISTENERS  (single DOMContentLoaded)
   ════════════════════════════════════════════════════════════ */
   document.addEventListener('DOMContentLoaded', () => {
   
     /* Shimmer keyframe */
     const style = document.createElement('style');
     style.textContent = `
       @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
       @keyframes trackResultIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
     `;
     document.head.appendChild(style);
   
     /* Desktop cart */
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
   
     /* Checkout */
     document.getElementById('checkoutBtn')?.addEventListener('click', () => {
       document.getElementById('cartSidebar').classList.remove('open');
       document.getElementById('cartBackdrop').classList.remove('show');
       openCheckout();
     });
     document.getElementById('checkoutForm')?.addEventListener('submit', placeOrder);
     document.getElementById('confirmOrderBtn')?.addEventListener('click', placeOrder);
   
     /* Mobile nav */
     document.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
       item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.page); });
     });
     document.getElementById('mobileCartBtn')?.addEventListener('click', e => { e.preventDefault(); openMobileCart(); });
     document.getElementById('closeMobileCart')?.addEventListener('click', closeMobileCart);
     document.getElementById('mobileCheckoutBtn')?.addEventListener('click', () => { closeMobileCart(); openCheckout(); });
   
     /* Desktop nav */
     document.querySelectorAll('.nav-link[data-page]').forEach(link => {
       link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
     });
   
     /* Filters */
     document.getElementById('searchProducts')?.addEventListener('input', debounce(() => loadProducts(1), 400));
     document.getElementById('categoryFilter')?.addEventListener('change', () => loadProducts(1));
     document.getElementById('sortBy')?.addEventListener('change', () => loadProducts(1));
     document.getElementById('priceFilter')?.addEventListener('change', () => loadProducts(1));
   
     /* ★ Tracking modal input listener */
     document.getElementById('trackOrderInput')?.addEventListener('input', _toggleClearBtn);
   
     /* Close modal on backdrop */
     document.querySelectorAll('.modal').forEach(m => {
       m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
     });
   
     /* Escape key */
     document.addEventListener('keydown', e => {
       if (e.key === 'Escape') {
         document.querySelectorAll('.modal.active').forEach(m => closeModal(m.id));
         document.getElementById('cartSidebar')?.classList.remove('open');
         document.getElementById('cartBackdrop')?.classList.remove('show');
         closeMobileCart();
       }
     });
   
     /* Resize confetti */
     window.addEventListener('resize', () => {
       const c = document.getElementById('confettiCanvas');
       if (c?.classList.contains('active')) { c.width = window.innerWidth; c.height = window.innerHeight; }
     });
   
     /* Init */
     updateCartUI();
     navigateTo('home');
   });
   
   /* ════════════════════════════════════════════════════════════
      GLOBAL EXPORTS
   ════════════════════════════════════════════════════════════ */
   window.navigateTo         = navigateTo;
   window.viewProduct        = viewProduct;
   window.addToCart          = addToCart;
   window.updateQuantity     = updateQuantity;
   window.removeFromCart     = removeFromCart;
   window.openCheckout       = openCheckout;
   window.placeOrder         = placeOrder;
   window.closeModal         = closeModal;
   window.loadProducts       = loadProducts;
   window.filterByCategory   = filterByCategory;
   window.showPolicy         = showPolicy;
   window.openTrackingModal  = openTrackingModal;
   window.trackOrder         = trackOrder;
   window.clearTracking      = clearTracking;
   window.quickTrackFromOrders = quickTrackFromOrders;
