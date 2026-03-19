// ═══════════════════════════════════════════════════════════
//  renderer.js — Отрисовка мира, персонажей, UI
// ═══════════════════════════════════════════════════════════

// ── ЦВЕТОВЫЕ ТЕМЫ ЗДАНИЙ ───────────────────────────────────
const THEME_COLORS = {
  old:     { wall: '#6B3A14', roof: '#8B4A18', trim: '#A05A28', shadow: '#3a1808' },
  new:     { wall: '#1A4A1A', roof: '#2A6A2A', trim: '#3A8A3A', shadow: '#082008' },
  cult:    { wall: '#2E0A50', roof: '#4A1278', trim: '#6A1A9A', shadow: '#180430' },
  mine:    { wall: '#4A3828', roof: '#5A4830', trim: '#7A5840', shadow: '#201408' },
  ruins:   { wall: '#3A3028', roof: '#2A2018', trim: '#5A4A38', shadow: '#181008' },
  neutral: { wall: '#4A4030', roof: '#5A5038', trim: '#7A6848', shadow: '#201808' },
};

// ── ДЕТЕРМИНИРОВАННЫЙ PRNG ─────────────────────────────────
function mkRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── ПРЕД-ГЕНЕРАЦИЯ ДЕКОРА ──────────────────────────────────
const DECO = (function() {
  const rng = mkRng(12345);
  const items = [];
  for (let i = 0; i < 180; i++) {
    items.push({ type: 'rock', x: rng()*WORLD.W, y: rng()*WORLD.H, rx: 3+rng()*5, ry: 2+rng()*3, a: rng()*Math.PI });
  }
  for (let i = 0; i < 220; i++) {
    items.push({ type: 'tree', x: rng()*WORLD.W, y: rng()*WORLD.H, r: 7+rng()*10, variant: Math.floor(rng()*3) });
  }
  for (let i = 0; i < 60; i++) {
    items.push({ type: 'bush', x: rng()*WORLD.W, y: rng()*WORLD.H, r: 4+rng()*5 });
  }
  return items;
})();

