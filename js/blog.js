/* ═══════════════════════════════════════════════════════════
   BeeHarvest — Blog Feature JS  v3.0
   Full-page detail view · Powerful search · Real-time polling
   API: https://beeyond-harvest-admin.onrender.com/api/blogs
═══════════════════════════════════════════════════════════ */

const BLOG_API      = "https://beeyond-harvest-admin.onrender.com/api/blogs";
const BLOG_SITE_URL = "https://beeharvest.vercel.app";

/* ── State ─────────────────────────────────────────────── */
const BlogState = {
  posts: [], categories: [], tags: [],
  activeCategory: "", activeTag: "",
  search: "", sort: "newest",
  page: 1, totalPages: 1,
  loading: false, detailLoading: false,
  currentPost: null, view: "list", /* "list" | "detail" */
  likedPosts: JSON.parse(localStorage.getItem("bh_liked_blogs") || "[]"),
  realtimeInterval: null,
  searchHistory: JSON.parse(localStorage.getItem("bh_blog_history") || "[]"),
};

/* ── Helpers ────────────────────────────────────────────── */
function $b(id) { return document.getElementById(id); }

function blogEsc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function blogDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("bn-BD", { year:"numeric", month:"long", day:"numeric" });
}

function blogDateShort(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("bn-BD", { year:"numeric", month:"short", day:"numeric" });
}

function authorInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function stripHtml(html) { return html ? html.replace(/<[^>]+>/g,"").trim() : ""; }

function bengaliNum(n) { return String(n).replace(/[0-9]/g, d => "০১২৩৪৫৬৭৮৯"[d]); }

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

async function blogFetch(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Blog API error");
  return data;
}

