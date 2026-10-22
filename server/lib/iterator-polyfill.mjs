// unpdf 1.9 memuat pdf.js yang membaca Iterator.prototype saat inisialisasi.
// Node 22 sudah punya global Iterator. Node 20 (CI) belum, jadi modul itu gagal
// dengan "Iterator is not defined" sebelum teks PDF sempat dibaca.
const nativeIteratorProto = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
if (typeof globalThis.Iterator !== 'function' && nativeIteratorProto && nativeIteratorProto !== Object.prototype) {
  function Iterator() {
    throw new TypeError('Iterator is not a constructor');
  }
  Iterator.prototype = nativeIteratorProto;
  globalThis.Iterator = Iterator;
}
