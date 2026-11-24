// ====== PENGATURAN (ganti sesuai kebutuhan) ======
// Nomor WhatsApp tujuan pesanan, format internasional tanpa "+" atau spasi (contoh: 6281234567890)
const WA_NUMBER = "6285892477475";
// Tautan media sosial di footer
const INSTAGRAM_URL = "https://instagram.com/";
const TIKTOK_URL = "https://tiktok.com/";
// Minimal belanja untuk gratis ongkir (rupiah)
const FREE_SHIPPING_MIN = 150000;
// Ongkos kirim flat jika belanja di bawah batas gratis ongkir (rupiah)
const SHIPPING_FEE = 12000;
// Opsional: URL yang menerima pesanan lewat POST JSON (contoh Formspree: "https://formspree.io/f/xxxxxxxx").
// Untuk kirim email bukti + PDF otomatis ke pembeli: tempel URL web app Google Apps Script
// (lihat apps-script/PETUNJUK.md). Kosongkan jika belum ada.
const ORDER_ENDPOINT = "";

// Bukti pembayaran ke email pembeli lewat EmailJS (https://www.emailjs.com, gratis 200 email/bulan).
// Isi ketiga nilai ini (lihat petunjuk di email-template.html). Kosong = email tidak dikirim.
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";
const EMAILJS_PUBLIC_KEY = "";

// MODE PROTOTIPE: true = persis seperti desain (QR contoh, rekening contoh, QRIS otomatis "lunas" setelah beberapa detik).
// Untuk toko sungguhan, ubah ke false lalu isi data asli di bawah. Pembayaran lalu perlu diverifikasi manual
// (tombol "Saya sudah bayar" / "Saya sudah transfer" hanya membuat pesanan berstatus menunggu verifikasi).
const DEMO_MODE = true;
const BANK_NAME = "BANK BCA";
const BANK_HOLDER = "Onthel Coffee (contoh)";
const BANK_ACCOUNT = "0000000000";
// Gambar QRIS asli milik toko (mis. "assets/qris.png"). Dipakai jika DEMO_MODE = false.
const QRIS_IMAGE = "";
// Masa berlaku kode QR (detik) dan jeda simulasi pembayaran QRIS di mode prototipe (milidetik)
const QR_TTL = 300;
const DEMO_PAY_DELAY = 7000;
// =================================================

const STORAGE_KEY = "onthel-cart-v4";
const METHOD_LABEL = { qris: "QRIS", bank: "Transfer Bank BCA" };

const $ = (sel) => document.querySelector(sel);
const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
const icon = (id, size) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;

// ---------- Katalog (diambil dari tombol "Tambah ke keranjang") ----------
// Harga dan nama selalu dibaca dari sini, bukan dari localStorage.
const CATALOG = {};
document.querySelectorAll(".add-to-cart").forEach((btn) => {
  CATALOG[btn.dataset.id] = {
    id: btn.dataset.id,
    name: btn.dataset.name,
    price: Number(btn.dataset.price),
    img: btn.dataset.img || "",
  };
});

// ---------- State keranjang ----------
function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => i && CATALOG[i.id] && Number(i.qty) > 0)
      .map((i) => ({
        ...CATALOG[i.id],
        qty: Math.min(99, Math.floor(Number(i.qty))),
      }));
  } catch (e) {
    return [];
  }
}

let cart = loadCart();

const saveCart = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    /* abaikan jika storage tidak tersedia */
  }
};

const getSubtotal = () => cart.reduce((s, i) => s + i.qty * i.price, 0);
const getShipping = (subtotal) =>
  subtotal === 0 || subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;

// ---------- Elemen ----------
const drawer = $("#drawer");
const overlay = $("#overlay");
const cartItemsEl = $("#cartItems");
const cartCountEl = $("#cartCount");
const subtotalEl = $("#cartSubtotal");
const shipNoteEl = $("#shipNote");
const checkoutBtn = $("#checkoutBtn");
const checkoutModal = $("#checkoutModal");
const checkoutForm = $("#checkoutForm");
const payModal = $("#payModal");
const copyModal = $("#copyModal");
const successModal = $("#successModal");
const cartPage = $("#cartPage");
const cpBody = $("#cpBody");
const nav = $("#nav");
const menuBtn = $("#menuBtn");

