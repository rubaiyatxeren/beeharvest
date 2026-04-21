/* ═══════════════════════════════════════════════════════════
   BeeHarvest — reviews.js
   Drop this into any product detail page to show live reviews.
   Usage: ReviewsWidget.init(productId, containerElement)
   ═══════════════════════════════════════════════════════════ */
   "use strict";

   const ReviewsWidget = (() => {
     const API_URL = "https://beeyond-harvest-admin.onrender.com/api";
     let _productId = null;
     let _container = null;
     let _currentPage = 1;
     let _currentSort = "newest";
     let _totalPages = 1;
     let _summary = null;
     let _pollInterval = null;
     let _lastCount = 0;
   
     // ── Public API ──────────────────────────────────────────
     function init(productId, containerElement) {
       if (!productId || !containerElement) return;
       _productId = productId;
       _container = containerElement;
       _render();
       _fetchAndUpdate(1, "newest");
       _startPolling();
     }
   
     function destroy() {
       if (_pollInterval) clearInterval(_pollInterval);
     }
   
     // ── Polling for real-time updates ──────────────────────
     function _startPolling() {
       if (_pollInterval) clearInterval(_pollInterval);
       _pollInterval = setInterval(async () => {
         try {
           const res = await fetch(
             `${API_URL}/reviews/product/${_productId}?page=1&limit=1&sort=newest`
           );
           const data = await res.json();
           if (!data.success) return;
           const newCount = data.data.summary?.count || 0;
           if (newCount !== _lastCount) {
             _lastCount = newCount;
             _fetchAndUpdate(_currentPage, _currentSort, true);
           }
         } catch (_) {}
       }, 30000); // every 30s
     }
   
     // ── Build skeleton DOM ─────────────────────────────────
     function _render() {
       _container.innerHTML = `
         <div class="rv-section" id="rv-section-${_productId}">
           <div class="rv-header">
             <div class="rv-title">
               <div class="rv-title-icon"><i class="fas fa-star"></i></div>
               <h2>গ্রাহক রিভিউ</h2>
               <span class="rv-live-badge" id="rv-live-${_productId}">
                 <span class="rv-live-dot"></span> লাইভ
               </span>
             </div>
           </div>
   
           <!-- Summary Panel -->
           <div class="rv-summary-panel" id="rv-summary-${_productId}">
             ${_skeletonSummary()}
           </div>
   
           <!-- Controls -->
           <div class="rv-controls" id="rv-controls-${_productId}" style="display:none">
             <div class="rv-sort-group">
               <span class="rv-sort-label"><i class="fas fa-sort"></i></span>
               <button class="rv-sort-btn active" data-sort="newest" onclick="ReviewsWidget._sortBy('newest','${_productId}')">সর্বশেষ</button>
               <button class="rv-sort-btn" data-sort="highest" onclick="ReviewsWidget._sortBy('highest','${_productId}')">সর্বোচ্চ রেটিং</button>
               <button class="rv-sort-btn" data-sort="lowest" onclick="ReviewsWidget._sortBy('lowest','${_productId}')">সর্বনিম্ন রেটিং</button>
               <button class="rv-sort-btn" data-sort="helpful" onclick="ReviewsWidget._sortBy('helpful','${_productId}')">সহায়ক</button>
             </div>
           </div>
   
           <!-- Review List -->
           <div class="rv-list" id="rv-list-${_productId}">
             ${_skeletonCards(3)}
           </div>
   
           <!-- Pagination -->
           <div class="rv-pagination" id="rv-page-${_productId}"></div>
         </div>
       `;
     }
   
     // ── Fetch reviews ──────────────────────────────────────
     async function _fetchAndUpdate(page, sort, silent = false) {
       _currentPage = page;
       _currentSort = sort;
   
       if (!silent) {
         document.getElementById(`rv-list-${_productId}`).innerHTML = _skeletonCards(3);
       }
   
       try {
         const res = await fetch(
           `${API_URL}/reviews/product/${_productId}?page=${page}&limit=8&sort=${sort}`
         );
         const data = await res.json();
         if (!data.success) throw new Error("Failed");
   
         const { reviews, summary, pagination } = data.data;
         _summary = summary;
         _totalPages = pagination.pages;
         _lastCount = summary.count;
   
         _renderSummary(summary);
         _renderControls(summary.count);
         _renderReviews(reviews, summary.count);
         _renderPagination(pagination);
       } catch (_) {
         document.getElementById(`rv-list-${_productId}`).innerHTML = `
           <div class="rv-empty">
             <i class="fas fa-exclamation-triangle"></i>
             <p>রিভিউ লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।</p>
             <button onclick="ReviewsWidget._fetchAndUpdate(1,'newest')" class="rv-retry-btn">
               <i class="fas fa-redo"></i> পুনরায় লোড করুন
             </button>
           </div>`;
       }
     }
   
     function _sortBy(sort, pid) {
       if (pid !== _productId) return;
       _currentSort = sort;
       _currentPage = 1;
   
       // Update active button
       document.querySelectorAll(`#rv-section-${pid} .rv-sort-btn`).forEach(btn => {
         btn.classList.toggle("active", btn.dataset.sort === sort);
       });
   
       _fetchAndUpdate(1, sort);
     }
   
     // ── Render Summary ────────────────────────────────────
     function _renderSummary(summary) {
       const avg = summary.average || 0;
       const count = summary.count || 0;
       const breakdown = summary.breakdown || {};
   
       const maxCount = Math.max(...Object.values(breakdown), 1);
   
       const bars = [5, 4, 3, 2, 1].map(star => {
         const n = breakdown[star] || 0;
         const pct = count > 0 ? Math.round((n / count) * 100) : 0;
         const barW = maxCount > 0 ? Math.round((n / maxCount) * 100) : 0;
         return `
           <div class="rv-bar-row">
             <span class="rv-bar-label">${star}<i class="fas fa-star rv-tiny-star"></i></span>
             <div class="rv-bar-track">
               <div class="rv-bar-fill ${star >= 4 ? 'fill-high' : star === 3 ? 'fill-mid' : 'fill-low'}" style="width:${barW}%"></div>
             </div>
             <span class="rv-bar-count">${n}</span>
             <span class="rv-bar-pct">${pct}%</span>
           </div>`;
       }).join("");
   
       const fullStars = Math.floor(avg);
       const half = avg % 1 >= 0.5;
       const empty = 5 - fullStars - (half ? 1 : 0);
       const starsHtml = '★'.repeat(fullStars) + (half ? '½' : '') + '☆'.repeat(empty);
   
       document.getElementById(`rv-summary-${_productId}`).innerHTML = `
         <div class="rv-summary">
           <div class="rv-avg-block">
             <div class="rv-avg-num">${avg.toFixed(1)}</div>
             <div class="rv-avg-stars">${starsHtml}</div>
             <div class="rv-avg-count">${count.toLocaleString()} রিভিউ</div>
             ${count === 0 ? '<div class="rv-no-review-note">এখনো কোনো রিভিউ নেই</div>' : ''}
           </div>
           <div class="rv-bars">${bars}</div>
         </div>`;
     }
   
     function _renderControls(count) {
       const ctrl = document.getElementById(`rv-controls-${_productId}`);
       if (ctrl) ctrl.style.display = count > 0 ? "flex" : "none";
     }
   
     // ── Render Reviews ────────────────────────────────────
     function _renderReviews(reviews, total) {
       const list = document.getElementById(`rv-list-${_productId}`);
       if (!list) return;
   
       if (reviews.length === 0) {
         list.innerHTML = `
           <div class="rv-empty">
             <div class="rv-empty-icon">💬</div>
             <h4>এখনো কোনো রিভিউ নেই</h4>
             <p>এই পণ্যটি কিনলে আপনিও রিভিউ দিতে পারবেন!</p>
           </div>`;
         return;
       }
   
       list.innerHTML = reviews.map(r => _reviewCard(r)).join("");
     }
   
     function _reviewCard(r) {
       const stars = _starsHtml(r.rating);
       const date = new Date(r.createdAt).toLocaleDateString("bn-BD", {
         day: "2-digit", month: "short", year: "numeric"
       });
       const initial = (r.customerName || "গ্রাহক").charAt(0).toUpperCase();
       const name = _maskName(r.customerName || "গ্রাহক");
       const helpful = r.helpfulVotes || 0;
       const notHelpful = r.notHelpfulVotes || 0;
       const bodyText = _escHtml(r.body || "");
       const titleText = r.title ? `<div class="rv-card-title">"${_escHtml(r.title)}"</div>` : "";
   
       return `
         <div class="rv-card" id="rv-card-${r._id}">
           <div class="rv-card-top">
             <div class="rv-card-avatar">${initial}</div>
             <div class="rv-card-meta">
               <div class="rv-card-name">${_escHtml(name)}</div>
               <div class="rv-card-stars">${stars}</div>
             </div>
             <div class="rv-card-right">
               ${r.isVerifiedPurchase ? `<div class="rv-verified"><i class="fas fa-check-circle"></i> যাচাইকৃত ক্রয়</div>` : ""}
               <div class="rv-card-date">${date}</div>
             </div>
           </div>
           ${titleText}
           <div class="rv-card-body">${bodyText}</div>
           <div class="rv-card-footer">
             <span class="rv-helpful-label">এটি কি সহায়ক ছিল?</span>
             <button class="rv-vote-btn rv-vote-yes" onclick="ReviewsWidget._vote('${r._id}', true)" title="সহায়ক">
               <i class="fas fa-thumbs-up"></i> <span>${helpful}</span>
             </button>
             <button class="rv-vote-btn rv-vote-no" onclick="ReviewsWidget._vote('${r._id}', false)" title="সহায়ক নয়">
               <i class="fas fa-thumbs-down"></i> <span>${notHelpful}</span>
             </button>
           </div>
         </div>`;
     }
   
     // ── Vote ──────────────────────────────────────────────
     async function _vote(reviewId, helpful) {
       const voterEmail = localStorage.getItem("bh_voter_email");
       if (!voterEmail) {
         const email = prompt("ভোট দিতে আপনার ইমেইল দিন:");
         if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
         localStorage.setItem("bh_voter_email", email.toLowerCase());
       }
   
       const email = localStorage.getItem("bh_voter_email");
   
       try {
         const res = await fetch(`${API_URL}/reviews/${reviewId}/vote`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ helpful, voterEmail: email }),
         });
         const data = await res.json();
   
         if (!data.success) {
           _showMiniToast(data.message || "ভোট দেওয়া যায়নি", false);
           return;
         }
   
         // Update counts in DOM
         const card = document.getElementById(`rv-card-${reviewId}`);
         if (card) {
           const yesBtn = card.querySelector(".rv-vote-yes span");
           const noBtn = card.querySelector(".rv-vote-no span");
           if (yesBtn) yesBtn.textContent = data.data.helpfulVotes;
           if (noBtn) noBtn.textContent = data.data.notHelpfulVotes;
   
           // Visual feedback
           const btn = card.querySelector(helpful ? ".rv-vote-yes" : ".rv-vote-no");
           if (btn) {
             btn.classList.add("voted");
             btn.disabled = true;
           }
         }
   
         _showMiniToast("ভোট সফলভাবে দেওয়া হয়েছে!", true);
       } catch (_) {
         _showMiniToast("নেটওয়ার্ক সমস্যা", false);
       }
     }
   
     // ── Pagination ────────────────────────────────────────
     function _renderPagination(pagination) {
       const el = document.getElementById(`rv-page-${_productId}`);
       if (!el || pagination.pages <= 1) {
         if (el) el.innerHTML = "";
         return;
       }
   
       const { page, pages } = pagination;
       let html = `<div class="rv-pager">`;
   
       html += `<button class="rv-page-btn" onclick="ReviewsWidget._goto(${page - 1})" ${page === 1 ? "disabled" : ""}>
         <i class="fas fa-chevron-left"></i>
       </button>`;
   
       for (let i = 1; i <= pages; i++) {
         if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) {
           html += `<button class="rv-page-btn ${i === page ? "active" : ""}" onclick="ReviewsWidget._goto(${i})">${i}</button>`;
         } else if (i === page - 2 || i === page + 2) {
           html += `<span class="rv-page-dots">…</span>`;
         }
       }
   
       html += `<button class="rv-page-btn" onclick="ReviewsWidget._goto(${page + 1})" ${page === pages ? "disabled" : ""}>
         <i class="fas fa-chevron-right"></i>
       </button></div>`;
   
       el.innerHTML = html;
     }
   
     function _goto(page) {
       if (page < 1 || page > _totalPages) return;
       document.getElementById(`rv-section-${_productId}`)?.scrollIntoView({ behavior: "smooth" });
       setTimeout(() => _fetchAndUpdate(page, _currentSort), 200);
     }
   
     // ── Helpers ───────────────────────────────────────────
     function _starsHtml(rating) {
       let html = "";
       for (let i = 1; i <= 5; i++) {
         if (i <= rating) html += `<span class="rv-star filled">★</span>`;
         else if (i - 0.5 <= rating) html += `<span class="rv-star half">☆</span>`;
         else html += `<span class="rv-star empty">☆</span>`;
       }
       return `<div class="rv-stars-group">${html}</div>`;
     }
   
     function _maskName(name) {
       if (!name || name.length <= 2) return name;
       return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
     }
   
     function _escHtml(str) {
       return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
     }
   
     function _skeletonSummary() {
       return `<div class="rv-skeleton-summary">
         <div class="rv-sk rv-sk-avg"></div>
         <div style="flex:1;display:flex;flex-direction:column;gap:8px">
           ${[80,65,40,25,15].map(w => `<div class="rv-sk" style="height:12px;width:${w}%"></div>`).join("")}
         </div>
       </div>`;
     }
   
     function _skeletonCards(n) {
       return Array(n).fill(0).map(() => `
         <div class="rv-card rv-sk-card">
           <div class="rv-card-top">
             <div class="rv-sk rv-sk-avatar"></div>
             <div style="flex:1">
               <div class="rv-sk" style="height:14px;width:35%;margin-bottom:8px"></div>
               <div class="rv-sk" style="height:12px;width:55%"></div>
             </div>
           </div>
           <div class="rv-sk" style="height:12px;width:70%;margin:12px 0 6px"></div>
           <div class="rv-sk" style="height:12px;width:90%;margin-bottom:6px"></div>
           <div class="rv-sk" style="height:12px;width:60%"></div>
         </div>`).join("");
     }
   
     function _showMiniToast(msg, success) {
       const t = document.createElement("div");
       t.style.cssText = `
         position:fixed;bottom:80px;right:16px;z-index:9999;
         background:${success ? "#E8F5EE" : "#FDEDEC"};
         color:${success ? "#1E8A4A" : "#C0392B"};
         border:1px solid ${success ? "rgba(30,138,74,0.3)" : "rgba(192,57,43,0.3)"};
         padding:8px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;
         display:flex;align-items:center;gap:6px;
         animation:toastIn 0.3s ease;
         box-shadow:0 4px 12px rgba(0,0,0,0.1);
       `;
       t.innerHTML = `<i class="fas ${success ? "fa-check" : "fa-times"}"></i>${msg}`;
       document.body.appendChild(t);
       setTimeout(() => t.remove(), 2500);
     }
   
     // Expose sort/goto/vote for inline onclick
     return { init, destroy, _sortBy, _fetchAndUpdate, _goto, _vote };
   })();
   
   /* ═══════════════════════════════════════════════════════════
      CSS — injected once
      ═══════════════════════════════════════════════════════════ */
   (function injectReviewCSS() {
     if (document.getElementById("rv-styles")) return;
     const style = document.createElement("style");
     style.id = "rv-styles";
     style.textContent = `
       @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
       @keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
       @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
   
       /* ── Section ── */
       .rv-section{padding:2rem 0;position:relative}
       .rv-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem}
       .rv-title{display:flex;align-items:center;gap:12px}
       .rv-title-icon{width:40px;height:40px;background:linear-gradient(135deg,#F5A623,#C47F11);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:1rem}
       .rv-title h2{font-family:'DM Serif Display',serif;font-size:1.5rem;color:#0D1B3E}
       .rv-live-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(30,138,74,0.1);border:1px solid rgba(30,138,74,0.3);color:#1E8A4A;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:50px}
       .rv-live-dot{width:7px;height:7px;background:#1E8A4A;border-radius:50%;animation:livePulse 1.8s ease infinite}
   
       /* ── Summary ── */
       .rv-summary{display:flex;gap:2rem;background:#fff;border-radius:16px;padding:1.5rem;border:1px solid #E8EBF4;box-shadow:0 2px 8px rgba(13,27,62,0.06);margin-bottom:1.25rem;flex-wrap:wrap}
       .rv-avg-block{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:110px;text-align:center}
       .rv-avg-num{font-family:'DM Serif Display',serif;font-size:3rem;color:#0D1B3E;line-height:1}
       .rv-avg-stars{font-size:1.3rem;color:#F5A623;margin:4px 0;letter-spacing:2px}
       .rv-avg-count{font-size:0.78rem;color:#6B7A99;font-weight:600}
       .rv-no-review-note{font-size:0.72rem;color:#A0ABBE;margin-top:4px}
       .rv-bars{flex:1;display:flex;flex-direction:column;gap:7px;min-width:200px}
       .rv-bar-row{display:flex;align-items:center;gap:8px}
       .rv-bar-label{font-size:0.75rem;font-weight:600;color:#6B7A99;min-width:28px;display:flex;align-items:center;gap:2px}
       .rv-tiny-star{color:#F5A623;font-size:0.65rem}
       .rv-bar-track{flex:1;height:8px;background:#E8EBF4;border-radius:4px;overflow:hidden}
       .rv-bar-fill{height:100%;border-radius:4px;transition:width 0.6s ease}
       .rv-bar-fill.fill-high{background:linear-gradient(90deg,#1E8A4A,#27AE60)}
       .rv-bar-fill.fill-mid{background:linear-gradient(90deg,#d69e2e,#F5A623)}
       .rv-bar-fill.fill-low{background:linear-gradient(90deg,#C0392B,#E74C3C)}
       .rv-bar-count{font-size:0.72rem;color:#6B7A99;min-width:24px;text-align:right}
       .rv-bar-pct{font-size:0.7rem;color:#A0ABBE;min-width:30px;text-align:right}
   
       /* ── Controls ── */
       .rv-controls{display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap}
       .rv-sort-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
       .rv-sort-label{color:#6B7A99;font-size:0.85rem}
       .rv-sort-btn{background:white;border:1.5px solid #E8EBF4;color:#6B7A99;padding:6px 14px;border-radius:50px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:'Hind Siliguri',sans-serif}
       .rv-sort-btn:hover{border-color:#F5A623;color:#C47F11}
       .rv-sort-btn.active{background:#0D1B3E;border-color:#0D1B3E;color:white}
   
       /* ── Review Card ── */
       .rv-list{display:flex;flex-direction:column;gap:1rem;margin-bottom:1.25rem}
       .rv-card{background:white;border:1.5px solid #E8EBF4;border-radius:16px;padding:1.25rem;box-shadow:0 2px 8px rgba(13,27,62,0.04);transition:all 0.2s;position:relative}
       .rv-card:hover{border-color:rgba(245,166,35,0.3);box-shadow:0 6px 20px rgba(13,27,62,0.08)}
       .rv-card-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:0.875rem}
       .rv-card-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0D1B3E,#1A2E5A);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0}
       .rv-card-meta{flex:1;min-width:0}
       .rv-card-name{font-weight:700;font-size:0.875rem;color:#0D1B3E;margin-bottom:3px}
       .rv-stars-group{display:flex;gap:2px}
       .rv-star{font-size:1rem;line-height:1}
       .rv-star.filled{color:#F5A623}
       .rv-star.half{color:#FDD882}
       .rv-star.empty{color:#E8EBF4}
       .rv-card-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
       .rv-verified{display:inline-flex;align-items:center;gap:4px;background:#E8F5EE;color:#1E8A4A;font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:50px;border:1px solid rgba(30,138,74,0.2)}
       .rv-card-date{font-size:0.7rem;color:#A0ABBE}
       .rv-card-title{font-weight:700;font-size:0.9rem;color:#0D1B3E;font-style:italic;margin-bottom:6px}
       .rv-card-body{font-size:0.875rem;color:#374151;line-height:1.7;margin-bottom:0.875rem;white-space:pre-wrap;word-break:break-word}
       .rv-card-footer{display:flex;align-items:center;gap:8px;padding-top:0.75rem;border-top:1px dashed #E8EBF4;flex-wrap:wrap}
       .rv-helpful-label{font-size:0.72rem;color:#A0ABBE;margin-right:auto}
       .rv-vote-btn{display:flex;align-items:center;gap:5px;background:none;border:1.5px solid #E8EBF4;color:#6B7A99;padding:4px 12px;border-radius:50px;font-size:0.75rem;cursor:pointer;transition:all 0.2s;font-family:'Hind Siliguri',sans-serif}
       .rv-vote-btn:hover{border-color:#F5A623;color:#C47F11}
       .rv-vote-btn.voted{background:rgba(245,166,35,0.1);border-color:#F5A623;color:#C47F11;cursor:default}
       .rv-vote-yes.voted{background:rgba(30,138,74,0.1);border-color:#1E8A4A;color:#1E8A4A}
   
       /* ── Empty / Error ── */
       .rv-empty{text-align:center;padding:3rem 2rem;background:white;border-radius:16px;border:2px dashed #E8EBF4}
       .rv-empty-icon{font-size:2.5rem;margin-bottom:0.75rem}
       .rv-empty h4{font-family:'DM Serif Display',serif;font-size:1.2rem;color:#0D1B3E;margin-bottom:0.5rem}
       .rv-empty p{font-size:0.875rem;color:#6B7A99}
       .rv-retry-btn{margin-top:1rem;background:var(--honey,#F5A623);color:#0D1B3E;border:none;padding:8px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem}
   
       /* ── Pagination ── */
       .rv-pager{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}
       .rv-page-btn{min-width:36px;height:36px;border:1.5px solid #E8EBF4;background:white;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;color:#0D1B3E;transition:all 0.2s;display:flex;align-items:center;justify-content:center;padding:0 8px}
       .rv-page-btn:hover:not(:disabled){border-color:#F5A623;color:#C47F11}
       .rv-page-btn.active{background:#0D1B3E;border-color:#0D1B3E;color:white}
       .rv-page-btn:disabled{opacity:0.35;cursor:not-allowed}
       .rv-page-dots{display:flex;align-items:center;color:#A0ABBE;font-size:0.85rem;padding:0 4px}
   
       /* ── Skeletons ── */
       .rv-sk{background:linear-gradient(90deg,#f0f2f8 25%,#e8eaf0 50%,#f0f2f8 75%);background-size:200%;border-radius:6px;animation:shimmer 1.4s infinite}
       .rv-sk-summary{display:flex;gap:2rem;background:white;border-radius:16px;padding:1.5rem;border:1px solid #E8EBF4;margin-bottom:1.25rem}
       .rv-sk-avg{width:110px;height:80px}
       .rv-sk-card{background:white;border:1.5px solid #E8EBF4;border-radius:16px;padding:1.25rem}
       .rv-sk-avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0}
   
       /* ── Responsive ── */
       @media(max-width:640px){
         .rv-summary{flex-direction:column;gap:1rem}
         .rv-avg-block{flex-direction:row;gap:12px;text-align:left}
         .rv-avg-num{font-size:2.2rem}
         .rv-card-top{flex-wrap:wrap}
         .rv-card-right{width:100%;flex-direction:row;justify-content:flex-start}
         .rv-sort-group{gap:4px}
         .rv-sort-btn{padding:5px 10px;font-size:0.72rem}
       }
     `;
     document.head.appendChild(style);
   })();