/* ── Save search history ────────────────────────────────── */
function saveSearchHistory(q) {
  if (!q || q.length < 2) return;
  BlogState.searchHistory = [q, ...BlogState.searchHistory.filter(h => h !== q)].slice(0, 8);
  localStorage.setItem("bh_blog_history", JSON.stringify(BlogState.searchHistory));
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
async function initBlogPage() {
  BlogState.view = "list";
  renderBlogPageShell();
  await Promise.all([loadBlogCategories(), loadBlogPosts()]);
  startBlogRealtime();
}

/* ── Real-time polling ──────────────────────────────────── */
function startBlogRealtime() {
  stopBlogRealtime();
  BlogState.realtimeInterval = setInterval(() => {
    const blogsPage = $b("blogsPage");
    if (!blogsPage?.classList.contains("active")) return;
    if (BlogState.view === "list") silentRefreshPosts();
    else if (BlogState.view === "detail" && BlogState.currentPost) {
      silentRefreshDetail(BlogState.currentPost._id);
    }
  }, 40000);
}

function stopBlogRealtime() {
  if (BlogState.realtimeInterval) { clearInterval(BlogState.realtimeInterval); BlogState.realtimeInterval = null; }
}

async function silentRefreshPosts() {
  try {
    const params = new URLSearchParams({ page: BlogState.page, limit: 9, sort: BlogState.sort });
    if (BlogState.activeCategory) params.set("category", BlogState.activeCategory);
    if (BlogState.search) params.set("search", BlogState.search);
    const data = await blogFetch(`${BLOG_API}?${params}`);
    (data.data || []).forEach(post => {
      const id = String(post._id);
      document.querySelectorAll(`[data-post-id="${id}"]`).forEach(card => {
        const v = card.querySelector(".blog-stat-chip.views");
        const l = card.querySelector(".blog-stat-chip.likes");
        if (v) v.innerHTML = `<i class="fas fa-eye"></i> ${bengaliNum(post.views || 0)}`;
        if (l) l.innerHTML = `<i class="fas fa-heart"></i> ${bengaliNum(post.likes || 0)}`;
      });
    });
  } catch(e) {}
}

async function silentRefreshDetail(id) {
  try {
    const data = await blogFetch(`${BLOG_API}/${id}`);
    const post = data.data;
    const vEl = document.querySelector(".blog-article-views");
    const lEl = $b("blogLikeCount");
    if (vEl) vEl.textContent = bengaliNum(post.views || 0);
    if (lEl && !BlogState.likedPosts.includes(String(id))) lEl.textContent = bengaliNum(post.likes || 0);
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════
   PAGE SHELL — List view
═══════════════════════════════════════════════════════════ */
function renderBlogPageShell() {
  const page = $b("blogsPage");
  if (!page) return;

  page.innerHTML = `
    <!-- Reading progress bar -->
    <div class="blog-reading-progress" id="blogReadingProgress">
      <div class="blog-reading-progress-fill" id="blogReadingFill"></div>
    </div>

    <!-- List view -->
    <div id="blogListView">
      <div class="blog-hero-banner">
        <div class="blog-hero-eyebrow"><i class="fas fa-pen-nib"></i> জ্ঞান ও অনুপ্রেরণা</div>
        <h1 class="blog-hero-title">আমাদের <em>ব্লগ</em></h1>
        <p class="blog-hero-desc">স্বাস্থ্য, পুষ্টি ও প্রকৃতির সেরা পণ্য নিয়ে বিশেষজ্ঞদের লেখা পড়ুন।</p>
      </div>

      <!-- Powerful Search -->
      <div class="blog-search-section" id="blogSearchSection">
        <div class="blog-search-outer">
          <div class="blog-search-icon"><i class="fas fa-search"></i></div>
          <input type="text" id="blogSearchInput" class="blog-search-input"
            placeholder="শিরোনাম, ট্যাগ, লেখক দিয়ে খুঁজুন..." autocomplete="off" />
          <div class="blog-search-controls">
            <button class="blog-search-clear" id="blogSearchClear" onclick="clearBlogSearch()">
              <i class="fas fa-times"></i>
            </button>
            <span class="blog-search-kbd"><i class="fas fa-keyboard"></i> Enter</span>
          </div>
          <button class="blog-search-btn" onclick="triggerBlogSearch()">
            <i class="fas fa-search"></i>
            <span>খুঁজুন</span>
          </button>
        </div>

        <!-- Suggestions dropdown -->
        <div class="blog-suggestions-drop" id="blogSuggestions"></div>

        <!-- Filters row -->
        <div class="blog-search-filters" id="blogFilterRow">
          <button class="blog-filter-chip active" data-filter="all" onclick="setBlogFilter('all', this)">
            <i class="fas fa-border-all"></i> সব পোস্ট
          </button>
          <button class="blog-filter-chip" data-filter="popular" onclick="setBlogFilter('popular', this)">
            <i class="fas fa-fire"></i> জনপ্রিয়
          </button>
          <button class="blog-filter-chip" data-filter="trending" onclick="setBlogFilter('trending', this)">
            <i class="fas fa-chart-line"></i> ট্রেন্ডিং
          </button>
          <button class="blog-filter-chip" data-filter="recent" onclick="setBlogFilter('recent', this)">
            <i class="fas fa-clock"></i> সাম্প্রতিক
          </button>
          <select id="blogSortSelect" class="blog-sort-select">
            <option value="newest">সর্বশেষ</option>
            <option value="popular">পঠিত</option>
            <option value="trending">ট্রেন্ডিং</option>
            <option value="oldest">পুরনো</option>
          </select>
        </div>

        <!-- Search result info -->
        <div class="blog-search-info" id="blogSearchInfo">
          <i class="fas fa-search"></i>
          <span id="blogSearchInfoText"></span>
          <button class="blog-search-info-clear" onclick="clearBlogSearch()">মুছুন</button>
        </div>
      </div>

      <!-- Category pills -->
      <div class="blog-category-pills" id="blogCatPills">
        <button class="blog-cat-pill active" data-cat="" onclick="filterBlogByCategory('')">
          <i class="fas fa-border-all"></i> সব
        </button>
      </div>

      <div id="blogFeaturedWrap"></div>
      <div class="blog-grid" id="blogGrid">${blogSkeletons(6)}</div>
      <div class="blog-pagination" id="blogPagination"></div>
    </div>

    <!-- Detail view (full page, no modal) -->
    <div class="blog-detail-page" id="blogDetailView"></div>
  `;

  wireSearchEvents();
  wireSortEvent();
}

function blogSkeletons(n) {
  return Array(n).fill(0).map(() => `
    <div class="blog-skeleton">
      <div class="blog-skel-img"></div>
      <div class="blog-skel-body">
        <div class="blog-skel-line" style="height:11px;width:38%;"></div>
        <div class="blog-skel-line" style="height:17px;width:88%;"></div>
        <div class="blog-skel-line" style="height:17px;width:68%;"></div>
        <div class="blog-skel-line" style="height:11px;width:80%;"></div>
        <div class="blog-skel-line" style="height:11px;width:50%;"></div>
      </div>
    </div>`).join("");
}

/* ── Wire search events ─────────────────────────────────── */
function wireSearchEvents() {
  const input = $b("blogSearchInput");
  if (!input) return;

  input.addEventListener("input", debounce((e) => {
    const q = e.target.value.trim();
    const clearBtn = $b("blogSearchClear");
    if (clearBtn) clearBtn.classList.toggle("show", q.length > 0);
    showBlogSuggestions(q);
  }, 200));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); triggerBlogSearch(); }
    if (e.key === "Escape") { closeBlogSuggestions(); input.blur(); }
  });

  input.addEventListener("focus", () => {
    showBlogSuggestions(input.value.trim());
  });

  document.addEventListener("click", (e) => {
    if (!$b("blogSearchSection")?.contains(e.target)) closeBlogSuggestions();
  });
}

function wireSortEvent() {
  const sel = $b("blogSortSelect");
  if (sel) sel.addEventListener("change", () => {
    BlogState.sort = sel.value;
    BlogState.page = 1;
    loadBlogPosts();
  });
}

