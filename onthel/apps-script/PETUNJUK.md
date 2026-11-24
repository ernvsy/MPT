# Kirim email bukti pembelian (PDF) lewat Google Apps Script

Gratis, memakai akun Google tokomu. Email terkirim dari Gmail-mu, dan setiap pesanan tercatat di Google Sheet.

1. Buat Google Sheet baru (nama bebas, mis. "Pesanan Onthel").
2. Di Sheet itu: **Extensions > Apps Script**. Hapus isi default, tempel seluruh isi `Code.gs`.
3. Di bagian atas `Code.gs`, cek `CATALOG` (nama + harga produk harus sama persis dengan `index.html`),
   `FREE_SHIPPING_MIN`, `SHIPPING_FEE`, dan isi `OWNER_EMAIL` kalau mau dapat salinan tiap pesanan.
4. Klik **Deploy > New deployment > Select type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   Klik Deploy, setujui izin Google (Gmail + Sheets), lalu salin **Web app URL**
   (berakhiran `/exec`).
5. Tempel URL itu ke `ORDER_ENDPOINT` di `script.js`.
6. Tes: buat pesanan dengan emailmu sendiri. Email + PDF masuk, dan baris baru muncul di tab "Pesanan".

Catatan
- Setiap kali kode `Code.gs` diubah, buat **New deployment** (atau Manage deployments > Edit > New version) agar perubahan aktif.
- Kuota kirim Gmail: sekitar 100 email/hari untuk akun Gmail biasa, 1.500/hari untuk Google Workspace.
- Server menghitung ulang harga dari `CATALOG`, jadi total yang dikirim browser tidak dipercaya.
- Tiap alamat email dibatasi 5 pesanan per jam untuk mencegah penyalahgunaan.
- Selama `DEMO_MODE = true` di `script.js`, subjek email diberi "[CONTOH]". Ubah ke `false` untuk toko sungguhan.
- Jika `ORDER_ENDPOINT` berisi URL Apps Script, kunci EmailJS diabaikan (tidak ada email ganda).