// ---------- Drawer & modal ----------
const ALL_MODALS = [checkoutModal, payModal, copyModal, successModal, cartPage];

function syncScrollLock() {
  const open = drawer.classList.contains("open") || ALL_MODALS.some((m) => !m.hidden);
  document.body.style.overflow = open ? "hidden" : "";
}

function openCart() {
  drawer.inert = false;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  syncScrollLock();
  $("#cartClose").focus();
}

function closeCart() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  overlay.hidden = true;
  syncScrollLock();
}

function openModal(modal, focusEl) {
  modal.hidden = false;
  syncScrollLock();
  if (focusEl) focusEl.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  syncScrollLock();
}

function openCartPage() {
  closeCart();
  renderCartPage();
  cartPage.hidden = false;
  cartPage.scrollTop = 0;
  syncScrollLock();
  $("#cpClose").focus();
}

function closeCartPage() {
  cartPage.hidden = true;
  syncScrollLock();
}

$("#cartOpen").addEventListener("click", openCartPage);
$("#viewCartPage").addEventListener("click", openCartPage);
$("#cpClose").addEventListener("click", closeCartPage);
$("#cpHome").addEventListener("click", closeCartPage);
$("#cartClose").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

// ---------- Render keranjang ----------
function renderCartPage() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  if (cart.length === 0) {
    cpBody.innerHTML = `
      <div class="cp-empty">
        <p class="cp-empty-title">Keranjangmu masih kosong.</p>
        <p>Yuk pilih kopi Excelsa dari Wonosalam dulu.</p>
        <button class="btn btn-dark" type="button" data-cp="shop">Pilih kopimu ${icon("i-arrow", 16)}</button>
      </div>`;
    return;
  }
  const subtotal = getSubtotal();
  const shipping = getShipping(subtotal);
  const note =
    shipping === 0
      ? "Selamat, pesananmu gratis ongkir."
      : "Belanja " + rupiah(FREE_SHIPPING_MIN - subtotal) + " lagi untuk gratis ongkir.";

  cpBody.innerHTML = `
    <div class="cp-main">
      <div class="cp-head" aria-hidden="true">
        <span></span><span>Produk</span><span>Harga</span><span>Jumlah</span><span>Subtotal</span>
      </div>
      ${cart
        .map(
          (i) => `
        <article class="cp-row" data-id="${esc(i.id)}">
          <button type="button" class="cp-rm" data-act="rm" aria-label="Hapus ${esc(i.name)}">${icon("i-x", 18)}</button>
          <div class="cp-prod">
            <div class="cp-thumb">${i.img ? `<img src="${esc(i.img)}" alt="" onerror="this.remove()">` : ""}</div>
            <div><h3>${esc(i.name)}</h3><p>Kopi Excelsa</p></div>
          </div>
          <div class="cp-price" data-label="Harga">${rupiah(i.price)}</div>
          <div class="cp-qty" data-label="Jumlah">
            <div class="qty">
              <button type="button" data-act="dec" aria-label="Kurangi jumlah">−</button>
              <span>${i.qty}</span>
              <button type="button" data-act="inc" aria-label="Tambah jumlah">+</button>
            </div>
          </div>
          <div class="cp-sub" data-label="Subtotal">${rupiah(i.price * i.qty)}</div>
        </article>`
        )
        .join("")}
      <div class="cp-foot"><button type="button" class="cp-clear" data-cp="clear">Kosongkan keranjang</button></div>
    </div>
    <aside class="cp-summary" aria-label="Ringkasan pesanan">
      <h3>Ringkasan Pesanan</h3>
      <dl>
        <div><dt>Jumlah barang</dt><dd>${count}</dd></div>
        <div><dt>Subtotal</dt><dd>${rupiah(subtotal)}</dd></div>
        <div><dt>Pengiriman</dt><dd>${shipping === 0 ? "Gratis" : rupiah(shipping)}</dd></div>
      </dl>
      <div class="cp-total"><span>Total</span><strong>${rupiah(subtotal + shipping)}</strong></div>
      <button class="btn btn-dark btn-block" type="button" data-cp="checkout">Lanjut ke checkout ${icon("i-arrow", 16)}</button>
      <p class="cp-note">${note}</p>
    </aside>`;
}

