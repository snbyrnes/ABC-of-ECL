#!/usr/bin/env node
/**
 * Generate the raster images the manifest and social cards need.
 *
 * The project has no image toolchain and no binary assets in git history, so
 * these are drawn programmatically and written as PNGs with zlib. Re-run with
 * `node tools/make-images.js` if the brand colours change.
 *
 * Design follows favicon.svg: an indigo gradient rounded square with a
 * monospace angle-bracket mark.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..');
const SS = 4;                       // supersampling factor for smooth edges
const INDIGO_A = [0x63, 0x66, 0xf1];
const INDIGO_B = [0x4f, 0x46, 0xe5];
const INK      = [0x0f, 0x17, 0x2a];

/* ---------- canvas ---------- */

function canvas(w, h) {
    return { w, h, data: new Uint8Array(w * h * 4) };
}

function setPx(c, x, y, [r, g, b], a = 255) {
    if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
    const i = (y * c.w + x) * 4;
    if (a === 255) {
        c.data[i] = r; c.data[i + 1] = g; c.data[i + 2] = b; c.data[i + 3] = 255;
        return;
    }
    const k = a / 255, inv = 1 - k;
    c.data[i]     = Math.round(r * k + c.data[i] * inv);
    c.data[i + 1] = Math.round(g * k + c.data[i + 1] * inv);
    c.data[i + 2] = Math.round(b * k + c.data[i + 2] * inv);
    c.data[i + 3] = Math.max(c.data[i + 3], a);
}

function fill(c, colour) {
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) setPx(c, x, y, colour);
}

function lerp(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}

/** Diagonal gradient, matching the favicon's 0%->100% linear gradient. */
function gradientRoundedRect(c, x0, y0, w, h, radius, from, to) {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            const lx = x - x0, ly = y - y0;
            // Rounded-corner test.
            const cx = lx < radius ? radius : lx > w - radius ? w - radius : lx;
            const cy = ly < radius ? radius : ly > h - radius ? h - radius : ly;
            const dx = lx - cx, dy = ly - cy;
            if (dx * dx + dy * dy > radius * radius) continue;
            setPx(c, x, y, lerp(from, to, (lx / w + ly / h) / 2));
        }
    }
}

/** Thick polyline, used for the angle-bracket mark. */
function stroke(c, points, width, colour) {
    const r = width / 2;
    for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay] = points[i], [bx, by] = points[i + 1];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy <= r * r) setPx(c, Math.round(px + dx), Math.round(py + dy), colour);
                }
            }
        }
    }
}

/** Downsample a supersampled canvas for anti-aliasing. */
function downsample(src, factor) {
    const out = canvas(src.w / factor, src.h / factor);
    for (let y = 0; y < out.h; y++) {
        for (let x = 0; x < out.w; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let sy = 0; sy < factor; sy++) {
                for (let sx = 0; sx < factor; sx++) {
                    const i = ((y * factor + sy) * src.w + (x * factor + sx)) * 4;
                    r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3];
                }
            }
            const n = factor * factor, i = (y * out.w + x) * 4;
            out.data[i] = r / n; out.data[i + 1] = g / n; out.data[i + 2] = b / n; out.data[i + 3] = a / n;
        }
    }
    return out;
}

/* ---------- PNG encoding ---------- */

