/* ═══════════════════════════════════════════════════════════
   BeeHarvest — blog.js
   Real-time Blog System for Customer Panel
   ═══════════════════════════════════════════════════════════ */

   const BLOG_API = "https://beeyond-harvest-admin.onrender.com/api/blogs";

   /* ── State ─────────────────────────────────────────────────── */
   const BlogState = {
     posts: [],
     currentPost: null,
     categories: [],
     tags: [],
     page: 1,
     totalPages: 1,
     activeCategory: "",
     activeTag: "",
     searchQuery: "",
     sortBy: "newest",
     loading: false,
     viewMode: "grid", // grid | list
     likedPosts: JSON.parse(localStorage.getItem("bh_liked_posts") || "[]"),
     readPosts: JSON.parse(localStorage.getItem("bh_read_posts") || "[]"),
   };
   
   /* ════════════════════════════════════════════════════════════
      INIT
   ════════════════════════════════════════════════════════════ */
   window.initBlogPage = async function () {
     renderBlogShell();
     await Promise.all([fetchBlogMeta(), fetchBlogs(1)]);
     initBlogSearch();
     initBlogIntersectionObserver();
   };
   
   /* ════════════════════════════════════════════════════════════
      SHELL RENDER
   ════════════════════════════════════════════════════════════ */
   function renderBlogShell() {
     const page = document.getElementById("blogsPage");
     if (!page) return;
   
     page.innerHTML = `
       <!-- ── BLOG HERO ──────────────────────────────────────── -->
       <div class="blog-hero">
         <div class="blog-hero-bg"></div>
         <div class="blog-hero-orbs">
           <span class="bh-orb bh-orb-1"></span>
           <span class="bh-orb bh-orb-2"></span>
           <span class="bh-orb bh-orb-3"></span>
         </div>
         <div class="blog-hero-content">
           <div class="blog-hero-eyebrow">
             <span class="blog-eyebrow-dot"></span>
             জ্ঞান · স্বাস্থ্য · জীবনধারা
           </div>
           <h1 class="blog-hero-title">
             BeeHarvest <em>ব্লগ</em>
           </h1>
           <p class="blog-hero-sub">
             প্রকৃতির সেরা উপহার থেকে শুরু করে সুস্বাস্থ্যের রহস্য — সব কিছু জানুন একসাথে।
           </p>
           <!-- Search bar -->
           <div class="blog-search-bar" id="blogSearchBar">
             <i class="fas fa-search"></i>
             <input
               type="text"
               id="blogSearchInput"
               placeholder="ব্লগ খুঁজুন..."
               autocomplete="off"
               spellcheck="false"
             />
             <button class="blog-search-clear" id="blogSearchClear" style="display:none">
               <i class="fas fa-times"></i>
             </button>
             <div class="blog-search-shortcut">⌘K</div>
           </div>
           <!-- Stats -->
           <div class="blog-hero-stats">
             <div class="bhs-item">
               <span class="bhs-num" id="blogStatPosts">—</span>
               <span class="bhs-label">পোস্ট</span>
             </div>
             <div class="bhs-sep"></div>
             <div class="bhs-item">
               <span class="bhs-num" id="blogStatCats">—</span>
               <span class="bhs-label">ক্যাটাগরি</span>
             </div>
             <div class="bhs-sep"></div>
             <div class="bhs-item">
               <span class="bhs-num" id="blogStatTags">—</span>
               <span class="bhs-label">ট্যাগ</span>
             </div>
           </div>
         </div>
       </div>
   
       <!-- ── FILTERS BAR ─────────────────────────────────────── -->
       <div class="blog-filters-bar" id="blogFiltersBar">
         <div class="blog-filter-cats" id="blogFilterCats">
           <button class="blog-cat-chip active" onclick="filterBlogByCategory('')">সব</button>
         </div>
         <div class="blog-filter-controls">
           <div class="blog-sort-select">
             <select id="blogSortSelect" onchange="onBlogSortChange(this.value)">
               <option value="newest">সর্বশেষ</option>
               <option value="oldest">পুরনো</option>
               <option value="popular">জনপ্রিয়</option>
               <option value="trending">ট্রেন্ডিং</option>
             </select>
             <i class="fas fa-chevron-down"></i>
           </div>
           <div class="blog-view-toggle">
             <button class="bvt-btn active" id="bvt-grid" onclick="setBlogView('grid')" title="গ্রিড">
               <i class="fas fa-grid-2"></i>
             </button>
             <button class="bvt-btn" id="bvt-list" onclick="setBlogView('list')" title="লিস্ট">
               <i class="fas fa-list"></i>
             </button>
           </div>
         </div>
       </div>
   
       <!-- ── TAG CLOUD ──────────────────────────────────────── -->
       <div class="blog-tag-cloud" id="blogTagCloud"></div>
   
       <!-- ── MAIN CONTENT AREA ──────────────────────────────── -->
       <div class="blog-layout">
         <!-- Posts grid -->
         <div class="blog-posts-area">
           <div class="blog-posts-header" id="blogPostsHeader">
             <span class="bph-count" id="blogPostsCount"></span>
             <div class="bph-active-filters" id="blogActiveFilters"></div>
           </div>
           <div class="blog-grid" id="blogGrid"></div>
           <!-- Load more -->
           <div class="blog-load-more-area" id="blogLoadMore" style="display:none">
             <button class="blog-load-more-btn" onclick="loadMoreBlogs()">
               <i class="fas fa-arrow-down"></i>
               আরও পোস্ট দেখুন
             </button>
           </div>
         </div>
         <!-- Sidebar -->
         <aside class="blog-sidebar" id="blogSidebar">
           <div class="blog-sidebar-section">
             <div class="bss-title"><i class="fas fa-fire"></i> ট্রেন্ডিং পোস্ট</div>
             <div id="blogTrending" class="blog-trending-list">
               ${skeletonTrending(3)}
             </div>
           </div>
           <div class="blog-sidebar-section">
             <div class="bss-title"><i class="fas fa-tags"></i> জনপ্রিয় ট্যাগ</div>
             <div class="blog-sidebar-tags" id="blogSidebarTags"></div>
           </div>
           <div class="blog-sidebar-cta">
             <div class="bsc-icon">🐝</div>
             <div class="bsc-title">নিউজলেটার</div>
             <div class="bsc-sub">সেরা আর্টিকেল সরাসরি আপনার ইনবক্সে পান।</div>
             <div class="bsc-input-row">
               <input type="email" id="blogNewsletterEmail" placeholder="আপনার ইমেইল..."/>
               <button onclick="subscribeNewsletter()">সাবস্ক্রাইব</button>
             </div>
           </div>
         </aside>
       </div>
   
       <!-- ── SINGLE POST VIEW (overlay) ─────────────────────── -->
       <div class="blog-post-overlay" id="blogPostOverlay">
         <div class="bpo-inner">
           <div class="bpo-top-bar">
             <button class="bpo-back" onclick="closeBlogPost()">
               <i class="fas fa-arrow-left"></i>
               <span>ব্লগে ফিরুন</span>
             </button>
             <div class="bpo-top-actions">
               <button class="bpo-action-btn" id="bpoLikeBtn" onclick="togglePostLike()">
                 <i class="far fa-heart"></i>
                 <span id="bpoLikeCount">0</span>
               </button>
               <button class="bpo-action-btn" onclick="sharePost()">
                 <i class="fas fa-share-alt"></i>
               </button>
             </div>
           </div>
           <div class="bpo-content" id="bpoContent">
             <!-- Rendered post goes here -->
           </div>
         </div>
       </div>
     `;
   }
   
   /* ════════════════════════════════════════════════════════════
      FETCH BLOGS
   ════════════════════════════════════════════════════════════ */
   async function fetchBlogs(page = 1, append = false) {
     if (BlogState.loading) return;
     BlogState.loading = true;
   
     const grid = document.getElementById("blogGrid");
     if (!grid) return;
   
     if (!append) {
       grid.innerHTML = skeletonBlogCards(6);
       grid.classList.add("loading");
     } else {
       showBlogLoadingMore();
     }
   
     try {
       const params = new URLSearchParams({
         page,
         limit: 9,
         sort: BlogState.sortBy,
       });
       if (BlogState.activeCategory) params.set("category", BlogState.activeCategory);
       if (BlogState.activeTag) params.set("tag", BlogState.activeTag);
       if (BlogState.searchQuery) params.set("search", BlogState.searchQuery);
   
       const res = await fetch(`${BLOG_API}?${params}`);
       if (!res.ok) throw new Error("Failed");
       const data = await res.json();
   
       BlogState.posts = append
         ? [...BlogState.posts, ...(data.data || [])]
         : data.data || [];
       BlogState.page = page;
       BlogState.totalPages = data.pagination?.pages || 1;
   
       renderBlogGrid(BlogState.posts, append);
       updateBlogUI(data.pagination);
       fetchTrending();
     } catch (e) {
       grid.innerHTML = `
         <div class="blog-error-state">
           <div class="bes-icon"><i class="fas fa-satellite-dish"></i></div>
           <h3>সংযোগ সমস্যা</h3>
           <p>ব্লগ লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।</p>
           <button class="btn-primary" onclick="fetchBlogs(1)">
             <i class="fas fa-redo"></i> রিট্রাই
           </button>
         </div>`;
     } finally {
       BlogState.loading = false;
       const g = document.getElementById("blogGrid");
       if (g) g.classList.remove("loading");
       hideBlogLoadingMore();
     }
   }
   
   async function fetchBlogMeta() {
     try {
       const [catRes, tagRes] = await Promise.all([
         fetch(`${BLOG_API}/meta/categories`),
         fetch(`${BLOG_API}/meta/tags`),
       ]);
       const [catData, tagData] = await Promise.all([catRes.json(), tagRes.json()]);
   
       BlogState.categories = catData.data || [];
       BlogState.tags = tagData.data || [];
   
       renderCategoryChips();
       renderTagCloud();
       renderSidebarTags();
   
       // Update hero stats
       setText("blogStatCats", BlogState.categories.length);
       setText("blogStatTags", BlogState.tags.length);
     } catch (e) {
       console.warn("Blog meta fetch failed", e);
     }
   }
   
   async function fetchTrending() {
     try {
       const res = await fetch(`${BLOG_API}?sort=popular&limit=5`);
       const data = await res.json();
       renderTrending(data.data || []);
       setText("blogStatPosts", data.pagination?.total || BlogState.posts.length);
     } catch (e) {}
   }
   
   /* ════════════════════════════════════════════════════════════
      RENDER — GRID
   ════════════════════════════════════════════════════════════ */
   function renderBlogGrid(posts, append = false) {
     const grid = document.getElementById("blogGrid");
     if (!grid) return;
   
     if (!posts || posts.length === 0) {
       grid.innerHTML = `
         <div class="blog-empty-state">
           <div class="bes-icon"><i class="fas fa-newspaper"></i></div>
           <h3>কোনো পোস্ট পাওয়া যায়নি</h3>
           <p>অন্য কিওয়ার্ড বা ক্যাটাগরি দিয়ে চেষ্টা করুন।</p>
           <button class="btn-ghost" onclick="resetBlogFilters()">
             <i class="fas fa-refresh"></i> ফিল্টার রিসেট করুন
           </button>
         </div>`;
       return;
     }
   
     const isGrid = BlogState.viewMode === "grid";
     const isList = BlogState.viewMode === "list";
   
     const cardsHtml = posts.map((post, idx) => renderBlogCard(post, idx, isList)).join("");
   
     if (append) {
       grid.insertAdjacentHTML("beforeend", cardsHtml);
     } else {
       grid.className = `blog-grid ${isList ? "blog-grid-list" : ""}`;
       grid.innerHTML = cardsHtml;
     }
   
     // Add entrance animations
     requestAnimationFrame(() => {
       grid.querySelectorAll(".blog-card:not(.animated)").forEach((card, i) => {
         card.style.animationDelay = `${i * 0.06}s`;
         card.classList.add("animated");
       });
     });
   }
   
   function renderBlogCard(post, idx = 0, isList = false) {
     const img = post.coverImage?.url || "";
     const cat = post.category || "";
     const readTime = post.readingTime || Math.ceil((post.body?.length || 600) / 1000);
     const isNew = isPostNew(post.publishedAt);
     const isFeatured = post.isFeatured;
     const isRead = BlogState.readPosts.includes(post._id);
     const likeCount = post.likes || 0;
     const views = formatBlogNum(post.views || 0);
     const date = formatBlogDate(post.publishedAt || post.createdAt);
     const excerpt = post.excerpt || "";
   
     const badge = isFeatured
       ? `<span class="blog-card-badge bcb-featured"><i class="fas fa-crown"></i> ফিচার্ড</span>`
       : isNew
       ? `<span class="blog-card-badge bcb-new"><i class="fas fa-sparkles"></i> নতুন</span>`
       : "";
   
     const readBadge = isRead
       ? `<span class="blog-card-read-badge"><i class="fas fa-check"></i> পড়েছেন</span>`
       : "";
   
     if (isList) {
       return `
         <div class="blog-card blog-card-list" onclick="openBlogPost('${post._id}')">
           <div class="bcl-img-wrap">
             ${img ? `<img src="${escBlog(img)}" alt="${escBlog(post.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'bcl-img-fallback\\'>🍯</div>'">` : `<div class="bcl-img-fallback">🍯</div>`}
             ${badge}
           </div>
           <div class="bcl-body">
             <div class="bcl-meta">
               ${cat ? `<span class="blog-cat-tag">${escBlog(cat)}</span>` : ""}
               <span class="blog-meta-dot"></span>
               <span>${date}</span>
               <span class="blog-meta-dot"></span>
               <span><i class="fas fa-clock"></i> ${readTime} মিনিট</span>
               ${readBadge}
             </div>
             <h3 class="bcl-title">${escBlog(post.title)}</h3>
             <p class="bcl-excerpt">${escBlog(excerpt)}</p>
             <div class="bcl-footer">
               <div class="blog-author-mini">
                 <div class="bam-avatar">${(post.author?.name || "B")[0]}</div>
                 <span>${escBlog(post.author?.name || "BeeHarvest")}</span>
               </div>
               <div class="blog-stats-mini">
                 <span><i class="fas fa-eye"></i> ${views}</span>
                 <span><i class="fas fa-heart"></i> ${likeCount}</span>
               </div>
             </div>
           </div>
         </div>`;
     }
   
     return `
       <div class="blog-card" onclick="openBlogPost('${post._id}')">
         <div class="blog-card-img">
           ${img ? `<img src="${escBlog(img)}" alt="${escBlog(post.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'blog-card-img-fallback\\'>🍯</div>'">` : `<div class="blog-card-img-fallback">🍯</div>`}
           <div class="blog-card-img-overlay"></div>
           ${badge}
           ${readBadge}
           <div class="blog-card-cat-tag">${escBlog(cat)}</div>
         </div>
         <div class="blog-card-body">
           <div class="blog-card-meta">
             <span class="bcm-date"><i class="far fa-calendar"></i> ${date}</span>
             <span class="bcm-dot"></span>
             <span class="bcm-read"><i class="fas fa-clock"></i> ${readTime} মিনিট</span>
           </div>
           <h3 class="blog-card-title">${escBlog(post.title)}</h3>
           <p class="blog-card-excerpt">${escBlog(excerpt)}</p>
           <div class="blog-card-footer">
             <div class="blog-author-mini">
               <div class="bam-avatar">${(post.author?.name || "B")[0]}</div>
               <span>${escBlog(post.author?.name || "BeeHarvest")}</span>
             </div>
             <div class="blog-stats-mini">
               <span><i class="fas fa-eye"></i> ${views}</span>
               <span><i class="far fa-heart"></i> ${likeCount}</span>
             </div>
           </div>
         </div>
       </div>`;
   }
   
   /* ════════════════════════════════════════════════════════════
      SINGLE POST VIEW
   ════════════════════════════════════════════════════════════ */
   window.openBlogPost = async function (postId) {
    const overlay = document.getElementById("blogPostOverlay");
    const content = document.getElementById("bpoContent");
    if (!overlay || !content) return;
  
    if (!BlogState.readPosts.includes(postId)) {
      BlogState.readPosts.push(postId);
      localStorage.setItem("bh_read_posts", JSON.stringify(BlogState.readPosts));
    }
  
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
    content.innerHTML = skeletonPostDetail();
  
    // Only push state if we aren't already in a post
    if (!history.state?.blogPost) {
      history.pushState({ blogPost: postId }, "", `?post=${postId}`);
    } else {
      history.replaceState({ blogPost: postId }, "", `?post=${postId}`);
    }
  
    try {
      const res = await fetch(`${BLOG_API}/${postId}`);
      const data = await res.json();
      if (!data.success || !data.data) throw new Error("Not found");
      BlogState.currentPost = data.data;
      renderPostDetail(data.data);
    } catch (e) {
      content.innerHTML = `
        <div class="blog-error-state" style="margin:4rem auto;max-width:400px;text-align:center">
          <div class="bes-icon"><i class="fas fa-file-slash"></i></div>
          <h3>পোস্ট পাওয়া যায়নি</h3>
          <button class="btn-primary" onclick="closeBlogPost()">ফিরে যান</button>
        </div>`;
    }
  };
   
   function renderPostDetail(post) {
     const content = document.getElementById("bpoContent");
     if (!content) return;
   
     const isLiked = BlogState.likedPosts.includes(post._id);
     const readTime = post.readingTime || 5;
     const date = formatBlogDate(post.publishedAt || post.createdAt);
     const tags = (post.tags || []).slice(0, 8);
     const approvedComments = (post.comments || []).filter((c) => c.isApproved);
   
     // Update like button
     const likeBtn = document.getElementById("bpoLikeBtn");
     if (likeBtn) {
       likeBtn.classList.toggle("liked", isLiked);
       likeBtn.innerHTML = `<i class="${isLiked ? "fas" : "far"} fa-heart"></i><span>${post.likes || 0}</span>`;
     }
   
     content.innerHTML = `
       <article class="bpo-article">
         <!-- Cover -->
         ${post.coverImage?.url ? `
           <div class="bpo-cover">
             <img src="${escBlog(post.coverImage.url)}" alt="${escBlog(post.coverImage.alt || post.title)}" loading="eager">
             <div class="bpo-cover-overlay"></div>
           </div>` : ""}
   
         <!-- Header -->
         <header class="bpo-header">
           ${post.category ? `<div class="bpo-category">${escBlog(post.category)}</div>` : ""}
           <h1 class="bpo-title">${escBlog(post.title)}</h1>
           ${post.excerpt ? `<p class="bpo-lead">${escBlog(post.excerpt)}</p>` : ""}
           <div class="bpo-meta-row">
             <div class="bpo-author">
               <div class="bpo-author-avatar">${(post.author?.name || "B")[0]}</div>
               <div>
                 <div class="bpo-author-name">${escBlog(post.author?.name || "BeeHarvest")}</div>
                 ${post.author?.bio ? `<div class="bpo-author-bio">${escBlog(post.author.bio)}</div>` : ""}
               </div>
             </div>
             <div class="bpo-stats">
               <span><i class="far fa-calendar"></i> ${date}</span>
               <span><i class="fas fa-clock"></i> ${readTime} মিনিট পড়া</span>
               <span><i class="fas fa-eye"></i> ${formatBlogNum(post.views || 0)}</span>
               <span><i class="fas fa-comments"></i> ${approvedComments.length}</span>
             </div>
           </div>
           <!-- Tags -->
           ${tags.length ? `
             <div class="bpo-tags">
               ${tags.map(t => `<span class="bpo-tag" onclick="filterBlogByTag('${t}');closeBlogPost()">#${escBlog(t)}</span>`).join("")}
             </div>` : ""}
           <!-- Reading progress -->
           <div class="bpo-progress-bar"><div class="bpo-progress-fill" id="bpoProgress"></div></div>
         </header>
   
         <!-- Body -->
         <div class="bpo-body" id="bpoBody">
           ${renderBlogBody(post.body)}
         </div>
   
         <!-- Gallery -->
         ${post.gallery?.length ? `
           <div class="bpo-gallery">
             <h3><i class="fas fa-images"></i> ফটো গ্যালারি</h3>
             <div class="bpo-gallery-grid">
               ${post.gallery.map(g => `<div class="bpo-gallery-item"><img src="${escBlog(g.url)}" alt="${escBlog(g.alt || "")}" loading="lazy" onclick="openGalleryImage('${escBlog(g.url)}')"></div>`).join("")}
             </div>
           </div>` : ""}
   
         <!-- Related products -->
         ${post.relatedProducts?.length ? `
           <div class="bpo-related-products">
             <h3><i class="fas fa-box"></i> সম্পর্কিত পণ্য</h3>
             <div class="bpo-rp-grid">
               ${post.relatedProducts.map(p => `
                 <div class="bpo-rp-card" onclick="viewProduct('${p._id}')">
                   ${p.images?.[0]?.url ? `<img src="${escBlog(p.images[0].url)}" alt="${escBlog(p.name)}">` : `<div class="bpo-rp-placeholder">🍯</div>`}
                   <div class="bpo-rp-name">${escBlog(p.name)}</div>
                   <div class="bpo-rp-price">৳${(p.price || 0).toLocaleString()}</div>
                 </div>`).join("")}
             </div>
           </div>` : ""}
   
         <!-- Engagement -->
         <div class="bpo-engagement">
           <button class="bpo-like-big ${isLiked ? "liked" : ""}" onclick="togglePostLike()">
             <i class="${isLiked ? "fas" : "far"} fa-heart"></i>
             <span>${isLiked ? "লাইক করেছেন" : "পোস্টটি পছন্দ হলে লাইক করুন"}</span>
             <span class="bpo-like-count">${post.likes || 0}</span>
           </button>
           <div class="bpo-share-row">
             <span>শেয়ার করুন:</span>
             <button onclick="shareFacebook()" class="bpo-share-btn bpo-fb"><i class="fab fa-facebook-f"></i></button>
             <button onclick="shareWhatsapp()" class="bpo-share-btn bpo-wa"><i class="fab fa-whatsapp"></i></button>
             <button onclick="copyPostLink()" class="bpo-share-btn bpo-cp"><i class="fas fa-link"></i></button>
           </div>
         </div>
   
         <!-- Comments -->
         ${post.allowComments !== false ? `
           <div class="bpo-comments-section">
             <h3 class="bpo-comments-title">
               <i class="fas fa-comments"></i>
               মন্তব্য
               <span class="bpo-comment-count">${approvedComments.length}</span>
             </h3>
             <div class="bpo-comments-list" id="bpoCommentsList">
               ${approvedComments.length === 0
                 ? `<div class="bpo-no-comments"><i class="far fa-comment-dots"></i><p>এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন!</p></div>`
                 : approvedComments.map(c => renderComment(c)).join("")}
             </div>
             <!-- Comment form -->
             <div class="bpo-comment-form">
               <h4><i class="fas fa-pen"></i> মন্তব্য করুন</h4>
               <div class="bcf-fields">
                 <div class="bcf-row">
                   <input type="text" id="bcfName" placeholder="আপনার নাম *" maxlength="80">
                   <input type="email" id="bcfEmail" placeholder="ইমেইল * (প্রকাশ হবে না)" maxlength="100">
                 </div>
                 <textarea id="bcfBody" placeholder="আপনার মন্তব্য লিখুন..." rows="4" maxlength="1000"></textarea>
                 <div class="bcf-footer">
                   <span class="bcf-char-count" id="bcfCharCount">0/1000</span>
                   <button class="btn-primary" onclick="submitBlogComment('${post._id}')">
                     <i class="fas fa-paper-plane"></i> পাঠান
                   </button>
                 </div>
               </div>
               <div class="bcf-note"><i class="fas fa-info-circle"></i> মন্তব্য অনুমোদনের পর প্রকাশিত হবে।</div>
             </div>
           </div>` : `<div class="bpo-comments-disabled"><i class="fas fa-lock"></i> এই পোস্টে মন্তব্য বন্ধ আছে।</div>`}
   
         <!-- Related posts -->
         ${post.relatedPosts?.length ? `
           <div class="bpo-related-posts">
             <h3><i class="fas fa-newspaper"></i> আরও পড়ুন</h3>
             <div class="bpo-related-grid">
               ${post.relatedPosts.map(rp => `
                 <div class="bpo-related-card" onclick="openBlogPost('${rp._id || rp}')">
                   ${rp.coverImage?.url ? `<img src="${escBlog(rp.coverImage.url)}" alt="${escBlog(rp.title || "")}">` : ""}
                   <div class="bpo-rc-body">
                     <div class="bpo-rc-date">${formatBlogDate(rp.publishedAt)}</div>
                     <div class="bpo-rc-title">${escBlog(rp.title || "")}</div>
                   </div>
                 </div>`).join("")}
             </div>
           </div>` : ""}
       </article>
     `;
   
     // Init reading progress
     initReadingProgress();
   
     // Init char counter
     const bodyTA = document.getElementById("bcfBody");
     const charCount = document.getElementById("bcfCharCount");
     if (bodyTA && charCount) {
       bodyTA.addEventListener("input", () => {
         charCount.textContent = `${bodyTA.value.length}/1000`;
       });
     }
   
     // Scroll to top of overlay
     const overlay = document.getElementById("blogPostOverlay");
     if (overlay) overlay.scrollTop = 0;
   }
   
   function renderComment(c) {
     const date = formatBlogDate(c.approvedAt || c.createdAt);
     return `
       <div class="bpo-comment">
         <div class="bpo-comment-avatar">${(c.author || "?")[0].toUpperCase()}</div>
         <div class="bpo-comment-body">
           <div class="bpo-comment-header">
             <span class="bpc-author">${escBlog(c.author)}</span>
             <span class="bpc-date">${date}</span>
           </div>
           <p class="bpc-text">${escBlog(c.body)}</p>
         </div>
       </div>`;
   }
   
   function renderBlogBody(body) {
     if (!body) return "<p>কোনো কন্টেন্ট নেই।</p>";
     // If it's HTML already, render it; otherwise wrap in p tags
     const isHtml = /<[a-z][\s\S]*>/i.test(body);
     if (isHtml) return body;
     // Simple text — convert newlines to paragraphs
     return body.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
   }
   
   window.closeBlogPost = function () {
    const overlay = document.getElementById("blogPostOverlay");
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
    BlogState.currentPost = null;
    // Go back in history if we pushed a state for this post
    if (history.state?.blogPost) {
      history.back();
    } else {
      history.replaceState({}, "", window.location.pathname);
    }
  };
   
   /* ════════════════════════════════════════════════════════════
      LIKE
   ════════════════════════════════════════════════════════════ */
   window.togglePostLike = async function () {
     const post = BlogState.currentPost;
     if (!post) return;
   
     const isLiked = BlogState.likedPosts.includes(post._id);
     if (isLiked) {
       showToast("আপনি ইতোমধ্যে এই পোস্টটি লাইক করেছেন", "info");
       return;
     }
   
     try {
       const res = await fetch(`${BLOG_API}/${post._id}/like`, { method: "POST" });
       const data = await res.json();
       if (!data.success) throw new Error();
   
       BlogState.likedPosts.push(post._id);
       localStorage.setItem("bh_liked_posts", JSON.stringify(BlogState.likedPosts));
       BlogState.currentPost.likes = data.data.likes;
   
       // Update like button
       const likeBtn = document.getElementById("bpoLikeBtn");
       if (likeBtn) {
         likeBtn.classList.add("liked");
         likeBtn.innerHTML = `<i class="fas fa-heart"></i><span>${data.data.likes}</span>`;
       }
       // Update big like button
       const bigLike = document.querySelector(".bpo-like-big");
       if (bigLike) {
         bigLike.classList.add("liked");
         bigLike.innerHTML = `<i class="fas fa-heart"></i><span>লাইক করেছেন</span><span class="bpo-like-count">${data.data.likes}</span>`;
       }
       showToast("পোস্টটি লাইক করা হয়েছে ❤️", "success");
     } catch (e) {
       showToast("লাইক করতে সমস্যা হয়েছে", "error");
     }
   };
   
   /* ════════════════════════════════════════════════════════════
      COMMENTS
   ════════════════════════════════════════════════════════════ */
   window.submitBlogComment = async function (postId) {
     const author = document.getElementById("bcfName")?.value.trim();
     const email = document.getElementById("bcfEmail")?.value.trim();
     const body = document.getElementById("bcfBody")?.value.trim();
   
     if (!author || !email || !body) {
       showToast("নাম, ইমেইল এবং মন্তব্য সব পূরণ করুন", "error");
       return;
     }
     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
       showToast("সঠিক ইমেইল ঠিকানা দিন", "error");
       return;
     }
   
     const btn = document.querySelector(".bpo-comment-form .btn-primary");
     if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> পাঠানো হচ্ছে...'; }
   
     try {
       const res = await fetch(`${BLOG_API}/${postId}/comments`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ author, email, body }),
       });
       const data = await res.json();
       if (!data.success) throw new Error(data.message);
   
       document.getElementById("bcfName").value = "";
       document.getElementById("bcfEmail").value = "";
       document.getElementById("bcfBody").value = "";
       document.getElementById("bcfCharCount").textContent = "0/1000";
   
       showToast("মন্তব্য পাঠানো হয়েছে! অনুমোদনের পর দেখা যাবে। ✅", "success");
     } catch (e) {
       showToast(e.message || "মন্তব্য পাঠাতে সমস্যা হয়েছে", "error");
     } finally {
       if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> পাঠান'; }
     }
   };
   
   /* ════════════════════════════════════════════════════════════
      FILTERS & SEARCH
   ════════════════════════════════════════════════════════════ */
   window.filterBlogByCategory = function (cat) {
     BlogState.activeCategory = cat;
     BlogState.activeTag = "";
     BlogState.page = 1;
     fetchBlogs(1);
     // Update active chip
     document.querySelectorAll(".blog-cat-chip").forEach((c) => {
       c.classList.toggle("active", c.dataset.cat === cat || (cat === "" && !c.dataset.cat));
     });
     updateActiveFilters();
   };
   
   window.filterBlogByTag = function (tag) {
     BlogState.activeTag = tag === BlogState.activeTag ? "" : tag;
     BlogState.page = 1;
     fetchBlogs(1);
     updateActiveFilters();
     // Update tag cloud
     document.querySelectorAll(".blog-tag-item, .bst-tag").forEach((t) => {
       t.classList.toggle("active", t.dataset.tag === BlogState.activeTag);
     });
   };
   
   window.onBlogSortChange = function (val) {
     BlogState.sortBy = val;
     fetchBlogs(1);
   };
   
   window.setBlogView = function (mode) {
     BlogState.viewMode = mode;
     document.getElementById("bvt-grid")?.classList.toggle("active", mode === "grid");
     document.getElementById("bvt-list")?.classList.toggle("active", mode === "list");
     renderBlogGrid(BlogState.posts);
   };
   
   window.resetBlogFilters = function () {
     BlogState.activeCategory = "";
     BlogState.activeTag = "";
     BlogState.searchQuery = "";
     BlogState.sortBy = "newest";
     const searchInput = document.getElementById("blogSearchInput");
     if (searchInput) searchInput.value = "";
     const sortSel = document.getElementById("blogSortSelect");
     if (sortSel) sortSel.value = "newest";
     document.querySelectorAll(".blog-cat-chip").forEach((c) => c.classList.remove("active"));
     document.querySelector(".blog-cat-chip")?.classList.add("active");
     fetchBlogs(1);
     updateActiveFilters();
   };
   
   window.loadMoreBlogs = function () {
     if (BlogState.page < BlogState.totalPages) {
       fetchBlogs(BlogState.page + 1, true);
     }
   };
   
   function initBlogSearch() {
    const input = document.getElementById("blogSearchInput");
    const clear = document.getElementById("blogSearchClear");
    if (!input) return;
  
    let debounceTimer;
    input.addEventListener("input", () => {
      BlogState.searchQuery = input.value.trim();
      clear.style.display = BlogState.searchQuery ? "flex" : "none";
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchBlogs(1);
        updateActiveFilters();
        // Scroll to blog grid after search
        scrollToBlogGrid();
      }, 450);
    });
  
    clear.addEventListener("click", () => {
      input.value = "";
      BlogState.searchQuery = "";
      clear.style.display = "none";
      fetchBlogs(1);
      updateActiveFilters();
    });
  
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (document.getElementById("blogsPage")?.classList.contains("active")) {
          input.focus();
          input.select();
        }
      }
    });
  }
  
  function scrollToBlogGrid() {
    const grid = document.getElementById("blogGrid");
    if (!grid) return;
    setTimeout(() => {
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
   
   function updateActiveFilters() {
     const el = document.getElementById("blogActiveFilters");
     if (!el) return;
     const filters = [];
     if (BlogState.activeCategory) filters.push(`<span class="baf-chip" onclick="filterBlogByCategory('')"><i class="fas fa-times"></i> ${escBlog(BlogState.activeCategory)}</span>`);
     if (BlogState.activeTag) filters.push(`<span class="baf-chip" onclick="filterBlogByTag('${BlogState.activeTag}')"><i class="fas fa-times"></i> #${escBlog(BlogState.activeTag)}</span>`);
     if (BlogState.searchQuery) filters.push(`<span class="baf-chip" onclick="resetBlogFilters()"><i class="fas fa-times"></i> "${escBlog(BlogState.searchQuery)}"</span>`);
     el.innerHTML = filters.join("");
   }
   
   function updateBlogUI(pagination) {
     // Post count
     if (pagination) {
       setText("blogPostsCount", `${pagination.total || 0} টি পোস্ট পাওয়া গেছে`);
       setText("blogStatPosts", pagination.total || 0);
       const lm = document.getElementById("blogLoadMore");
       if (lm) lm.style.display = pagination.hasNext ? "flex" : "none";
     }
   }
   
   /* ════════════════════════════════════════════════════════════
      SIDEBAR RENDERS
   ════════════════════════════════════════════════════════════ */
   function renderCategoryChips() {
     const cont = document.getElementById("blogFilterCats");
     if (!cont) return;
     const cats = BlogState.categories.slice(0, 8);
     const allBtn = `<button class="blog-cat-chip active" data-cat="" onclick="filterBlogByCategory('')">সব</button>`;
     cont.innerHTML = allBtn + cats.map(c =>
       `<button class="blog-cat-chip" data-cat="${escBlog(c.name)}" onclick="filterBlogByCategory('${escBlog(c.name)}')">${escBlog(c.name)} <span class="bcc-count">${c.count}</span></button>`
     ).join("");
   }
   
   function renderTagCloud() {
     const cont = document.getElementById("blogTagCloud");
     if (!cont) return;
     const tags = BlogState.tags.slice(0, 20);
     if (!tags.length) { cont.style.display = "none"; return; }
     cont.innerHTML = tags.map(t =>
       `<button class="blog-tag-item" data-tag="${escBlog(t.tag)}" onclick="filterBlogByTag('${escBlog(t.tag)}')">#${escBlog(t.tag)} <span>${t.count}</span></button>`
     ).join("");
   }
   
   function renderSidebarTags() {
     const cont = document.getElementById("blogSidebarTags");
     if (!cont) return;
     const tags = BlogState.tags.slice(0, 15);
     cont.innerHTML = tags.map(t =>
       `<button class="bst-tag" data-tag="${escBlog(t.tag)}" onclick="filterBlogByTag('${escBlog(t.tag)}')">#${escBlog(t.tag)}</button>`
     ).join("");
   }
   
   function renderTrending(posts) {
     const cont = document.getElementById("blogTrending");
     if (!cont) return;
     if (!posts.length) { cont.innerHTML = "<p style='color:var(--text-muted);font-size:.8rem'>কোনো ট্রেন্ডিং পোস্ট নেই</p>"; return; }
     cont.innerHTML = posts.slice(0, 5).map((p, i) => `
       <div class="blog-trending-item" onclick="openBlogPost('${p._id}')">
         <span class="bti-num">${String(i + 1).padStart(2, "0")}</span>
         <div class="bti-body">
           <div class="bti-title">${escBlog(p.title)}</div>
           <div class="bti-meta"><i class="fas fa-eye"></i> ${formatBlogNum(p.views || 0)} · <i class="fas fa-heart"></i> ${p.likes || 0}</div>
         </div>
       </div>`).join("");
   }
   
   /* ════════════════════════════════════════════════════════════
      READING PROGRESS
   ════════════════════════════════════════════════════════════ */
   function initReadingProgress() {
     const overlay = document.getElementById("blogPostOverlay");
     const bar = document.getElementById("bpoProgress");
     if (!overlay || !bar) return;
   
     overlay.addEventListener("scroll", () => {
       const scrollTop = overlay.scrollTop;
       const scrollHeight = overlay.scrollHeight - overlay.clientHeight;
       const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
       bar.style.width = `${Math.min(100, progress)}%`;
     }, { passive: true });
   }
   
   function initBlogIntersectionObserver() {
     // Lazy animate cards when they appear
     const observer = new IntersectionObserver((entries) => {
       entries.forEach(e => {
         if (e.isIntersecting) {
           e.target.classList.add("in-view");
           observer.unobserve(e.target);
         }
       });
     }, { threshold: 0.12 });
   
     const observe = () => {
       document.querySelectorAll(".blog-card:not(.in-view)").forEach(c => observer.observe(c));
     };
   
     // Re-observe after grid updates
     const grid = document.getElementById("blogGrid");
     if (grid) {
       new MutationObserver(observe).observe(grid, { childList: true });
     }
   }
   
   /* ════════════════════════════════════════════════════════════
      SHARE
   ════════════════════════════════════════════════════════════ */
   window.sharePost = function () {
     const post = BlogState.currentPost;
     if (!post) return;
     if (navigator.share) {
       navigator.share({ title: post.title, url: window.location.href });
     } else {
       copyPostLink();
     }
   };
   
   window.shareFacebook = function () {
     window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank");
   };
   
   window.shareWhatsapp = function () {
     const post = BlogState.currentPost;
     window.open(`https://wa.me/?text=${encodeURIComponent((post?.title || "") + " " + window.location.href)}`, "_blank");
   };
   
   window.copyPostLink = function () {
     navigator.clipboard?.writeText(window.location.href).then(() => {
       showToast("লিংক কপি হয়েছে! 🔗", "success");
     });
   };
   
   /* ════════════════════════════════════════════════════════════
      GALLERY LIGHTBOX
   ════════════════════════════════════════════════════════════ */
   window.openGalleryImage = function (url) {
     const lb = document.createElement("div");
     lb.className = "blog-lightbox";
     lb.innerHTML = `
       <div class="blog-lb-backdrop" onclick="this.parentElement.remove()"></div>
       <div class="blog-lb-img-wrap">
         <img src="${escBlog(url)}" alt="Gallery image">
         <button class="blog-lb-close" onclick="this.closest('.blog-lightbox').remove()">
           <i class="fas fa-times"></i>
         </button>
       </div>`;
     document.body.appendChild(lb);
     requestAnimationFrame(() => lb.classList.add("active"));
   };
   
   /* ════════════════════════════════════════════════════════════
      NEWSLETTER
   ════════════════════════════════════════════════════════════ */
   window.subscribeNewsletter = function () {
     const email = document.getElementById("blogNewsletterEmail")?.value.trim();
     if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
       showToast("সঠিক ইমেইল ঠিকানা দিন", "error");
       return;
     }
     showToast("নিউজলেটার সাবস্ক্রিপশন সফল! 🐝", "success");
     document.getElementById("blogNewsletterEmail").value = "";
   };
   
   /* ════════════════════════════════════════════════════════════
      LOADING HELPERS
   ════════════════════════════════════════════════════════════ */
   function showBlogLoadingMore() {
     const btn = document.querySelector(".blog-load-more-btn");
     if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> লোড হচ্ছে...';
   }
   
   function hideBlogLoadingMore() {
     const btn = document.querySelector(".blog-load-more-btn");
     if (btn) btn.innerHTML = '<i class="fas fa-arrow-down"></i> আরও পোস্ট দেখুন';
   }
   
   /* ════════════════════════════════════════════════════════════
      SKELETONS
   ════════════════════════════════════════════════════════════ */
   function skeletonBlogCards(n) {
     return Array(n).fill(0).map(() => `
       <div class="blog-card blog-card-skeleton">
         <div class="bcs-img"></div>
         <div class="bcs-body">
           <div class="bcs-line bcs-line-sm"></div>
           <div class="bcs-line bcs-line-lg"></div>
           <div class="bcs-line bcs-line-lg"></div>
           <div class="bcs-line bcs-line-md"></div>
           <div class="bcs-footer">
             <div class="bcs-circle"></div>
             <div class="bcs-line bcs-line-sm" style="width:80px"></div>
           </div>
         </div>
       </div>`).join("");
   }
   
   function skeletonTrending(n) {
     return Array(n).fill(0).map(() => `
       <div class="blog-trending-item blog-trending-skeleton">
         <div class="bts-num"></div>
         <div class="bts-body">
           <div class="bts-line bts-lg"></div>
           <div class="bts-line bts-sm"></div>
         </div>
       </div>`).join("");
   }
   
   function skeletonPostDetail() {
     return `
       <div class="bpo-skeleton">
         <div class="bpos-cover"></div>
         <div class="bpos-content">
           <div class="bpos-line bpos-cat"></div>
           <div class="bpos-line bpos-title-1"></div>
           <div class="bpos-line bpos-title-2"></div>
           <div class="bpos-meta"></div>
           ${Array(8).fill('<div class="bpos-line bpos-body"></div>').join("")}
         </div>
       </div>`;
   }
   
   /* ════════════════════════════════════════════════════════════
      HELPERS
   ════════════════════════════════════════════════════════════ */
   function escBlog(str) {
     if (!str) return "";
     return String(str)
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#39;");
   }
   
   function formatBlogDate(dateStr) {
     if (!dateStr) return "";
     const d = new Date(dateStr);
     return d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
   }
   
   function formatBlogNum(n) {
     if (n >= 1000) return (n / 1000).toFixed(1) + "হা";
     return String(n);
   }
   
   function isPostNew(dateStr) {
     if (!dateStr) return false;
     const diff = Date.now() - new Date(dateStr).getTime();
     return diff < 7 * 24 * 60 * 60 * 1000; // 7 days
   }
   
   /* ════════════════════════════════════════════════════════════
      HANDLE BACK BUTTON ON POST OVERLAY
   ════════════════════════════════════════════════════════════ */
   window.addEventListener("popstate", (e) => {
    const overlay = document.getElementById("blogPostOverlay");
    if (overlay?.classList.contains("active")) {
      // User pressed browser back while post is open — close without pushing history again
      overlay.classList.remove("active");
      document.body.style.overflow = "";
      BlogState.currentPost = null;
    } else if (e.state?.blogPost) {
      // Forward navigation to a post
      openBlogPost(e.state.blogPost);
    }
  });
   
   /* ════════════════════════════════════════════════════════════
      AUTO-OPEN FROM URL
   ════════════════════════════════════════════════════════════ */
   (function checkBlogAutoOpen() {
     const params = new URLSearchParams(window.location.search);
     const postId = params.get("post");
     if (postId) {
       setTimeout(() => {
         navigateTo("blogs");
         openBlogPost(postId);
       }, 800);
     }
   })();
