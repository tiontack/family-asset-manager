const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// DB 초기화 (앱 시작 시)
require('./database').getDb();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,  // 동일 도메인 서비스: 모든 origin 허용
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 프론트엔드 정적 파일 serve (프로덕션 빌드)
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// API 라우터
app.use('/api/upload',       require('./routes/upload'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/categories',   require('./routes/categories'));
app.use('/api/rules',        require('./routes/rules'));
app.use('/api/analytics',    require('./routes/analytics'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: err.message || '서버 오류가 발생했습니다' });
});

// SPA fallback - /api가 아닌 모든 경로는 index.html 반환
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: npm run build' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📊 가족 자산 관리 서버 준비 완료`);
  if (fs.existsSync(frontendDist)) {
    console.log(`🌐 프론트엔드 serve 중: ${frontendDist}`);
  }
});