function buildingContains(bx, by) {
  for (const b of BUILDINGS) {
    if (bx > b.x-8 && bx < b.x+b.w+8 && by > b.y-8 && by < b.y+b.h+8) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
//  РИСОВАТЬ МИР
// ═══════════════════════════════════════════════════════════
function renderWorld(ctx, camX, camY, t) {
  ctx.save();
  ctx.translate(-camX, -camY);

  drawGround(ctx);
  drawZones(ctx);
  drawRoads(ctx);
  drawWater(ctx, t);
  drawDecorations(ctx);
  drawBuildings(ctx);
  drawBarrier(ctx, t);

  ctx.restore();
}

// ── ЗЕМЛЯ ──────────────────────────────────────────────────
function drawGround(ctx) {
  ctx.fillStyle = '#1C1810';
  ctx.fillRect(0, 0, WORLD.W, WORLD.H);

  // Тайловая вариация грунта
  const T = WORLD.TILE;
  for (let tx = 0; tx < WORLD.W; tx += T) {
    for (let ty = 0; ty < WORLD.H; ty += T) {
      const h = ((tx * 7919 + ty * 6271 + tx*ty) & 0xff) / 255;
      if (h > 0.72) {
        ctx.fillStyle = `rgba(32,28,16,${0.25 + h*0.2})`;
        ctx.fillRect(tx, ty, T, T);
      } else if (h < 0.18) {
        ctx.fillStyle = `rgba(10,8,4,${0.2})`;
        ctx.fillRect(tx, ty, T, T);
      }
    }
  }
}

// ── ЗОНЫ ───────────────────────────────────────────────────
const ZONE_STYLE = {
  old:   { fill: 'rgba(90,40,8,0.22)',   border: 'rgba(180,90,20,0.55)',  label: '#C06820' },
  new:   { fill: 'rgba(8,60,8,0.22)',    border: 'rgba(30,140,40,0.55)',  label: '#30A840' },
  cult:  { fill: 'rgba(50,5,90,0.25)',   border: 'rgba(120,30,200,0.55)', label: '#9030D0' },
  mine:  { fill: 'rgba(60,40,10,0.22)',  border: 'rgba(140,100,30,0.55)', label: '#A07030' },
  ruins: { fill: 'rgba(30,25,15,0.25)',  border: 'rgba(90,75,45,0.55)',   label: '#807050' },
};

function drawZones(ctx) {
  for (const z of ZONES) {
    const s = ZONE_STYLE[z.theme] || ZONE_STYLE.ruins;
    ctx.fillStyle = s.fill;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = s.border;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(z.x+1, z.y+1, z.w-2, z.h-2);
    ctx.setLineDash([]);
    ctx.font = 'bold 12px Georgia';
    ctx.fillStyle = s.label;
    ctx.globalAlpha = 0.65;
    ctx.textAlign = 'center';
    ctx.fillText('— ' + z.name.toUpperCase() + ' —', z.x + z.w/2, z.y + 18);
    ctx.globalAlpha = 1;
  }
}

// ── ДОРОГИ ─────────────────────────────────────────────────
function drawRoads(ctx) {
  const roads = [
    { x1:0,       y1:480,  x2:WORLD.W, y2:480,  w:32 },   // главная горизонтальная
    { x1:850,     y1:0,    x2:850,     y2:1250,  w:28 },   // центральная вертикальная
    { x1:850,     y1:480,  x2:1000,    y2:1250,  w:26 },   // к сектантам
    { x1:720,     y1:0,    x2:1650,    y2:0,     w:28 },   // верхняя к новому лагерю
    { x1:1650,    y1:0,    x2:1650,    y2:480,   w:28 },   // к новому лагерю
    { x1:1200,    y1:480,  x2:1500,    y2:750,   w:24 },   // к шахте
  ];
  for (const r of roads) {
    ctx.strokeStyle = '#282010';
    ctx.lineWidth = r.w;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2); ctx.stroke();
    ctx.strokeStyle = '#222010';
    ctx.lineWidth = r.w - 6;
    ctx.beginPath(); ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2); ctx.stroke();
    // Осевая линия
    ctx.strokeStyle = 'rgba(50,44,22,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.lineCap = 'butt';
}

// ── ВОДА (река / пруды) ────────────────────────────────────
function drawWater(ctx, t) {
  const wave = Math.sin(t * 0.8) * 0.05;
  // Главная река
  ctx.fillStyle = `rgba(18,40,70,${0.85+wave})`;
  ctx.fillRect(1180, 480, 20, WORLD.H - 480);
  ctx.fillStyle = `rgba(24,55,95,${0.6+wave})`;
  ctx.fillRect(1178, 480, 8, WORLD.H - 480);
  ctx.fillStyle = `rgba(40,80,140,${0.15+wave*0.5})`;
  ctx.fillRect(1176, 480, 28, WORLD.H - 480);

  // Блики
  for (let wy = 500; wy < WORLD.H; wy += 60) {
    const bx = 1180 + Math.sin(t * 1.2 + wy * 0.1) * 3;
    ctx.fillStyle = `rgba(100,160,220,0.12)`;
    ctx.fillRect(bx, wy, 6, 20);
  }

  // Пруд у руин
  ctx.fillStyle = 'rgba(14,30,55,0.8)';
  ctx.beginPath();
  ctx.ellipse(400, 1050, 70, 40, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = 'rgba(25,50,90,0.4)';
  ctx.beginPath();
  ctx.ellipse(398, 1048, 65, 36, 0, 0, Math.PI*2);
  ctx.fill();
}

// ── ДЕКОРАЦИИ ──────────────────────────────────────────────
function drawDecorations(ctx) {
  for (const d of DECO) {
    if (buildingContains(d.x, d.y)) continue;
    if (d.type === 'rock') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(d.x+2, d.y+2, d.rx+1, d.ry+0.5, d.a, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#4A4230';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.rx, d.ry, d.a, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.ellipse(d.x-1, d.y-1, d.rx*0.5, d.ry*0.4, d.a, 0, Math.PI*2);
      ctx.fill();
    } else if (d.type === 'tree') {
      // Тень
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(d.x+4, d.y+4, d.r+1, d.r*0.6, 0, 0, Math.PI*2);
      ctx.fill();
      // Ствол
      ctx.fillStyle = '#2A1808';
      ctx.fillRect(d.x-2, d.y-2, 4, d.r*0.7);
      // Крона — три слоя
      const greens = ['#142808', '#1C3A0A', '#24480C'];
      const g = greens[d.variant % 3];
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y - d.r*0.3, d.r, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = shadeColor(g, 15);
      ctx.beginPath();
      ctx.arc(d.x - d.r*0.3, d.y - d.r*0.5, d.r*0.7, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = shadeColor(g, 25);
      ctx.beginPath();
      ctx.arc(d.x + d.r*0.2, d.y - d.r*0.6, d.r*0.55, 0, Math.PI*2);
      ctx.fill();
    } else if (d.type === 'bush') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(d.x+2, d.y+2, d.r+1, d.r*0.6, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#1C3A08';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#28500A';
      ctx.beginPath();
      ctx.arc(d.x-d.r*0.3, d.y-d.r*0.2, d.r*0.6, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function shadeColor(hex, pct) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n>>16)&0xff) + pct);
  const g = Math.min(255, ((n>>8)&0xff)  + pct);
  const b = Math.min(255, (n&0xff)        + pct);
  return `rgb(${r},${g},${b})`;
}

// ═══════════════════════════════════════════════════════════
//  ПОСТРОЙКИ
// ═══════════════════════════════════════════════════════════
function drawBuildings(ctx) {
  // Сначала тени
  for (const b of BUILDINGS) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x+6, b.y+6, b.w, b.h);
  }
  // Потом сами
  for (const b of BUILDINGS) {
    drawBuilding(ctx, b);
  }
}

function drawBuilding(ctx, b) {
  const tc = THEME_COLORS[b.theme] || THEME_COLORS.neutral;
  const { x, y, w, h, type } = b;

  if (type === 'tower') {
    drawTower(ctx, b, tc);
  } else if (type === 'altar') {
    drawAltar(ctx, b, tc);
  } else if (type === 'mine') {
    drawMineEntrance(ctx, b, tc);
  } else if (type === 'ruin') {
    drawRuin(ctx, b, tc);
  } else {
    drawHouse(ctx, b, tc);
  }

  // Подпись
  if (b.label) {
    ctx.font = '9px Georgia';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(b.label, x + w/2, y - 5);
    ctx.fillStyle = 'rgba(200,170,100,0.8)';
    ctx.fillText(b.label, x + w/2, y - 5);
  }
}

function drawHouse(ctx, b, tc) {
  const { x, y, w, h } = b;
  // Стены
  ctx.fillStyle = tc.wall;
  ctx.fillRect(x, y, w, h);
  // Крыша (верхняя часть)
  const rh = Math.round(h * 0.3);
  ctx.fillStyle = tc.roof;
  ctx.fillRect(x, y, w, rh);
  // Нависание крыши
  ctx.fillStyle = shadeColor(tc.roof, -10);
  ctx.fillRect(x-2, y, w+4, 4);
  // Вертикальные брёвна (обрамление)
  ctx.fillStyle = tc.trim;
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x+w-4, y, 4, h);
  // Горизонтальный брус
  ctx.fillStyle = tc.trim;
  ctx.fillRect(x, y+rh, w, 3);
  // Окно
  if (w > 60) {
    const wx = x + Math.floor(w*0.25);
    const wy = y + rh + Math.floor((h-rh)*0.2);
    const ww = Math.max(10, Math.floor(w*0.2));
    const wh = Math.max(10, Math.floor((h-rh)*0.4));
    ctx.fillStyle = 'rgba(180,140,60,0.15)';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = tc.trim;
    ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy, ww, wh);
    // Крест рамы
    ctx.beginPath();
    ctx.moveTo(wx+ww/2, wy); ctx.lineTo(wx+ww/2, wy+wh);
    ctx.moveTo(wx, wy+wh/2); ctx.lineTo(wx+ww, wy+wh/2);
    ctx.strokeStyle = tc.trim;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // Второе окно (для широких зданий)
    if (w > 100) {
      const wx2 = x + Math.floor(w*0.6);
      ctx.fillStyle = 'rgba(180,140,60,0.15)';
      ctx.fillRect(wx2, wy, ww, wh);
      ctx.strokeStyle = tc.trim;
      ctx.lineWidth = 1;
      ctx.strokeRect(wx2, wy, ww, wh);
    }
  }
  // Дверь
  const dw = Math.max(10, Math.floor(w*0.22));
  const dh = Math.max(12, Math.floor((h-rh)*0.55));
  const dx = x + Math.floor((w-dw)/2);
  const dy = y + h - dh;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(dx, dy, dw, dh);
  // Арка двери
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.arc(dx + dw/2, dy, dw/2, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = tc.trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(dx, dy, dw, dh);
  // Контур здания
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawTower(ctx, b, tc) {
  const { x, y, w, h } = b;
  // Основание (толще)
  ctx.fillStyle = tc.wall;
  ctx.fillRect(x+4, y+h*0.4, w-8, h*0.6);
  // Тело башни
  ctx.fillStyle = shadeColor(tc.wall, 5);
  ctx.fillRect(x, y, w, h);
  // Мерлоны (зубцы наверху)
  ctx.fillStyle = tc.roof;
  const mw = Math.floor(w/5);
  for (let i = 0; i < 5; i += 2) {
    ctx.fillRect(x + i*mw, y-8, mw, 10);
  }
  // Горизонтальные полосы кладки
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let sy = y+12; sy < y+h; sy += 12) {
    ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x+w, sy); ctx.stroke();
  }
  // Бойница
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x + w/2 - 3, y + h*0.3, 6, 10);
  ctx.fillRect(x + w*0.2, y + h*0.6, 5, 8);
  ctx.fillRect(x + w*0.7, y + h*0.6, 5, 8);
  // Контур
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y-8, w, h+8);
}

