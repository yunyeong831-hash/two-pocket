// 시뮬레이터 쉘 제어 스크립트 (app.js)
import { store } from './store.js';
import { 
  renderHomeTab, 
  renderTxsTab, 
  renderAssetsTab, 
  renderMyTab, 
  renderInvitationScreen,
  renderLandingScreen
} from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  const userAContainer = document.getElementById('user-a-viewport');
  const userBContainer = document.getElementById('user-b-viewport');
  const navA = document.getElementById('nav-user-a');
  const navB = document.getElementById('nav-user-b');

  // URL 파라미터 감지 (?user=user_a 또는 ?user=user_b)
  const urlParams = new URLSearchParams(window.location.search);
  const targetUserParam = urlParams.get('user');

  if (targetUserParam === 'user_a' || targetUserParam === 'user_b') {
    document.body.classList.add('mobile-mode');
    if (targetUserParam === 'user_a') {
      document.getElementById('panel-user-b').style.display = 'none';
    } else {
      document.getElementById('panel-user-a').style.display = 'none';
    }
  }

  // 사용자의 현재 활성화 탭 관리 (기본값: dash)
  let activeTabA = 'dash';
  let activeTabB = 'dash';

  // 뷰포트 내용 그리기 헬퍼
  const drawViewport = (userId, container, activeTab) => {
    // 1. 초기 론칭 메인 랜딩 상태
    if (store.data.status === 'landing') {
      renderLandingScreen(userId, container);
      
      // 네비게이션 바 숨김
      const nav = userId === 'user_a' ? navA : navB;
      nav.style.display = 'none';
      return;
    }

    // 2. 초대 대기 중 상태 (온보딩)
    if (store.data.status === 'waiting_invitation') {
      renderInvitationScreen(userId, container);
      
      // 네비게이션 바 숨김
      const nav = userId === 'user_a' ? navA : navB;
      nav.style.display = 'none';
      return;
    }

    // 3. 공동 연결 활성화 완료 상태 (대시보드 전개)
    const nav = userId === 'user_a' ? navA : navB;
    nav.style.display = 'flex';

    switch (activeTab) {
      case 'dash':
        renderHomeTab(userId, container);
        break;
      case 'txs':
        renderTxsTab(userId, container);
        break;
      case 'assets':
        renderAssetsTab(userId, container);
        break;
      case 'my':
        renderMyTab(userId, container);
        break;
      default:
        renderHomeTab(userId, container);
    }
  };

  // 실시간 UI 갱신 이벤트 수신기
  const updateUI = () => {
    drawViewport('user_a', userAContainer, activeTabA);
    drawViewport('user_b', userBContainer, activeTabB);
  };

  // 초기 로드 실행 및 스토어 구독
  updateUI();
  store.subscribe(updateUI);

  // 하단 네비게이션 바 이벤트 연결
  const setupNavListeners = (navEl, userId, getTab, setTab) => {
    const navItems = navEl.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const clickedItem = e.currentTarget;
        const tab = clickedItem.getAttribute('data-tab');
        
        // 클릭된 탭 활성화 처리
        navItems.forEach(i => i.classList.remove('active'));
        clickedItem.classList.add('active');

        // 상태 업데이트 및 화면 다시 그리기
        if (userId === 'user_a') {
          activeTabA = tab;
        } else {
          activeTabB = tab;
        }
        updateUI();
      });
    });
  };

  setupNavListeners(navA, 'user_a', () => activeTabA, (val) => { activeTabA = val; });
  setupNavListeners(navB, 'user_b', () => activeTabB, (val) => { activeTabB = val; });
});