function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = (crc ^ buf[n]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = c ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function encodePng(c) {
    const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
    for (let y = 0; y < c.h; y++) {
        raw[y * (c.w * 4 + 1)] = 0;   // filter: none
        for (let x = 0; x < c.w * 4; x++) {
            raw[y * (c.w * 4 + 1) + 1 + x] = c.data[y * c.w * 4 + x];
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(c.w, 0);
    ihdr.writeUInt32BE(c.h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

/* ---------- 5x7 bitmap font ---------- */

const FONT = {
    A: ['01110','10001','10001','11111','10001','10001','10001'],
    B: ['11110','10001','10001','11110','10001','10001','11110'],
    C: ['01111','10000','10000','10000','10000','10000','01111'],
    D: ['11110','10001','10001','10001','10001','10001','11110'],
    E: ['11111','10000','10000','11110','10000','10000','11111'],
    F: ['11111','10000','10000','11110','10000','10000','10000'],
    G: ['01111','10000','10000','10111','10001','10001','01111'],
    H: ['10001','10001','10001','11111','10001','10001','10001'],
    I: ['11111','00100','00100','00100','00100','00100','11111'],
    J: ['00111','00010','00010','00010','00010','10010','01100'],
    K: ['10001','10010','10100','11000','10100','10010','10001'],
    L: ['10000','10000','10000','10000','10000','10000','11111'],
    M: ['10001','11011','10101','10101','10001','10001','10001'],
    N: ['10001','11001','10101','10011','10001','10001','10001'],
    O: ['01110','10001','10001','10001','10001','10001','01110'],
    P: ['11110','10001','10001','11110','10000','10000','10000'],
    Q: ['01110','10001','10001','10001','10101','10010','01101'],
    R: ['11110','10001','10001','11110','10100','10010','10001'],
    S: ['01111','10000','10000','01110','00001','00001','11110'],
    T: ['11111','00100','00100','00100','00100','00100','00100'],
    U: ['10001','10001','10001','10001','10001','10001','01110'],
    V: ['10001','10001','10001','10001','10001','01010','00100'],
    W: ['10001','10001','10001','10101','10101','11011','10001'],
    X: ['10001','10001','01010','00100','01010','10001','10001'],
    Y: ['10001','10001','01010','00100','00100','00100','00100'],
    Z: ['11111','00001','00010','00100','01000','10000','11111'],
    '0': ['01110','10001','10011','10101','11001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00110','01000','10000','11111'],
    '3': ['11111','00010','00100','00010','00001','10001','01110'],
    '4': ['00010','00110','01010','10010','11111','00010','00010'],
    '5': ['11111','10000','11110','00001','00001','10001','01110'],
    '6': ['00110','01000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00010','01100'],
    '<': ['00010','00100','01000','10000','01000','00100','00010'],
    '>': ['01000','00100','00010','00001','00010','00100','01000'],
    '|': ['00100','00100','00100','00100','00100','00100','00100'],
    ':': ['00000','00100','00100','00000','00100','00100','00000'],
    '.': ['00000','00000','00000','00000','00000','01100','01100'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
    ' ': ['00000','00000','00000','00000','00000','00000','00000']
};

function drawText(c, text, x, y, scale, colour) {
    let cx = x;
    for (const ch of text.toUpperCase()) {
        const glyph = FONT[ch] || FONT[' '];
        glyph.forEach((row, gy) => {
            [...row].forEach((bit, gx) => {
                if (bit !== '1') return;
                for (let sy = 0; sy < scale; sy++) {
                    for (let sx = 0; sx < scale; sx++) {
                        setPx(c, cx + gx * scale + sx, y + gy * scale + sy, colour);
                    }
                }
            });
        });
        cx += 6 * scale;
    }
    return cx;
}

function textWidth(text, scale) { return text.length * 6 * scale; }

/* ---------- the mark ---------- */

function drawMark(c, x, y, size) {
    gradientRoundedRect(c, x, y, size, size, size * 0.1875, INDIGO_A, INDIGO_B);
    const w = Math.max(2, size * 0.075);
    const cx = x + size / 2, cy = y + size / 2;
    const reach = size * 0.17, spread = size * 0.145;
    stroke(c, [[cx - spread * 0.4, cy - reach], [cx - spread * 1.35, cy], [cx - spread * 0.4, cy + reach]], w, [255, 255, 255]);
    stroke(c, [[cx + spread * 0.4, cy - reach], [cx + spread * 1.35, cy], [cx + spread * 0.4, cy + reach]], w, [255, 255, 255]);
}

function makeIcon(size, file) {
    const c = canvas(size * SS, size * SS);
    drawMark(c, 0, 0, size * SS);
    fs.writeFileSync(path.join(OUT, file), encodePng(downsample(c, SS)));
    console.log(`  ${file}  ${size}x${size}`);
}

function makeOgImage(file) {
    const W = 1200, H = 630;
    const c = canvas(W * SS, H * SS);
    fill(c, INK);

    // Subtle gradient wash from the brand indigo in the top-left.
    for (let y = 0; y < c.h; y++) {
        for (let x = 0; x < c.w; x++) {
            const t = 1 - Math.min(1, Math.hypot(x / c.w, y / c.h) / 1.1);
            if (t > 0) setPx(c, x, y, lerp(INK, INDIGO_B, t * 0.55));
        }
    }

    const mark = 132 * SS;
    drawMark(c, 96 * SS, 92 * SS, mark);

    drawText(c, 'ABC OF ECL', 96 * SS, 266 * SS, 11 * SS, [255, 255, 255]);
    drawText(c, 'LEARN SNOMED CT EXPRESSION', 96 * SS, 374 * SS, 4 * SS, [0xc7, 0xd2, 0xfe]);
    drawText(c, 'CONSTRAINT LANGUAGE', 96 * SS, 414 * SS, 4 * SS, [0xc7, 0xd2, 0xfe]);

    // A real expression, because that is what the site is about.
    const snippet = '<< 763158003 |MEDICINAL PRODUCT|';
    const sx = 96 * SS, sy = 502 * SS, ss = 4 * SS;
    for (let y = sy - 14 * SS; y < sy + 7 * ss + 14 * SS; y++) {
        for (let x = sx - 18 * SS; x < sx + textWidth(snippet, ss) + 18 * SS; x++) {
            setPx(c, x, y, [0x1e, 0x29, 0x3b]);
        }
    }
    drawText(c, snippet, sx, sy, ss, [0x93, 0xc5, 0xfd]);

    fs.writeFileSync(path.join(OUT, file), encodePng(downsample(c, SS)));
    console.log(`  ${file}  ${W}x${H}`);
}

console.log('Generating images:');
makeIcon(192, 'icon-192.png');
makeIcon(512, 'icon-512.png');
makeIcon(180, 'apple-touch-icon.png');
makeOgImage('og-image.png');
console.log('Done.');