function drawAltar(ctx, b, tc) {
  const { x, y, w, h } = b;
  // Основание пирамидой
  ctx.fillStyle = tc.wall;
  ctx.fillRect(x, y+h*0.5, w, h*0.5);
  ctx.fillStyle = shadeColor(tc.wall, 8);
  ctx.fillRect(x+8, y+h*0.3, w-16, h*0.2);
  ctx.fillStyle = shadeColor(tc.wall, 15);
  ctx.fillRect(x+16, y+h*0.15, w-32, h*0.15);
  // Вершина (пирамида)
  ctx.fillStyle = tc.roof;
  ctx.beginPath();
  ctx.moveTo(x+w/2, y);
  ctx.lineTo(x+16, y+h*0.15);
  ctx.lineTo(x+w-16, y+h*0.15);
  ctx.closePath();
  ctx.fill();
  // Свечение сектантского алтаря
  const grd = ctx.createRadialGradient(x+w/2, y, 2, x+w/2, y+h/2, h*0.8);
  grd.addColorStop(0, 'rgba(140,30,200,0.25)');
  grd.addColorStop(1, 'rgba(140,30,200,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(x-20, y-20, w+40, h+40);
  // Контур
  ctx.strokeStyle = 'rgba(160,40,220,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawMineEntrance(ctx, b, tc) {
  const { x, y, w, h } = b;
  // Здание
  drawHouse(ctx, { ...b }, tc);
  // Шахтная арка поверх
  ctx.fillStyle = '#0a0806';
  ctx.beginPath();
  ctx.arc(x+w/2, y+h, w*0.35, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = tc.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x+w/2, y+h, w*0.35, Math.PI, 0);
  ctx.stroke();
  // Рельсы
  ctx.strokeStyle = '#5A4A30';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x+w*0.35, y+h+2);
  ctx.lineTo(x, y+h+30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x+w*0.65, y+h+2);
  ctx.lineTo(x+w, y+h+30);
  ctx.stroke();
}

