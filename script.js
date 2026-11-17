// ====== PENGATURAN (ganti sesuai kebutuhan) ======
// Nomor WhatsApp tujuan pesanan, format internasional tanpa "+" atau spasi (contoh: 6281234567890)
const WA_NUMBER = "6281234567890";
// Minimal belanja untuk gratis ongkir (rupiah)
const FREE_SHIPPING_MIN = 150000;
// Ongkos kirim flat jika belanja di bawah batas gratis ongkir (rupiah)
const SHIPPING_FEE = 12000;
// Opsional: URL yang menerima pesanan lewat POST JSON (contoh Formspree: "https://formspree.io/f/xxxxxxxx").
// Kosongkan jika belum ada. Kalau kosong, pembeli diminta mengirim detail pesanan lewat WhatsApp.
const ORDER_ENDPOINT = "";
// =================================================

const STORAGE_KEY = "onthel-cart-v2";
const GRINDS = [
  "Biji utuh",
  "Kasar (French press)",
  "Medium (V60 / drip)",
  "Halus (espresso / moka pot)",
];

const $ = (sel) => document.querySelector(sel);
const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

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
        grind: GRINDS.includes(i.grind) ? i.grind : GRINDS[0],
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
const successModal = $("#successModal");
const payBtn = $("#payBtn");
const payLabel = $("#payLabel");
const coError = $("#coError");
const nav = $("#nav");
const menuBtn = $("#menuBtn");

// ---------- Drawer & modal ----------
function syncScrollLock() {
  const open =
    drawer.classList.contains("open") || !checkoutModal.hidden || !successModal.hidden;
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

$("#cartOpen").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

// ---------- Render keranjang ----------
const grindOptions = (selected) =>
  GRINDS.map(
    (g) => `<option value="${esc(g)}"${g === selected ? " selected" : ""}>${esc(g)}</option>`
  ).join("");

function renderCart() {
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
      <article class="cart-item" data-id="${esc(i.id)}">
        <div class="cart-thumb">${
          i.img ? `<img src="${esc(i.img)}" alt="" onerror="this.remove()">` : ""
        }</div>
        <div class="cart-info">
          <div class="cart-info-top">
            <div>
              <h4 class="cart-name">${esc(i.name)}</h4>
              <p class="cart-price">${rupiah(i.price)}</p>
            </div>
            <button type="button" class="cart-remove" data-act="rm" aria-label="Hapus ${esc(i.name)}">×</button>
          </div>
          <div class="qty">
            <button type="button" data-act="dec" aria-label="Kurangi jumlah">−</button>
            <span>${i.qty}</span>
            <button type="button" data-act="inc" aria-label="Tambah jumlah">+</button>
          </div>
        </div>
        <div class="grind">
          <label class="section-label" for="grind-${esc(i.id)}">Pilihan gilingan</label>
          <select id="grind-${esc(i.id)}" data-act="grind">${grindOptions(i.grind)}</select>
        </div>
      </article>`
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
    cart.push({ ...product, qty: 1, grind: GRINDS[0] });
  }
  saveCart();
  renderCart();
  openCart();
}

document.querySelectorAll(".add-to-cart").forEach((btn) => {
  btn.addEventListener("click", () => addToCart(btn.dataset.id));
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".cart-item").dataset.id;
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

cartItemsEl.addEventListener("change", (e) => {
  const select = e.target.closest("select[data-act='grind']");
  if (!select) return;
  const item = cart.find((i) => i.id === select.closest(".cart-item").dataset.id);
  if (!item || !GRINDS.includes(select.value)) return;
  item.grind = select.value;
  saveCart();
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
        <div>${i.qty}× ${esc(i.name)}<small>${esc(i.grind)}</small></div>
        <span>${rupiah(i.price * i.qty)}</span>
      </div>`
    )
    .join("");
  $("#coSubtotal").textContent = rupiah(subtotal);
  $("#coShipping").textContent = shipping === 0 ? "Gratis" : rupiah(shipping);
  $("#coTotal").textContent = rupiah(subtotal + shipping);
}

function updatePayLabel() {
  payLabel.textContent = "Bayar dengan " + checkoutForm.elements.payment.value;
}

checkoutForm.querySelectorAll('input[name="payment"]').forEach((r) => {
  r.addEventListener("change", updatePayLabel);
});

let paying = false;

function setPaying(state) {
  paying = state;
  payBtn.disabled = state;
  if (state) payLabel.textContent = "Memproses…";
  else updatePayLabel();
}

function openCheckout() {
  if (cart.length === 0) return;
  closeCart();
  renderSummary();
  coError.hidden = true;
  Object.keys(FIELDS).forEach((key) => setFieldError(key, ""));
  openModal(checkoutModal, FIELDS.name.el);
}

function closeCheckout() {
  if (paying) return;
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
  return {
    id: genOrderId(),
    createdAt: new Date().toISOString(),
    items: cart.map((i) => ({ name: i.name, grind: i.grind, qty: i.qty, price: i.price })),
    subtotal,
    shipping,
    total: subtotal + shipping,
    payment: checkoutForm.elements.payment.value,
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
    ...order.items.map(
      (i) => `- ${i.name} (${i.grind}) x${i.qty} = ${rupiah(i.price * i.qty)}`
    ),
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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(order),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return true;
}

function showSuccess(order, delivered) {
  const strong = document.createElement("strong");
  strong.textContent = "#" + order.id;
  $("#successMsg").replaceChildren(
    "Pesanan ",
    strong,
    delivered
      ? " sudah kami terima. Detail pembayaran dan status pengiriman akan dikirimkan ke emailmu."
      : " sudah dibuat. Kirim detail pesanan lewat WhatsApp agar kami bisa mengonfirmasi pembayaran dan pengirimannya."
  );
  $("#successEyebrow").textContent = delivered ? "Pesanan berhasil dibuat" : "Satu langkah lagi";

  const wa = $("#successWa");
  wa.href = waLink(buildWaText(order));
  wa.className = delivered ? "success-link" : "btn btn-amber";

  openModal(successModal, $("#successHome"));
}

function closeSuccess() {
  closeModal(successModal);
}

checkoutBtn.addEventListener("click", openCheckout);
$("#checkoutClose").addEventListener("click", closeCheckout);
$("#successClose").addEventListener("click", closeSuccess);
$("#successHome").addEventListener("click", () => {
  closeSuccess();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
checkoutModal.addEventListener("click", (e) => {
  if (e.target === checkoutModal) closeCheckout();
});
successModal.addEventListener("click", (e) => {
  if (e.target === successModal) closeSuccess();
});

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (paying || cart.length === 0) return;
  coError.hidden = true;
  if (!validateForm()) return;

  const order = buildOrder();
  setPaying(true);
  try {
    const delivered = await sendOrder(order);
    cart = [];
    saveCart();
    renderCart();
    checkoutForm.reset();
    setPaying(false);
    closeModal(checkoutModal);
    showSuccess(order, delivered);
  } catch (err) {
    setPaying(false);
    coError.textContent =
      "Pesanan belum terkirim. Periksa koneksi lalu coba lagi, atau pesan langsung lewat WhatsApp.";
    coError.hidden = false;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!successModal.hidden) closeSuccess();
  else if (!checkoutModal.hidden) closeCheckout();
  else closeCart();
});

// ---------- Link bantuan WhatsApp di footer ----------
$("#waHelp").href = waLink("Halo Onthel, saya mau tanya soal kopinya.");

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
updatePayLabel();