/* ── Suggestions ────────────────────────────────────────── */
async function showBlogSuggestions(q) {
  const drop = $b("blogSuggestions");
  if (!drop) return;

  const items = [];

  if (!q) {
    // Show recent searches
    if (BlogState.searchHistory.length > 0) {
      items.push(`<div class="blog-sug-label">সাম্প্রতিক অনুসন্ধান</div>`);
      BlogState.searchHistory.slice(0, 5).forEach(h => {
        items.push(`<div class="blog-sug-item" onclick="selectSuggestion('${blogEsc(h)}')">
          <i class="fas fa-history"></i> ${blogEsc(h)}
        </div>`);
      });
    }

    // Show categories as suggestions
    if (BlogState.categories.length > 0) {
      items.push(`<div class="blog-sug-label">ক্যাটাগরি</div>`);
      BlogState.categories.slice(0, 4).forEach(c => {
        items.push(`<div class="blog-sug-item" onclick="filterBlogByCategory('${blogEsc(c.name)}'); closeBlogSuggestions();">
          <i class="fas fa-tag"></i> ${blogEsc(c.name)} <span style="margin-left:auto;font-size:0.68rem;color:var(--text-light);">${bengaliNum(c.count)}</span>
        </div>`);
      });
    }
  } else {
    // Live search in loaded posts
    const lq = q.toLowerCase();
    const matched = BlogState.posts.filter(p =>
      (p.title || "").toLowerCase().includes(lq) ||
      (p.category || "").toLowerCase().includes(lq) ||
      (p.excerpt || "").toLowerCase().includes(lq) ||
      (p.tags || []).some(t => t.toLowerCase().includes(lq))
    ).slice(0, 6);

    if (matched.length > 0) {
      items.push(`<div class="blog-sug-label">পোস্ট</div>`);
      matched.forEach(p => {
        const hi = (p.title || "").replace(new RegExp(`(${q})`, "gi"), "<mark>$1</mark>");
        items.push(`<div class="blog-sug-item" onclick="openBlogDetail('${String(p._id)}')">
          <i class="fas fa-file-alt"></i> <span>${hi}</span>
        </div>`);
      });
    }

    // Match categories
    const matchedCats = BlogState.categories.filter(c => c.name.toLowerCase().includes(lq)).slice(0, 3);
    if (matchedCats.length > 0) {
      items.push(`<div class="blog-sug-label">ক্যাটাগরি</div>`);
      matchedCats.forEach(c => {
        items.push(`<div class="blog-sug-item" onclick="filterBlogByCategory('${blogEsc(c.name)}'); closeBlogSuggestions();">
          <i class="fas fa-tag"></i> ${blogEsc(c.name)}
        </div>`);
      });
    }

    if (items.length === 0) {
      items.push(`<div class="blog-sug-item" style="color:var(--text-muted);cursor:default;">
        <i class="fas fa-search"></i> "<strong>${blogEsc(q)}</strong>" খুঁজুন
      </div>`);
    }
  }

  if (items.length > 0) {
    drop.innerHTML = items.join("");
    drop.classList.add("open");
  } else {
    closeBlogSuggestions();
  }
}

function closeBlogSuggestions() {
  const drop = $b("blogSuggestions");
  if (drop) drop.classList.remove("open");
}

function selectSuggestion(q) {
  const input = $b("blogSearchInput");
  if (input) input.value = q;
  closeBlogSuggestions();
  BlogState.search = q;
  BlogState.page = 1;
  loadBlogPosts();
}

function triggerBlogSearch() {
  const input = $b("blogSearchInput");
  const q = input?.value.trim() || "";
  closeBlogSuggestions();
  saveSearchHistory(q);
  BlogState.search = q;
  BlogState.page = 1;
  loadBlogPosts();
  updateSearchInfo(q);
}

function clearBlogSearch() {
  const input = $b("blogSearchInput");
  if (input) input.value = "";
  const clearBtn = $b("blogSearchClear");
  if (clearBtn) clearBtn.classList.remove("show");
  closeBlogSuggestions();
  BlogState.search = "";
  BlogState.activeTag = "";
  BlogState.page = 1;
  updateSearchInfo("");
  loadBlogPosts();
}

function updateSearchInfo(q) {
  const info = $b("blogSearchInfo");
  const text = $b("blogSearchInfoText");
  if (!info || !text) return;
  if (q) {
    text.textContent = `"${q}" খোঁজার ফলাফল দেখাচ্ছে`;
    info.classList.add("show");
  } else {
    info.classList.remove("show");
  }
}