function drawRuin(ctx, b, tc) {
  const { x, y, w, h } = b;
  const rng = mkRng(x*31+y*17);
  // Пол
  ctx.fillStyle = tc.shadow;
  ctx.fillRect(x, y, w, h);
  // Разрушенные стены — только куски
  ctx.fillStyle = tc.wall;
  // Левая стена (частичная)
  const lh = Math.floor(h*(0.4+rng()*0.5));
  ctx.fillRect(x, y, 10, lh);
  // Правая стена
  const rh = Math.floor(h*(0.3+rng()*0.5));
  ctx.fillRect(x+w-10, y+h-rh, 10, rh);
  // Нижняя стена
  ctx.fillRect(x, y+h-8, w, 8);
  // Куски верхней стены
  const tw = Math.floor(w*(0.3+rng()*0.4));
  ctx.fillRect(x, y, tw, 8);
  // Осколки/обломки
  for (let i = 0; i < 5; i++) {
    const rx = x + rng()*(w-8);
    const ry = y + rng()*(h-8);
    ctx.fillStyle = shadeColor(tc.wall, Math.floor(rng()*20));
    ctx.fillRect(rx, ry, 4+rng()*10, 4+rng()*8);
  }
  // Трещины
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const sx = x + rng()*w; const sy = y + rng()*h;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rng()-0.5)*20, sy + rng()*15);
    ctx.stroke();
  }
}

