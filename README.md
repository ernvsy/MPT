# Onthel — Kopi Excelsa Wonosalam

Website statis (HTML + CSS + JS), tanpa build step. Siap di-deploy ke GitHub Pages.

## Deploy ke GitHub Pages
1. Buat repository baru di GitHub (mis. `onthel`).
2. Upload semua isi folder ini (`index.html`, `style.css`, `script.js`, folder `assets/`) ke branch `main`.
3. Buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1–2 menit. Situs tampil di `https://USERNAME.github.io/onthel/`.

## Yang perlu kamu ganti
- `script.js` (bagian atas): harga, ongkir, nomor WhatsApp, pilihan gilingan.
- `index.html`: teks testimoni (cari komentar "Ganti isi testimoni").
- `assets/hero.jpg`: taruh foto lereng Wonosalam untuk latar hero (tanpa file ini, hero memakai gradasi cokelat).
- Pembayaran di situs ini hanya demo (QR tiruan). Untuk transaksi asli, hubungkan ke payment gateway seperti Midtrans atau Xendit.
