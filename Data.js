
// =============================================================
//  КОЛОНИЯ — За Барьером | main.js
//  Phaser 3, top-down RPG prototype
//  Архитектура: одна сцена GameScene
//  Сущности: Player, NPC[], Quest, UI (HUD + DialogueBox)
// =============================================================

// ─── КОНСТАНТЫ КАРТЫ ────────────────────────────────────────
const TILE   = 32;   // размер тайла в пикселях
const MAP_W  = 50;   // ширина карты в тайлах
const MAP_H  = 40;   // высота карты в тайлах

// ─── ЗОНЫ ЛАГЕРЕЙ (в пикселях) ──────────────────────────────
const ZONES = [
  { name: 'Старый лагерь',   x: 160,  y: 160,  w: 480,  h: 320,  color: 0x8b4513 },
  { name: 'Новый лагерь',    x: 960,  y: 160,  w: 400,  h: 320,  color: 0x2e5a2e },
  { name: 'Сектанты',        x: 560,  y: 700,  w: 360,  h: 300,  color: 0x4a2070 },
  { name: 'Нейтральная зона', x: 0,   y: 0,    w: 9999, h: 9999, color: 0x333333 },
];

// ─── ДАННЫЕ NPC ──────────────────────────────────────────────
const NPC_DATA = [
  {
    id: 'captain',
    name: 'Капитан Рагнар',
    x: 320, y: 280,
    color: 0xc0a030,
    camp: 'Старый лагерь',
    dialogues: {
      default: {
        text: 'Значит, ты новенький? Барьер больше не выпустит тебя отсюда. Добро пожаловать в колонию, заключённый.',
        options: [
          { label: 'Есть ли для меня работа?', next: 'quest_offer' },
          { label: 'Пока, Рагнар.', next: null },
        ]
      },
      quest_offer: {
        text: 'Дело есть. Один из наших — Кривой Торс — пропал в нейтральной зоне. Говорят, видели его у Башни стражи. Найди его и передай: пусть возвращается в лагерь.',
        options: [
          { label: 'Хорошо, поищу его.', next: null, action: 'QUEST_ACCEPT' },
          { label: 'Не моя забота.', next: null },
        ]
      },
      quest_active: {
        text: 'Ты ещё не нашёл Кривого Торса? Башня стражи — к востоку, за рекой.',
        options: [
          { label: 'Уже иду.', next: null },
        ]
      },
      quest_done: {
        text: 'Торс вернулся. Хорошая работа. Можешь рассчитывать на защиту Старого лагеря.',
        options: [
          { label: 'Рад помочь.', next: null },
        ]
      },
    }
  },
  {
    id: 'tors',
    name: 'Кривой Торс',
    x: 720, y: 430,
    color: 0x8a7060,
    camp: 'Нейтральная зона',
    dialogues: {
      default: {
        text: 'Чего тебе надо? Я тут изучаю руины у Башни. Никуда не собираюсь.',
        options: [
          { label: 'Рагнар просит тебя вернуться.', next: 'urge_return' },
          { label: 'Ничего, проходил мимо.', next: null },
        ]
      },
      urge_return: {
        text: '...Хорошо, скажи ему — я иду. Только дай ещё немного осмотреться здесь. Этот камень странный.',
        options: [
          { label: 'Передам. Будь осторожен.', next: null, action: 'QUEST_COMPLETE' },
        ]
      },
      quest_done: {
        text: 'Я уже сказал капитану, что вернусь. Оставь меня в покое.',
        options: [
          { label: 'Хорошо.', next: null },
        ]
      },
    }
  },
  {
    id: 'shaman',
    name: 'Старец Гааль',
    x: 680, y: 820,
    color: 0x9a40c0,
    camp: 'Сектанты',
    dialogues: {
      default: {
        text: 'Ты чувствуешь это? Барьер живой. Мы слышим его пение каждую ночь. Присоединяйся к нам — и ты тоже услышишь.',
        options: [
          { label: 'Что за "пение"?', next: 'lore' },
          { label: 'Нет, спасибо.', next: null },
        ]
      },
      lore: {
        text: 'Барьер создали маги. Но что-то зовёт из-под земли — нечто древнее. Мы его называем Дремлющим. Когда он проснётся — барьер рухнет.',
        options: [
          { label: 'Звучит опасно.', next: 'danger' },
          { label: 'Понятно.', next: null },
        ]
      },
      danger: {
        text: 'Всё великое — опасно. Именно поэтому мы готовимся.',
        options: [
          { label: 'Удачи вам.', next: null },
        ]
      },
    }
  },
  {
    id: 'engineer',
    name: 'Инженер Волка',
    x: 1060, y: 260,
    color: 0x4a8a4a,
    camp: 'Новый лагерь',
    dialogues: {
      default: {
        text: 'Новый лагерь строит катапульту. Если собрать достаточно руды и деревянных балок — может, пробьём брешь в барьере изнутри. Нас тут считают безумцами.',
        options: [
          { label: 'Звучит как план.', next: 'plan' },
          { label: 'Удачи с этим.', next: null },
        ]
      },
      plan: {
        text: 'Не просто план — единственный реальный способ выбраться. Старый лагерь торгуется с королём, а сектанты молятся. Только мы что-то делаем.',
        options: [
          { label: 'Интересно. Зайду позже.', next: null },
        ]
      },
    }
  },
];

