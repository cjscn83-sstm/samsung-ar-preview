const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');

app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: '20mb' }));

// 제품 메타 — 이미지는 samsung.com/sec 공식 페이지의 og:image 사용
// (downloaded → public/products/) · 치수는 모델 공식 스펙
const PRODUCTS = {
  'bespoke-fridge': {
    id: 'bespoke-fridge',
    name: 'Bespoke AI 패밀리허브 4도어 864L',
    modelCode: 'RM90H91B1W',
    sourceUrl: 'https://www.samsung.com/sec/refrigerators/french-door-rm90h91b1w-d2c/RM90H91B1W/',
    file: 'bespoke-fridge.png',
    widthMm: 812,
    heightMm: 1853,
    depthMm: 716,
    clearance: { top: 50, sides: 25, back: 50 },
    powerNote: '220V 전용 접지 콘센트 필요 · 도어 개방 동선 확보',
    defaultScale: 0.55
  },
  'bespoke-washer': {
    id: 'bespoke-washer',
    name: 'Bespoke AI 세탁기 25kg',
    modelCode: 'WF25CB8895BV',
    sourceUrl: 'https://www.samsung.com/sec/washing-machines/wf25cb8895bg-d2c/WF25CB8895BV/',
    file: 'bespoke-washer.png',
    widthMm: 600,
    heightMm: 850,
    depthMm: 800,
    clearance: { top: 30, sides: 20, back: 50 },
    powerNote: '급수/배수 호스 · 220V 접지 콘센트 · 방수팬 위치 확인',
    defaultScale: 0.35
  },
  'neo-qled': {
    id: 'neo-qled',
    name: '2025 Neo QLED QNF90 75" (189cm)',
    modelCode: 'KQ75QNF90BFXKR',
    sourceUrl: 'https://www.samsung.com/sec/tvs/neo-qled-4k-qnf90b-d2c/KQ75QNF90BFXKR/',
    file: 'neo-qled.png',
    widthMm: 1668,
    heightMm: 956,
    depthMm: 60,
    clearance: { top: 100, sides: 100, back: 0 },
    powerNote: '벽걸이 시 No-Gap 월마운트(별매) 권장 · 시청거리 2.5m 이상',
    defaultScale: 0.6
  }
};

app.get('/api/products', (_req, res) => {
  res.json(Object.values(PRODUCTS).map(p => ({
    id: p.id,
    name: p.name,
    modelCode: p.modelCode,
    sourceUrl: p.sourceUrl,
    image: `/products/${p.file}`,
    dimensions: { width: p.widthMm, height: p.heightMm, depth: p.depthMm },
    clearance: p.clearance,
    powerNote: p.powerNote
  })));
});

app.post('/api/compose', upload.single('room'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'room 이미지가 필요합니다.' });
    const productId = req.body.productId;
    const product = PRODUCTS[productId];
    if (!product) return res.status(400).json({ error: '알 수 없는 productId' });

    const x = parseInt(req.body.x ?? '50', 10);
    const y = parseInt(req.body.y ?? '50', 10);
    const scale = parseFloat(req.body.scale ?? String(product.defaultScale));

    const room = sharp(req.file.buffer).rotate();
    const roomMeta = await room.metadata();
    const roomW = roomMeta.width || 1080;
    const roomH = roomMeta.height || 1440;

    const productPath = path.join(PRODUCTS_DIR, product.file);
    if (!fs.existsSync(productPath)) {
      return res.status(500).json({ error: `제품 이미지 누락: ${product.file}` });
    }

    const targetH = Math.round(roomH * scale);
    const productBuf = await sharp(productPath)
      .resize({ height: targetH, withoutEnlargement: false })
      .toBuffer();
    const productMeta = await sharp(productBuf).metadata();

    const left = Math.max(0, Math.min(roomW - (productMeta.width || 0),
      Math.round((x / 100) * roomW - (productMeta.width || 0) / 2)));
    const top = Math.max(0, Math.min(roomH - (productMeta.height || 0),
      Math.round((y / 100) * roomH - (productMeta.height || 0) / 2)));

    const composed = await room
      .composite([{ input: productBuf, left, top }])
      .jpeg({ quality: 88 })
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(composed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Samsung AR Preview running on http://localhost:${PORT}`);
});
