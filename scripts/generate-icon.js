// Generates simple flat-color PNG app icons (no image deps) — a dark
// rounded-ish square with a blue "N" monogram block — plus a matching .ico
// for the desktop shortcut. Swap these files for real artwork any time.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// bg: [r,g,b], accent: [r,g,b] drawn as a centered square block
function makePng(size, bg, accent) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const inset = Math.round(size * 0.22);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    const insideY = y >= inset && y < size - inset;
    for (let x = 0; x < size; x++) {
      const insideX = x >= inset && x < size - inset;
      const [r, g, b] = insideX && insideY ? accent : bg;
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
    }
  }

  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Minimal ICO wrapper around one PNG image (valid since Windows Vista).
function makeIco(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width (0 = 256)
  entry[1] = size >= 256 ? 0 : size; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32BE(0, 8); // placeholder, fix below (little-endian actually)
  entry.writeUInt32LE(pngBuf.length, 8); // image data size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, pngBuf]);
}

const bg = [90, 107, 58]; // matches --board-2 (cork green)
const accent = [247, 226, 138]; // matches --note-yellow

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const png192 = makePng(192, bg, accent);
const png512 = makePng(512, bg, accent);
const png180 = makePng(180, bg, accent);
const png256 = makePng(256, bg, accent);

fs.writeFileSync(path.join(outDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(outDir, 'icon-512.png'), png512);
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png180);
fs.writeFileSync(path.join(outDir, 'icon.ico'), makeIco(png256, 256));

console.log('Icons written to', outDir);