// =============================================================
//  СЦЕНА ИГРЫ
// =============================================================
class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ─── QUEST STATE ─────────────────────────────────────────
  questState = 'none'; // none | active | done

  // ─── PRELOAD ─────────────────────────────────────────────
  preload() {
    // Все ассеты — процедурные, внешних файлов нет
  }

  // ─── CREATE ──────────────────────────────────────────────
  create() {
    this.questState = 'none';
    this.dialogueOpen = false;
    this.activeNPC = null;

    // ── Нарисовать фон карты ──────────────────────────────
    this._buildMap();

    // ── Создать игрока ────────────────────────────────────
    this._createPlayer();

    // ── Создать NPC ───────────────────────────────────────
    this._createNPCs();

    // ── Камера ───────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    // ── Клавиши ──────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.keyE   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // ── Физика столкновений ───────────────────────────────
    this.physics.add.collider(this.player, this.wallsGroup);
    this.physics.add.collider(this.player, this.buildingsGroup);

    // ── Обновить HUD ─────────────────────────────────────
    this._updateHUD();
  }

  // ─── BUILD MAP ───────────────────────────────────────────
  _buildMap() {
    const gfx = this.add.graphics();

    // Земля
    gfx.fillStyle(0x2a2218, 1);
    gfx.fillRect(0, 0, MAP_W * TILE, MAP_H * TILE);

    // Трава пятнами
    for (let i = 0; i < 400; i++) {
      const tx = Phaser.Math.Between(0, MAP_W - 1) * TILE;
      const ty = Phaser.Math.Between(0, MAP_H - 1) * TILE;
      gfx.fillStyle(0x2e2a1a, 1);
      gfx.fillRect(tx, ty, TILE, TILE);
    }

    // Зоны лагерей (визуальная заливка)
    const zones = [
      { x: 160, y: 160, w: 480, h: 320, color: 0x2a1a0a },
      { x: 960, y: 160, w: 400, h: 320, color: 0x0a1a0a },
      { x: 560, y: 700, w: 360, h: 300, color: 0x150a20 },
    ];
    for (const z of zones) {
      gfx.fillStyle(z.color, 0.7);
      gfx.fillRect(z.x, z.y, z.w, z.h);
    }

    // Дороги (горизонтальные и вертикальные полосы)
    gfx.fillStyle(0x3a3020, 1);
    gfx.fillRect(0, 380, MAP_W * TILE, 24);   // горизонтальная дорога
    gfx.fillRect(620, 0, 24, MAP_H * TILE);   // вертикальная

    // Река (декор)
    gfx.fillStyle(0x1a3050, 1);
    gfx.fillRect(640, 440, 12, 380);
    gfx.fillStyle(0x203860, 0.5);
    gfx.fillRect(638, 440, 16, 380);

    // ── Стены карты (границы) ─────────────────────────────
    this.wallsGroup = this.physics.add.staticGroup();

    // 4 невидимые стены по краям карты
    const wallThickness = 16;
    const walls = [
      { x: MAP_W * TILE / 2, y: wallThickness / 2, w: MAP_W * TILE, h: wallThickness },
      { x: MAP_W * TILE / 2, y: MAP_H * TILE - wallThickness / 2, w: MAP_W * TILE, h: wallThickness },
      { x: wallThickness / 2, y: MAP_H * TILE / 2, w: wallThickness, h: MAP_H * TILE },
      { x: MAP_W * TILE - wallThickness / 2, y: MAP_H * TILE / 2, w: wallThickness, h: MAP_H * TILE },
    ];
    for (const w of walls) {
      const wall = this.add.rectangle(w.x, w.y, w.w, w.h, 0x0a0806);
      this.physics.add.existing(wall, true);
      this.wallsGroup.add(wall);
    }

    // ── Постройки ─────────────────────────────────────────
    this.buildingsGroup = this.physics.add.staticGroup();

    const buildings = [
      // Старый лагерь
      { x: 200, y: 180, w: 80, h: 60,  color: 0x6b3a10, label: 'Казармы' },
      { x: 310, y: 190, w: 60, h: 50,  color: 0x5a3010, label: 'Склад' },
      { x: 420, y: 170, w: 100, h: 70, color: 0x7a4010, label: 'Главный зал' },
      { x: 220, y: 300, w: 70, h: 55,  color: 0x5a3010, label: 'Кузница' },
      { x: 510, y: 320, w: 60, h: 50,  color: 0x5a3010, label: '' },

      // Новый лагерь
      { x: 990, y: 180, w: 80, h: 60,  color: 0x1a5020, label: 'Мастерская' },
      { x: 1110, y: 200, w: 70, h: 55, color: 0x1a4018, label: 'Лаборатория' },
      { x: 1000, y: 300, w: 90, h: 55, color: 0x183818, label: 'Общий дом' },
      { x: 1200, y: 190, w: 60, h: 50, color: 0x1a4518, label: '' },

      // Сектанты
      { x: 600, y: 720, w: 70, h: 60,  color: 0x3a1560, label: 'Святилище' },
      { x: 720, y: 730, w: 80, h: 55,  color: 0x2a1050, label: 'Алтарь' },
      { x: 660, y: 840, w: 60, h: 50,  color: 0x2a1050, label: '' },

      // Башня стражи (нейтральная зона)
      { x: 700, y: 410, w: 40, h: 40,  color: 0x504030, label: 'Башня стражи' },
    ];

    for (const b of buildings) {
      // Заливка
      const body = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, b.color);
      // Обводка
      const gfxB = this.add.graphics();
      gfxB.lineStyle(1, 0x8b6030, 0.8);
      gfxB.strokeRect(b.x, b.y, b.w, b.h);
      // Тень крыши
      gfxB.fillStyle(0x000000, 0.3);
      gfxB.fillRect(b.x + 2, b.y + 2, b.w - 4, 6);

      // Физическое тело
      this.physics.add.existing(body, true);
      this.buildingsGroup.add(body);

      // Подпись
      if (b.label) {
        this.add.text(b.x + b.w / 2, b.y - 6, b.label, {
          fontFamily: '"IM Fell English", serif',
          fontSize: '10px',
          color: '#a08050',
          align: 'center',
        }).setOrigin(0.5, 1);
      }
    }

    // ── Барьер (граница карты — свечение) ─────────────────
    const barrierGfx = this.add.graphics();
    barrierGfx.lineStyle(4, 0x4080ff, 0.35);
    barrierGfx.strokeRect(20, 20, MAP_W * TILE - 40, MAP_H * TILE - 40);
    barrierGfx.lineStyle(1, 0x80c0ff, 0.15);
    barrierGfx.strokeRect(24, 24, MAP_W * TILE - 48, MAP_H * TILE - 48);

    // Метки зон
    const zoneLabels = [
      { x: 400, y: 152,  text: '[ СТАРЫЙ ЛАГЕРЬ ]',   color: '#a07030' },
      { x: 1160, y: 152, text: '[ НОВЫЙ ЛАГЕРЬ ]',    color: '#50a050' },
      { x: 740, y: 693,  text: '[ СЕКТАНТЫ ]',        color: '#9040c0' },
    ];
    for (const lbl of zoneLabels) {
      this.add.text(lbl.x, lbl.y, lbl.text, {
        fontFamily: 'Cinzel, serif',
        fontSize: '11px',
        color: lbl.color,
        alpha: 0.7,
      }).setOrigin(0.5, 1);
    }
  }

  // ─── CREATE PLAYER ────────────────────────────────────────
  _createPlayer() {
    // Игрок — простой sprite из геометрии
    const pg = this.make.graphics({ x: 0, y: 0, add: false });
    pg.fillStyle(0xd0b060, 1);
    pg.fillCircle(10, 10, 10);
    pg.fillStyle(0x000000, 0.5);
    pg.fillCircle(10, 10, 10); // тень
    pg.fillStyle(0xe0c878, 1);
    pg.fillCircle(10, 10, 9);
    // Голова
    pg.fillStyle(0xd4a870, 1);
    pg.fillCircle(10, 6, 5);
    // Туловище
    pg.fillStyle(0x7a5a30, 1);
    pg.fillRect(6, 11, 8, 8);
    pg.generateTexture('player', 20, 20);
    pg.destroy();

    this.player = this.physics.add.sprite(400, 380, 'player');
    this.player.setCollideWorldBounds(false); // мировые границы через wallsGroup
    this.player.setDepth(5);

    // Имя над игроком
    this.playerLabel = this.add.text(0, 0, 'Ты', {
      fontFamily: 'Cinzel, serif',
      fontSize: '9px',
      color: '#e8d080',
    }).setOrigin(0.5, 1).setDepth(6);
  }

  // ─── CREATE NPCS ──────────────────────────────────────────
  _createNPCs() {
    this.npcs = [];

    for (const data of NPC_DATA) {
      // Генерим текстуру для каждого NPC
      const g = this.make.graphics({ add: false });
      // Тень
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(10, 17, 14, 6);
      // Тело
      g.fillStyle(data.color, 1);
      g.fillCircle(10, 10, 9);
      // Голова
      g.fillStyle(0xcc9966, 1);
      g.fillCircle(10, 5, 5);
      // Туловище
      g.fillStyle(data.color, 1);
      g.fillRect(6, 10, 8, 9);
      // Контур
      g.lineStyle(1, 0xffffff, 0.2);
      g.strokeCircle(10, 10, 9);
      g.generateTexture(`npc_${data.id}`, 20, 20);
      g.destroy();

      const sprite = this.physics.add.sprite(data.x, data.y, `npc_${data.id}`);
      sprite.setImmovable(true);
      sprite.setDepth(4);
      sprite.body.allowGravity = false;

      // Имя
      const label = this.add.text(data.x, data.y - 14, data.name, {
        fontFamily: '"IM Fell English", serif',
        fontSize: '10px',
        color: '#c8a860',
        stroke: '#000',
        strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(6);

      // Иконка взаимодействия [E]
      const hint = this.add.text(data.x, data.y - 26, '[E]', {
        fontFamily: 'Cinzel, serif',
        fontSize: '9px',
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(7).setVisible(false);

      this.npcs.push({ data, sprite, label, hint });
      this.physics.add.collider(this.player, sprite);
    }
  }

  // ─── UPDATE ──────────────────────────────────────────────
  update() {
    // Обновить метку игрока
    this.playerLabel.setPosition(this.player.x, this.player.y - 14);

    // Закрыть диалог по Esc
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc) && this.dialogueOpen) {
      this._closeDialogue();
      return;
    }

    if (this.dialogueOpen) {
      this.player.setVelocity(0, 0);
      return;
    }

    // ── Движение ─────────────────────────────────────────
    const speed = 160;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

    let vx = 0, vy = 0;
    if (left)  vx = -speed;
    if (right) vx =  speed;
    if (up)    vy = -speed;
    if (down)  vy =  speed;

    // Нормализовать диагональ
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    this.player.setVelocity(vx, vy);

    // ── Зона лагеря ──────────────────────────────────────
    const zone = this._getZone(this.player.x, this.player.y);
    if (zone !== this._lastZone) {
      this._lastZone = zone;
      this._updateHUD();
    }

    // ── Иконки NPC и взаимодействие ─────────────────────
    let nearNPC = null;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, npc.sprite.x, npc.sprite.y
      );
      const isNear = dist < 60;
      npc.hint.setVisible(isNear);
      if (isNear) nearNPC = npc;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyE) && nearNPC) {
      this._openDialogue(nearNPC);
    }
  }

  // ─── ZONE DETECTION ──────────────────────────────────────
  _getZone(px, py) {
    const checkZones = [
      { name: 'Старый лагерь',   x: 160, y: 160, w: 480, h: 320 },
      { name: 'Новый лагерь',    x: 960, y: 160, w: 400, h: 320 },
      { name: 'Сектанты',        x: 560, y: 700, w: 360, h: 300 },
    ];
    for (const z of checkZones) {
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
        return z.name;
      }
    }
    return 'Нейтральная зона';
  }

  // ─── DIALOGUE SYSTEM ─────────────────────────────────────
  _openDialogue(npc) {
    this.dialogueOpen = true;
    this.activeNPC = npc;

    // Выбрать правильную ветку диалога
    let branchKey = 'default';
    if (npc.data.id === 'captain') {
      if (this.questState === 'active') branchKey = 'quest_active';
      if (this.questState === 'done')   branchKey = 'quest_done';
    }
    if (npc.data.id === 'tors') {
      if (this.questState === 'done') branchKey = 'quest_done';
    }

    const branch = npc.data.dialogues[branchKey] || npc.data.dialogues['default'];
    this._renderDialogue(npc.data.name, branch);

    document.getElementById('dialogue-overlay').style.display = 'block';
  }

  _renderDialogue(name, branch) {
    document.getElementById('dialogue-npc-name').textContent = name;
    document.getElementById('dialogue-text').textContent = branch.text;

    const optionsEl = document.getElementById('dialogue-options');
    optionsEl.innerHTML = '';

    for (const opt of branch.options) {
      const btn = document.createElement('button');
      btn.className = 'dialogue-btn';
      btn.textContent = opt.label;
      btn.onclick = () => this._handleOption(opt);
      optionsEl.appendChild(btn);
    }
  }

  _handleOption(opt) {
    // Квестовые экшны
    if (opt.action === 'QUEST_ACCEPT') {
      this.questState = 'active';
      this._updateHUD();
      this._notify('Задание принято: найти Кривого Торса');
    }
    if (opt.action === 'QUEST_COMPLETE') {
      this.questState = 'done';
      this._updateHUD();
      this._notify('Квест выполнен! Вернись к Рагнару');
    }

    // Переход к следующей ветке диалога
    if (opt.next && this.activeNPC) {
      const branch = this.activeNPC.data.dialogues[opt.next];
      if (branch) {
        this._renderDialogue(this.activeNPC.data.name, branch);
        return;
      }
    }

    // Закрыть диалог
    this._closeDialogue();
  }

  _closeDialogue() {
    this.dialogueOpen = false;
    this.activeNPC = null;
    document.getElementById('dialogue-overlay').style.display = 'none';
  }

  // ─── HUD UPDATE ──────────────────────────────────────────
  _updateHUD() {
    const zone = this._getZone(this.player?.x ?? 400, this.player?.y ?? 380);
    document.getElementById('hud-location-name').textContent = zone;

    const questEl   = document.getElementById('hud-quest-text');
    const questTexts = {
      none:   'Нет активных заданий',
      active: 'Найди Кривого Торса у Башни стражи',
      done:   '✓ Квест завершён',
    };
    questEl.textContent = questTexts[this.questState] || '';
    questEl.className   = this.questState === 'done' ? 'quest-done' : 'quest-text';
  }

  // ─── NOTIFICATION ────────────────────────────────────────
  _notify(msg) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

