/**
 * Onthel — penerima pesanan + pengirim email bukti pembelian (PDF).
 * Tempel di Google Apps Script, lalu Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Petunjuk lengkap: PETUNJUK.md
 */

// ====== PENGATURAN ======
var STORE_NAME = "Onthel Coffee";
var OWNER_EMAIL = "";            // opsional: salinan setiap pesanan dikirim ke sini
var FREE_SHIPPING_MIN = 150000;  // samakan dengan script.js
var SHIPPING_FEE = 12000;        // samakan dengan script.js
// Daftar harga resmi (server tidak percaya harga dari browser). Samakan dengan data-name & data-price di index.html.
var CATALOG = { "Excelsa 10 g": 7000 };
var MAX_ORDERS_PER_EMAIL_PER_HOUR = 5;
// ========================

function doPost(e) {
  try {
    var o = JSON.parse(e.postData.contents);
    var order = sanitize_(o);

    // batasi spam per alamat email
    var cache = CacheService.getScriptCache();
    var key = "rl_" + Utilities.base64EncodeWebSafe(order.customer.email);
    var n = Number(cache.get(key) || 0);
    if (n >= MAX_ORDERS_PER_EMAIL_PER_HOUR) return json_({ ok: false, error: "Terlalu banyak pesanan, coba lagi nanti." });
    cache.put(key, String(n + 1), 3600);

    logToSheet_(order);

    var emailed = false;
    try {
      sendReceipt_(order);
      emailed = true;
    } catch (err) {
      console.error("Gagal kirim email: " + err);
    }
    return json_({ ok: true, emailed: emailed });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: "onthel-orders" });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function str_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function rupiah_(n) {
  return "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Validasi + hitung ulang total di server
function sanitize_(o) {
  var email = str_(o.customer && o.customer.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email tidak valid");
  if (!o.items || !o.items.length || o.items.length > 20) throw new Error("Pesanan kosong");

  var subtotal = 0;
  var items = o.items.map(function (i) {
    var name = str_(i.name, 80);
    var price = CATALOG[name];
    var qty = Math.floor(Number(i.qty));
    if (price === undefined) throw new Error("Produk tidak dikenal: " + name);
    if (!(qty >= 1 && qty <= 99)) throw new Error("Jumlah tidak valid");
    subtotal += price * qty;
    return { name: name, qty: qty, price: price };
  });
  var shipping = subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
  var method = o.method === "bank" ? "Transfer Bank BCA" : "QRIS";

  return {
    id: str_(o.id, 30).replace(/[^A-Za-z0-9\-]/g, ""),
    createdAt: new Date(),
    items: items,
    subtotal: subtotal,
    shipping: shipping,
    total: subtotal + shipping,
    payment: method,
    status: o.status === "paid" ? "paid" : "pending",
    demo: o.demo === true,
    customer: {
      name: str_(o.customer.name, 80),
      email: email,
      phone: str_(o.customer.phone, 20),
      address: str_(o.customer.address, 300)
    }
  };
}

function logToSheet_(order) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  var sh = ss.getSheetByName("Pesanan") || ss.insertSheet("Pesanan");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Waktu", "No. pesanan", "Nama", "Email", "Telepon", "Alamat", "Pesanan", "Subtotal", "Ongkir", "Total", "Metode", "Status", "Contoh?"]);
  }
  sh.appendRow([
    order.createdAt, order.id, order.customer.name, order.customer.email, order.customer.phone, order.customer.address,
    order.items.map(function (i) { return i.qty + "x " + i.name; }).join(", "),
    order.subtotal, order.shipping, order.total, order.payment, order.status, order.demo ? "ya" : ""
  ]);
}

