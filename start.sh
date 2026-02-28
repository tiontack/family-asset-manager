#!/bin/bash
# 부부 자산 관리 앱 실행 스크립트

echo "🚀 부부 자산 관리 앱 시작..."
echo ""

# 백엔드 서버 시작 (백그라운드)
echo "📦 백엔드 서버 시작 중... (포트 3001)"
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# 잠시 대기
sleep 2

# 프론트엔드 개발 서버 시작
echo ""
echo "🎨 프론트엔드 서버 시작 중... (포트 5173)"
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

echo ""
echo "✅ 실행 완료!"
echo ""
echo "📱 브라우저에서 열기: http://localhost:5173"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"

# 종료 시 프로세스 정리
trap "echo '종료 중...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
