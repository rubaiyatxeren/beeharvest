/* ═══════════════════════════════════════════════════════════
   BEEHARVEST — ReviewsSection Module
   Fetches approved reviews from API, renders premium slider
   ═══════════════════════════════════════════════════════════ */

   const ReviewsSection = (() => {
    "use strict";
  
    // ── Config ──────────────────────────────────────────────
    const API_URL = "https://beeyond-harvest-admin.onrender.com/api";
    const CARD_WIDTH = 320;   // px (synced with CSS)
    const GAP = 20;           // px gap between cards
    const SLIDE_COUNT = 3;    // cards per "page" on desktop
  
    // ── State ────────────────────────────────────────────────
    let allReviews = [];       // raw data from API
    let filtered = [];         // after filter
    let currentIndex = 0;
    let maxIndex = 0;
    let activeFilter = "all";
    let isAnimating = false;
    let touchStartX = 0;
    let touchDeltaX = 0;
    let votedCards = new Set(JSON.parse(localStorage.getItem("bh_rv_votes") || "[]"));
    let intersectionObserver = null;
  
    // ── DOM Refs (populated lazily) ─────────────────────────
    let $track, $viewport, $prevBtn, $nextBtn, $dots, $filterPills, $summaryBar;
  
    // ── Helpers ──────────────────────────────────────────────
    const escHtml = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
  
    const formatDate = (d) => {
      if (!d) return "";
      return new Date(d).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };
  
    const getInitials = (name = "") => {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase() || "?";
    };
  
    const stripeClass = (rating) => `stripe-${Math.round(rating)}`;
  
    const avatarClass = (name = "", index = 0) =>
      `av-${Math.abs(name.charCodeAt(0) + index) % 6}`;
  
    const buildStarHTML = (rating) => {
      let html = "";
      for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
          html += `<i class="fas fa-star"></i>`;
        } else if (i === Math.ceil(rating) && rating % 1 >= 0.5) {
          html += `<i class="fas fa-star-half-alt"></i>`;
        } else {
          html += `<i class="far fa-star"></i>`;
        }
      }
      return html;
    };
  
    // ── Summary bar calculation ──────────────────────────────
    const calcSummary = (reviews) => {
      if (!reviews.length) return { avg: 0, total: 0, dist: {} };
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sum = 0;
      reviews.forEach((r) => {
        const star = Math.round(r.rating);
        dist[star] = (dist[star] || 0) + 1;
        sum += r.rating;
      });
      return {
        avg: (sum / reviews.length).toFixed(1),
        total: reviews.length,
        dist,
      };
    };
  
    // ── Render Summary Bar ───────────────────────────────────
    const renderSummaryBar = (reviews) => {
      const el = document.getElementById("rv-summary-bar");
      if (!el) return;
      const { avg, total, dist } = calcSummary(reviews);
      const verifiedCount = reviews.filter((r) => r.isVerifiedPurchase).length;
  
      el.innerHTML = `
        <div class="rsb-score">
          <div class="rsb-score-num">${avg}</div>
          <div class="rsb-score-label">গড় রেটিং</div>
        </div>
        <div class="rsb-divider"></div>
        <div class="rsb-stars-col">
          ${[5, 4, 3, 2, 1]
            .map((star) => {
              const count = dist[star] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return `
            <div class="rsb-star-row">
              <span class="rsb-star-label">${star} <i class="fas fa-star"></i></span>
              <div class="rsb-bar-track">
                <div class="rsb-bar-fill" data-pct="${pct}" style="width:0%"></div>
              </div>
              <span class="rsb-bar-pct">${pct}%</span>
            </div>`;
            })
            .join("")}
        </div>
        <div class="rsb-divider"></div>
        <div class="rsb-meta-col">
          <div class="rsb-meta-item">
            <i class="fas fa-comments"></i>
            <span><span class="rsb-meta-num">${total}</span> রিভিউ</span>
          </div>
          <div class="rsb-meta-item">
            <i class="fas fa-shield-check"></i>
            <span><span class="rsb-meta-num">${verifiedCount}</span> যাচাইকৃত</span>
          </div>
          <div class="rsb-meta-item">
            <i class="fas fa-star"></i>
            <span>সামগ্রিক <span class="rsb-meta-num">${avg}★</span></span>
          </div>
        </div>`;
  
      // Animate bars after paint
      requestAnimationFrame(() => {
        setTimeout(() => {
          el.querySelectorAll(".rsb-bar-fill").forEach((bar) => {
            bar.style.width = bar.dataset.pct + "%";
          });
        }, 150);
      });
    };
  
    // ── Build a single review card ───────────────────────────
    const buildCard = (review, index) => {
      const isFeatured = review.rating === 5 && index === 0;
      const initials = getInitials(review.customerName);
      const avClass = avatarClass(review.customerName, index);
      const stars = buildStarHTML(review.rating);
      const hasVoted = votedCards.has(review._id);
  
      const cardClass = isFeatured
        ? "rv-card rv-card--featured"
        : "rv-card";
  
      const titleHtml = review.title
        ? `<div class="rv-card-title">${escHtml(review.title)}</div>`
        : "";
  
      const productName = review.product?.name || "পণ্য";
  
      return `
      <div class="${cardClass}" data-review-id="${review._id}" style="animation-delay:${index * 0.07}s">
        <div class="rv-card-stripe ${stripeClass(review.rating)}"></div>
        <div class="rv-card-body">
          <div class="rv-card-header">
            <div class="rv-card-avatar-wrap">
              <div class="rv-card-avatar ${avClass}">${escHtml(initials)}</div>
              <div class="rv-card-author-info">
                <div class="rv-card-author-name">${escHtml(review.customerName)}</div>
                <div class="rv-card-author-date">
                  <i class="fas fa-calendar-alt"></i>
                  ${formatDate(review.createdAt)}
                </div>
              </div>
            </div>
            <div class="rv-card-rating">
              <div class="rv-card-stars">${stars}</div>
              <div class="rv-card-rating-num">${review.rating.toFixed(1)}</div>
            </div>
          </div>
  
          <span class="rv-card-quote-icon">"</span>
          ${titleHtml}
          <div class="rv-card-body-text">${escHtml(review.body)}</div>
  
          <div class="rv-card-footer">
            <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
              ${review.isVerifiedPurchase
                ? `<span class="rv-verified-badge"><i class="fas fa-check-circle"></i> যাচাইকৃত</span>`
                : ""}
              <span class="rv-product-chip">
                <i class="fas fa-box"></i>
                ${escHtml(productName)}
              </span>
            </div>
            <button class="rv-helpful-btn ${hasVoted ? "voted" : ""}"
              onclick="ReviewsSection.vote('${review._id}', this)"
              title="সহায়ক ছিল">
              <i class="fas fa-thumbs-up"></i>
              <span>${(review.helpfulVotes || 0) + (hasVoted ? 1 : 0)}</span>
            </button>
          </div>
        </div>
      </div>`;
    };
  
    // ── Build skeleton cards for loading state ───────────────
    const buildSkeletons = (n = 3) =>
      Array.from({ length: n }, () => `
      <div class="rv-skeleton-card">
        <div class="rv-skeleton-stripe"></div>
        <div class="rv-skeleton-body">
          <div style="display:flex;gap:9px;margin-bottom:4px;">
            <div class="rv-skeleton-avatar"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;padding-top:4px;">
              <div class="rv-skeleton-line w-60"></div>
              <div class="rv-skeleton-line w-40"></div>
            </div>
          </div>
          <div class="rv-skeleton-line w-80" style="height:10px;margin-top:8px;"></div>
          <div class="rv-skeleton-line w-100"></div>
          <div class="rv-skeleton-line w-100"></div>
          <div class="rv-skeleton-line w-60"></div>
          <div class="rv-skeleton-line w-40" style="margin-top:4px;"></div>
        </div>
      </div>`).join("");
  
    // ── Render filtered reviews into the track ───────────────
    const renderTrack = () => {
      if (!$track) return;
      if (!filtered.length) {
        $track.innerHTML = `
          <div class="rv-empty-state" style="min-width:320px;">
            <span class="rv-empty-icon">💬</span>
            <h4>কোনো রিভিউ পাওয়া যায়নি</h4>
            <p>এই ফিল্টারে কোনো রিভিউ নেই। অন্য ফিল্টার চেষ্টা করুন।</p>
          </div>`;
        updateControls();
        return;
      }
  
      $track.innerHTML = filtered.map((r, i) => buildCard(r, i)).join("");
      currentIndex = 0;
      updatePosition(false);
      updateControls();
      renderDots();
    };
  
    // ── Slider position ──────────────────────────────────────
    const visibleCards = () => {
      if (!$viewport) return SLIDE_COUNT;
      const vw = $viewport.offsetWidth;
      if (vw < 360) return 1;
      if (vw < 600) return 1.2;
      if (vw < 900) return 2;
      return SLIDE_COUNT;
    };
  
    const getCardWidth = () => {
      const card = $track?.querySelector(".rv-card");
      if (!card) return CARD_WIDTH + GAP;
      return card.offsetWidth + GAP;
    };
  
    const updatePosition = (animate = true) => {
      if (!$track) return;
      const offset = currentIndex * getCardWidth();
      if (!animate) {
        $track.style.transition = "none";
        $track.style.transform = `translateX(-${offset}px)`;
        void $track.offsetHeight; // force reflow
        $track.style.transition = "";
      } else {
        $track.style.transform = `translateX(-${offset}px)`;
      }
    };
  
    const calcMaxIndex = () => {
      if (!filtered.length) return 0;
      const visible = Math.floor(visibleCards());
      return Math.max(0, filtered.length - visible);
    };
  
    const updateControls = () => {
      maxIndex = calcMaxIndex();
      if ($prevBtn) $prevBtn.disabled = currentIndex <= 0;
      if ($nextBtn) $nextBtn.disabled = currentIndex >= maxIndex;
    };
  
    // ── Dots ─────────────────────────────────────────────────
    const renderDots = () => {
      if (!$dots) return;
      const total = calcMaxIndex() + 1;
      if (total <= 1) { $dots.innerHTML = ""; return; }
      $dots.innerHTML = Array.from({ length: total }, (_, i) =>
        `<div class="rv-dot ${i === currentIndex ? "active" : ""}" onclick="ReviewsSection.goTo(${i})"></div>`
      ).join("");
    };
  
    const updateDots = () => {
      if (!$dots) return;
      $dots.querySelectorAll(".rv-dot").forEach((d, i) => {
        d.classList.toggle("active", i === currentIndex);
      });
    };
  
    // ── Navigation ───────────────────────────────────────────
    const prev = () => {
      if (isAnimating || currentIndex <= 0) return;
      isAnimating = true;
      currentIndex--;
      updatePosition();
      updateControls();
      updateDots();
      setTimeout(() => (isAnimating = false), 520);
    };
  
    const next = () => {
      if (isAnimating || currentIndex >= maxIndex) return;
      isAnimating = true;
      currentIndex++;
      updatePosition();
      updateControls();
      updateDots();
      setTimeout(() => (isAnimating = false), 520);
    };
  
    const goTo = (index) => {
      if (isAnimating) return;
      isAnimating = true;
      currentIndex = Math.max(0, Math.min(index, calcMaxIndex()));
      updatePosition();
      updateControls();
      updateDots();
      setTimeout(() => (isAnimating = false), 520);
    };
  
    // ── Filter pills ─────────────────────────────────────────
    const applyFilter = (filter) => {
      activeFilter = filter;
      document.querySelectorAll(".rv-filter-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.filter === filter);
      });
  
      if (filter === "all") {
        filtered = [...allReviews];
      } else if (filter === "verified") {
        filtered = allReviews.filter((r) => r.isVerifiedPurchase);
      } else {
        const star = parseInt(filter);
        filtered = allReviews.filter((r) => Math.round(r.rating) === star);
      }
  
      renderTrack();
    };
  
    // ── Vote (helpful) ───────────────────────────────────────
    const vote = (reviewId, btn) => {
      if (votedCards.has(reviewId)) return;
      votedCards.add(reviewId);
      localStorage.setItem("bh_rv_votes", JSON.stringify([...votedCards]));
  
      btn.classList.add("voted");
      const countEl = btn.querySelector("span");
      if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
  
      // Fire-and-forget to API
      fetch(`${API_URL}/reviews/${reviewId}/helpful`, { method: "POST" }).catch(() => {});
    };
  
    // ── Touch / swipe ────────────────────────────────────────
    const bindTouch = () => {
      if (!$viewport) return;
      $viewport.addEventListener(
        "touchstart",
        (e) => { touchStartX = e.touches[0].clientX; touchDeltaX = 0; },
        { passive: true }
      );
      $viewport.addEventListener(
        "touchmove",
        (e) => { touchDeltaX = e.touches[0].clientX - touchStartX; },
        { passive: true }
      );
      $viewport.addEventListener("touchend", () => {
        if (touchDeltaX < -50) next();
        else if (touchDeltaX > 50) prev();
        touchDeltaX = 0;
      });
    };
  
    // ── Keyboard nav (when section focused) ─────────────────
    const bindKeyboard = () => {
      document.addEventListener("keydown", (e) => {
        const section = document.getElementById("reviews-section");
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      });
    };
  
    // ── Auto-play (optional, pauses on hover/focus) ──────────
    let autoPlayTimer = null;
    const startAutoPlay = () => {
      stopAutoPlay();
      autoPlayTimer = setInterval(() => {
        if (currentIndex < maxIndex) next();
        else goTo(0);
      }, 5000);
    };
  
    const stopAutoPlay = () => {
      if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
    };
  
    // ── Fetch reviews from API (using existing endpoints) ──
