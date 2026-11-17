/* Storytelling — hanya tautan WhatsApp */
const WA_NUMBER = '6281234567890'; // ganti dengan nomor WhatsApp (format 62...)
document.querySelectorAll('[data-wa]').forEach((a) => {
  a.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Halo Onthel, saya mau tanya tentang kopi Excelsa.')}`;
});