function renderCart() {
  renderCartPage();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = getSubtotal();

  cartCountEl.textContent = count;
  cartCountEl.hidden = count === 0;
  subtotalEl.textContent = rupiah(subtotal);
  checkoutBtn.disabled = count === 0;

  if (count === 0) {
    shipNoteEl.textContent = "";
  } else if (subtotal >= FREE_SHIPPING_MIN) {
    shipNoteEl.textContent = "Selamat, pesananmu gratis ongkir.";
  } else {
    shipNoteEl.textContent =
      "Ongkir dihitung saat checkout. Belanja " +
      rupiah(FREE_SHIPPING_MIN - subtotal) +
      " lagi untuk gratis ongkir.";
  }

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Keranjangmu masih kosong.</p>';
    return;
  }

  cartItemsEl.innerHTML = cart
    .map(
      (i) => `
      <div class="cart-line" data-id="${esc(i.id)}">
        <article class="cart-item">
          <div class="cart-thumb">${
            i.img ? `<img src="${esc(i.img)}" alt="" onerror="this.remove()">` : ""
          }</div>
          <div class="cart-info">
            <div class="cart-info-top">
              <div>
                <h4 class="cart-name">${esc(i.name)}</h4>
                <p class="cart-price">${rupiah(i.price)}</p>
              </div>
              <button type="button" class="cart-remove" data-act="rm" aria-label="Hapus ${esc(i.name)}">${icon("i-x", 16)}</button>
            </div>
            <div class="qty">
              <button type="button" data-act="dec" aria-label="Kurangi jumlah">−</button>
              <span>${i.qty}</span>
              <button type="button" data-act="inc" aria-label="Tambah jumlah">+</button>
            </div>
          </div>
        </article>
      </div>`
    )
    .join("");
}

// ---------- Aksi keranjang ----------
function addToCart(id) {
  const product = CATALOG[id];
  if (!product) return;
  const found = cart.find((i) => i.id === id);
  if (found) {
    found.qty = Math.min(99, found.qty + 1);
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart();
  renderCart();
  openCart();
}

document.querySelectorAll(".add-to-cart").forEach((btn) => {
  btn.addEventListener("click", () => addToCart(btn.dataset.id));
});

cpBody.addEventListener("click", (e) => {
  const cp = e.target.closest("[data-cp]");
  if (cp) {
    if (cp.dataset.cp === "shop") {
      closeCartPage();
      $("#produk").scrollIntoView({ behavior: "smooth" });
    } else if (cp.dataset.cp === "clear") {
      cart = [];
      saveCart();
      renderCart();
    } else if (cp.dataset.cp === "checkout") {
      openCheckout();
    }
    return;
  }
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".cp-row").dataset.id;
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  if (btn.dataset.act === "inc") item.qty = Math.min(99, item.qty + 1);
  if (btn.dataset.act === "dec") item.qty -= 1;
  if (btn.dataset.act === "rm" || item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  saveCart();
  renderCart();
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".cart-line").dataset.id;
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  if (btn.dataset.act === "inc") item.qty = Math.min(99, item.qty + 1);
  if (btn.dataset.act === "dec") item.qty -= 1;
  if (btn.dataset.act === "rm" || item.qty <= 0) {
    cart = cart.filter((i) => i.id !== id);
  }
  saveCart();
  renderCart();
});

// ---------- Checkout ----------
const FIELDS = {
  name: {
    el: $("#coName"),
    ok: (v) => v.trim().length >= 2,
    msg: "Nama penerima wajib diisi.",
  },
  email: {
    el: $("#coEmail"),
    ok: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    msg: "Masukkan email yang valid.",
  },
  phone: {
    el: $("#coPhone"),
    ok: (v) => /^(\+62|62|0)8[1-9]\d{7,11}$/.test(v.replace(/[\s-]/g, "")),
    msg: "Masukkan nomor telepon yang valid, contoh 081234567890.",
  },
  address: {
    el: $("#coAddress"),
    ok: (v) => v.trim().length >= 10,
    msg: "Alamat lengkap wajib diisi (jalan, nomor, kecamatan, kota).",
  },
};

