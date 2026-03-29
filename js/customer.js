/* ═══════════════════════════════════════════════════════════
   BeeHarvest — customer.js (OPTIMIZED)
   Fixed: Loading speed, timeouts, error handling
   ═══════════════════════════════════════════════════════════ */

   const API_URL = 'https://beeyond-harvest-admin.onrender.com/api';
   const API_TIMEOUT = 10000; // 10 seconds timeout
   
   let cart = [];
   let currentProductsPage = 1;
   let totalProductsPages = 1;
   let isLoading = false;
   
   /* ─── Init cart from localStorage ─────────────────────── */
   try {
     const saved = localStorage.getItem('cart');
     if (saved) cart = JSON.parse(saved);
   } catch(e) { cart = []; }
   
   /* ════════════════════════════════════════════════════════════
      API HELPER with timeout
      ════════════════════════════════════════════════════════════ */
   async function apiCall(endpoint, options = {}) {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
     
     try {
       const res = await fetch(`${API_URL}${endpoint}`, {
         headers: { 'Content-Type': 'application/json' },
         signal: controller.signal,
         ...options,
       });
       clearTimeout(timeoutId);
       
       const ct = res.headers.get('content-type') || '';
       if (!ct.includes('application/json')) {
         throw new Error(`সার্ভার থেকে অপ্রত্যাশিত রেসপন্স (HTTP ${res.status})`);
       }
       const data = await res.json();
       if (!res.ok) throw new Error(data.message || 'সার্ভার ত্রুটি');
       return data;
     } catch (err) {
       clearTimeout(timeoutId);
       if (err.name === 'AbortError') {
         throw new Error('সার্ভার সাড়া দিচ্ছে না। নেটওয়ার্ক চেক করুন।');
       }
       throw err;
     }
   }
   
   /* ════════════════════════════════════════════════════════════
      CATEGORIES - Load only when needed
      ════════════════════════════════════════════════════════════ */
   async function loadCategories() {
     try {
       const res = await apiCall('/categories?limit=100');
       if (!res.success || !res.data) return;
       const cats = res.data;
   
       // Grid on home
       const grid = document.getElementById('categoriesList');
       if (grid && cats.length > 0) {
         grid.innerHTML = cats.slice(0, 8).map(c => `
           <div class="category-card" onclick="filterByCategory('${c._id}')">
             <div class="cat-icon"><i class="fas fa-tag"></i></div>
             <h3>${escHtml(c.name)}</h3>
           </div>`).join('');
       }
   
       // Filter dropdown
       const sel = document.getElementById('categoryFilter');
       if (sel && cats.length > 0) {
         sel.innerHTML = '<option value="">সব ক্যাটাগরি</option>' +
           cats.map(c => `<option value="${c._id}">${escHtml(c.name)}</option>`).join('');
       }
     } catch(e) {
       console.error('Categories:', e);
       // Don't show error to user - categories are optional
     }
   }
   
   /* ════════════════════════════════════════════════════════════
      PRODUCTS - Optimized loading
      ════════════════════════════════════════════════════════════ */
   async function loadFeaturedProducts() {
     const grid = document.getElementById('featuredProducts');
     if (!grid) return;
     
     grid.innerHTML = skeletonCards(4);
     
     try {
       const res = await fetch(`${API_URL}/products?isFeatured=true&limit=8`);
       if (!res.ok) throw new Error('Network error');
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
     if (isLoading) return;
     isLoading = true;
     
     const grid = document.getElementById('allProducts');
     if (!grid) {
       isLoading = false;
       return;
     }
     
     grid.innerHTML = skeletonCards(6);
   
     try {
       const search = document.getElementById('searchProducts')?.value.trim() || '';
       const category = document.getElementById('categoryFilter')?.value || '';
       const sort = document.getElementById('sortBy')?.value || '-createdAt';
       const priceRange = document.getElementById('priceFilter')?.value || '';
   
       const params = new URLSearchParams({ page, limit: 12 });
       if (search) params.set('search', search);
       if (category) params.set('category', category);
       if (sort) params.set('sort', sort);
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
     } finally {
       isLoading = false;
     }
   }
   
   /* ─── Render Product Card ────────────────────────────── */
   function renderProductCard(p) {
     if (!p?._id) return '';
   
     const id = String(p._id);
     const safeName = escHtml(p.name || '');
     const price = p.discountPrice || p.price;
     const imgUrl = p.images?.[0]?.url || 'https://via.placeholder.com/400x300?text=No+Image';
     const discount = p.discountPrice ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;
   
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
         </div>
         <div class="product-info">
           <div class="product-name">${safeName}</div>
           <div class="product-price-row">
             <span class="price-final">৳${price.toLocaleString('bn-BD')}</span>
             ${p.discountPrice ? `<span class="price-original">৳${p.price.toLocaleString('bn-BD')}</span>` : ''}
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
      CART - Optimized
      ════════════════════════════════════════════════════════════ */
   function addToCart(productId, price, imageUrl) {
     const pData = window[`__p_${productId}`];
     const name = pData?.name || 'পণ্য';
   
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
     const mc = document.getElementById('mobileCartCount');
     if (mc) mc.textContent = count;
   
     // Desktop cart items
     const ci = document.getElementById('cartItems');
     if (ci) {
       ci.innerHTML = cart.length === 0
         ? `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>আপনার কার্ট এখন খালি</p></div>`
         : cart.map(renderCartItem).join('');
     }
   
     // Desktop totals
     setText('cartSubtotal', `৳${subtotal.toLocaleString('bn-BD')}`);
     setText('cartShipping', `৳${shipping.toLocaleString('bn-BD')}`);
     setText('cartTotal', `৳${total.toLocaleString('bn-BD')}`);
   
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
      CHECKOUT - Optimized
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
     setText('summaryTotal', `৳${total.toLocaleString()}`);
   
     openModal('checkoutModal');
   }
   
   async function placeOrder(e) {
     if (e) e.preventDefault();
   
     if (cart.length === 0) {
       showToast('কার্ট খালি!', 'error');
       return;
     }
   
     // Get values
     const fullName = val('checkoutName');
     const email = val('checkoutEmail');
     const phone = val('checkoutPhone');
     const address = val('checkoutAddress');
     const city = val('checkoutCity');
     const zipCode = val('checkoutZipCode');
     const notes = val('checkoutNotes');
     const payMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';
     const accepted = document.getElementById('acceptTerms')?.checked;
   
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
       items: cart.map(i => ({ product: i.productId, quantity: i.quantity })),
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
       cart = [];
       saveCart();
       updateCartUI();
       closeModal('checkoutModal');
       hideLoadingOverlay();
   
       const orderNum = data.data?.orderNumber || data.data?._id?.slice(-8) || 'SUCCESS';
       setText('orderNumber', `#${orderNum}`);
   
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
      NAVIGATION - Optimized
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
   
     // Load data lazily
     switch (page) {
       case 'home':
         if (!window._homeLoaded) {
           loadFeaturedProducts();
           loadCategories();
           window._homeLoaded = true;
         }
         break;
       case 'products':
         if (!window._productsLoaded) {
           loadCategories();
           loadProducts(1);
           window._productsLoaded = true;
         }
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
       </div>`;
   }
   
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
     const end = Math.min(total, current + 2);
     if (start > 1) pages.push(`<button onclick="${fnName}(1)">1</button>`);
     if (start > 2) pages.push(`<button disabled>…</button>`);
   
     for (let i = start; i <= end; i++) {
       pages.push(`<button onclick="${fnName}(${i})" class="${i === current ? 'active' : ''}">${i}</button>`);
     }
   
     if (end < total - 1) pages.push(`<button disabled>…</button>`);
     if (end < total) pages.push(`<button onclick="${fnName}(${total})">${total}</button>`);
   
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
     // Remove existing toasts
     document.querySelectorAll(`.toast`).forEach(t => t.remove());
   
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
     canvas.width = window.innerWidth;
     canvas.height = window.innerHeight;
     const ctx = canvas.getContext('2d');
   
     const colors = ['#F5A623', '#FDD882', '#C47F11', '#0D1B3E', '#1A2E5A', '#28a745', '#ff6b6b'];
     const particles = Array.from({ length: 120 }, () => ({
       x: Math.random() * canvas.width,
       y: -20 - Math.random() * canvas.height,
       size: Math.random() * 8 + 3,
       color: colors[Math.floor(Math.random() * colors.length)],
       vy: Math.random() * 4 + 2,
       vx: (Math.random() - 0.5) * 2,
       rot: Math.random() * 360,
       rotV: (Math.random() - 0.5) * 6,
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
       .replace(/&/g, '&amp;').replace(/</g, '&lt;')
       .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      EVENT LISTENERS - Optimized
      ════════════════════════════════════════════════════════════ */
   document.addEventListener('DOMContentLoaded', () => {
     // Add shimmer animation style
     const style = document.createElement('style');
     style.textContent = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
     document.head.appendChild(style);
   
     // Desktop cart
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
   
     // Checkout
     document.getElementById('checkoutBtn')?.addEventListener('click', () => {
       document.getElementById('cartSidebar').classList.remove('open');
       document.getElementById('cartBackdrop').classList.remove('show');
       openCheckout();
     });
   
     const form = document.getElementById('checkoutForm');
     if (form) form.addEventListener('submit', placeOrder);
   
     document.getElementById('confirmOrderBtn')?.addEventListener('click', placeOrder);
   
     // Mobile nav
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
   
     // Desktop nav links
     document.querySelectorAll('.nav-link[data-page]').forEach(link => {
       link.addEventListener('click', e => {
         e.preventDefault();
         navigateTo(link.dataset.page);
       });
     });
   
     // Filters - debounced
     const debounce = (fn, delay) => {
       let timer;
       return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
     };
     
     document.getElementById('searchProducts')?.addEventListener('input',
       debounce(() => loadProducts(1), 500));
     document.getElementById('categoryFilter')?.addEventListener('change', () => loadProducts(1));
     document.getElementById('sortBy')?.addEventListener('change', () => loadProducts(1));
     document.getElementById('priceFilter')?.addEventListener('change', () => loadProducts(1));
   
     // Close modal on backdrop click
     document.querySelectorAll('.modal').forEach(m => {
       m.addEventListener('click', e => {
         if (e.target === m) closeModal(m.id);
       });
     });
   
     // Escape key
     document.addEventListener('keydown', e => {
       if (e.key === 'Escape') {
         document.querySelectorAll('.modal.active').forEach(m => closeModal(m.id));
         document.getElementById('cartSidebar')?.classList.remove('open');
         document.getElementById('cartBackdrop')?.classList.remove('show');
         closeMobileCart();
       }
     });
   
     // Resize confetti
     window.addEventListener('resize', () => {
       const c = document.getElementById('confettiCanvas');
       if (c?.classList.contains('active')) {
         c.width = window.innerWidth;
         c.height = window.innerHeight;
       }
     });
   
     // Init
     updateCartUI();
     navigateTo('home');
   });
   
   /* ── Global exports ─────────────────────────────────────── */
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
   window.openMobileCart = openMobileCart;
   window.closeMobileCart = closeMobileCart;
