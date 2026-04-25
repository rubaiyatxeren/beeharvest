/* ═══════════════════════════════════════════════════════════
   BEEHARVEST — COMPLAINT MODULE (complaint.js)
   Features: Submit complaint (multi-step), Track by ticket,
   Customer reply, Satisfaction rating
   ═══════════════════════════════════════════════════════════ */

   const ComplaintModule = (function () {
    "use strict";
  
    const API = "https://beeyond-harvest-admin.onrender.com/api";
  
    /* ── State ─────────────────────────────────────────────── */
    let state = {
      step: 1,
      category: null,
      formData: {},
      submitting: false,
      tracking: false,
      trackedComplaint: null,
      attachments: [], // Store attachment files
        maxSize: 5 * 1024 * 1024, // 5MB max per file
    maxFiles: 5, // Max 5 files
    };
    
    /* ── Attachment Helpers ─────────────────────────────────── */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  
  function validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showMsg('cAttachMsg', 'শুধু ছবি (JPG, PNG, GIF) বা PDF ফাইল সমর্থিত', 'error');
      setTimeout(() => {
        const msgEl = document.getElementById('cAttachMsg');
        if (msgEl && msgEl.classList.contains('complaint-msg-error')) {
          msgEl.innerHTML = '';
          msgEl.className = 'complaint-msg';
        }
      }, 3000);
      return false;
    }
    if (file.size > state.maxSize) {
      showMsg('cAttachMsg', `ফাইল সাইজ ${formatFileSize(state.maxSize)} এর বেশি হতে পারবে না`, 'error');
      setTimeout(() => {
        const msgEl = document.getElementById('cAttachMsg');
        if (msgEl && msgEl.classList.contains('complaint-msg-error')) {
          msgEl.innerHTML = '';
          msgEl.className = 'complaint-msg';
        }
      }, 3000);
      return false;
    }
    return true;
  }
  
  function addAttachment(file) {
    if (!validateFile(file)) return false;
    if (state.attachments.length >= state.maxFiles) {
      showMsg('cAttachMsg', `সর্বোচ্চ ${state.maxFiles}টি ফাইল যোগ করা যাবে`, 'error');
      return false;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      state.attachments.push({
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        data: e.target.result.split(',')[1],
        preview: file.type.startsWith('image/') ? e.target.result : null
      });
      renderAttachmentList();
      showMsg('cAttachMsg', `${file.name} যোগ হয়েছে`, 'success');
      // Clear success message after 2 seconds
      setTimeout(() => {
        const msgEl = document.getElementById('cAttachMsg');
        if (msgEl && msgEl.classList.contains('complaint-msg-success')) {
          msgEl.innerHTML = '';
          msgEl.className = 'complaint-msg';
        }
      }, 2000);
    };
    reader.readAsDataURL(file);
    return true;
  }
  
  function removeAttachment(index) {
    state.attachments.splice(index, 1);
    renderAttachmentList();
    showMsg('cAttachMsg', 'ফাইল সরানো হয়েছে', 'info');
    // Clear the message after 2 seconds
    setTimeout(() => {
      const msgEl = document.getElementById('cAttachMsg');
      if (msgEl) msgEl.innerHTML = '';
    }, 2000);
  }
  
  function renderAttachmentList() {
    const container = document.getElementById('cAttachmentList');
    if (!container) return;
    
    if (state.attachments.length === 0) {
      container.innerHTML = '<div style="font-size:0.7rem;color:#A0ABBE;padding:8px 0;">কোনো ফাইল যোগ করা হয়নি</div>';
      return;
    }
    
    container.innerHTML = state.attachments.map((att, i) => `
      <div class="c-attachment-item">
        <div class="c-attachment-preview">${att.preview ? `<img src="${att.preview}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '<i class="fas fa-file-pdf"></i>'}</div>
        <div class="c-attachment-info">
          <div class="c-attachment-name">${esc(att.name)}</div>
          <div class="c-attachment-size">${formatFileSize(att.size)}</div>
        </div>
        <button type="button" class="c-attachment-remove" onclick="ComplaintModule.removeAttachment(${i})">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  }

    /* ── Category definitions ───────────────────────────────── */
    const CATEGORIES = [
      { key: "wrong_product", icon: "📦", label: "ভুল পণ্য পেয়েছি" },
      { key: "damaged_product", icon: "💔", label: "পণ্য নষ্ট/ক্ষতিগ্রস্ত" },
      { key: "missing_item", icon: "🔍", label: "পণ্য পাইনি" },
      { key: "delivery_issue", icon: "🚚", label: "ডেলিভারি সমস্যা" },
      { key: "payment_issue", icon: "💳", label: "পেমেন্ট সমস্যা" },
      { key: "refund_request", icon: "💰", label: "রিফান্ড চাই" },
      { key: "quality_issue", icon: "⚠️", label: "মানসম্পন্ন নয়" },
      { key: "late_delivery", icon: "⏰", label: "দেরিতে ডেলিভারি" },
      { key: "rude_behavior", icon: "😤", label: "অভদ্র আচরণ" },
      { key: "other", icon: "📝", label: "অন্যান্য" },
    ];
  
    const STATUS_LABELS = {
      open: { label: "খোলা", icon: "📬", cls: "cstatus-open" },
      under_review: { label: "রিভিউয়ের মধ্যে", icon: "🔍", cls: "cstatus-under_review" },
      on_hold: { label: "স্থগিত", icon: "⏸️", cls: "cstatus-on_hold" },
      escalated: { label: "এস্কালেটেড", icon: "⬆️", cls: "cstatus-escalated" },
      resolved: { label: "সমাধান হয়েছে", icon: "✅", cls: "cstatus-resolved" },
      rejected: { label: "বাতিল", icon: "❌", cls: "cstatus-rejected" },
      closed: { label: "বন্ধ", icon: "🔒", cls: "cstatus-closed" },
    };
  
    const RESOLUTION_LABELS = {
      refund: "রিফান্ড",
      replacement: "প্রতিস্থাপন",
      discount_coupon: "ডিসকাউন্ট কুপন",
      apology: "ক্ষমাপ্রার্থনা",
      no_action: "কোনো ব্যবস্থা নেই",
      other: "অন্যান্য",
    };
  
    /* ── Helper: format date ────────────────────────────────── */
    function fmtDate(d) {
      if (!d) return "—";
      return new Date(d).toLocaleString("en-BD", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  
    /* ── Helper: show message ───────────────────────────────── */
    function showMsg(elId, text, type = "error") {
      const el = document.getElementById(elId);
      if (!el) return;
      el.textContent = text;
      el.className = `complaint-msg complaint-msg-${type}`;
    }
  
    /* ── Helper: escape HTML ────────────────────────────────── */
    function esc(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  
    /* ══════════════════════════════════════════════════════════
       SECTION RENDERER
    ══════════════════════════════════════════════════════════ */
    function renderSection(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
  
      container.innerHTML = `
        <section class="complaint-section" id="complaintMainSection">
          
          <!-- Header -->
          <div class="complaint-section-header">
            <div class="complaint-section-title">
              <div class="complaint-section-icon"><i class="fas fa-headset"></i></div>
              <h2>অভিযোগ ও সহায়তা</h2>
            </div>
          </div>
  
          <!-- Hero -->
          <div class="complaint-hero">
            <div class="complaint-hero-inner">
              <div class="complaint-hero-text">
                <div class="complaint-hero-badge">
                  <i class="fas fa-shield-halved"></i> ২৪ ঘণ্টার মধ্যে জবাব
                </div>
                <h3>সমস্যা হয়েছে?<br>আমরা সমাধান দিতে প্রস্তুত।</h3>
                <p>পণ্যে কোনো সমস্যা হলে আমাদের জানান। আমাদের দল দ্রুত সমাধান করবে এবং প্রতিটি ধাপে আপনাকে জানানো হবে।</p>
                <div class="complaint-hero-cta">
                  <button class="btn-primary" onclick="ComplaintModule.goToForm()">
                    <i class="fas fa-pen-to-square"></i> অভিযোগ দাখিল করুন
                  </button>
                  <button class="btn-ghost" style="color: white;" onclick="ComplaintModule.focusTrack()">
                    <i class="fas fa-search"></i> টিকেট ট্র্যাক করুন
                  </button>
                </div>
              </div>
              <div class="complaint-hero-stats">
                <div class="complaint-hero-stat">
                  <div class="complaint-hero-stat-num">২৪ঘ</div>
                  <div class="complaint-hero-stat-label">গড় প্রতিক্রিয়া<br>সময়</div>
                </div>
                <div class="complaint-hero-stat">
                  <div class="complaint-hero-stat-num">৯৫%</div>
                  <div class="complaint-hero-stat-label">সমাধানের<br>হার</div>
                </div>
                <div class="complaint-hero-stat">
                  <div class="complaint-hero-stat-num">৪.৮★</div>
                  <div class="complaint-hero-stat-label">গ্রাহক<br>সন্তুষ্টি</div>
                </div>
              </div>
            </div>
          </div>
  
          <!-- Process steps -->
          <div class="complaint-process">
            <div class="complaint-process-step">
              <div class="complaint-process-step-num">১</div>
              <div class="complaint-process-step-title">অভিযোগ দাখিল</div>
              <div class="complaint-process-step-desc">বিভাগ বাছুন এবং বিস্তারিত তথ্য দিন</div>
            </div>
            <div class="complaint-process-step">
              <div class="complaint-process-step-num">২</div>
              <div class="complaint-process-step-title">টিকেট পাবেন</div>
              <div class="complaint-process-step-desc">ইমেইলে টিকেট নম্বর পাঠানো হবে</div>
            </div>
            <div class="complaint-process-step">
              <div class="complaint-process-step-num">৩</div>
              <div class="complaint-process-step-title">পর্যালোচনা</div>
              <div class="complaint-process-step-desc">আমাদের টিম ২৪ ঘণ্টায় দেখবে</div>
            </div>
            <div class="complaint-process-step">
              <div class="complaint-process-step-num">৪</div>
              <div class="complaint-process-step-title">সমাধান</div>
              <div class="complaint-process-step-desc">রিফান্ড, প্রতিস্থাপন বা ক্ষমাপ্রার্থনা</div>
            </div>
          </div>
  
          <!-- Complaint Form Card -->
          <div class="complaint-form-card" id="complaintFormCard">
            <div class="complaint-form-card-header">
              <div class="complaint-form-card-header-icon"><i class="fas fa-pen-to-square"></i></div>
              <div>
                <div class="complaint-form-card-header-title">নতুন অভিযোগ দাখিল করুন</div>
                <div class="complaint-form-card-header-sub">সকল তথ্য সঠিকভাবে পূরণ করুন</div>
              </div>
            </div>
            <div class="complaint-form-body">
              
              <!-- Steps bar -->
              <div class="complaint-steps-bar" id="cStepsBar">
                <div class="complaint-step-wrapper">
                  <div class="complaint-step-dot active" id="csDot1">১</div>
                  <div class="complaint-step-label active" id="csLbl1">বিভাগ</div>
                </div>
                <div class="complaint-step-line" id="csLine1"></div>
                <div class="complaint-step-wrapper">
                  <div class="complaint-step-dot" id="csDot2">২</div>
                  <div class="complaint-step-label" id="csLbl2">তথ্য</div>
                </div>
                <div class="complaint-step-line" id="csLine2"></div>
                <div class="complaint-step-wrapper">
                  <div class="complaint-step-dot" id="csDot3">৩</div>
                  <div class="complaint-step-label" id="csLbl3">বিবরণ</div>
                </div>
                <div class="complaint-step-line" id="csLine3"></div>
                <div class="complaint-step-wrapper">
                  <div class="complaint-step-dot" id="csDot4">৪</div>
                  <div class="complaint-step-label" id="csLbl4">নিশ্চিত</div>
                </div>
              </div>
  
              <!-- Step content -->
              <div id="complaintStepContent"></div>
  
              <!-- Success state -->
              <div class="complaint-success-state" id="complaintSuccessState">
                <div class="complaint-success-icon"><i class="fas fa-check"></i></div>
                <h3>অভিযোগ সফলভাবে দাখিল হয়েছে!</h3>
                <p>আপনার অভিযোগটি আমাদের কাছে পৌঁছেছে। আমরা দ্রুত পর্যালোচনা করে ব্যবস্থা নেব।</p>
                <div class="complaint-ticket-chip">
                  <i class="fas fa-ticket-alt"></i>
                  <span id="cSuccessTicket">—</span>
                </div>
                <p style="font-size:0.8rem;color:#6B7A99;margin-bottom:1rem;">এই টিকেট নম্বরটি সংরক্ষণ করুন — ট্র্যাকিংয়ে কাজে লাগবে।</p>
                <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
                  <button class="btn-primary" onclick="ComplaintModule.trackFromSuccess()">
                    <i class="fas fa-search"></i> টিকেট ট্র্যাক করুন
                  </button>
                  <button class="btn-ghost" onclick="ComplaintModule.resetForm()">
                    <i class="fas fa-plus"></i> নতুন অভিযোগ
                  </button>
                </div>
              </div>
  
            </div>
          </div>
  
          <!-- Track complaint card -->
          <div class="complaint-track-card" id="complaintTrackCard">
            <div class="complaint-track-header">
              <div class="complaint-track-title">
                <i class="fas fa-satellite-dish"></i> টিকেট ট্র্যাক করুন
              </div>
            </div>
            <div class="complaint-track-body">
              <div class="complaint-track-row">
                <div class="complaint-track-inputs">
                  <input type="text" id="cTrackTicket" placeholder="টিকেট নম্বর (TKT-202506-XXXXX)" style="text-transform:uppercase;" autocomplete="off" spellcheck="false"
                    onkeydown="if(event.key==='Enter') ComplaintModule.trackComplaint()"
                    oninput="this.value=this.value.toUpperCase()"/>
                  <input type="email" id="cTrackEmail" placeholder="আপনার ইমেইল ঠিকানা"
                    onkeydown="if(event.key==='Enter') ComplaintModule.trackComplaint()"/>
                </div>
                <button class="complaint-track-btn" onclick="ComplaintModule.trackComplaint()">
                  <i class="fas fa-search"></i> ট্র্যাক করুন
                </button>
              </div>
              <div id="cTrackMsg"></div>
              <div class="complaint-track-result" id="cTrackResult"></div>
            </div>
          </div>
  
          <!-- FAQ section -->
          <div style="margin-top: 1.5rem;">
            <div style="font-family:'DM Serif Display',serif;font-size:1.1rem;color:#0D1B3E;margin-bottom:1rem;display:flex;align-items:center;gap:8px;">
              <i class="fas fa-circle-question" style="color:#C47F11;font-size:0.9rem;"></i>
              সাধারণ প্রশ্নসমূহ
            </div>
            <div class="complaint-faq-grid">
              <div class="complaint-faq-item">
                <div class="complaint-faq-icon"><i class="fas fa-clock"></i></div>
                <div class="complaint-faq-q">কতদিনে সমাধান পাব?</div>
                <div class="complaint-faq-a">সাধারণত ২৪–৪৮ ঘণ্টার মধ্যে প্রতিক্রিয়া পাবেন।</div>
              </div>
              <div class="complaint-faq-item">
                <div class="complaint-faq-icon"><i class="fas fa-rotate-left"></i></div>
                <div class="complaint-faq-q">রিফান্ড কীভাবে পাব?</div>
                <div class="complaint-faq-a">অভিযোগ অনুমোদনের পর ৩–৫ কার্যদিবসে রিফান্ড দেওয়া হবে।</div>
              </div>
              <div class="complaint-faq-item">
                <div class="complaint-faq-icon"><i class="fas fa-images"></i></div>
                <div class="complaint-faq-q">ছবি কি পাঠাতে পারব?</div>
                <div class="complaint-faq-a">হ্যাঁ, অভিযোগের সাথে প্রমাণ হিসেবে ছবি যোগ করতে পারবেন।</div>
              </div>
              <div class="complaint-faq-item">
                <div class="complaint-faq-icon"><i class="fas fa-headset"></i></div>
                <div class="complaint-faq-q">সরাসরি কথা বলতে চাই?</div>
                <div class="complaint-faq-a">01700-000000 নম্বরে কল করুন বা WhatsApp করুন।</div>
              </div>
            </div>
          </div>
  
        </section>
      `;
  
      // Render step 1
      renderStep(1);
    }
  
    /* ══════════════════════════════════════════════════════════
       STEP RENDERING
    ══════════════════════════════════════════════════════════ */
    function renderStep(step) {
      state.step = step;
      updateStepsBar(step);
  
      const content = document.getElementById("complaintStepContent");
      const successState = document.getElementById("complaintSuccessState");
      if (!content) return;
  
      if (successState) successState.style.display = "none";
      content.style.display = "block";
  
      if (step === 1) renderStep1(content);
      else if (step === 2) renderStep2(content);
      else if (step === 3) renderStep3(content);
      else if (step === 4) renderStep4(content);
    }
  
    function updateStepsBar(activeStep) {
      for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`csDot${i}`);
        const lbl = document.getElementById(`csLbl${i}`);
        const line = document.getElementById(`csLine${i}`);
        if (!dot) continue;
  
        dot.className = "complaint-step-dot" + (i < activeStep ? " done" : i === activeStep ? " active" : "");
        if (i < activeStep) dot.innerHTML = '<i class="fas fa-check" style="font-size:0.7rem;"></i>';
        else {
          const nums = ["১","২","৩","৪"];
          dot.textContent = nums[i - 1];
        }
  
        lbl.className = "complaint-step-label" + (i < activeStep ? " done" : i === activeStep ? " active" : "");
        if (line) line.className = "complaint-step-line" + (i < activeStep ? " done" : "");
      }
    }
  
    /* ── Step 1: Category selection ─────────────────────────── */
    function renderStep1(container) {
      const catsHtml = CATEGORIES.map(
        (c) =>
          `<div class="complaint-category-item ${state.category === c.key ? "selected" : ""}"
             onclick="ComplaintModule.selectCategory('${c.key}')">
            <span class="complaint-category-icon">${c.icon}</span>
            <div class="complaint-category-name">${c.label}</div>
          </div>`
      ).join("");
  
      container.innerHTML = `
        <div style="margin-bottom:1rem;">
          <div style="font-size:0.85rem;font-weight:600;color:#0D1B3E;margin-bottom:0.75rem;">
            আপনার অভিযোগের ধরন নির্বাচন করুন <span style="color:#e53e3e;">*</span>
          </div>
          <div class="complaint-category-grid">${catsHtml}</div>
          <div id="cStep1Msg" class="complaint-msg"></div>
        </div>
        <div class="complaint-form-nav">
          <button class="complaint-btn-next" id="cNextBtn1" onclick="ComplaintModule.next1()" ${!state.category ? "disabled" : ""}>
            পরবর্তী ধাপ <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      `;
    }
  
    /* ── Step 2: Customer info ───────────────────────────────── */
    function renderStep2(container) {
      const fd = state.formData;
      container.innerHTML = `
        <div style="font-size:0.82rem;color:#6B7A99;margin-bottom:1.1rem;padding:0.75rem 1rem;background:#F5F0E8;border-radius:10px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-info-circle" style="color:#C47F11;"></i>
          আপনার পরিচয় যাচাই করতে এই তথ্যগুলো প্রয়োজন।
        </div>
        <div class="complaint-form-row">
          <div class="complaint-form-group">
            <label><i class="fas fa-user"></i> আপনার নাম <span class="req">*</span></label>
            <input type="text" id="cName" placeholder="আপনার পূর্ণ নাম" value="${esc(fd.name || "")}" 
              oninput="ComplaintModule.autoFillFromCheckout()" />
          </div>
          <div class="complaint-form-group">
            <label><i class="fas fa-envelope"></i> ইমেইল <span class="req">*</span></label>
            <input type="email" id="cEmail" placeholder="example@gmail.com" value="${esc(fd.email || "")}" />
          </div>
        </div>
        <div class="complaint-form-group">
          <label><i class="fas fa-phone"></i> মোবাইল নম্বর</label>
          <input type="tel" id="cPhone" placeholder="01XXXXXXXXX" value="${esc(fd.phone || "")}" />
          <div style="font-size:0.7rem;color:#A0ABBE;margin-top:3px;">বাংলাদেশি নম্বর — ঐচ্ছিক কিন্তু সহায়ক</div>
        </div>
        <div class="complaint-form-group">
          <label><i class="fas fa-hashtag"></i> অর্ডার নম্বর</label>
          <input type="text" id="cOrderNum" placeholder="ORD-2025XX-XXXXX (ঐচ্ছিক)" value="${esc(fd.orderNumber || "")}" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()" />
          <div style="font-size:0.7rem;color:#A0ABBE;margin-top:3px;">থাকলে দিন — আমাদের সমাধান করতে সুবিধা হবে</div>
        </div>
        <div id="cStep2Msg" class="complaint-msg"></div>
        <div class="complaint-form-nav">
          <button class="complaint-btn-back" onclick="ComplaintModule.renderStep(1)">
            <i class="fas fa-arrow-left"></i> পিছনে
          </button>
          <button class="complaint-btn-next" onclick="ComplaintModule.next2()">
            পরবর্তী ধাপ <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      `;
  
      // Auto fill from saved checkout info
      autoFillFromSaved();
    }
  
    /* ── Step 3: Subject + description ──────────────────────── */
    function renderStep3(container) {
      const fd = state.formData;
      const catInfo = CATEGORIES.find((c) => c.key === state.category);
  
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:0.625rem 0.875rem;background:#F5F0E8;border-radius:8px;margin-bottom:1.1rem;font-size:0.8rem;color:#6B7A99;">
          <span style="font-size:1.1rem;">${catInfo ? catInfo.icon : "📝"}</span>
          <span>বিভাগ: <strong style="color:#0D1B3E;">${catInfo ? catInfo.label : ""}</strong></span>
        </div>
  
        <div class="complaint-form-group">
          <label><i class="fas fa-pen"></i> অভিযোগের বিষয় <span class="req">*</span></label>
          <input type="text" id="cSubject" placeholder="সংক্ষেপে বিষয়টি লিখুন" maxlength="200"
            value="${esc(fd.subject || "")}" 
            oninput="document.getElementById('cSubjectCount').textContent=this.value.length"/>
          <div class="char-counter"><span id="cSubjectCount">${(fd.subject || "").length}</span>/200</div>
        </div>
  
        <div class="complaint-form-group">
          <label><i class="fas fa-align-left"></i> বিস্তারিত বিবরণ <span class="req">*</span></label>
          <textarea id="cDesc" placeholder="পণ্যে কী সমস্যা হয়েছে তা বিস্তারিত লিখুন — কবে হয়েছে, কীভাবে হয়েছে..." maxlength="3000"
            oninput="document.getElementById('cDescCount').textContent=this.value.length"
            >${esc(fd.description || "")}</textarea>
          <div class="char-counter" style="margin-top:3px;display:flex;justify-content:space-between;">
            <span style="color:#A0ABBE;font-size:0.68rem;">কমপক্ষে ২০ অক্ষর লিখুন</span>
            <span><span id="cDescCount">${(fd.description || "").length}</span>/3000</span>
          </div>
        </div>

        <!-- Attachments -->
<div class="complaint-form-group">
  <label><i class="fas fa-paperclip"></i> সংযুক্তি (ঐচ্ছিক)</label>
  <div class="c-attachment-dropzone" id="cAttachmentDropzone" style="border:2px dashed #E8EBF4;border-radius:12px;padding:1rem;text-align:center;cursor:pointer;background:#FFFBF5;transition:all 0.2s;" 
       onclick="document.getElementById('cFileInput').click()"
       ondragover="event.preventDefault();this.style.borderColor='#F5A623';this.style.background='rgba(245,166,35,0.05)';"
       ondragleave="event.preventDefault();this.style.borderColor='#E8EBF4';this.style.background='#FFFBF5';"
       ondrop="event.preventDefault();ComplaintModule.handleDrop(event);">
    <i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:#A0ABBE;margin-bottom:8px;display:block;"></i>
    <div style="font-size:0.75rem;color:#6B7A99;">ফাইল টেনে আনুন বা ক্লিক করুন</div>
    <div style="font-size:0.65rem;color:#A0ABBE;margin-top:4px;">সর্বোচ্চ ৫টি ফাইল (JPG, PNG, PDF) — প্রতিটি ৫MB পর্যন্ত</div>
  </div>
  <input type="file" id="cFileInput" multiple accept="image/jpeg,image/png,image/jpg,image/gif,application/pdf" style="display:none;" onchange="ComplaintModule.handleFileSelect(this)">
  <div id="cAttachmentList" class="c-attachment-list" style="margin-top:10px;"></div>
  <div id="cAttachMsg" class="complaint-msg"></div>
</div>
  
        <div id="cStep3Msg" class="complaint-msg"></div>
        <div class="complaint-form-nav">
          <button class="complaint-btn-back" onclick="ComplaintModule.renderStep(2)">
            <i class="fas fa-arrow-left"></i> পিছনে
          </button>
          <button class="complaint-btn-next" onclick="ComplaintModule.next3()">
            পর্যালোচনা করুন <i class="fas fa-eye"></i>
          </button>
        </div>
      `;
    }
  
    /* ── Step 4: Review & confirm ───────────────────────────── */
    function renderStep4(container) {
      const fd = state.formData;
      const catInfo = CATEGORIES.find((c) => c.key === state.category);
  
      container.innerHTML = `
        <div style="font-size:0.82rem;color:#1E8A4A;padding:0.75rem 1rem;background:#E8F5EE;border-radius:10px;margin-bottom:1.1rem;display:flex;align-items:center;gap:8px;border:1px solid rgba(30,138,74,0.2);">
          <i class="fas fa-check-circle"></i>
          সব তথ্য পর্যালোচনা করুন, তারপর দাখিল করুন।
        </div>
  
        <div style="background:#F5F0E8;border-radius:14px;padding:1.1rem;margin-bottom:1rem;">
          <div style="font-size:0.72rem;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;">আপনার তথ্য</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div>
              <div style="font-size:0.68rem;color:#A0ABBE;">নাম</div>
              <div style="font-size:0.85rem;font-weight:600;color:#0D1B3E;">${esc(fd.name)}</div>
            </div>
            <div>
              <div style="font-size:0.68rem;color:#A0ABBE;">ইমেইল</div>
              <div style="font-size:0.85rem;font-weight:600;color:#0D1B3E;word-break:break-all;">${esc(fd.email)}</div>
            </div>
            ${fd.phone ? `<div>
              <div style="font-size:0.68rem;color:#A0ABBE;">মোবাইল</div>
              <div style="font-size:0.85rem;font-weight:600;color:#0D1B3E;">${esc(fd.phone)}</div>
            </div>` : ""}
            ${fd.orderNumber ? `<div>
              <div style="font-size:0.68rem;color:#A0ABBE;">অর্ডার নম্বর</div>
              <div style="font-size:0.85rem;font-weight:600;color:#F5A623;font-family:monospace;">${esc(fd.orderNumber)}</div>
            </div>` : ""}
          </div>
        </div>
  
        <div style="background:#F5F0E8;border-radius:14px;padding:1.1rem;">
          <div style="font-size:0.72rem;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;">অভিযোগের বিবরণ</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:0.625rem;">
            <span style="font-size:1.1rem;">${catInfo ? catInfo.icon : "📝"}</span>
            <span style="font-size:0.78rem;font-weight:700;background:rgba(245,166,35,0.15);color:#C47F11;padding:2px 10px;border-radius:50px;border:1px solid rgba(245,166,35,0.3);">${catInfo ? catInfo.label : ""}</span>
          </div>
          <div style="font-size:0.875rem;font-weight:700;color:#0D1B3E;margin-bottom:0.375rem;">${esc(fd.subject)}</div>
          <div style="font-size:0.8rem;color:#6B7A99;line-height:1.6;max-height:80px;overflow:hidden;position:relative;">
            ${esc(fd.description)}
            <div style="position:absolute;bottom:0;left:0;right:0;height:30px;background:linear-gradient(transparent,#F5F0E8);"></div>
          </div>
        </div>
  
        <div id="cStep4Msg" class="complaint-msg"></div>
        <div class="complaint-form-nav">
          <button class="complaint-btn-back" onclick="ComplaintModule.renderStep(3)">
            <i class="fas fa-arrow-left"></i> পিছনে
          </button>
          <button class="complaint-btn-next" id="cSubmitBtn" onclick="ComplaintModule.submitComplaint()">
            <i class="fas fa-paper-plane"></i> অভিযোগ দাখিল করুন
          </button>
        </div>
      `;
    }
  
    /* ══════════════════════════════════════════════════════════
       NAVIGATION LOGIC
    ══════════════════════════════════════════════════════════ */
    function selectCategory(key) {
      state.category = key;
      // Update UI
      document.querySelectorAll(".complaint-category-item").forEach((el) => {
        el.classList.toggle(
          "selected",
          el.onclick && el.getAttribute("onclick") &&
            el.getAttribute("onclick").includes(`'${key}'`)
        );
      });
      // Remove selected from all, add to correct
      document.querySelectorAll(".complaint-category-item").forEach((el) => {
        const onclk = el.getAttribute("onclick") || "";
        el.classList.toggle("selected", onclk.includes(`'${key}'`));
      });
      // Enable next button
      const btn = document.getElementById("cNextBtn1");
      if (btn) btn.disabled = false;
      // Clear msg
      showMsg("cStep1Msg", "");
    }
  
    function next1() {
      if (!state.category) {
        showMsg("cStep1Msg", "অনুগ্রহ করে একটি বিভাগ নির্বাচন করুন", "error");
        return;
      }
      renderStep(2);
    }
  
    function next2() {
      const name = (document.getElementById("cName")?.value || "").trim();
      const email = (document.getElementById("cEmail")?.value || "").trim();
      const phone = (document.getElementById("cPhone")?.value || "").trim();
      const orderNumber = (document.getElementById("cOrderNum")?.value || "").trim();
  
      if (!name) { showMsg("cStep2Msg", "নাম আবশ্যক", "error"); return; }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        showMsg("cStep2Msg", "সঠিক ইমেইল ঠিকানা দিন", "error"); return;
      }
      if (phone && !/^01[3-9]\d{8}$/.test(phone.replace(/\D/g, ""))) {
        showMsg("cStep2Msg", "সঠিক বাংলাদেশি মোবাইল নম্বর দিন", "error"); return;
      }
  
      state.formData = { ...state.formData, name, email, phone: phone || undefined, orderNumber: orderNumber || undefined };
      renderStep(3);
    }
  
    function next3() {
      const subject = (document.getElementById("cSubject")?.value || "").trim();
      const description = (document.getElementById("cDesc")?.value || "").trim();
  
      if (!subject) { showMsg("cStep3Msg", "অভিযোগের বিষয় লিখুন", "error"); return; }
      if (description.length < 20) {
        showMsg("cStep3Msg", "অভিযোগের বিবরণ কমপক্ষে ২০ অক্ষর হতে হবে", "error"); return;
      }
  
      state.formData = { ...state.formData, subject, description };
      renderStep(4);
    }
  
    /* ── Auto fill from saved checkout/localStorage ─────────── */
    function autoFillFromSaved() {
      try {
        const saved = JSON.parse(localStorage.getItem("bh_checkout_info") || "{}");
        const nameEl = document.getElementById("cName");
        const emailEl = document.getElementById("cEmail");
        const phoneEl = document.getElementById("cPhone");
        if (nameEl && !nameEl.value && saved.checkoutName) nameEl.value = saved.checkoutName;
        if (emailEl && !emailEl.value && saved.checkoutEmail) emailEl.value = saved.checkoutEmail;
        if (phoneEl && !phoneEl.value && saved.checkoutPhone) phoneEl.value = saved.checkoutPhone;
      } catch (e) {}
    }
  
    /* ══════════════════════════════════════════════════════════
       SUBMIT COMPLAINT
    ══════════════════════════════════════════════════════════ */
    async function submitComplaint() {
        if (state.submitting) return;
        state.submitting = true;
      
        const btn = document.getElementById("cSubmitBtn");
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> দাখিল হচ্ছে...';
        }
      
        showMsg("cStep4Msg", "");
      
        // Create FormData for file upload
        const formData = new FormData();
        
        // Add customer data as JSON string
        const customerData = {
          name: state.formData.name,
          email: state.formData.email,
          phone: state.formData.phone || undefined,
        };
        formData.append("customer", JSON.stringify(customerData));
        formData.append("category", state.category);
        formData.append("subject", state.formData.subject);
        formData.append("description", state.formData.description);
        if (state.formData.orderNumber) {
          formData.append("orderNumber", state.formData.orderNumber);
        }
        
        // Add attachments
        state.attachments.forEach((att) => {
          formData.append("attachments", att.file);
        });
      
        try {
          const res = await fetch(`${API}/complaints`, {
            method: "POST",
            body: formData, // Don't set Content-Type header - browser sets it with boundary
          });
          
          const data = await res.json();
      
          if (!data.success) throw new Error(data.message || "অভিযোগ দাখিল ব্যর্থ");
      
          // Show success
          const stepContent = document.getElementById("complaintStepContent");
          const successState = document.getElementById("complaintSuccessState");
          if (stepContent) stepContent.style.display = "none";
          if (successState) successState.style.display = "block";
      
          const ticketEl = document.getElementById("cSuccessTicket");
          if (ticketEl) ticketEl.textContent = data.data.ticketNumber;
      
          updateStepsBar(5);
          state.lastTicket = data.data.ticketNumber;
          state.lastEmail = state.formData.email;
          
          // Clear attachments after successful submission
          state.attachments = [];
          renderAttachmentList();
      
        } catch (err) {
          console.error("Submit error details:", err);
          showMsg("cStep4Msg", err.message || "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
        } finally {
          state.submitting = false;
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> অভিযোগ দাখিল করুন';
          }
        }
      }
  
    /* ══════════════════════════════════════════════════════════
       TRACK COMPLAINT
    ══════════════════════════════════════════════════════════ */
    async function trackComplaint() {
      if (state.tracking) return;
  
      const ticketEl = document.getElementById("cTrackTicket");
      const emailEl = document.getElementById("cTrackEmail");
      const ticket = (ticketEl?.value || "").trim().toUpperCase();
      const email = (emailEl?.value || "").trim().toLowerCase();
  
      if (!ticket) { showMsg("cTrackMsg", "টিকেট নম্বর লিখুন", "error"); return; }
      if (!email) { showMsg("cTrackMsg", "ইমেইল ঠিকানা লিখুন", "error"); return; }
  
      state.tracking = true;
      showMsg("cTrackMsg", "");
  
      const btn = document.querySelector(".complaint-track-btn");
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> খোঁজা হচ্ছে...'; }
  
      const resultEl = document.getElementById("cTrackResult");
      if (resultEl) {
        resultEl.style.display = "block";
        resultEl.innerHTML = `
          <div style="padding:1rem 0;">
            <div class="complaint-skel" style="height:60px;margin-bottom:10px;"></div>
            <div class="complaint-skel" style="height:120px;margin-bottom:10px;"></div>
            <div class="complaint-skel" style="height:80px;"></div>
          </div>`;
      }
  
      try {
        const res = await fetch(
          `${API}/complaints/track/${encodeURIComponent(ticket)}?email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
  
        if (!data.success) throw new Error(data.message || "টিকেট পাওয়া যায়নি");
  
        state.trackedComplaint = data.data;
        renderTrackResult(data.data, resultEl);
  
      } catch (err) {
        if (resultEl) {
          resultEl.innerHTML = `
            <div style="text-align:center;padding:1.5rem 1rem;">
              <div style="width:56px;height:56px;background:#FDEDEC;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 0.875rem;font-size:1.4rem;color:#C0392B;">
                <i class="fas fa-circle-xmark"></i>
              </div>
              <div style="font-weight:700;color:#0D1B3E;margin-bottom:0.375rem;">টিকেট পাওয়া যায়নি</div>
              <div style="font-size:0.8rem;color:#6B7A99;line-height:1.6;">${esc(err.message)}</div>
            </div>`;
        }
      } finally {
        state.tracking = false;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-search"></i> ট্র্যাক করুন';
        }
      }
    }
  
    /* ── Render tracked result ──────────────────────────────── */
    function renderTrackResult(c, container) {
      if (!container) return;
      const status = STATUS_LABELS[c.status] || { label: c.status, icon: "📋", cls: "cstatus-open" };
  
      // Build replies/timeline HTML
      let timelineHtml = "";
      if (c.replies && c.replies.length > 0) {
        timelineHtml = c.replies.map((r) => {
          const isAdmin = r.authorType === "admin";
          const dotClass = isAdmin ? "admin-dot" : "customer-dot";
          const msgClass = isAdmin ? "admin-msg" : "";
          const dotIcon = isAdmin ? '<i class="fas fa-headset"></i>' : '<i class="fas fa-user"></i>';
          return `
            <div class="complaint-timeline-item">
              <div class="cti-dot-wrap">
                <div class="cti-dot ${dotClass}">${dotIcon}</div>
                <div class="cti-line"></div>
              </div>
              <div class="cti-content">
                <div class="cti-author">
                  ${esc(r.authorName || (isAdmin ? "সাপোর্ট টিম" : "আপনি"))}
                  <span class="cti-time">${fmtDate(r.createdAt)}</span>
                </div>
                <div class="cti-message ${msgClass}">${esc(r.message)}</div>
              </div>
            </div>`;
        }).join("");
      } else {
        timelineHtml = `<div style="text-align:center;padding:1rem;font-size:0.8rem;color:#A0ABBE;">
          <i class="fas fa-comment-dots" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;opacity:0.3;"></i>
          এখনো কোনো বার্তা নেই
        </div>`;
      }
  
      // Resolution block
      let resolutionHtml = "";
      if (c.status === "resolved" && c.resolution) {
        const r = c.resolution;
        resolutionHtml = `
          <div class="complaint-resolution-block">
            <div class="complaint-resolution-title"><i class="fas fa-check-circle"></i> সমাধানের বিবরণ</div>
            ${r.details ? `<div class="complaint-resolution-detail">${esc(r.details)}</div>` : ""}
            ${r.refundAmount ? `<div class="complaint-resolution-amount"><i class="fas fa-coins"></i> রিফান্ড পরিমাণ: ৳${r.refundAmount.toLocaleString()}</div>` : ""}
            ${r.couponCode ? `<div style="margin-top:6px;font-size:0.75rem;color:rgba(255,255,255,0.6);">কুপন কোড:</div>
              <div class="complaint-resolution-coupon">${esc(r.couponCode)}</div>` : ""}
          </div>`;
      }
  
      // Satisfaction widget (only for resolved, not yet rated)
      let satHtml = "";
      if (c.status === "resolved" && !c.satisfactionRating?.score) {
        satHtml = `
          <div class="complaint-satisfaction" id="cSatBox">
            <div class="complaint-satisfaction-title">আমাদের সেবা কেমন ছিল?</div>
            <div class="complaint-satisfaction-stars" id="cSatStars">
              ${[1,2,3,4,5].map(n => `
                <button class="complaint-sat-star" data-val="${n}"
                  onclick="ComplaintModule.setSatRating(${n})"
                  onmouseenter="ComplaintModule.hoverSat(${n})"
                  onmouseleave="ComplaintModule.hoverSatEnd()">
                  ${n <= 3 ? ["😡","😞","😐","😊","🤩"][n-1] : ["😡","😞","😐","😊","🤩"][n-1]}
                </button>`).join("")}
            </div>
            <div id="cSatMsg" style="font-size:0.75rem;color:#A0ABBE;min-height:18px;"></div>
          </div>`;
      } else if (c.satisfactionRating?.score) {
        const emojis = ["😡","😞","😐","😊","🤩"];
        satHtml = `
          <div style="text-align:center;padding:0.75rem;background:#ECFDF5;border-radius:12px;margin-top:0.75rem;border:1px solid rgba(30,138,74,0.2);">
            <span style="font-size:1.8rem;">${emojis[c.satisfactionRating.score - 1] || "⭐"}</span>
            <div style="font-size:0.78rem;color:#059669;font-weight:600;margin-top:4px;">আপনি ইতিমধ্যে রেটিং দিয়েছেন (${c.satisfactionRating.score}/৫)</div>
          </div>`;
      }
  
      // Reply box (only if not closed/resolved/rejected)
      const canReply = !["resolved", "rejected", "closed"].includes(c.status);
      const replyHtml = canReply ? `
        <div class="complaint-reply-box">
          <div class="complaint-reply-box-title">
            <i class="fas fa-reply"></i> উত্তর পাঠান
          </div>
          <textarea id="cReplyText" placeholder="আপনার বার্তা লিখুন..." maxlength="2000"></textarea>
          <div id="cReplyMsg" class="complaint-msg"></div>
          <button class="complaint-reply-send-btn" onclick="ComplaintModule.sendReply('${esc(c._id)}', '${esc(c.customer?.email || "")}')">
            <i class="fas fa-paper-plane"></i> পাঠান
          </button>
        </div>` : "";
  
      const statusColors = {
        open: "#EFF6FF", under_review: "#F5F3FF", on_hold: "#FFFBEB",
        escalated: "#FEF2F2", resolved: "#ECFDF5", rejected: "#F9FAFB", closed: "#F3F4F6"
      };
      const borderColors = {
        open: "#BFDBFE", under_review: "#DDD6FE", on_hold: "#FCD34D",
        escalated: "#FCA5A5", resolved: "#6EE7B7", rejected: "#D1D5DB", closed: "#9CA3AF"
      };
  
      container.innerHTML = `
        <div class="complaint-result-header" style="background:${statusColors[c.status] || "#F9FAFB"};border-color:${borderColors[c.status] || "#E8EBF4"};">
          <div>
            <div class="complaint-result-ticket"><i class="fas fa-ticket-alt" style="color:#C47F11;font-size:0.85rem;margin-right:6px;"></i>${esc(c.ticketNumber)}</div>
            <div class="complaint-result-date"><i class="fas fa-calendar-alt" style="font-size:0.65rem;margin-right:4px;"></i>${fmtDate(c.createdAt)}</div>
          </div>
          <div>
            <div class="complaint-status-badge ${status.cls}">${status.icon} ${status.label}</div>
          </div>
        </div>
  
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;margin-bottom:1rem;">
          <div style="background:#F5F0E8;border-radius:10px;padding:0.75rem;">
            <div style="font-size:0.65rem;color:#A0ABBE;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">বিভাগ</div>
            <div style="font-size:0.8rem;font-weight:600;color:#0D1B3E;">${
              CATEGORIES.find((cat) => cat.key === c.category)?.label || c.category
            }</div>
          </div>
          <div style="background:#F5F0E8;border-radius:10px;padding:0.75rem;">
            <div style="font-size:0.65rem;color:#A0ABBE;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">অগ্রাধিকার</div>
            <div style="font-size:0.8rem;font-weight:600;color:${c.priority === "urgent" ? "#C0392B" : c.priority === "high" ? "#E67E22" : "#0D1B3E"};">
              ${c.priority === "urgent" ? "🚨 জরুরি" : c.priority === "high" ? "🔴 উচ্চ" : c.priority === "medium" ? "🟡 মধ্যম" : "🔵 নিম্ন"}
            </div>
          </div>
        </div>
  
        <div style="background:#F5F0E8;border-radius:12px;padding:0.875rem 1rem;margin-bottom:1rem;">
          <div style="font-size:0.68rem;color:#A0ABBE;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">বিষয়</div>
          <div style="font-size:0.875rem;font-weight:700;color:#0D1B3E;">${esc(c.subject)}</div>
        </div>
  
        ${resolutionHtml}
  
        <div style="margin-bottom:1rem;">
          <div style="font-size:0.75rem;font-weight:700;color:#0D1B3E;margin-bottom:0.75rem;display:flex;align-items:center;gap:7px;padding-bottom:0.5rem;border-bottom:1px solid #E8EBF4;">
            <i class="fas fa-comments" style="color:#C47F11;font-size:0.7rem;"></i> বার্তা থ্রেড
          </div>
          <div class="complaint-timeline">${timelineHtml}</div>
        </div>
  
        ${replyHtml}
        ${satHtml}
      `;
    }
  
    /* ── Send customer reply ─────────────────────────────────── */
    async function sendReply(complaintId, email) {
      const msg = (document.getElementById("cReplyText")?.value || "").trim();
      if (!msg || msg.length < 5) {
        showMsg("cReplyMsg", "বার্তাটি কমপক্ষে ৫ অক্ষর হতে হবে", "error");
        return;
      }
  
      const btn = document.querySelector(".complaint-reply-send-btn");
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  
      try {
        const res = await fetch(`${API}/complaints/${complaintId}/customer-reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, email: email }),
        });
        const data = await res.json();
  
        if (!data.success) throw new Error(data.message || "উত্তর পাঠানো ব্যর্থ");
  
        showMsg("cReplyMsg", "উত্তর সফলভাবে পাঠানো হয়েছে!", "success");
  
        // Re-track to refresh
        setTimeout(() => {
          const ticketEl = document.getElementById("cTrackTicket");
          const emailEl = document.getElementById("cTrackEmail");
          if (ticketEl?.value && emailEl?.value) trackComplaint();
        }, 1200);
  
      } catch (err) {
        showMsg("cReplyMsg", err.message || "সমস্যা হয়েছে", "error");
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> পাঠান'; }
      }
    }
  
    /* ── Satisfaction rating ─────────────────────────────────── */
    let _selectedRating = 0;
  
    function hoverSat(n) {
      document.querySelectorAll(".complaint-sat-star").forEach((btn) => {
        const val = parseInt(btn.dataset.val);
        btn.classList.toggle("hovered", val <= n);
      });
    }
  
    function hoverSatEnd() {
      document.querySelectorAll(".complaint-sat-star").forEach((btn) => {
        btn.classList.remove("hovered");
      });
    }
  
    function setSatRating(score) {
      _selectedRating = score;
      submitSatisfaction(score);
    }
  
    async function submitSatisfaction(score) {
      const c = state.trackedComplaint;
      if (!c) return;
  
      const satBox = document.getElementById("cSatBox");
      const satMsg = document.getElementById("cSatMsg");
      if (satMsg) satMsg.textContent = "রেটিং সংরক্ষণ হচ্ছে...";
  
      try {
        const res = await fetch(`${API}/complaints/satisfaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score,
            ticketNumber: c.ticketNumber,
            email: c.customer?.email || document.getElementById("cTrackEmail")?.value,
          }),
        });
        const data = await res.json();
  
        if (!data.success) throw new Error(data.message);
  
        if (satBox) {
          const emojis = ["😡","😞","😐","😊","🤩"];
          satBox.innerHTML = `
            <div style="text-align:center;">
              <span style="font-size:2rem;">${emojis[score-1]}</span>
              <div style="font-size:0.82rem;font-weight:600;color:#1E8A4A;margin-top:6px;">ধন্যবাদ! আপনার মতামত পেয়েছি।</div>
            </div>`;
          satBox.style.background = "#ECFDF5";
        }
      } catch (err) {
        if (satMsg) satMsg.textContent = "রেটিং সংরক্ষণ ব্যর্থ হয়েছে";
      }
    }
  
    /* ══════════════════════════════════════════════════════════
       UTILITIES
    ══════════════════════════════════════════════════════════ */
    function resetForm() {
      state = { step: 1, category: null, formData: {}, submitting: false, tracking: false, trackedComplaint: null };
      const stepContent = document.getElementById("complaintStepContent");
      const successState = document.getElementById("complaintSuccessState");
      if (stepContent) stepContent.style.display = "block";
      if (successState) successState.style.display = "none";
      renderStep(1);
      goToForm();
    }
  
    function goToForm() {
      const card = document.getElementById("complaintFormCard");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  
    function focusTrack() {
      const trackCard = document.getElementById("complaintTrackCard");
      if (trackCard) trackCard.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => document.getElementById("cTrackTicket")?.focus(), 400);
    }
  
    function trackFromSuccess() {
      const ticketEl = document.getElementById("cTrackTicket");
      const emailEl = document.getElementById("cTrackEmail");
      if (ticketEl) ticketEl.value = state.lastTicket || "";
      if (emailEl) emailEl.value = state.lastEmail || "";
      focusTrack();
      if (state.lastTicket && state.lastEmail) setTimeout(trackComplaint, 500);
    }
  
    /* ── Public API ─────────────────────────────────────────── */
    return {
        init: renderSection,
        renderStep,
        selectCategory,
        next1,
        next2,
        next3,
        submitComplaint,
        trackComplaint,
        sendReply,
        setSatRating,
        hoverSat,
        hoverSatEnd,
        resetForm,
        goToForm,
        focusTrack,
        trackFromSuccess,
        autoFillFromCheckout: autoFillFromSaved,
        // ── Attachment functions ──────────────────────────────
        handleFileSelect: function(input) {
          Array.from(input.files).forEach(file => addAttachment(file));
          input.value = '';
        },
        handleDrop: function(e) {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          files.forEach(file => addAttachment(file));
          const dropzone = document.getElementById('cAttachmentDropzone');
          if (dropzone) {
            dropzone.style.borderColor = '#E8EBF4';
            dropzone.style.background = '#FFFBF5';
          }
        },
        removeAttachment: removeAttachment,
      };
  })();
  
  // Auto-init when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    ComplaintModule.init("complaintSectionContainer");
  });