function setFieldError(key, message) {
  const { el } = FIELDS[key];
  $("#err-" + key).textContent = message;
  if (message) {
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", "err-" + key);
  } else {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("aria-describedby");
  }
}

function validateForm() {
  let firstInvalid = null;
  Object.entries(FIELDS).forEach(([key, f]) => {
    const valid = f.ok(f.el.value);
    setFieldError(key, valid ? "" : f.msg);
    if (!valid && !firstInvalid) firstInvalid = f.el;
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

Object.keys(FIELDS).forEach((key) => {
  FIELDS[key].el.addEventListener("input", () => setFieldError(key, ""));
});

function renderSummary() {
  const subtotal = getSubtotal();
  const shipping = getShipping(subtotal);
  $("#coItems").innerHTML = cart
    .map(
      (i) => `
      <div class="sum-item">
        <div>${i.qty}× ${esc(i.name)}</div>
        <span>${rupiah(i.price * i.qty)}</span>
      </div>`
    )
    .join("");
  $("#coSubtotal").textContent = rupiah(subtotal);
  $("#coShipping").textContent = shipping === 0 ? "Gratis" : rupiah(shipping);
  $("#coTotal").textContent = rupiah(subtotal + shipping);
}

function openCheckout() {
  if (cart.length === 0) return;
  closeCart();
  closeCartPage();
  renderSummary();
  Object.keys(FIELDS).forEach((key) => setFieldError(key, ""));
  openModal(checkoutModal, FIELDS.name.el);
}

function closeCheckout() {
  closeModal(checkoutModal);
}

function genOrderId() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const n = Math.floor(Math.random() * 900) + 100;
  return `ONTH-${yy}${n}`;
}

function buildOrder() {
  const subtotal = getSubtotal();
  const shipping = getShipping(subtotal);
  const method = checkoutForm.elements.payment.value;
  return {
    id: genOrderId(),
    createdAt: new Date().toISOString(),
    items: cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    subtotal,
    shipping,
    total: subtotal + shipping,
    method,
    payment: METHOD_LABEL[method],
    status: "pending",
    demo: DEMO_MODE,
    customer: {
      name: FIELDS.name.el.value.trim(),
      email: FIELDS.email.el.value.trim(),
      phone: FIELDS.phone.el.value.trim(),
      address: FIELDS.address.el.value.trim(),
    },
  };
}

function buildWaText(order) {
  return [
    `Halo Onthel, saya sudah membuat pesanan #${order.id}.`,
    "",
    "Pesanan:",
    ...order.items.map((i) => `- ${i.name} x${i.qty} = ${rupiah(i.price * i.qty)}`),
    "",
    "Subtotal: " + rupiah(order.subtotal),
    "Pengiriman: " + (order.shipping === 0 ? "Gratis" : rupiah(order.shipping)),
    "Total: " + rupiah(order.total),
    "Metode pembayaran: " + order.payment,
    "",
    "Nama: " + order.customer.name,
    "Telepon: " + order.customer.phone,
    "Email: " + order.customer.email,
    "Alamat: " + order.customer.address,
  ].join("\n");
}

// Mengirim pesanan ke ORDER_ENDPOINT. Mengembalikan true jika terkirim, false jika endpoint belum diisi.
async function sendOrder(order) {
  if (!ORDER_ENDPOINT) return false;
  const res = await fetch(ORDER_ENDPOINT, {
    method: "POST",
    // Apps Script tidak menangani preflight CORS, jadi dikirim sebagai text/plain
    headers: { "Content-Type": EMAIL_VIA_SCRIPT ? "text/plain;charset=utf-8" : "application/json", Accept: "application/json" },
    body: JSON.stringify(order),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  if (EMAIL_VIA_SCRIPT) {
    const data = await res.json();
    if (!data || !data.ok) throw new Error((data && data.error) || "Skrip menolak pesanan");
    order.emailed = Boolean(data.emailed);
  }
  return true;
}

// Mengirim bukti pesanan/pembayaran ke email yang diisi pembeli saat checkout.
// Jika ORDER_ENDPOINT adalah web app Google Apps Script, emailnya dikirim oleh skrip itu (lihat apps-script/Code.gs).
const EMAIL_VIA_SCRIPT = /script\.google(usercontent)?\.com/.test(ORDER_ENDPOINT);
const EMAIL_ENABLED = !EMAIL_VIA_SCRIPT && Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);

async function sendReceiptEmail(order) {
  const paid = order.status === "paid";
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: order.customer.email,
        to_name: order.customer.name,
        subject: (DEMO_MODE ? "[CONTOH] " : "") + `Bukti pesanan Onthel #${order.id}`,
        order_id: order.id,
        order_date: new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }),
        items: order.items.map((i) => `${i.qty}× ${i.name} — ${rupiah(i.price * i.qty)}`).join("\n"),
        subtotal: rupiah(order.subtotal),
        shipping: order.shipping === 0 ? "Gratis" : rupiah(order.shipping),
        total: rupiah(order.total),
        payment_method: order.payment,
        status_text: paid ? "Lunas • Pembayaran berhasil" : "Menunggu verifikasi pembayaran",
        phone: order.customer.phone,
        address: order.customer.address,
        note: DEMO_MODE
          ? "Ini email contoh dari mode prototipe, bukan bukti pembayaran sungguhan."
          : paid
            ? "Terima kasih, pesananmu akan segera kami proses."
            : "Kami akan memeriksa pembayaranmu sebelum pesanan diproses. Kirim bukti transfer lewat WhatsApp agar lebih cepat.",
      },
    }),
  });
  if (!res.ok) throw new Error("EmailJS " + res.status);
}