// ── БАРЬЕР ─────────────────────────────────────────────────
function drawBarrier(ctx, t) {
  const p1 = 0.28 + 0.12 * Math.sin(t * 0.9);
  const p2 = 0.15 + 0.08 * Math.sin(t * 1.3 + 1);
  // Внешнее свечение
  ctx.shadowColor = '#4488ff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = `rgba(60,120,255,${p1})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, WORLD.W-40, WORLD.H-40);
  ctx.shadowBlur = 0;
  // Внутренняя полоса
  ctx.strokeStyle = `rgba(100,160,255,${p2})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, WORLD.W-52, WORLD.H-52);
  // Частицы барьера
  for (let i = 0; i < 20; i++) {
    const pt = (t * 0.5 + i * 0.31) % 1;
    const px = 20 + pt * (WORLD.W - 40);
    const py = 20 + Math.sin(t + i * 0.8) * 3;
    ctx.fillStyle = `rgba(120,180,255,${0.3 * Math.sin(t*2 + i)})`;
    ctx.fillRect(px, py, 2, 2);
    ctx.fillRect(px, WORLD.H - py, 2, 2);
  }
}

// ═══════════════════════════════════════════════════════════
//  ЧЕЛОВЕЧКИ — детальные пиксельные персонажи
// ═══════════════════════════════════════════════════════════

// Нарисовать человека в top-down виде (овалы + детали)
function drawHuman(ctx, px, py, config, facing, moving, t) {
  const {
    bodyColor, cloakColor, skinColor, hairColor, armorColor,
    scale = 1, selected = false
  } = config;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  const bob = moving ? Math.sin(t * 8) * 1.5 : 0;

  // ── Тень ──────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 9, 4, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Ноги (две маленькие фигуры внизу) ─────────────────
  const legPhase = moving ? Math.sin(t * 9) * 4 : 0;
  ctx.fillStyle = cloakColor;
  // Левая нога
  ctx.beginPath();
  ctx.ellipse(-3, 8 + bob, 3, 4.5, 0, 0, Math.PI*2);
  ctx.fill();
  // Правая нога
  ctx.beginPath();
  ctx.ellipse(3, 8 - bob, 3, 4.5, 0, 0, Math.PI*2);
  ctx.fill();
  // Ступни
  ctx.fillStyle = '#2A2010';
  ctx.beginPath();
  ctx.ellipse(-3.5, 10 + bob, 2.5, 1.8, 0.2, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3.5, 10 - bob, 2.5, 1.8, -0.2, 0, Math.PI*2);
  ctx.fill();

  // ── Туловище / плащ / броня ────────────────────────────
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI*2);
  ctx.fill();

  // Броня/одежда поверх (центральная деталь)
  ctx.fillStyle = armorColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // Плечи
  ctx.fillStyle = cloakColor;
  ctx.beginPath();
  ctx.ellipse(-7, -1, 3.5, 2.5, -0.3, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, -1, 3.5, 2.5, 0.3, 0, Math.PI*2);
  ctx.fill();

  // Руки (position зависит от facing)
  const armSwing = moving ? Math.sin(t * 9 + Math.PI) * 3 : 0;
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(-8, 1 + armSwing, 2.5, 2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8, 1 - armSwing, 2.5, 2, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Шея ────────────────────────────────────────────────
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(0, -5.5, 2.8, 2.2, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Голова ─────────────────────────────────────────────
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(0, -10, 6, 5.5, 0, 0, Math.PI*2);
  ctx.fill();

  // Волосы
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.ellipse(0, -13, 5.5, 3, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-4.5, -11, 2.5, 3, -0.4, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4.5, -11, 2.5, 3, 0.4, 0, Math.PI*2);
  ctx.fill();

  // Лицо (глаза) — по направлению
  if (facing === 'down' || facing === 'up') {
    const eyeY = facing === 'down' ? -9.5 : -10.5;
    ctx.fillStyle = '#1a1008';
    ctx.beginPath(); ctx.arc(-2.2, eyeY, 1.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.2, eyeY, 1.1, 0, Math.PI*2); ctx.fill();
    // Зрачки
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-2.2, eyeY+0.3, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.2, eyeY+0.3, 0.5, 0, Math.PI*2); ctx.fill();
  } else {
    // Вид сбоку — один глаз
    const ex = facing === 'right' ? 2 : -2;
    ctx.fillStyle = '#1a1008';
    ctx.beginPath(); ctx.arc(ex, -9.5, 1.1, 0, Math.PI*2); ctx.fill();
  }

  // ── Выделение (когда рядом) ────────────────────────────
  if (selected) {
    ctx.strokeStyle = 'rgba(255,220,60,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ── Специальные вариации персонажей ────────────────────────
function drawWarrior(ctx, px, py, cfg, facing, moving, t) {
  drawHuman(ctx, px, py, cfg, facing, moving, t);
  // Дополнительно: меч/щит
  ctx.save();
  ctx.translate(px, py);
  // Меч (маленькая полоска)
  ctx.fillStyle = '#C0C0D0';
  ctx.fillRect(10, -6, 2, 10);
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(9, -2, 4, 3);
  ctx.restore();
}

function drawMage(ctx, px, py, cfg, facing, moving, t) {
  drawHuman(ctx, px, py, cfg, facing, moving, t);
  // Посох + свечение
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = '#5A3A10';
  ctx.fillRect(-11, -18, 2, 26);
  // Кристалл на посохе
  const glow = 0.6 + 0.4 * Math.sin(t * 2.5);
  ctx.shadowColor = '#4080ff';
  ctx.shadowBlur = 6 * glow;
  ctx.fillStyle = `rgba(80,140,255,${glow})`;
  ctx.beginPath();
  ctx.arc(-10, -20, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawShaman(ctx, px, py, cfg, facing, moving, t) {
  drawHuman(ctx, px, py, cfg, facing, moving, t);
  ctx.save();
  ctx.translate(px, py);
  // Посох с черепом
  ctx.fillStyle = '#3A2808';
  ctx.fillRect(-11, -16, 2, 24);
  const glow = 0.5 + 0.5 * Math.sin(t * 1.8);
  ctx.shadowColor = '#9020D0';
  ctx.shadowBlur = 8 * glow;
  ctx.fillStyle = `rgba(160,30,200,${0.7*glow})`;
  ctx.beginPath();
  ctx.arc(-10, -19, 3.5, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Одеяние — дополнительный слой
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = cfg.cloakColor;
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 5, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── ГЛАВНАЯ функция рисования NPC ──────────────────────────
function renderNPC(ctx, npc, isNear, t) {
  const moving = false;
  const facing = 'down';
  const cfg = { ...npc, selected: isNear };

  switch (npc.role) {
    case 'mage':     drawMage   (ctx, npc.x, npc.y, cfg, facing, moving, t); break;
    case 'shaman':   drawShaman (ctx, npc.x, npc.y, cfg, facing, moving, t); break;
    case 'warrior':  drawWarrior(ctx, npc.x, npc.y, cfg, facing, moving, t); break;
    default:         drawHuman  (ctx, npc.x, npc.y, cfg, facing, moving, t); break;
  }

  // Имя
  ctx.font = 'bold 10px Georgia';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeText(npc.name, npc.x, npc.y - 25);
  ctx.fillStyle = isNear ? '#FFE050' : '#C8A860';
  ctx.fillText(npc.name, npc.x, npc.y - 25);

  // Иконка [E]
  if (isNear) {
    const bounce = Math.sin(t * 4) * 2;
    ctx.font = 'bold 11px Georgia';
    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.lineWidth = 3;
    ctx.strokeText('[E]', npc.x, npc.y - 36 + bounce);
    ctx.fillStyle = '#FFD700';
    ctx.fillText('[E]', npc.x, npc.y - 36 + bounce);
  }
}

// ── ИГРОК ──────────────────────────────────────────────────
function renderPlayer(ctx, px, py, moving, facing, t) {
  const cfg = {
    bodyColor:  '#7A5030',
    cloakColor: '#5A3818',
    skinColor:  '#D4A870',
    hairColor:  '#2A1408',
    armorColor: '#6A4828',
    scale: 1.1,
  };
  drawHuman(ctx, px, py, cfg, facing, moving, t);

  // Дополнительно: простой плащ (треугольник)
  ctx.save();
  ctx.translate(px, py);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#4A2810';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(6, 2);
  ctx.lineTo(3, 14);
  ctx.lineTo(-3, 14);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Метка
  ctx.font = 'bold 9px Georgia';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeText('[ Ты ]', px, py - 26);
  ctx.fillStyle = '#E8D888';
  ctx.fillText('[ Ты ]', px, py - 26);
}
