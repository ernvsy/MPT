/* ====== PENGATURAN — ubah di sini ====== */
const PRODUCT = { name: 'Excelsa 100 g', price: 7000, img: 'assets/kemasan.png' };
const SHIPPING = 12000;
const WA_NUMBER = '6281234567890'; // ganti dengan nomor WhatsApp (format 62...)
/* ======================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const rp = (n) => 'Rp ' + n.toLocaleString('id-ID');
const KEY = 'onthel-cart';
let cart = { q: 0 };
try { cart = { ...cart, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };

/* ---------- Modal ---------- */
const open = (id) => { $$('.ov').forEach((o) => o.classList.remove('on')); $('#m-' + id).classList.add('on'); };
const closeAll = () => { $$('.ov').forEach((o) => o.classList.remove('on')); clearInterval(tick); };
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-close]') || t.classList.contains('ov')) return closeAll();
  const o = t.closest('[data-open]'); if (o) { renderCart(); open(o.dataset.open); }
  if (t.closest('[data-add]')) { cart.q++; save(); renderCart(); open('cart'); }
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAll());

/* ---------- Isi statis ---------- */
$('#price').textContent = rp(PRODUCT.price);
$$('[data-v]').forEach((r) => {
  const v = +r.dataset.v;
  r.querySelector('.bn').innerHTML = [0, 1, 2, 3, 4].map((i) => `<s class="${i < v ? 'on' : ''}"></s>`).join('');
});
$$('[data-wa]').forEach((a) => (a.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Halo Onthel, saya mau tanya tentang kopi Excelsa.')}`));

/* ---------- Keranjang ---------- */
function renderCart() {
  const b = $('#badge'); b.hidden = !cart.q; b.textContent = cart.q;
  const el = $('#cartBody');
  if (!cart.q) {
    el.innerHTML = `<div class="empty"><p class="mut">Keranjangmu masih kosong.</p><button class="btn dk" data-close>Pilih kopimu</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="ci"><img src="${PRODUCT.img}" alt=""><div><b>${PRODUCT.name}</b><span class="mut">${rp(PRODUCT.price)}</span>
      <div class="qty"><button data-q="-1" aria-label="Kurangi">−</button><span>${cart.q}</span><button data-q="1" aria-label="Tambah">+</button></div></div>
      <button class="x" data-q="x" aria-label="Hapus">×</button></div>
    <div class="cfoot"><div class="row t"><span>Subtotal</span><span>${rp(cart.q * PRODUCT.price)}</span></div>
      <p class="mut">Ongkir dihitung saat checkout.</p>
      <button class="btn dk wide" id="toCo">Lanjut checkout <span>→</span></button></div>`;
  el.querySelectorAll('[data-q]').forEach((btn) => (btn.onclick = () => {
    const d = btn.dataset.q; cart.q = d === 'x' ? 0 : Math.max(0, cart.q + +d); save(); renderCart();
  }));
  $('#toCo').onclick = () => { renderSummary(); open('co'); };
}

/* ---------- Checkout ---------- */
const total = () => cart.q * PRODUCT.price + SHIPPING;
function renderSummary() {
  $('#sumBody').innerHTML = `
    <div class="row"><span>${cart.q}× ${PRODUCT.name}</span><b>${rp(cart.q * PRODUCT.price)}</b></div>
    <div class="row"><span>Subtotal</span><span>${rp(cart.q * PRODUCT.price)}</span></div>
    <div class="row"><span>Pengiriman</span><span>${rp(SHIPPING)}</span></div>
    <div class="row t"><span>Total</span><span>${rp(total())}</span></div>`;
}
let method = 'QRIS';
$$('.pay button').forEach((b) => (b.onclick = () => {
  $$('.pay button').forEach((x) => x.classList.toggle('on', x === b));
  method = b.textContent; $('#payBtn').innerHTML = `Bayar dengan ${method} <span>→</span>`;
}));
$('#coForm').onsubmit = (e) => { e.preventDefault(); startPayment(); };

/* ---------- Pembayaran (demo) ---------- */
let tick;
function startPayment() {
  $('#payTotal').textContent = rp(total());
  const name = $('#payName'); name.textContent = method === 'QRIS' ? 'QRIS' : method.replace('Bank ', '');
  drawQR(); open('pay');
  let s = 300; clearInterval(tick);
  const show = () => ($('#timer').textContent = s > 0
    ? `QR code transaksi akan hangus dalam ${Math.floor(s / 60)} menit ${String(s % 60).padStart(2, '0')} detik`
    : 'QR code kedaluwarsa — tutup dan ulangi checkout');
  show(); tick = setInterval(() => { s = Math.max(0, s - 1); show(); if (!s) clearInterval(tick); }, 1000);
}
function drawQR() { // QR tiruan untuk demo, BUKAN kode pembayaran asli
  const c = $('#qr'), x = c.getContext('2d'), n = 25, p = c.width / n;
  let seed = total() + Date.now() % 1000; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
  const finder = (a, b) => [[7, 0], [5, 1], [3, 0]].forEach(([sz, w], i) => { x.fillStyle = i == 1 ? '#fff' : '#000'; x.fillRect((a + i) * p, (b + i) * p, (7 - 2 * i) * p, (7 - 2 * i) * p); });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (rnd() > 0.5) { x.fillStyle = '#000'; x.fillRect(i * p, j * p, p, p); }
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([a, b]) => { x.fillStyle = '#fff'; x.fillRect((a - 1) * p, (b - 1) * p, 9 * p, 9 * p); finder(a, b); });
}
$('#saveQR').onclick = () => { const a = document.createElement('a'); a.download = 'onthel-qr.png'; a.href = $('#qr').toDataURL(); a.click(); };
$('#paid').onclick = () => {
  clearInterval(tick); $('#orderId').textContent = 'No. pesanan ONT-' + Date.now().toString().slice(-6);
  cart.q = 0; save(); renderCart(); $('#coForm').reset(); open('ok');
};

renderCart();