checkoutBtn.addEventListener("click", openCheckout);
$("#checkoutClose").addEventListener("click", closeCheckout);
checkoutModal.addEventListener("click", (e) => {
  if (e.target === checkoutModal) closeCheckout();
});

checkoutForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (cart.length === 0) return;
  if (!validateForm()) return;
  openPayment(buildOrder());
});

// ---------- Pembayaran ----------
let currentOrder = null;
let busy = false;
let qrDeadline = 0;
let qrInterval = null;
let demoTimer = null;

// QR contoh (dekoratif, bukan kode pembayaran sungguhan)
function sampleQrSvg(seedText) {
  const N = 25;
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
  const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => rand() > 0.52));
  const finder = (ox, oy) => {
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        const gx = ox + x, gy = oy + y;
        if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
        const ring = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[gy][gx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (ring || core);
      }
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  let rects = "";
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) if (grid[y][x]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" role="img" aria-label="Kode QR contoh"><rect width="${N}" height="${N}" fill="#fff"/><g fill="#1b0d04">${rects}</g></svg>`;
}

function renderQr() {
  const box = $("#qrBox");
  box.classList.remove("expired");
  if (!DEMO_MODE && QRIS_IMAGE) {
    box.innerHTML = `<img src="${esc(QRIS_IMAGE)}" alt="Kode QRIS Onthel">`;
  } else {
    box.innerHTML = sampleQrSvg(currentOrder.id);
  }
}

function tickQr() {
  const left = Math.max(0, Math.round((qrDeadline - Date.now()) / 1000));
  const timer = $("#qrTimer");
  if (left === 0) {
    clearInterval(qrInterval);
    qrInterval = null;
    $("#qrBox").classList.add("expired");
    timer.textContent = "Kode QR sudah kedaluwarsa";
    $("#qrSave").textContent = "Buat ulang kode";
    return;
  }
  timer.textContent = `QR code transaksi akan hangus dalam ${Math.floor(left / 60)} menit ${left % 60} detik`;
}

function startQrTimer() {
  clearInterval(qrInterval);
  qrDeadline = Date.now() + QR_TTL * 1000;
  $("#qrSave").textContent = "Simpan Kode QR";
  renderQr();
  tickQr();
  qrInterval = setInterval(tickQr, 1000);
}

function stopTimers() {
  clearInterval(qrInterval);
  clearTimeout(demoTimer);
  qrInterval = null;
  demoTimer = null;
}

