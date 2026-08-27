const PNG = require('pngjs').PNG;
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const dir = 'public/icons';

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function createIconPNG(size) {
  const png = new PNG({ width: size, height: size, colorType: 6 }); // RGBA
  const r = Math.round(size * 0.1875); // border radius
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      
      // Check if point is inside rounded rect
      let inRect = true;
      if (x < r && y < r) {
        const dx = x - r, dy = y - r;
        if (dx * dx + dy * dy > r * r) inRect = false;
      } else if (x >= size - r && y < r) {
        const dx = x - (size - r), dy = y - r;
        if (dx * dx + dy * dy > r * r) inRect = false;
      } else if (x < r && y >= size - r) {
        const dx = x - r, dy = y - (size - r);
        if (dx * dx + dy * dy > r * r) inRect = false;
      } else if (x >= size - r && y >= size - r) {
        const dx = x - (size - r), dy = y - (size - r);
        if (dx * dx + dy * dy > r * r) inRect = false;
      }
      
      if (inRect) {
        // Gradient background: #F6AE4A to #E89B3A
        const t = (x + y) / (size * 2);
        const r = Math.round(246 * (1 - t) + 232 * t);
        const g = Math.round(174 * (1 - t) + 155 * t);
        const b = Math.round(74 * (1 - t) + 58 * t);
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      } else {
        // Transparent
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }
  
  // Draw "G" letter - approximate center
  const fontSize = Math.round(size * 0.5);
  const centerX = size / 2;
  const centerY = size / 2 + size * 0.03;
  
  // Simple "G" shape using filled circles/rects
  drawG(png, size, centerX, centerY, fontSize);
  
  // Accent circles
  drawCircle(png, size * 0.78, size * 0.22, size * 0.078, [255, 255, 255, 51]); // white 20%
  drawCircle(png, size * 0.22, size * 0.78, size * 0.055, [255, 255, 255, 38]); // white 15%
  
  return PNG.sync.write(png);
}

function drawCircle(png, cx, cy, radius, color) {
  const r = Math.round(radius);
  const x0 = Math.round(cx - r);
  const y0 = Math.round(cy - r);
  const size = png.width;
  
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        const x = x0 + dx + r;
        const y = y0 + dy + r;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const idx = (size * y + x) << 2;
          // Alpha blend
          const a = color[3] / 255;
          png.data[idx] = Math.round(png.data[idx] * (1 - a) + color[0] * a);
          png.data[idx + 1] = Math.round(png.data[idx + 1] * (1 - a) + color[1] * a);
          png.data[idx + 2] = Math.round(png.data[idx + 2] * (1 - a) + color[2] * a);
          png.data[idx + 3] = 255;
        }
      }
    }
  }
}

function drawG(png, size, cx, cy, fontSize) {
  const color = [255, 255, 255, 255]; // White
  const thickness = Math.max(2, Math.round(size * 0.08));
  const outerR = Math.round(fontSize * 0.5);
  const innerR = outerR - thickness;
  
  // Draw G as a thick circle with opening on right
  for (let y = -outerR; y <= outerR; y++) {
    for (let x = -outerR; x <= outerR; x++) {
      const distSq = x * x + y * y;
      if (distSq <= outerR * outerR && distSq >= innerR * innerR) {
        // Only draw left 3/4 of circle (G shape)
        const angle = Math.atan2(y, x);
        if (angle > -Math.PI * 0.75 && angle < Math.PI * 0.75) {
          const px = Math.round(cx + x);
          const py = Math.round(cy + y);
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (size * py + px) << 2;
            png.data[idx] = color[0];
            png.data[idx + 1] = color[1];
            png.data[idx + 2] = color[2];
            png.data[idx + 3] = color[3];
          }
        }
      }
    }
  }
  
  // Draw horizontal bar in G
  const barY = Math.round(cy + outerR * 0.1);
  const barXStart = Math.round(cx - outerR * 0.3);
  const barXEnd = Math.round(cx + outerR * 0.5);
  
  for (let x = barXStart; x <= barXEnd; x++) {
    for (let dy = -thickness/2; dy <= thickness/2; dy++) {
      const px = x;
      const py = barY + dy;
      if (px >= 0 && px < size && py >= 0 && py < size) {
        const idx = (size * py + px) << 2;
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = color[3];
      }
    }
  }
}

sizes.forEach(size => {
  try {
    const buffer = createIconPNG(size);
    fs.writeFileSync(`${dir}/icon-${size}.png`, buffer);
    console.log(`Created icon-${size}.png (${buffer.length} bytes)`);
  } catch (err) {
    console.error(`Failed icon-${size}:`, err.message);
  }
});

console.log('All icons generated!');