function receiptHtml_(order) {
  var paid = order.status === "paid";
  var when = Utilities.formatDate(order.createdAt, "Asia/Jakarta", "d MMMM yyyy, HH:mm") + " WIB";
  var rows = order.items.map(function (i) {
    return '<tr><td>' + i.qty + '× ' + esc_(i.name) + '</td><td style="text-align:right">' + rupiah_(i.price * i.qty) + '</td></tr>';
  }).join("");
  var note = order.demo
    ? "Ini email contoh dari mode prototipe, bukan bukti pembayaran sungguhan."
    : paid
      ? "Terima kasih, pesananmu akan segera kami proses."
      : "Kami akan memeriksa pembayaranmu sebelum pesanan diproses. Kirim bukti transfer lewat WhatsApp agar lebih cepat.";

  return '<div style="background:#f5f3dc;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#3a1a0a">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffebb8;border-radius:16px;overflow:hidden">' +
    '<div style="background:#351a05;padding:18px 24px;color:#fff;font-size:22px;letter-spacing:1px">Onthel <span style="color:#e08c00;font-style:italic;font-size:15px">bukti pembelian</span></div>' +
    '<div style="padding:24px">' +
    '<h2 style="margin:0 0 6px;font-weight:400;font-size:24px">Halo ' + esc_(order.customer.name) + ',</h2>' +
    '<p style="margin:0 0 16px;color:#6a4630;font-size:14px">Terima kasih sudah memesan kopi Onthel. Berikut bukti pesananmu.</p>' +
    '<table width="100%" style="background:#fff3d1;border-radius:12px;padding:12px 16px;font-size:14px">' +
    '<tr><td style="color:#6a4630">Nomor pesanan</td><td style="text-align:right"><b>#' + esc_(order.id) + '</b></td></tr>' +
    '<tr><td style="color:#6a4630">Tanggal</td><td style="text-align:right">' + when + '</td></tr>' +
    '<tr><td style="color:#6a4630">Metode</td><td style="text-align:right"><b>' + esc_(order.payment) + '</b></td></tr>' +
    '<tr><td style="color:#6a4630">Status</td><td style="text-align:right"><b>' + (paid ? "Lunas • Pembayaran berhasil" : "Menunggu verifikasi pembayaran") + '</b></td></tr></table>' +
    '<p style="margin:20px 0 6px;font-size:11px;letter-spacing:2px;color:#9a5200;font-weight:bold">PESANAN</p>' +
    '<table width="100%" style="font-size:14px">' + rows +
    '<tr><td style="color:#6a4630;padding-top:8px">Subtotal</td><td style="text-align:right;padding-top:8px">' + rupiah_(order.subtotal) + '</td></tr>' +
    '<tr><td style="color:#6a4630">Pengiriman</td><td style="text-align:right">' + (order.shipping === 0 ? "Gratis" : rupiah_(order.shipping)) + '</td></tr>' +
    '<tr><td style="padding-top:8px"><b>Total</b></td><td style="text-align:right;padding-top:8px;font-size:20px"><b>' + rupiah_(order.total) + '</b></td></tr></table>' +
    '<p style="margin:20px 0 6px;font-size:11px;letter-spacing:2px;color:#9a5200;font-weight:bold">DIKIRIM KE</p>' +
    '<div style="font-size:14px;line-height:1.6">' + esc_(order.customer.name) + ' · ' + esc_(order.customer.phone) + '<br>' + esc_(order.customer.address) + '</div>' +
    '<p style="margin:20px 0 0;font-size:13px;color:#6a4630">' + esc_(note) + '</p>' +
    '</div><div style="background:#2a140a;color:#cdbba6;padding:12px 24px;font-size:12px">' + STORE_NAME + ' · Wonosalam · Jombang · Jawa Timur</div></div></div>';
}

function sendReceipt_(order) {
  var html = receiptHtml_(order);
  var pdf = HtmlService.createHtmlOutput(html).getBlob().getAs("application/pdf").setName("Bukti-" + order.id + ".pdf");
  var opts = {
    to: order.customer.email,
    subject: (order.demo ? "[CONTOH] " : "") + "Bukti pesanan Onthel #" + order.id,
    htmlBody: html,
    name: STORE_NAME,
    attachments: [pdf]
  };
  if (OWNER_EMAIL) opts.bcc = OWNER_EMAIL;
  MailApp.sendEmail(opts);
}