function setBlogFilter(filter, btn) {
  document.querySelectorAll(".blog-filter-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const sortMap = { all: "newest", popular: "popular", trending: "trending", recent: "newest" };
  BlogState.sort = sortMap[filter] || "newest";
  const sel = $b("blogSortSelect");
  if (sel) sel.value = BlogState.sort;
  BlogState.page = 1;
  loadBlogPosts();
}

/* ── Categories ─────────────────────────────────────────── */
async function loadBlogCategories() {
  try {
    const data = await blogFetch(`${BLOG_API}/meta/categories`);
    BlogState.categories = data.data || [];
    renderCategoryPills();
  } catch(e) { console.warn("Blog categories:", e.message); }
}

function renderCategoryPills() {
  const container = $b("blogCatPills");
  if (!container) return;

  const pills = BlogState.categories.slice(0, 12).map(cat => `
    <button class="blog-cat-pill" data-cat="${blogEsc(cat.name)}" onclick="filterBlogByCategory('${blogEsc(cat.name)}')">
      <i class="fas fa-tag"></i> ${blogEsc(cat.name)}
      <span class="pill-count">${bengaliNum(cat.count)}</span>
    </button>`).join("");

  container.innerHTML = `
    <button class="blog-cat-pill ${!BlogState.activeCategory ? "active" : ""}" data-cat="" onclick="filterBlogByCategory('')">
      <i class="fas fa-border-all"></i> সব
    </button>${pills}`;
}

function filterBlogByCategory(cat) {
  BlogState.activeCategory = cat;
  BlogState.page = 1;
  document.querySelectorAll(".blog-cat-pill").forEach(p => p.classList.toggle("active", p.dataset.cat === cat));
  loadBlogPosts();
}

/* ── Load posts ─────────────────────────────────────────── */
async function loadBlogPosts() {
  if (BlogState.loading) return;
  BlogState.loading = true;
  const grid = $b("blogGrid");
  if (grid) grid.innerHTML = blogSkeletons(6);
  const featuredWrap = $b("blogFeaturedWrap");

  try {
    const params = new URLSearchParams({ page: BlogState.page, limit: 9, sort: BlogState.sort });
    if (BlogState.activeCategory) params.set("category", BlogState.activeCategory);
    if (BlogState.activeTag) params.set("tag", BlogState.activeTag);
    if (BlogState.search) params.set("search", BlogState.search);

    const data = await blogFetch(`${BLOG_API}?${params}`);
    const posts = data.data || [];
    BlogState.posts = posts;
    BlogState.totalPages = data.pagination?.pages || 1;

    if (featuredWrap) {
      const showFeatured = !BlogState.search && !BlogState.activeCategory && !BlogState.activeTag && BlogState.page === 1;
      const featured = showFeatured ? (posts.find(p => p.isFeatured) || posts[0]) : null;
      featuredWrap.innerHTML = featured ? renderFeaturedCard(featured) : "";
    }

    const featuredId = featuredWrap?.querySelector("[data-post-id]")?.dataset.postId;
    const gridPosts = posts.filter(p => String(p._id) !== String(featuredId));

    if (grid) {
      grid.innerHTML = gridPosts.length === 0 && !featuredId
        ? `<div class="blog-empty"><div class="blog-empty-icon">📝</div><h3>কোনো পোস্ট নেই</h3><p>এখনো কোনো পোস্ট প্রকাশিত হয়নি।</p></div>`
        : gridPosts.length === 0
        ? `<div class="blog-empty" style="grid-column:1/-1"><div class="blog-empty-icon">🔍</div><h3>ফলাফল পাওয়া যায়নি</h3><p>অনুসন্ধান পরিবর্তন করে আবার চেষ্টা করুন।</p></div>`
        : gridPosts.map(renderBlogCard).join("");
    }

    renderBlogPagination();
  } catch(e) {
    console.error("Blog load:", e);
    if (grid) grid.innerHTML = `<div class="blog-empty" style="grid-column:1/-1"><div class="blog-empty-icon">⚠️</div><h3>লোড করতে সমস্যা</h3><p>সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।</p></div>`;
  } finally {
    BlogState.loading = false;
  }
}

/* ── Featured card ──────────────────────────────────────── */
function renderFeaturedCard(post) {
  const id = String(post._id);
  const imgUrl = post.coverImage?.url || "";
  const title = post.title || "";
  const excerpt = post.excerpt || stripHtml(post.body || "").slice(0, 200);
  const cat = post.category || "সাধারণ";
  const views = post.views || 0, likes = post.likes || 0;
  const readTime = post.readingTime || "৫";

  return `
    <div class="blog-featured-card" data-post-id="${id}" onclick="openBlogDetail('${id}')">
      <div class="blog-featured-img">
        ${imgUrl ? `<img src="${blogEsc(imgUrl)}" alt="${blogEsc(title)}" loading="lazy">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:5rem;background:linear-gradient(135deg,rgba(245,166,35,0.12),rgba(13,27,62,0.07));">🍯</div>`}
        <div class="blog-featured-img-overlay"></div>
        <div class="blog-featured-badge"><i class="fas fa-star"></i> ফিচার্ড</div>
      </div>
      <div class="blog-featured-body">
        <div class="blog-featured-cat"><i class="fas fa-tag"></i> ${blogEsc(cat)}</div>
        <h2 class="blog-featured-title">${blogEsc(title)}</h2>
        <p class="blog-featured-excerpt">${blogEsc(excerpt)}</p>
        <div class="blog-featured-meta">
          <span><i class="fas fa-user"></i> ${blogEsc(post.author?.name || "BeeHarvest")}</span>
          <span><i class="fas fa-clock"></i> ${bengaliNum(readTime)} মিনিট</span>
          <span><i class="fas fa-eye"></i> ${bengaliNum(views)}</span>
          <span><i class="fas fa-heart"></i> ${bengaliNum(likes)}</span>
        </div>
        <button class="blog-read-btn" onclick="event.stopPropagation(); openBlogDetail('${id}')">
          <i class="fas fa-book-open"></i> পড়তে থাকুন <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>`;
}

/* ── Blog card ──────────────────────────────────────────── */
function renderBlogCard(post) {
  const id = String(post._id);
  const imgUrl = post.coverImage?.url || "";
  const title = post.title || "";
  const excerpt = post.excerpt || stripHtml(post.body || "").slice(0, 140);
  const cat = post.category || "সাধারণ";
  const authorName = post.author?.name || "BeeHarvest";
  const authorAvatar = post.author?.avatar || "";
  const views = post.views || 0, likes = post.likes || 0;
  const readTime = post.readingTime || 5;
  const commentCount = post.commentCount || 0;
  const publishedAt = post.publishedAt || post.createdAt;

  return `
    <div class="blog-card" data-post-id="${id}" onclick="openBlogDetail('${id}')">
      <div class="blog-card-img-wrap">
        ${imgUrl
          ? `<img class="blog-card-img" src="${blogEsc(imgUrl)}" alt="${blogEsc(title)}" loading="lazy"
               onerror="this.style.display='none';this.parentNode.querySelector('.blog-card-no-img').style.display='flex';">
             <div class="blog-card-no-img" style="display:none;">🍯</div>`
          : `<div class="blog-card-no-img">🍯</div>`}
        <div class="blog-card-cat-badge"><i class="fas fa-tag"></i> ${blogEsc(cat)}</div>
        <div class="blog-card-read-time"><i class="fas fa-clock"></i> ${bengaliNum(readTime)}মি</div>
      </div>
      <div class="blog-card-body">
        <h3 class="blog-card-title">${blogEsc(title)}</h3>
        <p class="blog-card-excerpt">${blogEsc(excerpt)}</p>
        <div class="blog-card-footer">
          <div class="blog-card-author">
            <div class="blog-card-avatar">
              ${authorAvatar ? `<img src="${blogEsc(authorAvatar)}" alt="${blogEsc(authorName)}" onerror="this.style.display='none'">` : authorInitials(authorName)}
            </div>
            <div>
              <div class="blog-card-author-name">${blogEsc(authorName)}</div>
              <div class="blog-card-date">${blogDateShort(publishedAt)}</div>
            </div>
          </div>
          <div class="blog-card-stats">
            <span class="blog-stat-chip views"><i class="fas fa-eye"></i> ${bengaliNum(views)}</span>
            <span class="blog-stat-chip likes"><i class="fas fa-heart"></i> ${bengaliNum(likes)}</span>
            ${commentCount > 0 ? `<span class="blog-stat-chip"><i class="fas fa-comment"></i> ${bengaliNum(commentCount)}</span>` : ""}
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Pagination ─────────────────────────────────────────── */
function renderBlogPagination() {
  const el = $b("blogPagination");
  if (!el) return;
  const { page, totalPages } = BlogState;
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  const btns = [];
  btns.push(`<button onclick="goBlogPage(${page-1})" ${page===1?"disabled":""}><i class="fas fa-chevron-left"></i></button>`);

  const start = Math.max(1, page - 2), end = Math.min(totalPages, page + 2);
  if (start > 1) btns.push(`<button onclick="goBlogPage(1)">১</button>`);
  if (start > 2) btns.push(`<button disabled>…</button>`);
  for (let i = start; i <= end; i++) btns.push(`<button onclick="goBlogPage(${i})" class="${i===page?"active":""}">${bengaliNum(i)}</button>`);
  if (end < totalPages - 1) btns.push(`<button disabled>…</button>`);
  if (end < totalPages) btns.push(`<button onclick="goBlogPage(${totalPages})">${bengaliNum(totalPages)}</button>`);
  btns.push(`<button onclick="goBlogPage(${page+1})" ${page===totalPages?"disabled":""}><i class="fas fa-chevron-right"></i></button>`);

  el.innerHTML = btns.join("");
}

function goBlogPage(n) {
  if (n < 1 || n > BlogState.totalPages) return;
  BlogState.page = n;
  loadBlogPosts();
  $b("blogsPage")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ═══════════════════════════════════════════════════════════
   BLOG DETAIL — Full page (no modal)
═══════════════════════════════════════════════════════════ */
async function openBlogDetail(id) {
  const listView = $b("blogListView");
  const detailView = $b("blogDetailView");
  if (!listView || !detailView) return;

  // Switch to detail view
  BlogState.view = "detail";
  listView.style.display = "none";
  detailView.classList.add("active");

  // Show loading
  detailView.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:5rem 2rem;flex-direction:column;gap:1rem;">
      <div style="width:44px;height:44px;border:3px solid var(--border);border-top-color:var(--honey);border-radius:50%;animation:spin 0.7s linear infinite;"></div>
      <p style="color:var(--text-muted);font-size:0.875rem;">লোড হচ্ছে...</p>
    </div>`;

  window.scrollTo({ top: 0, behavior: "smooth" });

  try {
    const data = await blogFetch(`${BLOG_API}/${id}`);
    const post = data.data;
    BlogState.currentPost = post;
    renderBlogDetailPage(post, detailView);
    startReadingProgress();
  } catch(e) {
    detailView.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
        <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin-bottom:0.5rem;">লোড করা যায়নি</h3>
        <p style="color:var(--text-muted);margin-bottom:1.5rem;">${e.message}</p>
        <button onclick="closeBlogDetail()" style="background:var(--navy);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;">ফিরে যান</button>
      </div>`;
  }
}

function closeBlogDetail() {
  const listView = $b("blogListView");
  const detailView = $b("blogDetailView");
  if (!listView || !detailView) return;

  BlogState.view = "list";
  BlogState.currentPost = null;

  detailView.classList.remove("active");
  detailView.innerHTML = "";
  listView.style.display = "";

  stopReadingProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── Render detail page ─────────────────────────────────── */
function renderBlogDetailPage(post, container) {
  const id = String(post._id);
  const imgUrl = post.coverImage?.url || "";
  const title = post.title || "";
  const body = post.body || "";
  const cat = post.category || "সাধারণ";
  const authorName = post.author?.name || "BeeHarvest";
  const authorBio = post.author?.bio || "";
  const authorAvatar = post.author?.avatar || "";
  const views = post.views || 0, likes = post.likes || 0;
  const readTime = post.readingTime || 5;
  const tags = post.tags || [];
  const comments = (post.comments || []).filter(c => c.isApproved);
  const relatedProducts = post.relatedProducts || [];
  const publishedAt = post.publishedAt || post.createdAt;
  const isLiked = BlogState.likedPosts.includes(id);

  // Build TOC from body headings
  const tocItems = [];
  const headingMatches = [...body.matchAll(/<h([23])[^>]*>(.*?)<\/h[23]>/gi)];
  headingMatches.forEach((m, i) => {
    tocItems.push({ level: m[1], text: stripHtml(m[2]), id: `bh-h-${i}` });
  });

  // Inject IDs into headings for TOC scrolling
  let processedBody = body;
  headingMatches.forEach((m, i) => {
    processedBody = processedBody.replace(m[0], m[0].replace(/<h([23])/, `<h$1 id="bh-h-${i}"`));
  });

  container.innerHTML = `
    <!-- Back bar -->
    <div class="blog-back-bar">
      <button class="blog-back-btn" onclick="closeBlogDetail()">
        <i class="fas fa-arrow-left"></i> ব্লগে ফিরুন
      </button>
      <div class="blog-back-breadcrumb">
        <span onclick="closeBlogDetail()">ব্লগ</span>
        <i class="fas fa-chevron-right"></i>
        <span style="color:var(--text-primary);font-weight:500;">${blogEsc(title.slice(0, 38))}${title.length > 38 ? "…" : ""}</span>
      </div>
    </div>

    <!-- Hero -->
    ${imgUrl
      ? `<div class="blog-article-hero">
           <img src="${blogEsc(imgUrl)}" alt="${blogEsc(title)}" onerror="this.style.display='none'">
           <div class="blog-article-hero-overlay"></div>
           <div class="blog-article-hero-content">
             <div class="blog-article-cat-badge"><i class="fas fa-tag"></i> ${blogEsc(cat)}</div>
             <h1 class="blog-article-title">${blogEsc(title)}</h1>
           </div>
         </div>`
      : `<div class="blog-article-no-hero">🍯</div>
         <div style="margin-top:1rem;">
           <div class="blog-article-cat-badge" style="background:var(--honey);color:var(--navy);display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:50px;font-size:0.7rem;font-weight:800;text-transform:uppercase;"><i class="fas fa-tag"></i> ${blogEsc(cat)}</div>
           <h1 style="font-family:'DM Serif Display',serif;font-size:2rem;color:var(--navy);margin-top:0.75rem;line-height:1.25;">${blogEsc(title)}</h1>
         </div>`}

    <!-- Two-column layout -->
    <div class="blog-article-layout" style="margin-top:${imgUrl ? "0" : "1.5rem"};">

      <!-- Main content -->
      <div>
        <div class="blog-article-main" style="${imgUrl ? "" : "border-radius:16px;border-top:1.5px solid var(--border);"}">
          <!-- Meta strip -->
          <div class="blog-article-meta">
            <div class="blog-article-author">
              <div class="blog-article-avatar">
                ${authorAvatar
                  ? `<img src="${blogEsc(authorAvatar)}" alt="${blogEsc(authorName)}" onerror="this.style.display='none';this.parentNode.textContent='${authorInitials(authorName)}';">`
                  : authorInitials(authorName)}
              </div>
              <div>
                <div class="blog-article-author-name">${blogEsc(authorName)}</div>
                <div class="blog-article-author-bio">${authorBio ? blogEsc(authorBio.slice(0,60)) + (authorBio.length > 60 ? "…" : "") : blogDate(publishedAt)}</div>
              </div>
            </div>
            <div class="blog-article-stats">
              <span><i class="fas fa-clock"></i> ${bengaliNum(readTime)} মিনিট</span>
              <span><i class="fas fa-eye"></i> <span class="blog-article-views">${bengaliNum(views)}</span></span>
              <span><i class="fas fa-heart"></i> ${bengaliNum(likes)}</span>
              <span><i class="fas fa-comment"></i> ${bengaliNum(comments.length)}</span>
            </div>
          </div>

          ${tags.length > 0 ? `<div class="blog-article-tags">${tags.map(t => `<span class="blog-tag" onclick="filterBlogByTag('${blogEsc(t)}');">#${blogEsc(t)}</span>`).join("")}</div>` : ""}

          <!-- Article body -->
          <div class="blog-article-body" id="blogArticleBody">
            ${processedBody || "<p>কোনো বিষয়বস্তু নেই।</p>"}
          </div>

          <!-- Actions -->
          <div class="blog-article-actions">
            <button class="blog-like-btn ${isLiked ? "liked" : ""}" id="blogLikeBtn" onclick="likeBlogPost('${id}')">
              <i class="${isLiked ? "fas" : "far"} fa-heart"></i>
              <span id="blogLikeCount">${bengaliNum(likes)}</span> পছন্দ
            </button>
            <div class="blog-share-row">
              <span>শেয়ার:</span>
              <button class="blog-share-btn" onclick="shareBlogPost('${id}','facebook')" title="Facebook"><i class="fab fa-facebook-f"></i></button>
              <button class="blog-share-btn" onclick="shareBlogPost('${id}','whatsapp')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
              <button class="blog-share-btn" onclick="copyBlogLink('${id}')" title="লিংক কপি"><i class="fas fa-link"></i></button>
            </div>
          </div>
        </div>

        <!-- Comments -->
        <div class="blog-comments-section">
          <div class="blog-comments-header">
            <div class="blog-comments-title">
              <i class="fas fa-comments"></i> মন্তব্য
              <span class="blog-comments-count-badge" id="blogCommentCount">${bengaliNum(comments.length)}</span>
            </div>
          </div>
          <div class="blog-comment-form">
            <div class="blog-comment-form-grid">
              <input type="text" id="commentName" placeholder="আপনার নাম *" maxlength="80">
              <input type="email" id="commentEmail" placeholder="ইমেইল *" maxlength="100">
            </div>
            <textarea id="commentBody" placeholder="আপনার মতামত লিখুন..." maxlength="1000" oninput="updateCommentChar(this)"></textarea>
            <div class="blog-comment-form-footer">
              <span class="blog-comment-char" id="commentChar">০/১০০০</span>
              <button class="blog-comment-submit" id="commentSubmitBtn" onclick="submitBlogComment('${id}')">
                <i class="fas fa-paper-plane"></i> মন্তব্য পাঠান
              </button>
            </div>
          </div>
          <div class="blog-comments-list" id="blogCommentsList">
            ${comments.length === 0
              ? `<div class="blog-no-comments"><i class="fas fa-comment-slash"></i> প্রথম মন্তব্য করুন!</div>`
              : comments.map(renderComment).join("")}
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="blog-article-sidebar">

        ${tocItems.length > 0 ? `
          <div class="blog-sidebar-card">
            <div class="blog-sidebar-title"><i class="fas fa-list-ul"></i> বিষয়সূচি</div>
            <div class="blog-toc-list" id="blogTocList">
              ${tocItems.map(t => `<a class="blog-toc-item ${t.level === "3" ? "h3" : ""}" onclick="scrollToHeading('${t.id}')">${blogEsc(t.text)}</a>`).join("")}
            </div>
          </div>` : ""}

        ${relatedProducts.length > 0 ? `
          <div class="blog-sidebar-card">
            <div class="blog-sidebar-title"><i class="fas fa-shopping-bag"></i> সম্পর্কিত পণ্য</div>
            <div class="blog-sidebar-products">
              ${relatedProducts.map(p => `
                <div class="blog-rel-product" onclick="closeBlogDetail(); viewProduct('${String(p._id)}')">
                  <img class="blog-rel-product-img" src="${blogEsc(p.images?.[0]?.url || "https://via.placeholder.com/52")}" alt="${blogEsc(p.name||"পণ্য")}" onerror="this.src='https://via.placeholder.com/52'">
                  <div class="blog-rel-product-info">
                    <div class="blog-rel-product-name">${blogEsc(p.name||"")}</div>
                    <div class="blog-rel-product-price">৳${(p.price||0).toLocaleString()}</div>
                  </div>
                </div>`).join("")}
            </div>
          </div>` : ""}

        <!-- Author card -->
        <div class="blog-sidebar-card">
          <div class="blog-sidebar-title"><i class="fas fa-user-pen"></i> লেখক</div>
          <div style="padding:1rem;display:flex;flex-direction:column;align-items:center;text-align:center;gap:0.625rem;">
            <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--honey),var(--honey-dark));display:flex;align-items:center;justify-content:center;color:white;font-size:1.1rem;font-weight:700;overflow:hidden;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.12);">
              ${authorAvatar ? `<img src="${blogEsc(authorAvatar)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : authorInitials(authorName)}
            </div>
            <div>
              <div style="font-weight:700;color:var(--navy);font-size:0.88rem;">${blogEsc(authorName)}</div>
              ${authorBio ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;line-height:1.5;">${blogEsc(authorBio.slice(0,100))}${authorBio.length>100?"…":""}</div>` : ""}
            </div>
          </div>
        </div>

      </div>
    </div>`;

  // Wire TOC active state
  setTimeout(() => { setupTOCObserver(); }, 400);
}

function scrollToHeading(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupTOCObserver() {
  const headings = document.querySelectorAll(".blog-article-body h2, .blog-article-body h3");
  if (!headings.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll(".blog-toc-item").forEach(a => a.classList.remove("active"));
        const tocItem = document.querySelector(`.blog-toc-item[onclick="scrollToHeading('${entry.target.id}')"]`);
        if (tocItem) tocItem.classList.add("active");
      }
    });
  }, { rootMargin: "-80px 0px -70% 0px" });
  headings.forEach(h => observer.observe(h));
}

function renderComment(c) {
  return `
    <div class="blog-comment-item">
      <div class="blog-comment-author-row">
        <div class="blog-comment-avatar">${authorInitials(c.author || "?")}</div>
        <div>
          <div class="blog-comment-author-name">${blogEsc(c.author || "বেনামী")}</div>
          <div class="blog-comment-date">${blogDate(c.approvedAt || c.createdAt)}</div>
        </div>
      </div>
      <div class="blog-comment-body">${blogEsc(c.body || "")}</div>
    </div>`;
}

function updateCommentChar(el) {
  const charEl = $b("commentChar");
  if (charEl) charEl.textContent = `${bengaliNum(el.value.length)}/১০০০`;
}

/* ── Reading progress bar ───────────────────────────────── */
let _scrollHandler = null;

function startReadingProgress() {
  const bar = $b("blogReadingProgress");
  const fill = $b("blogReadingFill");
  if (!bar || !fill) return;

  bar.classList.add("active");

  _scrollHandler = () => {
    const body = $b("blogArticleBody");
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const total = body.offsetHeight;
    const scrolled = Math.max(0, -rect.top);
    const pct = Math.min(100, (scrolled / total) * 100);
    fill.style.width = pct + "%";
  };

  window.addEventListener("scroll", _scrollHandler, { passive: true });
}

function stopReadingProgress() {
  const bar = $b("blogReadingProgress");
  if (bar) bar.classList.remove("active");
  if (_scrollHandler) { window.removeEventListener("scroll", _scrollHandler); _scrollHandler = null; }
}

/* ── Like ───────────────────────────────────────────────── */
async function likeBlogPost(id) {
  const btn = $b("blogLikeBtn");
  const countEl = $b("blogLikeCount");
  if (!btn || !countEl) return;

  const wasLiked = BlogState.likedPosts.includes(id);
  if (wasLiked) {
    BlogState.likedPosts = BlogState.likedPosts.filter(i => i !== id);
    localStorage.setItem("bh_liked_blogs", JSON.stringify(BlogState.likedPosts));
    btn.classList.remove("liked");
    const icon = btn.querySelector("i");
    if (icon) icon.className = "far fa-heart";
    return;
  }

  btn.disabled = true;
  try {
    const data = await blogFetch(`${BLOG_API}/${id}/like`, { method: "POST" });
    countEl.textContent = bengaliNum(data.data?.likes || 0);
    btn.classList.add("liked");
    const icon = btn.querySelector("i");
    if (icon) { icon.className = "fas fa-heart"; icon.style.transform = "scale(1.45)"; setTimeout(() => icon.style.transform = "", 300); }
    BlogState.likedPosts.push(id);
    localStorage.setItem("bh_liked_blogs", JSON.stringify(BlogState.likedPosts));
    if (typeof showToast === "function") showToast("পোস্টটি পছন্দ করা হয়েছে! ❤️", "success");
  } catch(e) {
    if (typeof showToast === "function") showToast("পছন্দ করতে সমস্যা হয়েছে", "error");
  } finally {
    btn.disabled = false;
  }
}

/* ── Comment submit ─────────────────────────────────────── */
async function submitBlogComment(postId) {
  const nameEl = $b("commentName");
  const emailEl = $b("commentEmail");
  const bodyEl = $b("commentBody");
  const btn = $b("commentSubmitBtn");

  const author = nameEl?.value.trim();
  const email = emailEl?.value.trim();
  const body = bodyEl?.value.trim();

  if (!author || !email || !body) {
    if (typeof showToast === "function") showToast("সব তথ্য পূরণ করুন", "error");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (typeof showToast === "function") showToast("সঠিক ইমেইল দিন", "error");
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; }

  try {
    await blogFetch(`${BLOG_API}/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ author, email, body }),
    });
    if (typeof showToast === "function") showToast("মন্তব্য পাঠানো হয়েছে! অনুমোদনের পরে দেখাবে।", "success");
    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (bodyEl) bodyEl.value = "";
    const charEl = $b("commentChar");
    if (charEl) charEl.textContent = "০/১০০০";
  } catch(e) {
    if (typeof showToast === "function") showToast("সমস্যা: " + e.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> মন্তব্য পাঠান'; }
  }
}

