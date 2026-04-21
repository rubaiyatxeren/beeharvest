/* ═══════════════════════════════════════════════════════════
   BEETRANSFER — Secure File Transfer Module
   Integrates into BeeHarvest customer SPA
═══════════════════════════════════════════════════════════ */

const BeeTransfer = (function () {
    "use strict";
  
    const API = "https://beeyond-harvest-admin.onrender.com/api";
  
    const MAX_FILES = 10;
    const MAX_FILE_MB = 15;
    const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
  
    let state = {
      files: [],
      transferId: null,
      otpExpiry: null,
      otpTimer: null,
      dragActive: false,
      step: "form", // form | otp | success
      downloadData: null,
    };
  
    /* ─── Utils ─────────────────────────────────────────────── */
    function fmt(bytes) {
      if (!bytes) return "0 B";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }
  
    function esc(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
  
    function getFileIcon(mime) {
      if (!mime) return "fa-file";
      if (mime.startsWith("image/")) return "fa-file-image";
      if (mime === "application/pdf") return "fa-file-pdf";
      if (mime.includes("word") || mime.includes("document")) return "fa-file-word";
      if (mime.includes("excel") || mime.includes("spreadsheet")) return "fa-file-excel";
      if (mime.includes("powerpoint") || mime.includes("presentation")) return "fa-file-powerpoint";
      if (mime.startsWith("video/")) return "fa-file-video";
      if (mime.startsWith("audio/")) return "fa-file-audio";
      if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z") || mime.includes("tar") || mime.includes("gzip")) return "fa-file-zipper";
      if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml") || mime.includes("javascript")) return "fa-file-code";
      return "fa-file";
    }
  
    function validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // Add at the end of BeeTransfer object
function checkForDownloadPage() {
    // Check if we're on transfer page with hash or query param
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    let transferId = null;
    
    // Check for transfer ID in various formats
    if (hash && hash.includes('/transfer/')) {
      transferId = hash.split('/transfer/')[1];
    } else if (urlParams.has('transfer')) {
      transferId = urlParams.get('transfer');
    } else if (urlParams.has('id')) {
      transferId = urlParams.get('id');
    }
    
    // Also check if transfer page is active and has data attribute
    const transferPage = document.getElementById('transferPage');
    if (transferPage && transferPage.classList.contains('active')) {
      const downloadContainer = document.getElementById('bt-download-page');
      if (downloadContainer && downloadContainer.dataset.transferId) {
        transferId = downloadContainer.dataset.transferId;
      }
    }
    
    if (transferId) {
      console.log('🔍 Found transfer ID:', transferId);
      // Switch to transfer page
      navigateTo('transfer');
      // Load download page after a short delay
      setTimeout(() => {
        BeeTransfer.showDownloadSection(transferId);
      }, 100);
    }
  }
  
  // Add showDownloadSection method
  function showDownloadSection(transferId) {
    const downloadContainer = document.getElementById('bt-download-page');
    const sendCard = document.querySelector('.bt-send-card');
    const trackSection = document.querySelector('.bt-track-section');
    
    if (downloadContainer) {
      // Hide other sections
      if (sendCard) sendCard.style.display = 'none';
      if (trackSection) trackSection.style.display = 'none';
      
      // Show download container
      downloadContainer.style.display = 'block';
      downloadContainer.dataset.transferId = transferId;
      
      // Load the download page
      loadDownloadPage(transferId);
      
      // Scroll to it
      downloadContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  
  // Modify init function to include route checking
  const originalInit = init;
  init = function() {
    originalInit();
    checkForDownloadPage();
    
    // Also listen for navigation changes
    const originalNavigate = window.navigateTo;
    if (originalNavigate) {
      window.navigateTo = function(page) {
        originalNavigate(page);
        if (page === 'transfer') {
          setTimeout(() => {
            const downloadContainer = document.getElementById('bt-download-page');
            if (downloadContainer && downloadContainer.dataset.transferId) {
              loadDownloadPage(downloadContainer.dataset.transferId);
            }
          }, 100);
        }
      };
    }
  };

  function goToDownload() {
    const input = document.getElementById('bt-track-input-page');
    if (!input) return;
    
    let transferId = input.value.trim();
    if (!transferId) {
      showToastBT('ট্রান্সফার আইডি দিন', 'error');
      return;
    }
    
    // Validate format (BT-YYYYMMDD-XXXXX)
    if (!transferId.match(/^BT-\d{8}-[A-F0-9]{6}$/i)) {
      showToastBT('সঠিক ট্রান্সফার আইডি দিন (উদাহরণ: BT-20250421-A3F7K)', 'error');
      return;
    }
    
    showDownloadSection(transferId);
  }
  
// Add these functions before the return statement in beetransfer.js

function resetOtp() {
    document.querySelectorAll(".bt-otp-input").forEach((i) => (i.value = ""));
    if (state.otpTimer) clearInterval(state.otpTimer);
    clearMsg("bt-otp-msg");
  }
  
  // Make sure showStep is exposed
  function showStep(step) {
    state.step = step;
    ["bt-step-form", "bt-step-otp", "bt-step-success"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const target = document.getElementById(`bt-step-${step}`);
    if (target) { target.style.display = "block"; }
    
    // Update step indicators
    updateStepIndicators(step);
  }
  
  function updateStepIndicators(step) {
    const steps = ['form', 'otp', 'success'];
    const currentIndex = steps.indexOf(step);
    
    steps.forEach((s, idx) => {
      const indicator = document.getElementById(`bt-ind-${s}`);
      if (indicator) {
        if (idx < currentIndex) {
          indicator.classList.add('done');
          indicator.classList.remove('active');
        } else if (idx === currentIndex) {
          indicator.classList.add('active');
          indicator.classList.remove('done');
        } else {
          indicator.classList.remove('active', 'done');
        }
      }
      
      // Update connectors
      if (idx < steps.length - 1) {
        const connector = document.getElementById(`bt-conn-${idx + 1}`);
        if (connector) {
          if (idx < currentIndex) {
            connector.classList.add('done');
          } else {
            connector.classList.remove('done');
          }
        }
      }
    });
  }

  // Add these to the public API
  return {
    init,
    openModal,
    closeModal,
    initiate,
    verifyOtp,
    resendOtp,
    removeFile,
    downloadFile,
    downloadAll,
    loadDownloadPage,
    resetForm,
    addFiles,
    goToDownload,      // Add this
    showDownloadSection, // Add this
    checkForDownloadPage // Add this
  };

    function showMsg(id, msg, type) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<i class="fas fa-${type === "error" ? "circle-exclamation" : type === "success" ? "circle-check" : "circle-info"}"></i> ${esc(msg)}`;
      el.className = `bt-field-msg bt-field-msg--${type}`;
      el.style.display = "block";
    }
  
    function clearMsg(id) {
      const el = document.getElementById(id);
      if (el) { el.textContent = ""; el.style.display = "none"; }
    }
  
    function setBtnLoading(id, loading) {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (loading) {
        btn._orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> অপেক্ষা করুন...';
      } else {
        btn.disabled = false;
        if (btn._orig) btn.innerHTML = btn._orig;
      }
    }
  
    /* ─── File Handling ─────────────────────────────────────── */
    function addFiles(fileList) {
      const existing = state.files.map((f) => f.name + f.size);
      let added = 0, skipped = 0;
  
      for (const file of fileList) {
        if (state.files.length >= MAX_FILES) { skipped++; continue; }
        if (file.size > MAX_FILE_BYTES) {
          showToastBT(`"${file.name}" — ফাইলটি ${MAX_FILE_MB}MB সীমার বেশি`, "error");
          skipped++;
          continue;
        }
        if (existing.includes(file.name + file.size)) { skipped++; continue; }
        state.files.push(file);
        added++;
      }
  
      if (skipped > 0) showToastBT(`${skipped}টি ফাইল যোগ করা যায়নি`, "info");
      renderFileList();
      updateSendBtn();
    }
  
    function removeFile(idx) {
      state.files.splice(idx, 1);
      renderFileList();
      updateSendBtn();
    }
  
    function renderFileList() {
      const container = document.getElementById("bt-file-list");
      const counter = document.getElementById("bt-file-counter");
      const zone = document.getElementById("bt-dropzone");
      if (!container) return;
  
      const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  
      if (counter) {
        counter.innerHTML = state.files.length > 0
          ? `<span class="bt-file-count">${state.files.length}/${MAX_FILES} ফাইল · ${fmt(totalSize)}</span>`
          : "";
      }
  
      if (state.files.length === 0) {
        container.innerHTML = "";
        if (zone) zone.classList.remove("bt-dropzone--has-files");
        return;
      }
  
      if (zone) zone.classList.add("bt-dropzone--has-files");
  
      container.innerHTML = state.files.map((file, i) => `
        <div class="bt-file-item" id="bt-file-${i}">
          <div class="bt-file-icon">
            <i class="fas ${getFileIcon(file.type)}"></i>
          </div>
          <div class="bt-file-info">
            <div class="bt-file-name">${esc(file.name)}</div>
            <div class="bt-file-size">${fmt(file.size)}</div>
          </div>
          <button class="bt-file-remove" onclick="BeeTransfer.removeFile(${i})" title="সরান">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join("");
    }
  
    function updateSendBtn() {
      const btn = document.getElementById("bt-send-btn");
      if (!btn) return;
      const hasSender = validateEmail((document.getElementById("bt-sender-email") || {}).value || "");
      const hasReceiver = validateEmail((document.getElementById("bt-receiver-email") || {}).value || "");
      const hasFiles = state.files.length > 0;
      btn.disabled = !(hasSender && hasReceiver && hasFiles);
    }
  
    /* ─── Step Rendering ────────────────────────────────────── */
    function showStep(step) {
      state.step = step;
      ["bt-step-form", "bt-step-otp", "bt-step-success"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });
      const target = document.getElementById(`bt-step-${step}`);
      if (target) { target.style.display = "block"; }
    }
  
    /* ─── Initiate Transfer ─────────────────────────────────── */
    async function initiate() {
      const senderEmail = (document.getElementById("bt-sender-email") || {}).value?.trim();
      const senderName = (document.getElementById("bt-sender-name") || {}).value?.trim();
      const receiverEmail = (document.getElementById("bt-receiver-email") || {}).value?.trim();
      const receiverName = (document.getElementById("bt-receiver-name") || {}).value?.trim();
      const message = (document.getElementById("bt-message") || {}).value?.trim();
  
      clearMsg("bt-form-msg");
  
      if (!senderEmail || !validateEmail(senderEmail)) {
        showMsg("bt-sender-email-msg", "সঠিক ইমেইল দিন", "error");
        return;
      }
      clearMsg("bt-sender-email-msg");
  
      if (!receiverEmail || !validateEmail(receiverEmail)) {
        showMsg("bt-receiver-email-msg", "সঠিক ইমেইল দিন", "error");
        return;
      }
      clearMsg("bt-receiver-email-msg");
  
      if (senderEmail.toLowerCase() === receiverEmail.toLowerCase()) {
        showMsg("bt-form-msg", "প্রেরক ও প্রাপকের ইমেইল একই হতে পারবে না", "error");
        return;
      }
  
      if (state.files.length === 0) {
        showMsg("bt-form-msg", "অন্তত একটি ফাইল যোগ করুন", "error");
        return;
      }
  
      setBtnLoading("bt-send-btn", true);
  
      const formData = new FormData();
      formData.append("senderEmail", senderEmail);
      if (senderName) formData.append("senderName", senderName);
      formData.append("receiverEmail", receiverEmail);
      if (receiverName) formData.append("receiverName", receiverName);
      if (message) formData.append("message", message);
      state.files.forEach((f) => formData.append("files", f));
  
      try {
        const res = await fetch(`${API}/transfers/initiate`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
  
        if (!data.success) {
          showMsg("bt-form-msg", data.message || "ট্রান্সফার শুরু করা যায়নি", "error");
          setBtnLoading("bt-send-btn", false);
          return;
        }
  
        state.transferId = data.data.transferId;
        state.otpExpiry = new Date(data.data.otpExpiresAt);
  
        document.getElementById("bt-otp-email").textContent = senderEmail;
        document.getElementById("bt-otp-transfer-id").textContent = state.transferId;
        showStep("otp");
        startOtpTimer();
      } catch (err) {
        showMsg("bt-form-msg", "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", "error");
        setBtnLoading("bt-send-btn", false);
      }
    }
  
    /* ─── OTP Timer ─────────────────────────────────────────── */
    function startOtpTimer() {
      if (state.otpTimer) clearInterval(state.otpTimer);
      updateOtpTimer();
      state.otpTimer = setInterval(updateOtpTimer, 1000);
    }
  
    function updateOtpTimer() {
      const el = document.getElementById("bt-otp-timer");
      if (!el || !state.otpExpiry) return;
      const remaining = Math.max(0, Math.floor((state.otpExpiry - Date.now()) / 1000));
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
      el.className = remaining < 60 ? "bt-otp-timer bt-otp-timer--urgent" : "bt-otp-timer";
      if (remaining === 0) {
        clearInterval(state.otpTimer);
        showMsg("bt-otp-msg", "OTP মেয়াদ শেষ হয়েছে। নতুন OTP নিন।", "error");
      }
    }
  
    /* ─── Verify OTP ────────────────────────────────────────── */
    async function verifyOtp() {
      const otpInputs = document.querySelectorAll(".bt-otp-input");
      const otp = Array.from(otpInputs).map((i) => i.value).join("");
  
      clearMsg("bt-otp-msg");
  
      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        showMsg("bt-otp-msg", "৬-সংখ্যার OTP দিন", "error");
        return;
      }
  
      setBtnLoading("bt-verify-btn", true);
  
      try {
        const res = await fetch(`${API}/transfers/${state.transferId}/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp }),
        });
        const data = await res.json();
  
        if (!data.success) {
          showMsg("bt-otp-msg", data.message || "OTP সঠিক নয়", "error");
          setBtnLoading("bt-verify-btn", false);
          // Shake animation
          otpInputs.forEach((i) => {
            i.classList.add("bt-otp-shake");
            i.value = "";
            setTimeout(() => i.classList.remove("bt-otp-shake"), 600);
          });
          otpInputs[0]?.focus();
          return;
        }
  
        clearInterval(state.otpTimer);
  
        // Success state
        document.getElementById("bt-success-transfer-id").textContent = data.data.transferId;
        document.getElementById("bt-success-receiver").textContent = data.data.receiver;
        document.getElementById("bt-success-files-count").textContent = data.data.filesCount + "টি ফাইল";
        document.getElementById("bt-success-total-size").textContent = data.data.totalSize;
        const expiry = new Date(data.data.expiresAt);
        document.getElementById("bt-success-expiry").textContent = expiry.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
  
        showStep("success");
      } catch (err) {
        showMsg("bt-otp-msg", "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", "error");
        setBtnLoading("bt-verify-btn", false);
      }
    }
  
    /* ─── Resend OTP ────────────────────────────────────────── */
    async function resendOtp() {
      clearMsg("bt-otp-msg");
      setBtnLoading("bt-resend-btn", true);
  
      try {
        const res = await fetch(`${API}/transfers/${state.transferId}/resend-otp`, {
          method: "POST",
        });
        const data = await res.json();
  
        if (!data.success) {
          showMsg("bt-otp-msg", data.message || "পুনরায় OTP পাঠানো যায়নি", "error");
        } else {
          state.otpExpiry = new Date(data.otpExpiresAt);
          startOtpTimer();
          showMsg("bt-otp-msg", "নতুন OTP পাঠানো হয়েছে!", "success");
          document.querySelectorAll(".bt-otp-input").forEach((i) => (i.value = ""));
          document.querySelector(".bt-otp-input")?.focus();
        }
      } catch (err) {
        showMsg("bt-otp-msg", "নেটওয়ার্ক সমস্যা।", "error");
      } finally {
        setBtnLoading("bt-resend-btn", false);
      }
    }
  
    /* ─── Download Page ─────────────────────────────────────── */
    async function loadDownloadPage(transferId) {
      const container = document.getElementById("bt-download-page");
      if (!container) return;
      container.innerHTML = `
        <div class="bt-download-loading">
          <div class="bt-spinner"></div>
          <p>ট্রান্সফার তথ্য লোড হচ্ছে...</p>
        </div>`;
  
      try {
        const res = await fetch(`${API}/transfers/${encodeURIComponent(transferId)}`);
        const data = await res.json();
  
        if (!data.success) {
          container.innerHTML = `
            <div class="bt-download-error">
              <div class="bt-download-error-icon"><i class="fas fa-link-slash"></i></div>
              <h3>${data.code === "TRANSFER_EXPIRED" ? "লিংকের মেয়াদ শেষ" : "ট্রান্সফার পাওয়া যায়নি"}</h3>
              <p>${esc(data.message)}</p>
              <button class="bt-btn bt-btn--primary" onclick="BeeTransfer.openModal()">নতুন ট্রান্সফার করুন</button>
            </div>`;
          return;
        }
  
        const t = data.data;
        state.downloadData = t;
        renderDownloadPage(t);
      } catch (err) {
        container.innerHTML = `
          <div class="bt-download-error">
            <div class="bt-download-error-icon"><i class="fas fa-wifi-slash"></i></div>
            <h3>নেটওয়ার্ক সমস্যা</h3>
            <p>পুনরায় চেষ্টা করুন</p>
            <button class="bt-btn bt-btn--primary" onclick="BeeTransfer.loadDownloadPage('${esc(transferId)}')">পুনরায় চেষ্টা</button>
          </div>`;
      }
    }
  
    function renderDownloadPage(t) {
        const container = document.getElementById("bt-download-page");
        if (!container) return;
      
        const expiry = new Date(t.expiresAt).toLocaleDateString("bn-BD", {
          year: "numeric", month: "long", day: "numeric",
        });
      
        const filesHtml = (t.files || []).map((f) => {
          // Log the URL for debugging
          console.log("File URL:", f.cloudinaryUrl);
          
          return `
            <div class="bt-dl-file">
              <div class="bt-dl-file-icon"><i class="fas ${getFileIcon(f.mimetype)}"></i></div>
              <div class="bt-dl-file-info">
                <div class="bt-dl-file-name">${esc(f.originalName)}</div>
                <div class="bt-dl-file-size">${esc(f.sizeFormatted || fmt(f.sizeBytes))}</div>
              </div>
              <button class="bt-dl-btn" data-transfer-id="${t.transferId}" data-file-id="${f._id}" data-url="${esc(f.cloudinaryUrl)}" data-name="${esc(f.originalName)}" onclick="BeeTransfer.downloadFile('${t.transferId}','${f._id}','${esc(f.cloudinaryUrl)}','${esc(f.originalName)}')">
                <i class="fas fa-download"></i>
                <span>ডাউনলোড</span>
              </button>
            </div>`;
        }).join("");
      
        container.innerHTML = `
          <div class="bt-download-wrapper">
            <div class="bt-download-header">
              <div class="bt-download-header-inner">
                <div class="bt-download-logo">
                  <span>🐝</span>
                  <div>
                    <div class="bt-download-logo-name">BeeTransfer</div>
                    <div class="bt-download-logo-tag">by BeeHarvest</div>
                  </div>
                </div>
                <div class="bt-download-meta">
                  <div class="bt-download-transfer-id">${esc(t.transferId)}</div>
                  <div class="bt-download-expiry">⏰ মেয়াদ: ${expiry}</div>
                </div>
              </div>
            </div>
      
            <div class="bt-download-body">
              <div class="bt-download-from">
                <div class="bt-download-from-icon"><i class="fas fa-user-circle"></i></div>
                <div>
                  <div class="bt-download-from-label">প্রেরক</div>
                  <div class="bt-download-from-email">${esc(t.sender?.email || "")}</div>
                  ${t.message ? `<div class="bt-download-message">"${esc(t.message)}"</div>` : ""}
                </div>
              </div>
      
              <div class="bt-download-stats">
                <div class="bt-download-stat">
                  <div class="bt-download-stat-num">${(t.files || []).length}</div>
                  <div class="bt-download-stat-label">ফাইল</div>
                </div>
                <div class="bt-download-stat">
                  <div class="bt-download-stat-num">${esc(t.totalSizeFormatted || "")}</div>
                  <div class="bt-download-stat-label">মোট সাইজ</div>
                </div>
              </div>
      
              <div class="bt-dl-files-title"><i class="fas fa-folder-open"></i> ফাইলসমূহ</div>
              <div class="bt-dl-files-list">${filesHtml}</div>
      
              ${(t.files || []).length > 1 ? `
              <button class="bt-btn bt-btn--primary bt-btn--full bt-download-all-btn" onclick="BeeTransfer.downloadAll()">
                <i class="fas fa-download"></i> সব ফাইল ডাউনলোড করুন
              </button>` : ""}
            </div>
          </div>`;
      }
  
    async function downloadFile(transferId, fileId, url, name) {
        console.log("📥 Download requested:", { transferId, fileId, url, name });
        
        try {
          // Track download first (don't await, let it happen in background)
          fetch(`${API}/transfers/${transferId}/files/${fileId}/download`, {
            method: "POST",
          }).catch(err => console.warn("Track error:", err));
        } catch (_) {}
      
        // Handle download
        if (url) {
          try {
            // For Cloudinary URLs, force download
            const link = document.createElement('a');
            link.href = url;
            link.download = name || 'file';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            // Add download attribute and click
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
              document.body.removeChild(link);
            }, 100);
            
            showToastBT("ডাউনলোড শুরু হয়েছে", "success");
          } catch (err) {
            console.error("Download error:", err);
            showToastBT("ডাউনলোড ব্যর্থ হয়েছে", "error");
          }
        } else {
          // If no direct URL, fetch from API
          try {
            showToastBT("ফাইল লোড হচ্ছে...", "info");
            
            const response = await fetch(`${API}/transfers/${transferId}/files/${fileId}/download`, {
              method: "GET",
              headers: {
                'Accept': 'application/octet-stream'
              }
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = name || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            
            showToastBT("ডাউনলোড শুরু হয়েছে", "success");
          } catch (err) {
            console.error("Download via API failed:", err);
            showToastBT("ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।", "error");
          }
        }
      }
  
    function downloadAll() {
      if (!state.downloadData) return;
      (state.downloadData.files || []).forEach((f, i) => {
        setTimeout(() => downloadFile(state.downloadData.transferId, f._id, f.cloudinaryUrl, f.originalName), i * 500);
      });
    }
  
    /* ─── Modal ─────────────────────────────────────────────── */
    function openModal() {
      const modal = document.getElementById("bt-modal");
      if (modal) {
        resetForm();
        modal.classList.add("bt-modal--open");
        document.body.style.overflow = "hidden";
      }
    }
  
    function closeModal() {
      const modal = document.getElementById("bt-modal");
      if (modal) {
        modal.classList.remove("bt-modal--open");
        document.body.style.overflow = "";
      }
      if (state.otpTimer) clearInterval(state.otpTimer);
    }
  
    function resetForm() {
      state.files = [];
      state.transferId = null;
      state.otpExpiry = null;
      if (state.otpTimer) clearInterval(state.otpTimer);
  
      ["bt-sender-email", "bt-sender-name", "bt-receiver-email", "bt-receiver-name", "bt-message"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
  
      document.querySelectorAll(".bt-otp-input").forEach((i) => (i.value = ""));
      renderFileList();
      showStep("form");
      updateSendBtn();
  
      ["bt-form-msg", "bt-sender-email-msg", "bt-receiver-email-msg", "bt-otp-msg"].forEach(clearMsg);
    }
  
    /* ─── Toast ─────────────────────────────────────────────── */
    function showToastBT(msg, type) {
      if (typeof showToast === "function") { showToast(msg, type); return; }
      const t = document.createElement("div");
      t.className = `bt-toast bt-toast--${type}`;
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    }
  
    /* ─── OTP Input Behaviour ───────────────────────────────── */
    function initOtpInputs() {
      const inputs = document.querySelectorAll(".bt-otp-input");
      inputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
          const val = e.target.value.replace(/\D/g, "");
          e.target.value = val.slice(-1);
          if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
          // Auto-verify when all filled
          const full = Array.from(inputs).every((i) => i.value);
          if (full) verifyOtp();
        });
  
        input.addEventListener("keydown", (e) => {
          if (e.key === "Backspace" && !input.value && idx > 0) inputs[idx - 1].focus();
          if (e.key === "ArrowLeft" && idx > 0) inputs[idx - 1].focus();
          if (e.key === "ArrowRight" && idx < inputs.length - 1) inputs[idx + 1].focus();
        });
  
        input.addEventListener("paste", (e) => {
          e.preventDefault();
          const paste = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
          if (paste.length === 6) {
            inputs.forEach((inp, i) => (inp.value = paste[i] || ""));
            verifyOtp();
          }
        });
  
        input.addEventListener("focus", () => input.select());
      });
    }
  
    /* ─── Drag & Drop ───────────────────────────────────────── */
    function initDropzone() {
      const zone = document.getElementById("bt-dropzone");
      const fileInput = document.getElementById("bt-file-input");
      if (!zone || !fileInput) return;
  
      zone.addEventListener("click", (e) => {
        if (!e.target.closest(".bt-file-remove")) fileInput.click();
      });
  
      fileInput.addEventListener("change", (e) => {
        addFiles(Array.from(e.target.files));
        e.target.value = "";
      });
  
      ["dragenter", "dragover"].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("bt-dropzone--active"); })
      );
  
      ["dragleave", "drop"].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("bt-dropzone--active"); })
      );
  
      zone.addEventListener("drop", (e) => {
        addFiles(Array.from(e.dataTransfer.files));
      });
    }
  
    /* ─── Input Listeners ───────────────────────────────────── */
    function initFormListeners() {
      ["bt-sender-email", "bt-receiver-email"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", updateSendBtn);
      });
    }
  
    /* ─── Init ──────────────────────────────────────────────── */
    function init() {
      initDropzone();
      initFormListeners();
      initOtpInputs();
  
      // Close on backdrop click
      const modal = document.getElementById("bt-modal");
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) closeModal();
        });
      }
  
      // Check for download page
      const downloadEl = document.getElementById("bt-download-page");
      if (downloadEl) {
        const tid = downloadEl.dataset.transferId;
        if (tid) loadDownloadPage(tid);
      }
    }
  
  })();
  
  // Auto-init when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => BeeTransfer.init());
  } else {
    BeeTransfer.init();
  }
