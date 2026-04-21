// ─── Review Modal State ─────────────────────────────────
const RV = {
    token: null,
    rating: 0,
    apiUrl: 'https://beeyond-harvest-admin.onrender.com/api',
   
    LABELS: {
      1: { text: 'খুবই খারাপ 😞', color: '#e53e3e' },
      2: { text: 'খারাপ 😕',       color: '#dd6b20' },
      3: { text: 'মোটামুটি 😐',   color: '#d69e2e' },
      4: { text: 'ভালো 😊',        color: '#C47F11' },
      5: { text: 'অসাধারণ! 🤩',   color: '#1E8A4A' },
    },
   
    async open(token) {
      this.token = token;
      this.rating = 0;
      // Reset all panels
      ['rv-modal-loading','rv-modal-error','rv-modal-form','rv-modal-success']
        .forEach(id => document.getElementById(id).style.display = 'none');
      document.getElementById('rv-modal-loading').style.display = 'block';
      // Open modal
      const m = document.getElementById('reviewModal');
      if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
      // Validate token
      await this.validate();
    },
   
    async validate() {
      try {
        const res  = await fetch(`${this.apiUrl}/reviews/validate-token?token=${encodeURIComponent(this.token)}`);
        const data = await res.json();
        document.getElementById('rv-modal-loading').style.display = 'none';
   
        if (!data.success) {
          const map = {
            TOKEN_INVALID: ['লিংক মেয়াদোত্তীর্ণ', 'এই রিভিউ লিংকটির মেয়াদ শেষ হয়ে গেছে।'],
            TOKEN_USED:    ['রিভিউ দেওয়া হয়েছে',   'এই লিংক দিয়ে ইতিমধ্যে একটি রিভিউ দেওয়া হয়েছে।'],
            NOT_DELIVERED: ['ডেলিভারি হয়নি',       'অর্ডার ডেলিভারি সম্পন্ন হলেই রিভিউ দেওয়া যাবে।'],
          };
          const [title, msg] = map[data.code] || ['সমস্যা হয়েছে', data.message || 'রিভিউ লিংকটি অকার্যকর।'];
          document.getElementById('rv-modal-error-title').textContent = title;
          document.getElementById('rv-modal-error-msg').textContent   = msg;
          // Special icon for "already used"
          if (data.code === 'TOKEN_USED') {
            document.querySelector('#rv-modal-error .fa-link-slash').className = 'fas fa-check-double';
            document.querySelector('#rv-modal-error div').style.background = '#E8F5EE';
            document.querySelector('#rv-modal-error .fas').style.color = '#1E8A4A';
          }
          document.getElementById('rv-modal-error').style.display = 'block';
          return;
        }
   
        // Populate form
        const info = data.data;
        document.getElementById('rv-modal-product-name').textContent = info.product?.name || 'পণ্য';
        document.getElementById('rv-modal-order-num').innerHTML =
          `<i class="fas fa-hashtag" style="margin-right:3px;"></i>${info.orderNumber || '—'}`;
        // Product image
        if (info.product?.image) {
          const imgEl = document.getElementById('rv-modal-product-img');
          imgEl.innerHTML = '';
          imgEl.style.padding = '0';
          const img = document.createElement('img');
          img.src = info.product.image;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:10px;';
          img.onerror = () => { imgEl.innerHTML = '🍯'; imgEl.style.padding = ''; };
          imgEl.appendChild(img);
        }
        // Reset form fields
        document.getElementById('rv-modal-title').value = '';
        document.getElementById('rv-modal-body').value  = '';
        document.getElementById('rv-modal-title-count').textContent = '0';
        document.getElementById('rv-modal-body-count').textContent  = '0';
        document.getElementById('rv-modal-star-feedback').textContent = 'একটি রেটিং নির্বাচন করুন';
        document.getElementById('rv-modal-star-feedback').style.color = '#6B7A99';
        document.querySelectorAll('.rv-modal-star').forEach(s => s.style.color = '#E8EBF4');
        document.getElementById('rv-modal-submit').disabled = true;
        document.getElementById('rv-modal-submit').style.opacity = '0.55';
        document.getElementById('rv-modal-form').style.display = 'block';
   
      } catch (err) {
        document.getElementById('rv-modal-loading').style.display = 'none';
        document.getElementById('rv-modal-error-title').textContent = 'সংযোগ সমস্যা';
        document.getElementById('rv-modal-error-msg').textContent   = 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট চেক করুন।';
        document.getElementById('rv-modal-error').style.display = 'block';
      }
    },
   
    async submit() {
      const title = document.getElementById('rv-modal-title').value.trim();
      const body  = document.getElementById('rv-modal-body').value.trim();
      if (!this.rating) { showToast('রেটিং নির্বাচন করুন', 'error'); return; }
      if (body.length < 10) { showToast('কমপক্ষে ১০ অক্ষর লিখুন', 'error'); return; }
   
      const btn = document.getElementById('rv-modal-submit');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> জমা হচ্ছে...';
   
      try {
        const res  = await fetch(`${this.apiUrl}/reviews`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: this.token, rating: this.rating, title, body }),
        });
        const data = await res.json();
   
        if (!data.success) {
          showToast(data.message || 'জমা দেওয়া যায়নি', 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> রিভিউ জমা দিন';
          return;
        }
   
        document.getElementById('rv-modal-form').style.display    = 'none';
        document.getElementById('rv-modal-success').style.display = 'block';
   
      } catch (err) {
        showToast('নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> রিভিউ জমা দিন';
      }
    }
  };
   
  // ─── Global star helpers ────────────────────────────────
  function rvHover(val) {
    document.querySelectorAll('.rv-modal-star').forEach((s, i) => {
      s.style.color = i < val ? '#F5A623' : '#E8EBF4';
      s.style.transform = i < val ? 'scale(1.12)' : '';
    });
    const fb = document.getElementById('rv-modal-star-feedback');
    fb.textContent = RV.LABELS[val].text;
    fb.style.color  = RV.LABELS[val].color;
  }
   
  function rvHoverEnd() {
    document.querySelectorAll('.rv-modal-star').forEach((s, i) => {
      s.style.color = i < RV.rating ? '#F5A623' : '#E8EBF4';
      s.style.transform = '';
    });
    if (RV.rating === 0) {
      document.getElementById('rv-modal-star-feedback').textContent = 'একটি রেটিং নির্বাচন করুন';
      document.getElementById('rv-modal-star-feedback').style.color = '#6B7A99';
    } else {
      document.getElementById('rv-modal-star-feedback').textContent = RV.LABELS[RV.rating].text;
      document.getElementById('rv-modal-star-feedback').style.color  = RV.LABELS[RV.rating].color;
    }
  }
   
  function rvSetRating(val) {
    RV.rating = val;
    rvHoverEnd();
    rvCheckSubmit();
  }
   
  function rvCheckSubmit() {
    const body = document.getElementById('rv-modal-body')?.value.trim() || '';
    const btn  = document.getElementById('rv-modal-submit');
    const ok   = RV.rating > 0 && body.length >= 10;
    btn.disabled = !ok;
    btn.style.opacity  = ok ? '1' : '0.55';
    btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
    btn.style.transform = ok ? '' : 'none';
  }
   
  function rvSubmit() { RV.submit(); }
   
  function closeReviewModal() {
    const m = document.getElementById('reviewModal');
    if (m) {
      m.classList.remove('active');
      document.body.style.overflow = '';
      // Remove ?review= from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('review');
      window.history.replaceState({}, '', url.toString());
    }
  }
   
  // ─── Auto-detect review token on page load ─────────────
  (function detectReviewToken() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('review') || params.get('token');
    if (!token) return;
   
    // Clean URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete('review');
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
   
    // Wait for DOM then open modal
    const open = () => RV.open(token);
    if (document.readyState === 'complete') {
      setTimeout(open, 300);
    } else {
      window.addEventListener('load', () => setTimeout(open, 300));
    }
  })();