// =============================================================
//  ЗАПУСК PHASER
// =============================================================
const config = {
  type:   Phaser.AUTO,
  width:  800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#0a0806',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [GameScene],
};

window.gameInstance = new Phaser.Game(config);

// =============================================================
//  TELEGRAM MINI APP — ИНТЕГРАЦИЯ (ИНСТРУКЦИЯ)
// =============================================================
/*
  ШАГ 1. Подключить SDK в index.html (перед main.js):
    <script src="https://telegram.org/js/telegram-web-app.js"></script>

  ШАГ 2. Инициализировать и получить userId:
    const tg = window.Telegram.WebApp;
    tg.ready();           // сообщает Telegram, что приложение готово
    tg.expand();          // разворачивает на весь экран
    const user = tg.initDataUnsafe?.user;
    window.TelegramUserId = user?.id ?? null;

  ШАГ 3. Передать userId в игровую логику:
    // В GameScene.create() добавить:
    if (window.TelegramUserId) {
      this.userId = window.TelegramUserId;
      // Загрузить прогресс с сервера по userId
    }

  ШАГ 4. Сохранять прогресс:
    // Вызывать при изменении questState:
    async function saveProgress(userId, questState) {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questState })
      });
    }

  ШАГ 5. Кнопка MainButton:
    tg.MainButton.setText('Вернуться в лагерь');
    tg.MainButton.show();
    tg.MainButton.onClick(() => { ... });

  НА СТОРОНЕ БОТА (что нужно сделать):
  - Создать бота через @BotFather.
  - Добавить команду /play, которая отправляет InlineKeyboardButton
    с url типа: https://your-domain.com/index.html?userId={user.id}
  - Либо зарегистрировать Web App в @BotFather и использовать
    initData для верификации userId на сервере.

  ПАРАМЕТР URL (альтернатива initData):
    const urlParams = new URLSearchParams(window.location.search);
    window.TelegramUserId = urlParams.get('userId') ?? null;
*/
