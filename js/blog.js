/* ═══════════════════════════════════════════════════════════
   BeeHarvest — blog.js (FIXED + PREMIUM)
   Fixes:
   1. Cover images load immediately (no broken lazy-load)
   2. Publish date shows correctly (not "2 minutes")
   3. Detail modal scrolls properly
   4. Premium card & detail UI
   ═══════════════════════════════════════════════════════════ */

   (function () {
    "use strict";
  
    const BLOG_API = "https://beeyond-harvest-admin.onrender.com/api/blogs";
  
    /* ── State ────────────────────────────────────────────── */
    const BlogState = {
      posts: [],
      featured: null,
      categories: [],
      tags: [],
      currentPage: 1,
      totalPages: 1,
      perPage: 9,
      loading: false,
      searchQuery: "",
      activeCategory: "",
      activeTag: "",
      activeSort: "newest",
      singlePost: null,
      searchDebounceTimer: null,
    };
  
    /* ── Helpers ──────────────────────────────────────────── */
    function esc(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  
    /* FIXED: proper date formatting — no more "2 minutes" */
    function fmtDate(d) {
      if (!d) return "অজানা তারিখ";
      const date = new Date(d);
      if (isNaN(date.getTime())) return "অজানা তারিখ";
      return date.toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  
    function fmtDateShort(d) {
      if (!d) return "";
      const date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  
    /* Reading time in minutes — used only for display, NOT as date */
    function calcReadTime(body) {
      if (!body) return 1;
      const words = body.replace(/<[^>]+>/g, "").split(/\s+/).length;
      return Math.max(1, Math.ceil(words / 200));
    }
  
    function stripHtml(html) {
      return (html || "").replace(/<[^>]+>/g, "");
    }
  
    function truncate(str, len) {
      const clean = stripHtml(str);
      return clean.length > len ? clean.slice(0, len).trim() + "…" : clean;
    }
  
    async function blogFetch(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }
  
    /* ── Fallback image ───────────────────────────────────── */
    const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360'%3E%3Crect width='600' height='360' fill='%23f0ebe0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23c9b99a' font-size='64'%3E%F0%9F%8D%AF%3C/text%3E%3C/svg%3E";
  
    /* FIXED: get image URL properly */
    function getImgUrl(post) {
      if (post.coverImage) {
        if (typeof post.coverImage === "string") return post.coverImage;
        if (post.coverImage.url) return post.coverImage.url;
      }
      if (post.image) return post.image;
      if (post.thumbnail) return post.thumbnail;
      return null;
    }
  
    /* ── Skeleton ─────────────────────────────────────────── */
    function blogSkeleton(n = 6) {
      return Array(n).fill(0).map(() => `
        <div class="blog-card bcs">
          <div class="bcs-img"></div>
          <div class="bcs-body">
            <div class="bcs-line bcs-sm"></div>
            <div class="bcs-line bcs-lg"></div>
            <div class="bcs-line bcs-md"></div>
          </div>
        </div>`).join("");
    }
  
    /* ── PREMIUM Card Renderer ────────────────────────────── */
    function renderBlogCard(post) {
      const imgUrl = getImgUrl(post);
      const category = post.category || "";
      const excerpt = post.excerpt
        ? truncate(post.excerpt, 130)
        : truncate(post.body, 130);
      /* FIXED: use readingTime field OR calculate, NEVER show as date */
      const rt = post.readingTime || calcReadTime(post.body);
      /* FIXED: properly format the publish date */
      const publishDate = fmtDate(post.publishedAt || post.createdAt);
      const publishDateShort = fmtDateShort(post.publishedAt || post.createdAt);
      const tags = (post.tags || []).slice(0, 3);
      const authorInitial = (post.author?.name || "B")[0].toUpperCase();
      const isFeatured = post.isFeatured || post.featured;
  
      return `
        <article class="bc-card" onclick="BlogModule.openPost('${esc(post.slug || post._id)}')" role="button" tabindex="0"
                 onkeydown="if(event.key==='Enter')BlogModule.openPost('${esc(post.slug || post._id)}')">
          
          <!-- Image -->
          <div class="bc-img-zone">
            ${imgUrl
              ? `<img class="bc-img" src="${esc(imgUrl)}" alt="${esc(post.title)}" loading="lazy"
                     onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`
              : `<div class="bc-img-placeholder"><span>🍯</span></div>`
            }
            <div class="bc-img-overlay"></div>
            ${isFeatured ? `<div class="bc-featured-badge"><i class="fas fa-star"></i> ফিচার্ড</div>` : ""}
            ${category ? `<div class="bc-cat-chip">${esc(category)}</div>` : ""}
            <div class="bc-rt-badge"><i class="fas fa-clock"></i> ${rt} মিনিট</div>
          </div>
          
          <!-- Body -->
          <div class="bc-body">
            <h3 class="bc-title">${esc(post.title)}</h3>
            <p class="bc-excerpt">${esc(excerpt)}</p>
            
            ${tags.length ? `<div class="bc-tags">${tags.map(t => `<span class="bc-tag">#${esc(t)}</span>`).join("")}</div>` : ""}
            
            <!-- Footer -->
            <div class="bc-footer">
              <div class="bc-author">
                <div class="bc-author-av">${authorInitial}</div>
                <div class="bc-author-info">
                  <div class="bc-author-name">${esc(post.author?.name || "BeeHarvest")}</div>
                  <!-- FIXED: show actual publish date -->
                  <div class="bc-date">${publishDateShort}</div>
                </div>
              </div>
              <div class="bc-stats">
                <span class="bc-stat"><i class="fas fa-eye"></i> ${(post.views || 0).toLocaleString()}</span>
                <span class="bc-stat"><i class="fas fa-heart"></i> ${(post.likes || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </article>`;
    }
  
    /* ── Featured Hero Banner ─────────────────────────────── */
    function renderFeaturedHero(post) {
      if (!post) return "";
      const imgUrl = getImgUrl(post);
      const rt = post.readingTime || calcReadTime(post.body);
      const excerpt = truncate(post.excerpt || post.body, 180);
      const publishDate = fmtDate(post.publishedAt || post.createdAt);
  
      return `
        <div class="bc-featured-hero" onclick="BlogModule.openPost('${esc(post.slug || post._id)}')">
          ${imgUrl
            ? `<img class="bc-fh-img" src="${esc(imgUrl)}" alt="${esc(post.title)}" loading="eager"
                   onerror="this.onerror=null;this.style.display='none'">`
            : `<div class="bc-fh-img" style="background:linear-gradient(135deg,#0D1B3E,#1A2E5A)"></div>`
          }
          <div class="bc-fh-overlay"></div>
          <div class="bc-fh-content">
            <div class="bc-fh-meta">
              ${post.category ? `<span class="bc-fh-cat">${esc(post.category)}</span>` : ""}
              <span class="bc-fh-rt"><i class="fas fa-clock"></i> ${rt} মিনিট পড়া</span>
              <span class="bc-fh-date"><i class="fas fa-calendar-alt"></i> ${publishDate}</span>
            </div>
            <h2 class="bc-fh-title">${esc(post.title)}</h2>
            <p class="bc-fh-excerpt">${esc(excerpt)}</p>
            <div class="bc-fh-bottom">
              <div class="bc-fh-author">
                <div class="bc-fh-av">${(post.author?.name || "B")[0].toUpperCase()}</div>
                <span>${esc(post.author?.name || "BeeHarvest")}</span>
              </div>
              <button class="bc-fh-read-btn" onclick="event.stopPropagation();BlogModule.openPost('${esc(post.slug || post._id)}')">
                পড়ুন <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>`;
    }
  
    /* ── Tags Cloud ───────────────────────────────────────── */
    function renderTagsCloud(tags) {
      if (!tags || !tags.length) return "";
      const max = tags[0]?.count || 1;
      return `
        <div class="bc-tags-cloud">
          <div class="bc-tc-label"><i class="fas fa-hashtag"></i> জনপ্রিয় ট্যাগ</div>
          <div class="bc-tc-list">
            ${tags.slice(0, 15).map(t => {
              const sz = (0.72 + (t.count / max) * 0.4).toFixed(2);
              const active = BlogState.activeTag === t.tag ? " bc-tc-active" : "";
              return `<span class="bc-tc-tag${active}" style="font-size:${sz}rem"
                           onclick="BlogModule.filterByTag('${esc(t.tag)}')">
                #${esc(t.tag)} <sup>${t.count}</sup>
              </span>`;
            }).join("")}
          </div>
        </div>`;
    }
  
    /* ── Active Filters Bar ───────────────────────────────── */
    function updateActiveFiltersBar() {
      const bar = document.getElementById("blogActiveFilters");
      if (!bar) return;
      const chips = [];
      if (BlogState.searchQuery)
        chips.push(`<span class="bc-af-chip">🔍 "${esc(BlogState.searchQuery)}" <button onclick="BlogModule.clearSearch()">×</button></span>`);
      if (BlogState.activeCategory)
        chips.push(`<span class="bc-af-chip">📁 ${esc(BlogState.activeCategory)} <button onclick="BlogModule.clearCategory()">×</button></span>`);
      if (BlogState.activeTag)
        chips.push(`<span class="bc-af-chip"># ${esc(BlogState.activeTag)} <button onclick="BlogModule.clearTag()">×</button></span>`);
      bar.style.display = chips.length ? "flex" : "none";
      bar.innerHTML = chips.length
        ? chips.join("") + `<button class="bc-af-clear" onclick="BlogModule.resetFilters()">সব রিসেট</button>`
        : "";
    }
  
    /* ── Pagination ───────────────────────────────────────── */
    function renderPagination() {
      const el = document.getElementById("blogPagination");
      if (!el) return;
      const { currentPage: cp, totalPages: tp } = BlogState;
      if (tp <= 1) { el.innerHTML = ""; return; }
  
      const pages = [];
      pages.push(`<button class="blog-pg-btn" ${cp === 1 ? "disabled" : ""} onclick="BlogModule.goPage(${cp - 1})"><i class="fas fa-chevron-left"></i></button>`);
      const start = Math.max(1, cp - 2);
      const end = Math.min(tp, cp + 2);
      if (start > 1) pages.push(`<button class="blog-pg-btn" onclick="BlogModule.goPage(1)">1</button>`);
      if (start > 2) pages.push(`<span class="blog-pg-dots">…</span>`);
      for (let i = start; i <= end; i++)
        pages.push(`<button class="blog-pg-btn${i === cp ? " active" : ""}" onclick="BlogModule.goPage(${i})">${i}</button>`);
      if (end < tp - 1) pages.push(`<span class="blog-pg-dots">…</span>`);
      if (end < tp) pages.push(`<button class="blog-pg-btn" onclick="BlogModule.goPage(${tp})">${tp}</button>`);
      pages.push(`<button class="blog-pg-btn" ${cp === tp ? "disabled" : ""} onclick="BlogModule.goPage(${cp + 1})"><i class="fas fa-chevron-right"></i></button>`);
      el.innerHTML = pages.join("");
    }
  
    /* ── Single Post Renderer ─────────────────────────────── */
    function renderSinglePost(post) {
      const imgUrl = getImgUrl(post);
      /* FIXED: reading time is separate from publish date */
      const rt = post.readingTime || calcReadTime(post.body);
      /* FIXED: actual formatted publish date */
      const publishDate = fmtDate(post.publishedAt || post.createdAt);
      const tags = post.tags || [];
      const comments = (post.comments || []).filter(c => c.isApproved !== false);
  
      return `
        <div class="bc-single-post">
  
          <!-- Hero -->
          ${imgUrl ? `
          <div class="bc-sp-hero">
            <img src="${esc(imgUrl)}" alt="${esc(post.title)}" loading="eager"
                 onerror="this.onerror=null;this.parentElement.style.display='none'">
            <div class="bc-sp-hero-overlay"></div>
          </div>` : ""}
  
          <!-- Header Info -->
          <div class="bc-sp-header">
            <div class="bc-sp-meta-top">
              ${post.category ? `<span class="bc-sp-cat">${esc(post.category)}</span>` : ""}
              <!-- FIXED: show reading time separately with label -->
              <span class="bc-sp-rt"><i class="fas fa-clock"></i> ${rt} মিনিট পড়া</span>
            </div>
            
            <h1 class="bc-sp-title">${esc(post.title)}</h1>
            
            <div class="bc-sp-author-row">
              <div class="bc-sp-author-info">
                <div class="bc-sp-av">${(post.author?.name || "B")[0].toUpperCase()}</div>
                <div>
                  <div class="bc-sp-author-name">${esc(post.author?.name || "BeeHarvest")}</div>
                  ${post.author?.bio ? `<div class="bc-sp-author-bio">${esc(post.author.bio)}</div>` : ""}
                </div>
              </div>
              <div class="bc-sp-pub-meta">
                <!-- FIXED: actual publish date with calendar icon -->
                <span><i class="fas fa-calendar-alt"></i> ${publishDate}</span>
                <span><i class="fas fa-eye"></i> ${(post.views || 0).toLocaleString()} ভিউ</span>
              </div>
            </div>
  
            ${tags.length ? `
            <div class="bc-sp-tags">
              ${tags.map(t => `<span class="bc-sp-tag" onclick="BlogModule.filterByTag('${esc(t)}')">#${esc(t)}</span>`).join("")}
            </div>` : ""}
          </div>
  
          <!-- Body Content -->
          <div class="bc-sp-body" id="bcSpBody">
            ${post.body || "<p>কোনো বিষয়বস্তু নেই।</p>"}
          </div>
  
          <!-- Engagement -->
          <div class="bc-sp-engagement">
            <button class="bc-sp-like-btn" id="bcSpLikeBtn" onclick="BlogModule.likePost('${esc(post._id)}')">
              <i class="fas fa-heart"></i>
              <span id="bcSpLikeCount">${post.likes || 0}</span> পছন্দ
            </button>
            <button class="bc-sp-share-btn" onclick="BlogModule.sharePost('${esc(post.title)}', '${esc(post.slug || post._id)}')">
              <i class="fas fa-share-alt"></i> শেয়ার
            </button>
          </div>
  
          <!-- Related Posts -->
          ${(post.relatedPosts || []).length ? `
          <div class="bc-sp-related">
            <h3 class="bc-sp-section-title"><i class="fas fa-book-open"></i> সম্পর্কিত পোস্ট</h3>
            <div class="bc-sp-related-grid">
              ${post.relatedPosts.map(rp => `
                <div class="bc-sp-related-card" onclick="BlogModule.openPost('${esc(rp.slug || rp._id)}')">
                  ${getImgUrl(rp)
                    ? `<img src="${esc(getImgUrl(rp))}" alt="${esc(rp.title)}" loading="lazy">`
                    : `<div class="bc-sp-related-placeholder">🍯</div>`
                  }
                  <div class="bc-sp-related-info">
                    <h4>${esc(rp.title)}</h4>
                    <span>${fmtDateShort(rp.publishedAt)}</span>
                  </div>
                </div>`).join("")}
            </div>
          </div>` : ""}
  
          <!-- Comments -->
          ${post.allowComments !== false ? `
          <div class="bc-sp-comments">
            <h3 class="bc-sp-section-title">
              <i class="fas fa-comments"></i> মন্তব্য
              <span class="bc-sp-comment-count">${comments.length}</span>
            </h3>
            
            ${comments.length ? `
            <div class="bc-sp-comments-list">
              ${comments.map(c => `
                <div class="bc-sp-comment">
                  <div class="bc-sp-comment-av">${(c.author || "?")[0].toUpperCase()}</div>
                  <div class="bc-sp-comment-body">
                    <div class="bc-sp-comment-header">
                      <strong>${esc(c.author)}</strong>
                      <!-- FIXED: actual comment date -->
                      <span>${fmtDateShort(c.createdAt)}</span>
                    </div>
                    <p>${esc(c.body)}</p>
                  </div>
                </div>`).join("")}
            </div>` : `
            <div class="bc-sp-no-comments">
              <i class="fas fa-comment-slash"></i>
              <p>এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন!</p>
            </div>`}
  
            <!-- Comment Form -->
            <div class="bc-sp-comment-form">
              <h4><i class="fas fa-pencil-alt"></i> মন্তব্য করুন</h4>
              <div class="bc-sp-comment-inputs">
                <div class="form-group">
                  <label>নাম *</label>
                  <input type="text" id="bcCommentAuthor" placeholder="আপনার নাম" maxlength="80">
                </div>
                <div class="form-group">
                  <label>ইমেইল *</label>
                  <input type="email" id="bcCommentEmail" placeholder="আপনার ইমেইল" maxlength="200">
                </div>
              </div>
              <div class="form-group">
                <label>মন্তব্য *</label>
                <textarea id="bcCommentBody" rows="4" placeholder="আপনার মন্তব্য লিখুন..." maxlength="1000"></textarea>
              </div>
              <button class="bc-sp-submit-btn" onclick="BlogModule.submitComment('${esc(post._id)}')">
                <i class="fas fa-paper-plane"></i> মন্তব্য পাঠান
              </button>
              <p class="bc-sp-comment-note"><i class="fas fa-info-circle"></i> মন্তব্য অনুমোদনের পর প্রকাশিত হবে।</p>
            </div>
          </div>` : ""}
  
        </div>`;
    }
  
    /* ── Blog List Initialiser ────────────────────────────── */
    function initBlogListUI() {
      const blogsPage = document.getElementById("blogsPage");
      if (!blogsPage) return;
  
      /* Reset state */
      BlogState.singlePost = null;
      BlogState.searchQuery = "";
      BlogState.activeCategory = "";
      BlogState.activeTag = "";
      BlogState.activeSort = "newest";
      BlogState.currentPage = 1;
  
      /* Inject structure */
      const listHTML = `
        <div id="blogListContainer">
          <!-- Active Filters -->
          <div class="bc-active-filters" id="blogActiveFilters" style="display:none"></div>
  
          <!-- Featured Hero -->
          <div id="blogFeaturedZone"></div>
  
          <!-- Tags Cloud -->
          <div id="blogTagsCloud"></div>
  
          <!-- Section Head -->
          <div class="bc-section-head">
            <div>
              <div class="bc-eyebrow">সব পোস্ট</div>
              <h2 class="bc-section-title">সাম্প্রতিক <em>লেখাসমূহ</em></h2>
            </div>
            <span class="bc-post-count" id="blogPostCount"></span>
          </div>
  
          <!-- Grid -->
          <div class="blog-grid" id="blogGrid">${blogSkeleton(6)}</div>
  
          <!-- Pagination -->
          <div class="pagination" id="blogPagination"></div>
  
          <!-- Empty -->
          <div class="bc-empty" id="blogEmpty" style="display:none">
            <div class="bc-empty-icon">📝</div>
            <h3>কোনো পোস্ট পাওয়া যায়নি</h3>
            <p>ভিন্ন কীওয়ার্ড বা ফিল্টার দিয়ে চেষ্টা করুন</p>
            <button class="btn-primary" onclick="BlogModule.resetFilters()">
              <i class="fas fa-redo"></i> ফিল্টার রিসেট করুন
            </button>
          </div>
        </div>`;
  
      /* Find or create container below the filters/hero that already exist in the HTML */
      let container = blogsPage.querySelector("#blogListContainer");
      if (!container) {
        /* Append after the static hero + filters already in HTML */
        const div = document.createElement("div");
        div.innerHTML = listHTML;
        blogsPage.appendChild(div.firstElementChild);
      }
  
      /* Wire up search input that's already in the HTML */
      const searchInput = document.getElementById("blogSearchInput");
      if (searchInput) {
        searchInput.value = "";
        searchInput.oninput = (e) => BlogModule.onSearchInput(e.target.value);
      }
  
      const sortSelect = document.getElementById("blogSortSelect");
      if (sortSelect) {
        sortSelect.value = "newest";
        sortSelect.onchange = (e) => BlogModule.onSortChange(e.target.value);
      }
  
      /* Parallel fetch */
      Promise.all([fetchFeatured(), fetchCategories(), fetchTags(), fetchPosts(1)]);
    }
  
    /* ── API Calls ────────────────────────────────────────── */
    async function fetchPosts(page = 1) {
      BlogState.loading = true;
      const grid = document.getElementById("blogGrid");
      if (grid) grid.innerHTML = blogSkeleton(6);
  
      const params = new URLSearchParams({ page, limit: BlogState.perPage, status: "published" });
      if (BlogState.searchQuery) params.set("search", BlogState.searchQuery);
      if (BlogState.activeCategory) params.set("category", BlogState.activeCategory);
      if (BlogState.activeTag) params.set("tag", BlogState.activeTag);
      if (BlogState.activeSort) params.set("sort", BlogState.activeSort);
  
      try {
        const data = await blogFetch(`${BLOG_API}?${params}`);
        if (!data.success) throw new Error(data.message);
  
        BlogState.posts = data.data || [];
        BlogState.currentPage = data.pagination?.page || 1;
        BlogState.totalPages = data.pagination?.pages || 1;
  
        if (grid) {
          if (!BlogState.posts.length) {
            grid.innerHTML = "";
            const empty = document.getElementById("blogEmpty");
            if (empty) empty.style.display = "flex";
          } else {
            const empty = document.getElementById("blogEmpty");
            if (empty) empty.style.display = "none";
            /* FIXED: render cards with direct src, not data-src */
            grid.innerHTML = BlogState.posts.map(p => renderBlogCard(p)).join("");
          }
        }
  
        const countEl = document.getElementById("blogPostCount");
        if (countEl) {
          const total = data.pagination?.total || BlogState.posts.length;
          countEl.textContent = `${total}টি পোস্ট`;
        }
  
        renderPagination();
        updateActiveFiltersBar();
  
        /* Entrance animation */
        setTimeout(() => {
          document.querySelectorAll(".bc-card").forEach((c, i) => {
            c.style.animationDelay = `${i * 0.07}s`;
            c.classList.add("bc-card--animate");
          });
        }, 50);
  
      } catch (e) {
        console.error("Blog fetch error:", e);
        if (grid) grid.innerHTML = `
          <div class="bc-error-state" style="grid-column:1/-1;">
            <i class="fas fa-exclamation-circle"></i>
            <p>পোস্ট লোড করতে সমস্যা হয়েছে।</p>
            <button class="btn-primary" onclick="BlogModule.loadPosts(1)"><i class="fas fa-redo"></i> রিট্রাই</button>
          </div>`;
      } finally {
        BlogState.loading = false;
      }
    }
  
    async function fetchFeatured() {
      try {
        const data = await blogFetch(`${BLOG_API}?featured=true&limit=1&status=published`);
        if (!data.success || !data.data.length) return;
        BlogState.featured = data.data[0];
        const heroEl = document.getElementById("blogFeaturedZone") || document.getElementById("blogFeatured");
        if (heroEl) {
          heroEl.style.display = "block";
          heroEl.innerHTML = renderFeaturedHero(data.data[0]);
        }
      } catch (e) {
        console.warn("Featured fetch:", e);
      }
    }
  
    async function fetchCategories() {
      try {
        const data = await blogFetch(`${BLOG_API}/meta/categories`);
        if (!data.success) return;
        BlogState.categories = data.data || [];
  
        /* Build pills in the existing HTML element */
        const pillsEl = document.getElementById("blogCategoryPills");
        if (pillsEl) {
          pillsEl.innerHTML =
            `<button class="blog-cat-pill${!BlogState.activeCategory ? " active" : ""}" onclick="BlogModule.clearCategory()">
              সব <span class="pill-count">${BlogState.categories.reduce((a, c) => a + (c.count || 0), 0)}</span>
            </button>` +
            BlogState.categories.map(c =>
              `<button class="blog-cat-pill${BlogState.activeCategory === c.name ? " active" : ""}"
                       onclick="BlogModule.onCategoryChange('${esc(c.name)}')">
                ${esc(c.name)} <span class="pill-count">${c.count || 0}</span>
              </button>`
            ).join("");
        }
      } catch (e) {
        console.warn("Categories fetch:", e);
      }
    }
  
    async function fetchTags() {
      try {
        const data = await blogFetch(`${BLOG_API}/meta/tags`);
        if (!data.success) return;
        BlogState.tags = data.data || [];
        const cloud = document.getElementById("blogTagsCloud");
        if (cloud) cloud.innerHTML = renderTagsCloud(BlogState.tags);
      } catch (e) {
        console.warn("Tags fetch:", e);
      }
    }
  
    /* ── Single post fetch & open in MODAL ───────────────── */
    async function fetchAndOpenPost(identifier) {
      /* FIXED: Open in a dedicated modal with proper scroll */
      let modal = document.getElementById("blogDetailModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.className = "modal";
        modal.id = "blogDetailModal";
        modal.innerHTML = `
          <div class="modal-content bc-detail-modal">
            <div class="modal-header" style="position:sticky;top:0;z-index:10;border-radius:0;">
              <h3><i class="fas fa-newspaper"></i> <span id="bcDetailModalTitle">ব্লগ পোস্ট</span></h3>
              <button class="close-modal" onclick="closeModal('blogDetailModal')"><i class="fas fa-times"></i></button>
            </div>
            <div id="bcDetailBody" class="bc-detail-body"></div>
          </div>`;
        document.body.appendChild(modal);
      }
  
      const body = modal.querySelector("#bcDetailBody");
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;gap:1rem;">
          <div style="width:48px;height:48px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--honey);animation:spin 0.8s linear infinite;"></div>
          <p style="color:var(--text-muted);font-size:0.9rem;">পোস্ট লোড হচ্ছে...</p>
        </div>`;
  
      /* Show modal */
      modal.classList.add("active");
      document.body.classList.add("modal-open");
      /* FIXED: reset scroll to top when opening */
      modal.scrollTop = 0;
      if (body) body.scrollTop = 0;
      const modalContent = modal.querySelector(".modal-content");
      if (modalContent) modalContent.scrollTop = 0;
  
      try {
        const data = await blogFetch(`${BLOG_API}/${encodeURIComponent(identifier)}`);
        if (!data.success || !data.data) throw new Error("Not found");
        BlogState.singlePost = data.data;
  
        /* FIXED: update title */
        const titleEl = modal.querySelector("#bcDetailModalTitle");
        if (titleEl) titleEl.textContent = data.data.title;
  
        body.innerHTML = renderSinglePost(data.data);
        /* FIXED: scroll to top after content loads */
        body.scrollTop = 0;
        if (modalContent) modalContent.scrollTop = 0;
  
        /* Style body content */
        styleBodyContent();
      } catch (e) {
        body.innerHTML = `
          <div style="text-align:center;padding:3rem 2rem;">
            <i class="fas fa-exclamation-circle" style="font-size:3rem;color:var(--danger);display:block;margin-bottom:1rem;"></i>
            <p style="color:var(--text-muted);">পোস্টটি খুঁজে পাওয়া যায়নি।</p>
            <button class="btn-primary" style="margin-top:1rem;" onclick="closeModal('blogDetailModal')">বন্ধ করুন</button>
          </div>`;
      }
    }
  
    function styleBodyContent() {
      const bodyEl = document.getElementById("bcSpBody");
      if (!bodyEl) return;
      bodyEl.querySelectorAll("a").forEach(a => {
        if (a.href && !a.href.includes(location.hostname)) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
      });
      bodyEl.querySelectorAll("img").forEach(img => {
        img.style.maxWidth = "100%";
        img.style.borderRadius = "12px";
        img.style.marginTop = "0.75rem";
        img.style.marginBottom = "0.75rem";
      });
      bodyEl.querySelectorAll("pre").forEach(el => {
        el.style.background = "#0D1B3E";
        el.style.color = "#c6f135";
        el.style.borderRadius = "10px";
        el.style.padding = "1rem 1.25rem";
        el.style.overflowX = "auto";
        el.style.fontSize = "0.85em";
      });
      bodyEl.querySelectorAll("code:not(pre code)").forEach(el => {
        el.style.background = "rgba(13,27,62,0.07)";
        el.style.padding = "1px 6px";
        el.style.borderRadius = "4px";
        el.style.fontFamily = "monospace";
        el.style.fontSize = "0.9em";
      });
    }
  
    /* ── Init ─────────────────────────────────────────────── */
    function initBlogPage() {
      const blogsPage = document.getElementById("blogsPage");
      if (!blogsPage) return;
      initBlogListUI();
    }
  
    /* ── Public API ───────────────────────────────────────── */
    window.BlogModule = {
      init: initBlogPage,
  
      loadPosts(page = 1) {
        BlogState.currentPage = page;
        fetchPosts(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
  
      goPage(page) { this.loadPosts(page); },
  
      openPost(identifier) {
        fetchAndOpenPost(identifier);
      },
  
      onSearchInput(val) {
        clearTimeout(BlogState.searchDebounceTimer);
        BlogState.searchDebounceTimer = setTimeout(() => {
          BlogState.searchQuery = val.trim();
          BlogState.currentPage = 1;
          fetchPosts(1);
          updateActiveFiltersBar();
        }, 380);
      },
  
      clearSearch() {
        BlogState.searchQuery = "";
        const inp = document.getElementById("blogSearchInput");
        if (inp) inp.value = "";
        BlogState.currentPage = 1;
        fetchPosts(1);
        updateActiveFiltersBar();
      },
  
      onCategoryChange(val) {
        BlogState.activeCategory = val;
        BlogState.currentPage = 1;
        fetchPosts(1);
        updateActiveFiltersBar();
        /* Update pill active states */
        document.querySelectorAll(".blog-cat-pill").forEach(p => {
          p.classList.toggle("active", p.textContent.trim().startsWith(val) || (!val && p.textContent.includes("সব")));
        });
      },
  
      clearCategory() {
        BlogState.activeCategory = "";
        BlogState.currentPage = 1;
        fetchPosts(1);
        updateActiveFiltersBar();
        document.querySelectorAll(".blog-cat-pill").forEach((p, i) => {
          p.classList.toggle("active", i === 0);
        });
      },
  
      onSortChange(val) {
        BlogState.activeSort = val;
        BlogState.currentPage = 1;
        fetchPosts(1);
      },
  
      filterByTag(tag) {
        BlogState.activeTag = BlogState.activeTag === tag ? "" : tag;
        BlogState.currentPage = 1;
        fetchPosts(1);
        updateActiveFiltersBar();
        const cloud = document.getElementById("blogTagsCloud");
        if (cloud && BlogState.tags.length) cloud.innerHTML = renderTagsCloud(BlogState.tags);
      },
  
      clearTag() { this.filterByTag(""); },
  
      resetFilters() {
        BlogState.searchQuery = "";
        BlogState.activeCategory = "";
        BlogState.activeTag = "";
        BlogState.activeSort = "newest";
        BlogState.currentPage = 1;
        const inp = document.getElementById("blogSearchInput");
        const sortSel = document.getElementById("blogSortSelect");
        if (inp) inp.value = "";
        if (sortSel) sortSel.value = "newest";
        fetchPosts(1);
        fetchCategories();
        updateActiveFiltersBar();
        const cloud = document.getElementById("blogTagsCloud");
        if (cloud && BlogState.tags.length) cloud.innerHTML = renderTagsCloud(BlogState.tags);
      },
  
      async likePost(postId) {
        const btn = document.getElementById("bcSpLikeBtn");
        if (!btn || btn.dataset.liked) return;
        btn.dataset.liked = "1";
        btn.classList.add("bc-sp-like-btn--liked");
        try {
          const r = await fetch(`${BLOG_API}/${postId}/like`, { method: "POST" });
          const data = await r.json();
          const countEl = document.getElementById("bcSpLikeCount");
          if (countEl && data.success) countEl.textContent = data.data.likes;
        } catch (e) {
          console.warn("Like error:", e);
        }
      },
  
      sharePost(title, slug) {
        const baseUrl = 'https://beeharvest.vercel.app';
        
        // Function to create a clean kebab-case slug
        const createKebabSlug = (text) => {
          return text
            .toLowerCase()
            // Convert spaces and special chars to hyphens
            .replace(/[\s\u0980-\u09FF]+/g, (match) => {
              // Keep Bengali characters but replace spaces with hyphens
              return match.includes(' ') ? '-' : match;
            })
            .replace(/[^\u0980-\u09FFa-z0-9-]/g, '') // Remove invalid chars
            .replace(/-+/g, '-')                     // Replace multiple hyphens with single
            .replace(/^-|-$/g, '');                  // Remove leading/trailing hyphens
        };
        
        const kebabSlug = createKebabSlug(slug);
        const url = `${baseUrl}${location.pathname}?blog=${encodeURIComponent(kebabSlug)}`;
        
        if (navigator.share) {
          navigator.share({ title, text: title, url }).catch(() => this._copy(url));
        } else {
          this._copy(url);
        }
      },
  
      _copy(text) {
        navigator.clipboard?.writeText(text).then(() => {
          if (typeof showToast === "function") showToast("লিংক কপি হয়েছে!", "success");
        });
      },
  
      async submitComment(postId) {
        const author = document.getElementById("bcCommentAuthor")?.value.trim();
        const email = document.getElementById("bcCommentEmail")?.value.trim();
        const body = document.getElementById("bcCommentBody")?.value.trim();
        if (!author || !email || !body) {
          if (typeof showToast === "function") showToast("সব ঘর পূরণ করুন", "error");
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          if (typeof showToast === "function") showToast("সঠিক ইমেইল দিন", "error");
          return;
        }
        const btn = document.querySelector(".bc-sp-submit-btn");
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> পাঠানো হচ্ছে...'; }
        try {
          const r = await fetch(`${BLOG_API}/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author, email, body }),
          });
          const data = await r.json();
          if (data.success) {
            if (typeof showToast === "function") showToast("মন্তব্য পাঠানো হয়েছে! অনুমোদনের পর প্রকাশিত হবে।", "success");
            if (document.getElementById("bcCommentAuthor")) document.getElementById("bcCommentAuthor").value = "";
            if (document.getElementById("bcCommentEmail")) document.getElementById("bcCommentEmail").value = "";
            if (document.getElementById("bcCommentBody")) document.getElementById("bcCommentBody").value = "";
          } else {
            if (typeof showToast === "function") showToast(data.message || "মন্তব্য পাঠাতে ব্যর্থ", "error");
          }
        } catch (e) {
          if (typeof showToast === "function") showToast("নেটওয়ার্ক সমস্যা", "error");
        } finally {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> মন্তব্য পাঠান'; }
        }
      },
    };
  
    /* URL param auto-open */
    const urlParams = new URLSearchParams(location.search);
    const blogParam = urlParams.get("blog");
    if (blogParam) {
      window.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
          if (typeof navigateTo === "function") navigateTo("blogs");
          setTimeout(() => BlogModule.openPost(blogParam), 600);
        }, 700);
      });
    }
  
    window.initBlogPage = initBlogPage;
  })();
