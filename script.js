// ====== PENGATURAN (ganti sesuai kebutuhan) ======
// Nomor WhatsApp tujuan pesanan, format internasional tanpa "+" atau spasi (contoh: 6281234567890)
const WA_NUMBER = "6281234567890";
// Minimal belanja untuk gratis ongkir (rupiah)
const FREE_SHIPPING_MIN = 150000;
// =================================================

const STORAGE_KEY = "onthel-cart-v1";

const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

// ---------- State keranjang ----------
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
} catch (e) {
  cart = [];
}

const saveCart = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    /* abaikan jika storage tidak tersedia */
  }
};

// ---------- Elemen ----------
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const cartItemsEl = document.getElementById("cartItems");
const cartCountEl = document.getElementById("cartCount");
const cartTotalEl = document.getElementById("cartTotal");
const shipNoteEl = document.getElementById("shipNote");
const checkoutBtn = document.getElementById("checkoutBtn");
const nav = document.getElementById("nav");
const menuBtn = document.getElementById("menuBtn");

// ---------- Drawer ----------
function openCart() {
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCart() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("cartOpen").addEventListener("click", openCart);
document.getElementById("cartClose").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
});

// ---------- Render keranjang ----------
function render() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  cartCountEl.textContent = count;
  cartCountEl.hidden = count === 0;
  cartTotalEl.textContent = rupiah(total);
  checkoutBtn.disabled = count === 0;

  if (count === 0) {
    shipNoteEl.textContent = "";
  } else if (total >= FREE_SHIPPING_MIN) {
    shipNoteEl.textContent = "Selamat, pesananmu gratis ongkir.";
  } else {
    shipNoteEl.textContent =
      "Belanja " + rupiah(FREE_SHIPPING_MIN - total) + " lagi untuk gratis ongkir.";
  }

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Keranjangmu masih kosong.</p>';
    return;
  }

  cartItemsEl.innerHTML = cart
    .map(
      (i) => `
      <div class="cart-item" data-id="${i.id}">
        <div class="cart-item-top">
          <span>${i.name}</span>
          <span>${rupiah(i.price * i.qty)}</span>
        </div>
        <div class="cart-item-bottom">
          <div class="qty">
            <button type="button" data-act="dec" aria-label="Kurangi">−</button>
            <span>${i.qty}</span>
            <button type="button" data-act="inc" aria-label="Tambah">+</button>
          </div>
          <button type="button" class="remove" data-act="rm">Hapus</button>
        </div>
      </div>`
    )
    .join("");
}

// ---------- Aksi keranjang ----------
function addToCart({ id, name, price }) {
  const found = cart.find((i) => i.id === id);
  if (found) {
    found.qty += 1;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }
  saveCart();
  render();
  openCart();
}

document.querySelectorAll(".add-to-cart").forEach((btn) => {
  btn.addEventListener("click", () => {
    addToCart({
      id: btn.dataset.id,
      name: btn.dataset.name,
      price: Number(btn.dataset.price),
    });
  });
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".cart-item").dataset.id;
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  if (btn.dataset.act === "inc") item.qty += 1;
  if (btn.dataset.act === "dec") item.qty -= 1;
  if (btn.dataset.act === "rm" || item.qty <= 0) {
    cart = cart.filter((i) => i.id !== id);
  }
  saveCart();
  render();
});

// ---------- Checkout via WhatsApp ----------
checkoutBtn.addEventListener("click", () => {
  if (cart.length === 0) return;
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const lines = cart.map((i) => `- ${i.name} x${i.qty} = ${rupiah(i.qty * i.price)}`);
  const text = [
    "Halo Onthel, saya mau pesan:",
    ...lines,
    "",
    "Total: " + rupiah(total),
    "",
    "Nama:",
    "Alamat pengiriman:",
    "Biji utuh atau digiling (sebutkan metode seduh):",
  ].join("\n");
  window.open(`https://wa.me/${6285892477475}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
});

// ---------- Link bantuan WhatsApp di footer ----------
document.getElementById("waHelp").href =
  `https://wa.me/${6285892477475}?text=${encodeURIComponent("Halo Onthel, saya mau tanya soal kopinya.")}`;

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
document.getElementById("year").textContent = new Date().getFullYear();

render();