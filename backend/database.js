const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'assets.db');

let db;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6B7280',
      icon TEXT DEFAULT '📦',
      budget INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      priority INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      type TEXT NOT NULL,
      merchant TEXT DEFAULT '',
      amount INTEGER NOT NULL DEFAULT 0,
      balance INTEGER DEFAULT 0,
      memo TEXT DEFAULT '',
      category_id INTEGER,
      month TEXT NOT NULL,
      source_file TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      total_income INTEGER DEFAULT 0,
      total_expense INTEGER DEFAULT 0,
      net_savings INTEGER DEFAULT 0,
      total_assets INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(month);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category_id);
  `);

  seedDefaultData();
}

function seedDefaultData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  if (count > 0) return;

  const defaultCategories = [
    { name: '급여/수입',  color: '#10B981', icon: '💰', budget: 0,       sort: 1 },
    { name: '저축/투자',  color: '#6366F1', icon: '📈', budget: 0,       sort: 2 },
    { name: '관리비',     color: '#F59E0B', icon: '🏠', budget: 300000,  sort: 3 },
    { name: '생활비',     color: '#EF4444', icon: '🛒', budget: 500000,  sort: 4 },
    { name: '식비',       color: '#F97316', icon: '🍽️', budget: 400000,  sort: 5 },
    { name: '교통비',     color: '#3B82F6', icon: '🚇', budget: 150000,  sort: 6 },
    { name: '의료비',     color: '#EC4899', icon: '🏥', budget: 100000,  sort: 7 },
    { name: '교육비',     color: '#8B5CF6', icon: '📚', budget: 200000,  sort: 8 },
    { name: '여가/외식',  color: '#14B8A6', icon: '🎉', budget: 300000,  sort: 9 },
    { name: '기타',       color: '#6B7280', icon: '📦', budget: 0,       sort: 10 },
  ];

  const insertCat = db.prepare(
    'INSERT INTO categories (name, color, icon, budget, sort_order) VALUES (?,?,?,?,?)'
  );
  const insertManyCats = db.transaction((cats) => {
    cats.forEach(c => insertCat.run(c.name, c.color, c.icon, c.budget, c.sort));
  });
  insertManyCats(defaultCategories);

  // 카테고리 ID를 이름으로 조회 후 규칙 삽입
  const getCatId = (name) => db.prepare('SELECT id FROM categories WHERE name = ?').get(name)?.id;

  const defaultRules = [
    // 급여/수입
    ['급여', getCatId('급여/수입')], ['월급', getCatId('급여/수입')],
    ['보너스', getCatId('급여/수입')], ['인센티브', getCatId('급여/수입')],
    ['용돈', getCatId('급여/수입')], ['이체입금', getCatId('급여/수입')],
    // 저축/투자
    ['저축', getCatId('저축/투자')], ['투자', getCatId('저축/투자')],
    ['펀드', getCatId('저축/투자')], ['증권', getCatId('저축/투자')],
    ['적금', getCatId('저축/투자')], ['주식', getCatId('저축/투자')],
    ['ETF', getCatId('저축/투자')], ['코인', getCatId('저축/투자')],
    // 관리비
    ['관리비', getCatId('관리비')], ['전기요금', getCatId('관리비')],
    ['가스요금', getCatId('관리비')], ['수도요금', getCatId('관리비')],
    ['통신비', getCatId('관리비')], ['인터넷', getCatId('관리비')],
    ['SKT', getCatId('관리비')], ['KT', getCatId('관리비')],
    ['LGU+', getCatId('관리비')], ['한국전력', getCatId('관리비')],
    ['도시가스', getCatId('관리비')],
    // 생활비
    ['이마트', getCatId('생활비')], ['홈플러스', getCatId('생활비')],
    ['롯데마트', getCatId('생활비')], ['코스트코', getCatId('생활비')],
    ['쿠팡', getCatId('생활비')], ['다이소', getCatId('생활비')],
    ['올리브영', getCatId('생활비')], ['마트', getCatId('생활비')],
    ['슈퍼마켓', getCatId('생활비')], ['약국', getCatId('의료비')],
    // 식비
    ['배달의민족', getCatId('식비')], ['요기요', getCatId('식비')],
    ['쿠팡이츠', getCatId('식비')], ['스타벅스', getCatId('식비')],
    ['맥도날드', getCatId('식비')], ['롯데리아', getCatId('식비')],
    ['버거킹', getCatId('식비')], ['KFC', getCatId('식비')],
    ['편의점', getCatId('식비')], ['CU', getCatId('식비')],
    ['GS25', getCatId('식비')], ['세븐일레븐', getCatId('식비')],
    ['이디야', getCatId('식비')], ['투썸', getCatId('식비')],
    ['파리바게트', getCatId('식비')], ['뚜레쥬르', getCatId('식비')],
    // 교통비
    ['교통카드', getCatId('교통비')], ['지하철', getCatId('교통비')],
    ['버스', getCatId('교통비')], ['택시', getCatId('교통비')],
    ['카카오택시', getCatId('교통비')], ['우버', getCatId('교통비')],
    ['주유소', getCatId('교통비')], ['고속도로', getCatId('교통비')],
    ['톨게이트', getCatId('교통비')], ['KTX', getCatId('교통비')],
    ['기차', getCatId('교통비')], ['항공', getCatId('교통비')],
    // 의료비
    ['병원', getCatId('의료비')], ['의원', getCatId('의료비')],
    ['치과', getCatId('의료비')], ['한의원', getCatId('의료비')],
    ['약국', getCatId('의료비')], ['건강검진', getCatId('의료비')],
    // 교육비
    ['학원', getCatId('교육비')], ['교육', getCatId('교육비')],
    ['인강', getCatId('교육비')], ['유치원', getCatId('교육비')],
    ['어린이집', getCatId('교육비')], ['도서', getCatId('교육비')],
    // 여가/외식
    ['영화', getCatId('여가/외식')], ['CGV', getCatId('여가/외식')],
    ['롯데시네마', getCatId('여가/외식')], ['넷플릭스', getCatId('여가/외식')],
    ['유튜브', getCatId('여가/외식')], ['게임', getCatId('여가/외식')],
    ['여행', getCatId('여가/외식')], ['호텔', getCatId('여가/외식')],
    ['레스토랑', getCatId('여가/외식')], ['카페', getCatId('여가/외식')],
    ['식당', getCatId('여가/외식')],
  ].filter(([kw, id]) => id != null);

  const insertRule = db.prepare(
    'INSERT INTO rules (keyword, category_id, priority) VALUES (?,?,?)'
  );
  const insertRules = db.transaction((rules) => {
    rules.forEach(([kw, catId]) => insertRule.run(kw, catId, 0));
  });
  insertRules(defaultRules);

  console.log('✅ 기본 카테고리 및 분류 규칙 초기화 완료');
}

module.exports = { getDb };
