const viewer   = document.getElementById('viewer');
const catalog  = document.getElementById('catalog');
const specName = document.getElementById('spec-name');
const specSize = document.getElementById('spec-size');
const arSupport = document.getElementById('ar-support');
const progressFill = document.querySelector('.progress-fill');

const swatchesEl = document.getElementById('swatches');
const colorCustom = document.getElementById('color-custom');
const sizePresetsEl = document.getElementById('size-presets');
const dimW = document.getElementById('dim-w');
const dimH = document.getElementById('dim-h');

// Палитра «дверных» цветов. null = исходный цвет модели.
const COLORS = [
  { name: 'Исходный', hex: null },
  { name: 'Белый',        hex: '#f2f0eb' },
  { name: 'Дуб светлый',  hex: '#c9a56a' },
  { name: 'Орех',         hex: '#6e4423' },
  { name: 'Венге',        hex: '#3b2b22' },
  { name: 'Серый',        hex: '#8b8b8b' },
  { name: 'Антрацит',     hex: '#35383b' },
];

// Пресеты стандартных размеров полотна, мм
const SIZE_PRESETS = [
  { w: 600, h: 2000 },
  { w: 700, h: 2000 },
  { w: 800, h: 2000 },
  { w: 900, h: 2100 },
];

// --- Состояние ---
let current = null;         // выбранная дверь
let currentColor = null;    // hex или null
let originalFactors = null; // исходные baseColorFactor материалов
let nativeSize = null;      // локальные габариты модели (метры), измеряются при загрузке
let roles = null;           // какая ось = ширина/высота/толщина: {thick,width,height}

// sRGB (0..255) -> linear (0..1)
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexToLinearRGBA(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear((n >> 16) & 255), srgbToLinear((n >> 8) & 255), srgbToLinear(n & 255), 1];
}

// Переобрамление камеры после смены масштаба (с задержкой, чтобы scale успел примениться)
let frameTimer = null;
function reframe() {
  if (!viewer.updateFraming) return;
  clearTimeout(frameTimer);
  frameTimer = setTimeout(() => viewer.updateFraming(), 60);
}

function applyColor() {
  if (!viewer.model) return;
  viewer.model.materials.forEach((m, i) => {
    if (currentColor === null) {
      if (originalFactors) m.pbrMetallicRoughness.setBaseColorFactor(originalFactors[i]);
    } else {
      m.pbrMetallicRoughness.setBaseColorFactor(hexToLinearRGBA(currentColor));
    }
  });
}

// Приводим модель к заданным габаритам (в мм) через scale — работает и в AR.
// Масштаб считаем по осям: у модели ось высоты/ширины/толщины определяется автоматически.
function applySize() {
  if (!current || !nativeSize || !roles) return;
  const w = Number(dimW.value) || current.width;
  const h = Number(dimH.value) || current.height;

  const sWidth  = (w / 1000) / (nativeSize[roles.width]  || 1);
  const sHeight = (h / 1000) / (nativeSize[roles.height] || 1);
  const sc = { x: 1, y: 1, z: 1 };
  sc[roles.width]  = sWidth;
  sc[roles.height] = sHeight;
  sc[roles.thick]  = sWidth;             // толщину масштабируем пропорционально ширине
  viewer.scale = `${sc.x} ${sc.y} ${sc.z}`;
  reframe();

  specSize.textContent = `${w} × ${h} мм`;
  sizePresetsEl.querySelectorAll('.size-preset').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.w) === w && Number(b.dataset.h) === h);
  });
}

function selectDoor(door, chipEl) {
  current = door;
  currentColor = null;
  originalFactors = null;
  nativeSize = null;
  roles = null;

  viewer.scale = '1 1 1';            // сбрасываем перед измерением
  viewer.orientation = '0deg 0deg 0deg';
  viewer.setAttribute('src', door.glb);
  if (door.usdz) viewer.setAttribute('ios-src', door.usdz);
  else viewer.removeAttribute('ios-src');
  viewer.setAttribute('alt', door.name);
  if (door.poster) viewer.setAttribute('poster', door.poster);
  else viewer.removeAttribute('poster');

  specName.textContent = door.name;
  dimW.value = door.width;
  dimH.value = door.height;
  specSize.textContent = `${door.width} × ${door.height} мм`;

  catalog.querySelectorAll('.door-chip').forEach((c) => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  swatchesEl.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('active', i === 0));
}