const fetchReviews = async () => {
    try {
      // First, try to get all products to fetch their reviews
      const productsRes = await fetch(`${API_URL}/products?limit=50`);
      
      if (!productsRes.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const productsData = await productsRes.json();
      let products = [];
      
      // Handle different response structures
      if (productsData.success && Array.isArray(productsData.data)) {
        products = productsData.data;
      } else if (Array.isArray(productsData.products)) {
        products = productsData.products;
      } else if (Array.isArray(productsData)) {
        products = productsData;
      }
      
      if (!products.length) {
        console.warn('No products found');
        return getFallbackReviews();
      }
      
      // Fetch reviews for each product (parallel)
      const reviewPromises = products.map(async (product) => {
        try {
          const reviewRes = await fetch(`${API_URL}/reviews/product/${product._id || product.id}?limit=20`);
          if (!reviewRes.ok) return [];
          
          const reviewData = await reviewRes.json();
          let reviews = [];
          
          // Extract reviews from response structure
          if (reviewData.success && reviewData.data && Array.isArray(reviewData.data.reviews)) {
            reviews = reviewData.data.reviews;
          } else if (reviewData.success && Array.isArray(reviewData.data)) {
            reviews = reviewData.data;
          } else if (Array.isArray(reviewData.reviews)) {
            reviews = reviewData.reviews;
          }
          
          // Add product info to each review
          return reviews.map(review => ({
            ...review,
            _id: review._id || `temp_${Date.now()}_${Math.random()}`,
            customerName: review.customerName || 'গ্রাহক',
            rating: review.rating || 5,
            body: review.body || 'পণ্যটি খুব ভালো।',
            title: review.title || '',
            createdAt: review.createdAt || new Date().toISOString(),
            isVerifiedPurchase: review.isVerifiedPurchase !== false,
            helpfulVotes: review.helpfulVotes || 0,
            status: 'approved', // Force approved status since API only returns approved
            product: {
              name: product.name,
              image: product.image
            }
          }));
        } catch (err) {
          console.warn(`Failed to fetch reviews for product ${product.name}:`, err);
          return [];
        }
      });
      
      const allReviewArrays = await Promise.all(reviewPromises);
      let allReviews = allReviewArrays.flat();
      
      // Remove duplicates (same review might appear for multiple products? unlikely)
      const uniqueReviews = [];
      const reviewIds = new Set();
      for (const review of allReviews) {
        if (review._id && !reviewIds.has(review._id)) {
          reviewIds.add(review._id);
          uniqueReviews.push(review);
        }
      }
      allReviews = uniqueReviews;
      
      // Sort by date (newest first)
      allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Limit to 30 reviews
      allReviews = allReviews.slice(0, 30);
      
      console.log(`✅ Loaded ${allReviews.length} approved reviews from ${products.length} products`);
      
      // If still no reviews, check if there are any pending reviews
      if (allReviews.length === 0) {
        console.log('No approved reviews found, checking admin endpoint...');
        
        // Try admin endpoint (if accessible)
        try {
          const adminRes = await fetch(`${API_URL}/reviews/admin?limit=10`);
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            let pendingReviews = [];
            if (adminData.success && Array.isArray(adminData.data)) {
              pendingReviews = adminData.data;
            } else if (Array.isArray(adminData)) {
              pendingReviews = adminData;
            }
            
            if (pendingReviews.length > 0) {
              console.log(`📊 Found ${pendingReviews.length} reviews total (including pending/approved)`);
              console.log('Review statuses:', pendingReviews.map(r => ({ status: r.status, customer: r.customerName })));
            }
          }
        } catch (adminErr) {
          // Admin endpoint might require auth, ignore
        }
        
        return getFallbackReviews();
      }
      
      return allReviews;
      
    } catch (error) {
      console.error('❌ Fetch reviews error:', error);
      return getFallbackReviews();
    }
};
  
    // ── Init: build DOM, fetch, render ──────────────────────
    const init = async (containerId = "reviews-section") => {
      const container = document.getElementById(containerId);
      if (!container) return;
  
      // 1. Render skeleton immediately
      container.innerHTML = buildSectionHTML();
  
      // Grab refs
      $track = document.getElementById("rv-track");
      $viewport = document.getElementById("rv-viewport");
      $prevBtn = document.getElementById("rv-prev");
      $nextBtn = document.getElementById("rv-next");
      $dots = document.getElementById("rv-dots");
  
      // Show loading state
      $track.innerHTML = `<div class="rv-loading-row">${buildSkeletons(4)}</div>`;
  
      // 2. Bind events
      if ($prevBtn) $prevBtn.addEventListener("click", prev);
      if ($nextBtn) $nextBtn.addEventListener("click", next);
      bindTouch();
      bindKeyboard();
  
      // Pause autoplay on hover
      $viewport?.addEventListener("mouseenter", stopAutoPlay);
      $viewport?.addEventListener("mouseleave", () => {
        if (allReviews.length > 3) startAutoPlay();
      });
  
      // Responsive reflow
      window.addEventListener("resize", () => {
        updatePosition(false);
        updateControls();
        renderDots();
      });
  
      // 3. Fetch real data
      const reviews = await fetchReviews();
      allReviews = reviews;
      filtered = [...reviews];
  
      // 4. Render
      renderSummaryBar(reviews);
      renderTrack();
  
      // 5. Update filter pill counts
      updatePillCounts(reviews);
  
      // 6. Auto-play if enough cards
      if (reviews.length > 3) startAutoPlay();
  
      // 7. Animate summary bar on scroll into view
      const section = document.getElementById(containerId);
      if ("IntersectionObserver" in window) {
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                // Trigger bar fill animation
                document.querySelectorAll(".rsb-bar-fill").forEach((bar) => {
                  bar.style.width = bar.dataset.pct + "%";
                });
                intersectionObserver.disconnect();
              }
            });
          },
          { threshold: 0.2 }
        );
        intersectionObserver.observe(section);
      }
    };
  
    // ── Update pill counts after data loads ─────────────────
    const updatePillCounts = (reviews) => {
      const counts = { all: reviews.length, verified: 0, 5: 0, 4: 0, 3: 0 };
      reviews.forEach((r) => {
        const star = Math.round(r.rating);
        if (counts[star] !== undefined) counts[star]++;
        if (r.isVerifiedPurchase) counts.verified++;
      });
  
      document.querySelectorAll(".rv-filter-pill[data-filter]").forEach((pill) => {
        const f = pill.dataset.filter;
        const badge = pill.querySelector(".pill-count");
        if (badge && counts[f] !== undefined) badge.textContent = counts[f];
      });
    };
  
    // ── HTML scaffold ────────────────────────────────────────
    const buildSectionHTML = () => `
      <!-- ★ REVIEWS SECTION HEADER ────────────────────────── -->
      <div class="reviews-section-head">
        <div class="reviews-section-left">
          <div class="reviews-eyebrow">গ্রাহকদের মতামত</div>
          <h2 class="reviews-section-title">আমাদের গ্রাহকরা কী <em>বলছেন?</em></h2>
        </div>
      </div>
  
      <!-- ★ SUMMARY BAR ─────────────────────────────────────── -->
      <div class="reviews-summary-bar" id="rv-summary-bar">
        <!-- populated by JS -->
        <div style="color:rgba(255,255,255,0.4);font-size:0.875rem;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-circle-notch fa-spin" style="color:#F5A623;"></i> রিভিউ লোড হচ্ছে...
        </div>
      </div>
  
      <!-- ★ FILTER + NAV CONTROLS ─────────────────────────── -->
      <div class="reviews-controls">
        <div class="reviews-filter-pills">
          <button class="rv-filter-pill active" data-filter="all" onclick="ReviewsSection.applyFilter('all')">
            <i class="fas fa-list"></i> সব
            <span class="pill-count">—</span>
          </button>
          <button class="rv-filter-pill" data-filter="verified" onclick="ReviewsSection.applyFilter('verified')">
            <i class="fas fa-shield-check"></i> যাচাইকৃত
            <span class="pill-count">—</span>
          </button>
          <button class="rv-filter-pill" data-filter="5" onclick="ReviewsSection.applyFilter('5')">
            <i class="fas fa-star pill-star"></i> ৫ তারা
            <span class="pill-count">—</span>
          </button>
          <button class="rv-filter-pill" data-filter="4" onclick="ReviewsSection.applyFilter('4')">
            <i class="fas fa-star pill-star"></i> ৪ তারা
            <span class="pill-count">—</span>
          </button>
          <button class="rv-filter-pill" data-filter="3" onclick="ReviewsSection.applyFilter('3')">
            <i class="fas fa-star pill-star"></i> ৩ তারা
            <span class="pill-count">—</span>
          </button>
        </div>
  
        <div class="reviews-nav-btns">
          <button class="rv-nav-btn" id="rv-prev" aria-label="আগে" disabled>
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="rv-nav-btn" id="rv-next" aria-label="পরে" disabled>
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
  
      <!-- ★ SLIDER VIEWPORT ─────────────────────────────────── -->
      <div class="reviews-slider-viewport" id="rv-viewport">
        <div class="reviews-slider-track" id="rv-track">
          <!-- cards injected by JS -->
        </div>
      </div>
  
      <!-- ★ DOTS ────────────────────────────────────────────── -->
      <div class="reviews-dots" id="rv-dots"></div>
  
      <!-- ★ CTA ROW ──────────────────────────────────────────── -->
      <div class="reviews-cta-row">
        <button class="rv-cta-btn rv-cta-btn--primary" onclick="navigateTo('products')">
          <i class="fas fa-shopping-bag"></i> পণ্য দেখুন
        </button>
        <button class="rv-cta-btn rv-cta-btn--ghost" onclick="openTrackingModal()">
          <i class="fas fa-satellite-dish"></i> অর্ডার ট্র্যাক করুন
        </button>
      </div>`;
  
    // ── Public API ───────────────────────────────────────────
    return { init, applyFilter, goTo, prev, next, vote };
  })();
  
  window.ReviewsSection = ReviewsSection;