/* ── Share — real production URL ────────────────────────── */
function shareBlogPost(id, platform) {
  const url = `${BLOG_SITE_URL}?blog=${id}`;
  const text = "BeeHarvest ব্লগে এই দুর্দান্ত লেখাটি পড়ুন!";
  let shareUrl = "";
  if (platform === "facebook") shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  else if (platform === "whatsapp") shareUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
  if (shareUrl) window.open(shareUrl, "_blank", "width=600,height=400");
}

async function copyBlogLink(id) {
  const url = `${BLOG_SITE_URL}?blog=${id}`;
  try {
    await navigator.clipboard.writeText(url);
    if (typeof showToast === "function") showToast("লিংক কপি হয়েছে! 📋", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy");
    document.body.removeChild(ta);
    if (typeof showToast === "function") showToast("লিংক কপি হয়েছে! 📋", "success");
  }
}

/* ── Filter by tag ──────────────────────────────────────── */
function filterBlogByTag(tag) {
  BlogState.activeTag = tag;
  BlogState.activeCategory = "";
  BlogState.page = 1;
  closeBlogDetail();
  if (typeof navigateTo === "function") navigateTo("blogs");
  loadBlogPosts();
}

/* ── URL param auto-open ────────────────────────────────── */
(function checkBlogUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const blogId = params.get("blog");
  if (blogId) {
    window.history.replaceState({}, "", window.location.pathname);
    setTimeout(() => {
      if (typeof navigateTo === "function") navigateTo("blogs");
      setTimeout(() => openBlogDetail(blogId), 500);
    }, 700);
  }
})();

/* ── Expose globals ─────────────────────────────────────── */
window.initBlogPage        = initBlogPage;
window.openBlogDetail      = openBlogDetail;
window.closeBlogDetail     = closeBlogDetail;
window.likeBlogPost        = likeBlogPost;
window.submitBlogComment   = submitBlogComment;
window.filterBlogByCategory = filterBlogByCategory;
window.filterBlogByTag     = filterBlogByTag;
window.goBlogPage          = goBlogPage;
window.shareBlogPost       = shareBlogPost;
window.copyBlogLink        = copyBlogLink;
window.updateCommentChar   = updateCommentChar;
window.clearBlogSearch     = clearBlogSearch;
window.triggerBlogSearch   = triggerBlogSearch;
window.setBlogFilter       = setBlogFilter;
window.selectSuggestion    = selectSuggestion;
window.scrollToHeading     = scrollToHeading;
window.stopBlogRealtime    = stopBlogRealtime;
