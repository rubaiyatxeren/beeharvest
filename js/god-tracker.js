/* ═══════════════════════════════════════════════════════
   BeeHarvest God Tracker — passive behavioral tracker
   Usage: <script src="js/god-tracker.js"></script>
   Place just before </body> in index.html and product-detail.html
═══════════════════════════════════════════════════════ */
(function () {
    "use strict";
  
    const API_URL   = "https://beeyond-harvest-admin.onrender.com/api";
    const BATCH_MS  = 5000;   // flush queue every 5 seconds
    const MAX_BATCH = 30;     // max events per batch
  
    // ── Identity ───────────────────────────────────────────
    function genId(prefix) {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  
    const sessionId = sessionStorage.getItem("_bt_sid") || genId("s");
    sessionStorage.setItem("_bt_sid", sessionId);
  
    const visitorId = localStorage.getItem("_bt_vid") || genId("v");
    localStorage.setItem("_bt_vid", visitorId);
  
    // ── Device fingerprint (collected once) ───────────────
    const conn  = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    const device = {
      userAgent:      navigator.userAgent,
      language:       navigator.language,
      platform:       navigator.platform,
      screenWidth:    screen.width,
      screenHeight:   screen.height,
      timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer:       document.referrer,
      connectionType: conn.effectiveType || conn.type || "unknown",
    };
  
    // ── Event queue ────────────────────────────────────────
    let queue = [];
  
    function track(type, payload = {}) {
      queue.push({ type, ts: new Date().toISOString(), payload });
      if (queue.length >= MAX_BATCH) flush();
    }
  
    async function flush() {
      if (!queue.length) return;
      const batch = queue.splice(0, MAX_BATCH);
      try {
        await fetch(`${API_URL}/track/events`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sessionId, visitorId, device, events: batch }),
          keepalive: true,  // survives page unload
        });
      } catch (e) {
        // Silently fail — never break user experience
        console.debug("[tracker] flush failed", e.message);
      }
    }
  
    setInterval(flush, BATCH_MS);
    window.addEventListener("pagehide",  flush, { passive: true });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  
    // ══════════════════════════════════════════════════════
    // AUTO-TRACKED EVENTS
    // ══════════════════════════════════════════════════════
  
    // 1. Page view
    track("page_view", {
      path:  location.pathname,
      page:  document.title,
      search: location.search,
    });
  
    // 2. Scroll depth (25 / 50 / 75 / 100 milestones)
    const scrollMilestones = new Set();
    window.addEventListener("scroll", () => {
      const pct = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );
      [25, 50, 75, 100].forEach((m) => {
        if (pct >= m && !scrollMilestones.has(m)) {
          scrollMilestones.add(m);
          track("scroll_depth", { milestone: m, path: location.pathname });
        }
      });
    }, { passive: true });
  
    // 3. Rage-click detection (3+ clicks within 600ms in same 60px zone)
    let clicks = [];
    document.addEventListener("click", (e) => {
      const now = Date.now();
      clicks.push({ t: now, x: e.clientX, y: e.clientY });
      clicks = clicks.filter((c) => now - c.t < 600);
      if (clicks.length >= 3) {
        const near = clicks.filter(
          (c) => Math.abs(c.x - e.clientX) < 60 && Math.abs(c.y - e.clientY) < 60
        );
        if (near.length >= 3) {
          track("rage_click", {
            x: Math.round(e.clientX),
            y: Math.round(e.clientY),
            target: e.target?.tagName,
            path: location.pathname,
          });
          clicks = [];
        }
      }
    }, { passive: true });
  
    // 4. Idle detection (60s without interaction)
    let idleTimer;
    function resetIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => track("idle", { path: location.pathname }), 60000);
    }
    ["mousemove", "keydown", "scroll", "touchstart"].forEach((ev) =>
      window.addEventListener(ev, resetIdle, { passive: true })
    );
    resetIdle();
  
    // 5. Nav clicks (SPA page changes)
    document.addEventListener("click", (e) => {
      const link = e.target.closest("[data-page]");
      if (link) track("nav_click", { page: link.dataset.page });
    }, { passive: true });
  
    // ══════════════════════════════════════════════════════
    // EXPOSED API — call from customer.js / details.js
    // ══════════════════════════════════════════════════════
    window.GodTracker = {
  
      // Product events
      productView: (id, name, price, category) =>
        track("product_view", { id, name, price, category }),
  
      productDetailView: (id, name, price, stock) =>
        track("product_detail_view", { id, name, price, stock }),
  
      addToCart: (id, name, price, qty) =>
        track("add_to_cart", { id, name, price, qty }),
  
      removeFromCart: (id, name) =>
        track("remove_from_cart", { id, name }),
  
      // Cart UI
      cartOpen: () => track("cart_open"),
      checkoutOpen: (itemCount, subtotal) =>
        track("cart_checkout_open", { itemCount, subtotal }),
  
      // Search & filters
      search: (query, resultCount) =>
        track("search", { query, resultCount }),
  
      categoryFilter: (categoryId, categoryName) =>
        track("category_filter", { categoryId, categoryName }),
  
      sortChange: (sortValue) =>
        track("sort_change", { sortValue }),
  
      // Coupon
      couponAttempt: (code) =>
        track("coupon_apply_attempt", { code }),
  
      couponSuccess: (code, discount) =>
        track("coupon_apply_success", { code, discount }),
  
      couponFail: (code, reason) =>
        track("coupon_apply_fail", { code, reason }),
  
      // Order lifecycle
      orderAttempt: (subtotal, itemCount, city, payMethod) =>
        track("order_attempt", { subtotal, itemCount, city, payMethod }),
  
      orderSuccess: (orderNumber, total, payMethod) => {
        track("order_success", { orderNumber, total, payMethod });
        // Link this session to the order (fire-and-forget)
        setTimeout(() => {
          fetch(`${API_URL}/track/sessions/${sessionId}/link`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ orderNumber }),
          }).catch(() => {});
        }, 1000);
      },
  
      orderFail: (reason) =>
        track("order_fail", { reason }),
  
      orderFraudHeld: (orderNumber) =>
        track("order_fraud_held", { orderNumber }),
  
      // Tracking
      trackOrder: (orderNumber) =>
        track("track_order", { orderNumber }),
  
      mobileOrderSearch: (phone) =>
        track("mobile_order_search", { phone: phone.slice(0, 5) + "XXXXX" }), // partial mask
  
      // Chatbot
      chatbotOpen: () => track("chatbot_open"),
      chatbotMessage: (intent) => track("chatbot_message", { intent }),
  
      // Modals & policies
      policyView: (policy) => track("policy_view", { policy }),
      modalOpen:  (modalId) => track("modal_open",  { modalId }),
      modalClose: (modalId) => track("modal_close", { modalId }),
  
      // Manual flush
      flush,
  
      // Expose sessionId so admin panel can show it in order details
      sessionId,
    };
  
    console.debug("[GodTracker] session:", sessionId);
  })();