function buildCatalog(doors) {
  catalog.innerHTML = '';
  doors.forEach((door, i) => {
    const chip = document.createElement('button');
    chip.className = 'door-chip';
    chip.innerHTML = door.poster
      ? `<img src="${door.poster}" alt="${door.name}" loading="lazy"><span>${door.name}</span>`
      : `<span class="no-poster">◫</span><span>${door.name}</span>`;
    chip.addEventListener('click', () => selectDoor(door, chip));
    catalog.appendChild(chip);
    if (i === 0) selectDoor(door, chip);
  });
}

// --- Свотчи цвета ---
COLORS.forEach((c, i) => {
  const s = document.createElement('button');
  s.className = 'swatch' + (c.hex === null ? ' original' : '') + (i === 0 ? ' active' : '');
  if (c.hex) s.style.background = c.hex;
  s.title = c.name;
  s.addEventListener('click', () => {
    currentColor = c.hex;
    applyColor();
    swatchesEl.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
    s.classList.add('active');
  });
  swatchesEl.appendChild(s);
});
colorCustom.addEventListener('input', () => {
  currentColor = colorCustom.value;
  applyColor();
  swatchesEl.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
});

// --- Пресеты размера ---
SIZE_PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.className = 'size-preset';
  b.textContent = `${p.w}×${p.h}`;
  b.dataset.w = p.w;
  b.dataset.h = p.h;
  b.addEventListener('click', () => { dimW.value = p.w; dimH.value = p.h; applySize(); });
  sizePresetsEl.appendChild(b);
});
dimW.addEventListener('input', applySize);
dimH.addEventListener('input', applySize);

// --- Вернуть модель в кадр ---
// Панорама камеры (два пальца) может «увезти» объект за пределы видимости.
// Кнопка и двойной тап сбрасывают панораму и подгоняют дистанцию, сохраняя угол обзора.
const recenterBtn = document.getElementById('recenter-btn');
function recenter() {
  const o = viewer.getCameraOrbit();                 // текущий угол/зум (радианы, метры)
  if (viewer.updateFraming) viewer.updateFraming();  // масштаб мог поменяться — пересчёт кадра
  viewer.cameraTarget = 'auto auto auto';            // цель камеры → центр модели (сброс панорамы)
  viewer.cameraOrbit  = `${o.theta}rad ${o.phi}rad auto`; // тот же угол, дистанция → по кадру
  viewer.fieldOfView  = 'auto';
}
recenterBtn.addEventListener('click', recenter);
viewer.addEventListener('dblclick', recenter);       // двойной тап/клик по сцене — тоже в центр

// --- Загрузка модели ---
viewer.addEventListener('progress', (e) => {
  const p = e.detail.totalProgress;
  progressFill.style.width = `${p * 100}%`;
  progressFill.style.opacity = p < 1 ? '1' : '0';
});
viewer.addEventListener('load', async () => {
  viewer.scale = '1 1 1';
  viewer.orientation = '0deg 0deg 0deg';
  await new Promise((r) => requestAnimationFrame(r));

  nativeSize = viewer.getDimensions();          // локальные габариты модели (метры)
  const e = Object.entries(nativeSize).sort((a, b) => a[1] - b[1]); // min..max
  roles = { thick: e[0][0], width: e[1][0], height: e[2][0] };

  // ставим модель вертикально: ось высоты -> мировой +Y
  viewer.orientation =
    roles.height === 'y' ? '0deg 0deg 0deg' :
    roles.height === 'z' ? '0deg -90deg 0deg' : '90deg 0deg 0deg';

  originalFactors = viewer.model.materials.map((m) => m.pbrMetallicRoughness.baseColorFactor);
  applyColor();
  applySize();
  arSupport.textContent = viewer.canActivateAR ? '' : 'AR доступен в Safari на iPhone/iPad';
});

// --- Динамическая загрузка каталога из manifest.json ---
fetch('models/manifest.json', { cache: 'no-store' })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((doors) => {
    if (!doors.length) throw new Error('пусто');
    buildCatalog(doors);
  })
  .catch((err) => {
    catalog.innerHTML =
      '<div style="padding:12px;color:var(--muted);font-size:13px">' +
      'Каталог пуст. Положи .glb в models/ и запусти <code>node gen-manifest.mjs</code>.' +
      '</div>';
    console.warn('manifest.json не загружен:', err);
  });
