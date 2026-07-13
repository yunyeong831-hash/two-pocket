// 모바일 단일 뷰포트 라우팅 및 탭 스위칭 엔진 (app.js)
import { store } from './store.js';
import { 
  renderHomeTab, 
  renderAssetsTab, 
  renderTxsTab, 
  renderMyTab, 
  renderLandingScreen, 
  renderInvitationScreen 
} from './dashboard.js';

// 현재 로딩된 액티브 탭 상태 ('home' | 'assets' | 'txs' | 'my')
let currentActiveTab = 'home';

// DOM 요소 캐싱
const viewport = document.getElementById('app-viewport');
const bottomNav = document.getElementById('app-bottom-nav');
const roleBadge = document.getElementById('app-role-badge');

// 🖥️ 기기별 통합 렌더링 오케스트레이터
function renderApp() {
  const data = store.data;
  const myUserId = store.getMyUserId(); // 기기 브라우저에 저장된 내 사용자 ID ('user_a' | 'user_b' | null)

  // 1. 아직 닉네임을 정하지 않았거나 초기 랜딩 단계인 경우
  if (data.status === 'landing' || !myUserId) {
    bottomNav.style.display = 'none';
    roleBadge.textContent = '가입 대기';
    roleBadge.style.background = 'var(--color-border)';
    roleBadge.style.color = 'var(--color-text-light)';
    
    // 임시로 user_a 시점으로 랜딩창을 노출 (닉네임 설정 시 역할 자동 부여됨)
    renderLandingScreen('user_a', viewport);
    return;
  }

  // 2. 초대 대기 중인 상태인 경우 (방 개설 후 대기 혹은 코드 입력 대기)
  if (data.status === 'waiting_invitation') {
    bottomNav.style.display = 'none';
    const userName = data.users[myUserId === 'user_a' ? 'A' : 'B']?.name || '투포켓';
    roleBadge.textContent = `${userName} 👛`;
    roleBadge.style.background = myUserId === 'user_a' ? 'var(--color-pink-bg)' : 'var(--color-green-bg)';
    roleBadge.style.color = myUserId === 'user_a' ? 'var(--color-pink)' : 'var(--color-green)';
    
    renderInvitationScreen(myUserId, viewport);
    return;
  }

  // 3. 2인 연동 완료 (Active) 상태인 경우 ➔ 탭 네비게이션 가동
  bottomNav.style.display = 'grid';
  const myName = data.users[myUserId === 'user_a' ? 'A' : 'B']?.name || '투포켓';
  roleBadge.textContent = `${myName} 👛`;
  roleBadge.style.background = myUserId === 'user_a' ? 'var(--color-pink-bg)' : 'var(--color-green-bg)';
  roleBadge.style.color = myUserId === 'user_a' ? 'var(--color-pink)' : 'var(--color-green)';

  // 현재 활성화된 탭을 그리기
  switch (currentActiveTab) {
    case 'home':
      renderHomeTab(myUserId, viewport);
      break;
    case 'assets':
      renderAssetsTab(myUserId, viewport);
      break;
    case 'txs':
      renderTxsTab(myUserId, viewport);
      break;
    case 'my':
      renderMyTab(myUserId, viewport);
      break;
    default:
      renderHomeTab(myUserId, viewport);
  }
}

// 🧭 하단 탭 버튼 클릭 이벤트 바인딩
function initNavigation() {
  const navButtons = bottomNav.querySelectorAll('.nav-btn');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.getAttribute('data-tab');
      currentActiveTab = targetTab;
      
      // 액티브 스타일 변경
      navButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // 화면 다시 그리기
      renderApp();
    });
  });
}

// 🚀 애플리케이션 초기화 및 스토어 구독 개시
function init() {
  initNavigation();
  
  // 데이터 변경 시 화면 자동 갱신 트리거 등록
  store.subscribe(() => {
    renderApp();
  });

  // 초기 화면 렌더링
  renderApp();
}

document.addEventListener('DOMContentLoaded', init);
