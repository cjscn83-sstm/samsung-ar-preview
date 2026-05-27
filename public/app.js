const $ = (s) => document.querySelector(s);

const state = {
  stream: null,
  roomBlob: null,
  productId: null,
  products: [],
  scale: 0.45,
};

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
  } catch {
    // Fallback (when serving as static file without backend)
    state.products = [
      { id: 'bespoke-fridge', name: 'Bespoke AI 패밀리허브 4도어 864L', modelCode: 'RM90H91B1W',
        image: '/products/bespoke-fridge.png',
        dimensions: { width: 812, height: 1853, depth: 716 },
        clearance: { top: 50, sides: 25, back: 50 },
        powerNote: '220V 전용 접지 콘센트 · 도어 개방 동선 확보' },
      { id: 'bespoke-washer', name: 'Bespoke AI 세탁기 25kg', modelCode: 'WF25CB8895BV',
        image: '/products/bespoke-washer.png',
        dimensions: { width: 600, height: 850, depth: 800 },
        clearance: { top: 30, sides: 20, back: 50 },
        powerNote: '급수/배수 호스 · 220V 접지 콘센트 · 방수팬 위치 확인' },
      { id: 'neo-qled', name: '2025 Neo QLED QNF90 75"', modelCode: 'KQ75QNF90BFXKR',
        image: '/products/neo-qled.png',
        dimensions: { width: 1668, height: 956, depth: 60 },
        clearance: { top: 100, sides: 100, back: 0 },
        powerNote: '벽걸이 시 No-Gap 월마운트(별매) 권장 · 시청거리 2.5m 이상' },
    ];
  }
  renderProducts();
  renderProductGrid();
}

function renderProducts() {
  const ul = $('#productList');
  ul.innerHTML = state.products.map(p => `
    <li data-id="${p.id}">
      <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.25'"/>
      <span>${p.name}</span>
      ${p.modelCode ? `<small class="model">${p.modelCode}</small>` : ''}
    </li>
  `).join('');
  ul.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => selectProduct(li.dataset.id));
  });
}

function renderProductGrid() {
  const grid = $('#prodGrid');
  grid.innerHTML = state.products.map(p => `
    <a class="neu-card prod-card" href="${p.sourceUrl || '#'}" target="_blank" rel="noopener">
      <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.25'"/>
      <h4>${p.name}</h4>
      <p class="muted">${p.modelCode || ''}</p>
      <p class="muted">${p.dimensions.width} × ${p.dimensions.height} × ${p.dimensions.depth} mm</p>
    </a>
  `).join('');
}

function selectProduct(id) {
  state.productId = id;
  document.querySelectorAll('#productList li').forEach(li =>
    li.classList.toggle('is-active', li.dataset.id === id));
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  $('#kvW').textContent = `${p.dimensions.width} mm`;
  $('#kvH').textContent = `${p.dimensions.height} mm`;
  $('#kvD').textContent = `${p.dimensions.depth} mm`;
  $('#kvCT').textContent = `${p.clearance.top} mm 이상`;
  $('#kvCS').textContent = `${p.clearance.sides} mm 이상`;
  $('#kvCB').textContent = `${p.clearance.back} mm 이상`;
  $('#powerNote').textContent = p.powerNote;
  updateGuide(p);
  updateComposeButton();
}

function updateGuide(p) {
  const frame = document.getElementById('guideFrame');
  if (!frame) return;
  // CSS aspect-ratio respects W / H (TV is wide, fridge is tall)
  frame.style.aspectRatio = `${p.dimensions.width} / ${p.dimensions.height}`;
  document.getElementById('dimW').textContent = `W ${p.dimensions.width} mm`;
  document.getElementById('dimH').textContent = `H ${p.dimensions.height} mm`;
  document.getElementById('dimD').textContent = `D ${p.dimensions.depth} mm`;
}

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false
    });
    const v = $('#cam');
    v.srcObject = state.stream;
    v.hidden = false;
    $('#snapshot').hidden = true;
    $('#captureEmpty').style.display = 'none';
    $('#guide').hidden = false;
    $('#btnSnap').disabled = false;
  } catch (e) {
    alert('카메라를 사용할 수 없습니다: ' + e.message);
  }
}

function snap() {
  const v = $('#cam');
  if (!v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  c.toBlob((b) => {
    state.roomBlob = b;
    const url = URL.createObjectURL(b);
    const img = $('#snapshot');
    img.src = url; img.hidden = false;
    v.hidden = true;
    $('#guide').hidden = true;
    stopCamera();
    updateComposeButton();
  }, 'image/jpeg', 0.92);
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
}

function onFile(e) {
  const f = e.target.files?.[0]; if (!f) return;
  state.roomBlob = f;
  const url = URL.createObjectURL(f);
  const img = $('#snapshot');
  img.src = url; img.hidden = false;
  $('#cam').hidden = true;
  $('#captureEmpty').style.display = 'none';
  stopCamera();
  updateComposeButton();
}

function updateComposeButton() {
  $('#btnCompose').disabled = !(state.roomBlob && state.productId);
}

async function compose() {
  $('#resultLoading').hidden = false;
  $('#resultEmpty').style.display = 'none';
  try {
    const fd = new FormData();
    fd.append('room', state.roomBlob, 'room.jpg');
    fd.append('productId', state.productId);
    fd.append('scale', String(state.scale));
    fd.append('x', '50');
    fd.append('y', '70');
    const res = await fetch('/api/compose', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.json()).error || '합성 실패');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const img = $('#resultImg');
    img.src = url; img.hidden = false;
    const dl = $('#btnDownload');
    dl.href = url; dl.hidden = false;
  } catch (e) {
    alert(e.message);
  } finally {
    $('#resultLoading').hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  $('#btnStartCam').addEventListener('click', startCamera);
  $('#btnSnap').addEventListener('click', snap);
  $('#fileInput').addEventListener('change', onFile);
  $('#btnCompose').addEventListener('click', compose);
  $('#scale').addEventListener('input', (e) => { state.scale = parseFloat(e.target.value); });
});