function setPayError(msg) {
  ["#payError", "#bankError"].forEach((sel) => {
    const el = $(sel);
    el.textContent = msg || "";
    el.hidden = !msg;
  });
}

function setBusy(state) {
  busy = state;
  ["#qrSave", "#qrPaid", "#bankDone", "#bankCopy"].forEach((sel) => ($(sel).disabled = state));
  $("#bankDone").textContent = state ? "Memproses…" : "Saya sudah transfer";
  $("#qrPaid").textContent = state ? "Memproses…" : "Saya sudah bayar";
}

function selectTab(tab) {
  const isQris = tab === "qris";
  $("#tabQris").setAttribute("aria-selected", String(isQris));
  $("#tabBank").setAttribute("aria-selected", String(!isQris));
  $("#tabQris").tabIndex = isQris ? 0 : -1;
  $("#tabBank").tabIndex = isQris ? -1 : 0;
  $("#panelQris").hidden = !isQris;
  $("#panelBank").hidden = isQris;
  currentOrder.method = tab;
  currentOrder.payment = METHOD_LABEL[tab];
  setPayError("");

  clearTimeout(demoTimer);
  if (isQris) {
    if (!qrInterval && Date.now() < qrDeadline) qrInterval = setInterval(tickQr, 1000);
    if (DEMO_MODE && Date.now() < qrDeadline) demoTimer = setTimeout(() => finishOrder("paid"), DEMO_PAY_DELAY);
  }
}

function openPayment(order) {
  currentOrder = order;
  stopTimers();
  setBusy(false);
  setPayError("");

  document.querySelectorAll(".js-total").forEach((el) => (el.textContent = rupiah(order.total)));
  $("#bankName").textContent = BANK_NAME;
  $("#bankHolder").textContent = "a.n. " + BANK_HOLDER;
  $("#bankNumber").textContent = BANK_ACCOUNT;
  $("#bankWarn").hidden = !DEMO_MODE;
  $("#qrDemo").hidden = !DEMO_MODE;
  $("#qrPaid").hidden = DEMO_MODE;
  $("#bankCopy").textContent = "Salin";

  closeModal(checkoutModal);
  startQrTimer();
  selectTab(order.method);
  openModal(payModal, $(order.method === "qris" ? "#tabQris" : "#tabBank"));
}

function closePayment() {
  if (busy) return;
  stopTimers();
  closeModal(copyModal);
  closeModal(payModal);
  openModal(checkoutModal);
}

async function finishOrder(status) {
  if (busy || !currentOrder || payModal.hidden) return;
  clearTimeout(demoTimer);
  setBusy(true);
  setPayError("");
  const order = currentOrder;
  order.status = status;
  try {
    await sendOrder(order);
    stopTimers();
    cart = [];
    saveCart();
    renderCart();
    checkoutForm.reset();
    setBusy(false);
    closeModal(payModal);
    showSuccess(order);
  } catch (err) {
    setBusy(false);
    setPayError("Pesanan belum terkirim. Periksa koneksi lalu coba lagi, atau pesan langsung lewat WhatsApp.");
  }
}

document.querySelectorAll(".pay-tabs button").forEach((b) => {
  b.addEventListener("click", () => selectTab(b.dataset.tab));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = b.dataset.tab === "qris" ? "bank" : "qris";
    selectTab(next);
    $(next === "qris" ? "#tabQris" : "#tabBank").focus();
  });
});

$("#payClose").addEventListener("click", closePayment);
payModal.addEventListener("click", (e) => {
  if (e.target === payModal) closePayment();
});

$("#qrSave").addEventListener("click", () => {
  if ($("#qrBox").classList.contains("expired")) {
    startQrTimer();
    if (DEMO_MODE) {
      clearTimeout(demoTimer);
      demoTimer = setTimeout(() => finishOrder("paid"), DEMO_PAY_DELAY);
    }
    return;
  }
  const a = document.createElement("a");
  if (!DEMO_MODE && QRIS_IMAGE) {
    a.href = QRIS_IMAGE;
  } else {
    a.href = URL.createObjectURL(new Blob([sampleQrSvg(currentOrder.id)], { type: "image/svg+xml" }));
  }
  a.download = `qris-${currentOrder.id}.${!DEMO_MODE && QRIS_IMAGE ? QRIS_IMAGE.split(".").pop() : "svg"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

$("#qrPaid").addEventListener("click", () => finishOrder("pending"));
$("#bankDone").addEventListener("click", () => finishOrder("pending"));

$("#bankCopy").addEventListener("click", async () => {
  if (DEMO_MODE) {
    $("#copyNumber").textContent = BANK_ACCOUNT;
    openModal(copyModal, $("#copyBack"));
    return;
  }
  try {
    await navigator.clipboard.writeText(BANK_ACCOUNT);
    $("#bankCopy").textContent = "Tersalin";
  } catch (e) {
    $("#bankCopy").textContent = "Salin manual";
  }
  setTimeout(() => ($("#bankCopy").textContent = "Salin"), 2000);
});
$("#copyBack").addEventListener("click", () => closeModal(copyModal));
copyModal.addEventListener("click", (e) => {
  if (e.target === copyModal) closeModal(copyModal);
});

// ---------- Sukses ----------
function showSuccess(order) {
  lastOrder = order;
  const paid = order.status === "paid";
  const qris = order.method === "qris";

  $("#successMsg").textContent = paid
    ? "Terima kasih! Pembayaran QRIS kamu berhasil.\nPesananmu sudah kami terima dan siap diproses."
    : "Terima kasih! Pesananmu sudah kami terima.\nPembayaran akan diperiksa sebelum pesanan diproses.";
  $("#rcId").textContent = "#" + order.id;
  $("#rcMethod").textContent = order.payment;
  $("#rcTotal").textContent = rupiah(order.total);

  const pill = $("#rcStatus");
  pill.classList.toggle("paid", paid);
  pill.textContent = paid
    ? "Lunas • Pembayaran berhasil"
    : qris ? "Menunggu verifikasi pembayaran" : "Menunggu verifikasi transfer";

  $("#successNote").textContent = paid
    ? "Pembayaran telah dikonfirmasi otomatis."
    : DEMO_MODE
      ? "Detail rekening pada desain ini adalah contoh."
      : "Kirim bukti pembayaran lewat WhatsApp agar pesananmu segera diproses.";

  const wa = $("#successWa");
  wa.hidden = paid;
  wa.href = waLink(buildWaText(order));

  const emailEl = $("#successEmail");
  emailEl.hidden = !(EMAIL_ENABLED || EMAIL_VIA_SCRIPT);
  if (EMAIL_VIA_SCRIPT) {
    emailEl.textContent = order.emailed
      ? "Bukti pembelian (PDF) sudah dikirim ke " + order.customer.email + ". Cek juga folder spam."
      : "Pesananmu tercatat, tapi email bukti belum berhasil dikirim. Simpan nomor pesananmu atau hubungi kami lewat WhatsApp.";
  } else if (EMAIL_ENABLED) {
    const to = order.customer.email;
    emailEl.textContent = "Mengirim bukti ke " + to + "…";
    sendReceiptEmail(order)
      .then(() => (emailEl.textContent = "Bukti pesanan sudah dikirim ke " + to + ". Cek juga folder spam."))
      .catch(() => (emailEl.textContent = "Bukti belum berhasil dikirim ke email. Simpan nomor pesananmu atau hubungi kami lewat WhatsApp."));
  }

  openModal(successModal, $("#successHome"));
}

// ---------- Bukti pembelian (cetak / simpan sebagai PDF) ----------
let lastOrder = null;

function receiptHtml(order) {
  const paid = order.status === "paid";
  const rows = order.items
    .map((i) => `<tr><td>${i.qty}× ${esc(i.name)}</td><td class="r">${rupiah(i.price * i.qty)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Bukti pembelian #${esc(order.id)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#3a1a0a;margin:0;padding:32px;background:#fff}
.box{max-width:520px;margin:0 auto;border:1px solid #e3cf9f;border-radius:14px;overflow:hidden}
.hd{background:#351a05;color:#fff;padding:18px 24px;font-size:22px;letter-spacing:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hd i{color:#e08c00;font-size:15px}
.bd{padding:24px}h1{font-size:22px;margin:0 0 4px;font-weight:600}
.lb{font-size:11px;letter-spacing:2px;color:#9a5200;font-weight:bold;margin:20px 0 6px}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:5px 0}.r{text-align:right}
.tot td{border-top:1px solid #e3cf9f;padding-top:10px;font-weight:bold;font-size:18px}
.pill{display:inline-block;margin-top:6px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:bold;background:${paid ? "#d9e6cc" : "#f1dcaa"};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.demo{margin-top:18px;padding:8px 12px;border:1px dashed #b3261e;color:#b3261e;font-size:12px;border-radius:8px}
.ft{padding:12px 24px;background:#f5f3dc;font-size:12px;color:#6a4630;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div class="box">
<div class="hd">Onthel <i>bukti pembelian</i></div>
<div class="bd">
<h1>#${esc(order.id)}</h1>
<div style="font-size:13px;color:#6a4630">${esc(new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }))}</div>
<span class="pill">${paid ? "Lunas • Pembayaran berhasil" : "Menunggu verifikasi pembayaran"}</span>
<div class="lb">PESANAN</div>
<table>${rows}
<tr><td>Subtotal</td><td class="r">${rupiah(order.subtotal)}</td></tr>
<tr><td>Pengiriman</td><td class="r">${order.shipping === 0 ? "Gratis" : rupiah(order.shipping)}</td></tr>
<tr class="tot"><td>Total</td><td class="r">${rupiah(order.total)}</td></tr></table>
<div class="lb">METODE PEMBAYARAN</div><div style="font-size:14px">${esc(order.payment)}</div>
<div class="lb">DIKIRIM KE</div>
<div style="font-size:14px;line-height:1.6">${esc(order.customer.name)} · ${esc(order.customer.phone)}<br>${esc(order.customer.email)}<br>${esc(order.customer.address)}</div>
${DEMO_MODE ? '<div class="demo">Dokumen contoh dari mode prototipe, bukan bukti pembayaran sungguhan.</div>' : ""}
</div><div class="ft">Onthel Coffee · Wonosalam · Jombang · Jawa Timur</div></div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
</body></html>`;
}

$("#successReceipt").addEventListener("click", () => {
  if (!lastOrder) return;
  const w = window.open("", "_blank");
  if (!w) {
    $("#successNote").textContent = "Pop-up diblokir browser. Izinkan pop-up untuk mengunduh bukti pembelian.";
    return;
  }
  w.document.open();
  w.document.write(receiptHtml(lastOrder));
  w.document.close();
});

function closeSuccess() {
  closeModal(successModal);
}

$("#successClose").addEventListener("click", closeSuccess);
$("#successHome").addEventListener("click", () => {
  closeSuccess();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
successModal.addEventListener("click", (e) => {
  if (e.target === successModal) closeSuccess();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!copyModal.hidden) closeModal(copyModal);
  else if (!successModal.hidden) closeSuccess();
  else if (!payModal.hidden) closePayment();
  else if (!checkoutModal.hidden) closeCheckout();
  else if (!cartPage.hidden) closeCartPage();
  else closeCart();
});

// ---------- Profil rasa (biji kopi) ----------
document.querySelectorAll(".meters li").forEach((li) => {
  const level = Number(li.dataset.level) || 0;
  li.querySelector(".beans").innerHTML = Array.from({ length: 5 }, (_, i) =>
    icon("i-bean-fill", 20).replace("<svg", `<svg class="${i < level ? "on" : "off"}"`)
  ).join("");
});

// ---------- Tautan footer ----------
const waHelp = waLink("Halo Onthel, saya mau tanya soal kopinya.");
$("#waHelp").href = waHelp;
$("#waHelpFooter").href = waHelp;
$("#igLink").href = INSTAGRAM_URL;
$("#ttLink").href = TIKTOK_URL;

// ---------- Menu mobile ----------
menuBtn.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  })
);

// ---------- Tahun footer ----------
$("#year").textContent = new Date().getFullYear();

// ---------- Mulai ----------
drawer.inert = true;
renderCart();
