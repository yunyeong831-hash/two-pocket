// 대시보드 및 상세 컴포넌트 렌더러 (dashboard.js)
import { store } from './store.js';

// 각 사용자별 자산 및 거래 탭 서브 뷰 상태 관리
const assetSubViewState = {
  user_a: { mode: 'list', editId: null, detailId: null },
  user_b: { mode: 'list', editId: null, detailId: null }
};

const txSubViewState = {
  user_a: { mode: 'list' }, // 'list' | 'categories'
  user_b: { mode: 'list' }
};

const ASSET_TYPE_META = {
  cash: { name: "현금 주머니", emoji: "💵" },
  saving: { name: "예적금 포켓", emoji: "🏦" },
  invest: { name: "투자 포켓", emoji: "📈" },
  loan: { name: "대출 포켓", emoji: "📉" }
};

// 숫자 포맷팅 (원화 ₩ 표시)
export function formatMoney(val) {
  return '₩ ' + new Intl.NumberFormat('ko-KR').format(val);
}

// 토스트 메시지 띄우기 (Toss Style)
export function showToast(container, message) {
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// 🌐 랜딩 및 초대대기 화면에서 사용할 Firebase 설정 공용 모달 팝업
export function showFirebaseConfigModal(container) {
  const modal = document.createElement('div');
  modal.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.45); display: flex; align-items: center;
    justify-content: center; z-index: 9999; padding: 20px;
    backdrop-filter: blur(4px);
  `;

  const isFirebaseSyncActive = store.syncManager.isActive();
  const syncStatusHtml = isFirebaseSyncActive
    ? `<span class="sticker mint" style="margin-bottom:0; font-size:0.75rem;">실시간 연동 완료 📡</span>`
    : `<span class="sticker yellow" style="margin-bottom:0; font-size:0.75rem;">오프라인 (로컬 모드) 🔒</span>`;

  modal.innerHTML = `
    <div class="cute-card" style="width: 100%; max-width: 340px; background: white; margin-bottom: 0; animation: bounce-cute 0.3s forwards;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-weight:700; font-size:0.95rem;">Firebase 동기화 설정</span>
        ${syncStatusHtml}
      </div>
      
      <p style="font-size:0.75rem; color:var(--color-text-light); line-height:1.5; margin-bottom:14px; text-align:left;">
        무선 연동을 활성화하려면 Firebase 웹 자격증명 JSON을 붙여넣으세요.
      </p>

      <textarea class="cute-textarea" id="modal-firebase-config" placeholder='{
  "apiKey": "AIzaSy...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}' style="font-family: monospace; font-size: 0.72rem; height: 110px; margin-bottom:12px; line-height:1.3; text-align:left;">${store.data.firebaseConfig ? JSON.stringify(store.data.firebaseConfig, null, 2) : ''}</textarea>

      <div style="display:flex; gap:6px; margin-bottom:12px;">
        <button class="cute-btn primary cute-btn-sm" id="btn-modal-save-firebase" style="flex:2; font-size:0.78rem;">동기화 활성화</button>
        <button class="cute-btn neutral cute-btn-sm" id="btn-modal-clear-firebase" style="flex:1; color:var(--color-red); font-size:0.78rem;">해제</button>
      </div>

      <button class="cute-btn secondary cute-btn-sm" id="btn-modal-fill-demo" style="width:100%; font-size:0.75rem; background-color: var(--color-blue-bg); margin-bottom:12px;">
        💡 테스트용 공용 데모 계정으로 자동 입력
      </button>

      <button class="cute-btn neutral cute-btn-sm" id="btn-modal-close" style="width: 100%;">닫기</button>
    </div>
  `;

  document.body.appendChild(modal);

  const txtConfig = modal.querySelector('#modal-firebase-config');

  modal.querySelector('#btn-modal-save-firebase').addEventListener('click', () => {
    const rawVal = txtConfig.value.trim();
    if (!rawVal) {
      alert("Firebase Config JSON 코드를 입력해 주세요.");
      return;
    }
    try {
      const parsedConfig = JSON.parse(rawVal);
      const res = store.setupFirebase(parsedConfig);
      if (res.success) {
        alert(res.message);
        modal.remove();
        window.location.reload();
      } else {
        alert(res.message);
      }
    } catch (e) {
      alert("올바른 JSON 형식이 아닙니다. 입력값을 확인해 주세요.");
    }
  });

  modal.querySelector('#btn-modal-clear-firebase').addEventListener('click', () => {
    if (confirm("클라우드 실시간 동기화를 끄고 로컬 모드로 복귀하시겠습니까?")) {
      store.setupFirebase(null);
      modal.remove();
      window.location.reload();
    }
  });

  modal.querySelector('#btn-modal-fill-demo').addEventListener('click', () => {
    const demoConfig = {
      apiKey: "AIzaSyAs1-U90kDemoTwoPocketCloudKeyMockUp",
      authDomain: "two-pocket-demo.firebaseapp.com",
      projectId: "two-pocket-demo",
      storageBucket: "two-pocket-demo.appspot.com",
      messagingSenderId: "987654321012",
      appId: "1:987654321012:web:demo123456789abcde"
    };
    txtConfig.value = JSON.stringify(demoConfig, null, 2);
    showToast(container, "데모 설정이 임시 작성되었습니다.");
  });

  modal.querySelector('#btn-modal-close').addEventListener('click', () => {
    modal.remove();
  });
}

// 🚀 시작 전 메인 랜딩 페이지 렌더러 (투포켓 전용 브랜딩 - 3단계 UX & PIN 번호 개편)
let landingStepState = 'main'; // 'main' | 'create' | 'join'

export function renderLandingScreen(userId, container) {
  const isSyncActive = store.syncManager.isActive();
  const syncLinkText = isSyncActive 
    ? "🟢 실시간 동기화(Firebase) 설정 변경" 
    : "📡 실시간 무선 동기화(Firebase) 먼저 설정하기";

  // 로컬 호스트(개발환경)일 때만 디버깅용 설정 링크 노출
  const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const localSettingHtml = isLocalEnv 
    ? `<div style="margin-top: 8px; margin-bottom: 16px;">
        <button class="cute-btn neutral cute-btn-sm" id="btn-landing-go-firebase" style="font-size: 0.78rem; text-decoration: underline; background: transparent; border: none; color: var(--color-blue); font-weight: 700; cursor: pointer;">
          ${syncLinkText}
        </button>
       </div>`
    : '';

  // 1️⃣ [Step 1: 메인] 개설하기 / 참가하기 큰 버튼 2개만 노출
  if (landingStepState === 'main') {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <div style="font-size: 4rem; margin-bottom: 16px; filter: drop-shadow(0px 8px 16px rgba(49, 130, 246, 0.15)); animation: pulse-cute 2s infinite alternate;">
          👛
        </div>
        
        <h2 class="paperlogy-title" style="font-size: 2.1rem; color: var(--color-text); margin-bottom: 6px;">
          투포켓
        </h2>
        <p class="paperlogy-sub" style="font-size: 0.92rem; color: var(--color-text-light); line-height: 1.6; margin-bottom: 24px;">
          주머니는 각자 따로, 관리는 같이!<br>
          복잡한 통장합치기 없이, 우리 둘의 미래 자산을 키워나가요.
        </p>

        <div class="cute-card" style="width: 100%; border: 1px solid var(--color-border); padding: 24px; background: #FFFFFF; text-align: center; margin-bottom: 12px; display:flex; flex-direction:column; gap:10px;">
          <button class="cute-btn primary" id="btn-go-create" style="width: 100%; padding: 14px 20px; font-size:1rem;">새 투포켓 지갑 개설하기</button>
          <button class="cute-btn secondary" id="btn-go-join" style="width: 100%; padding: 14px 20px; font-size:1rem; background-color: var(--color-green-bg); color: var(--color-green); border:none;">초대코드로 포켓 연결하기</button>
        </div>

        ${localSettingHtml}

        <div style="font-size: 0.72rem; color: var(--color-text-muted);">
          🔒 데이터는 기기 브라우저에 투명하게 보관됩니다.
        </div>
      </div>
    `;

    container.querySelector('#btn-go-create').addEventListener('click', () => {
      landingStepState = 'create';
      renderLandingScreen(userId, container);
    });

    container.querySelector('#btn-go-join').addEventListener('click', () => {
      landingStepState = 'join';
      renderLandingScreen(userId, container);
    });
  }
  
  // 2️⃣ [Step 2: 개설] 방장 닉네임 및 PIN번호 4자리 설정
  else if (landingStepState === 'create') {
    container.innerHTML = `
      <div style="padding: 24px 20px; display: flex; flex-direction: column; height: 100%; justify-content: center;">
        <div style="font-size: 2.5rem; text-align:center; margin-bottom:12px;">👑</div>
        <h3 class="cute-card-title" style="font-size:1.4rem; text-align:center; margin-bottom:8px;">투포켓 지갑 개설</h3>
        <p style="font-size:0.82rem; color:var(--color-text-light); text-align:center; line-height:1.5; margin-bottom:24px;">
          가계부방을 개설하고 파트너를 초대합니다.<br>비상금 프라이버시 보호용 핀번호를 설정하세요.
        </p>

        <div class="cute-card" style="border: 1px solid var(--color-border); padding: 20px; background: #FFFFFF; margin-bottom:16px;">
          <label class="cute-label" style="font-size: 0.8rem; margin-bottom: 6px;">사용할 닉네임</label>
          <input type="text" class="cute-input" id="create-user-name" placeholder="닉네임 입력" style="margin-bottom: 14px;">

          <label class="cute-label" style="font-size: 0.8rem; margin-bottom: 6px;">개인 비밀번호 (숫자 4자리)</label>
          <input type="password" class="cute-input" id="create-user-pin" placeholder="숫자 4자리 입력" maxlength="4" pattern="[0-8]*" inputmode="numeric" style="text-align: center; font-size:1.2rem; letter-spacing:8px;">
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="cute-btn primary" id="btn-submit-create" style="width: 100%;">포켓 개설하고 코드 생성</button>
          <button class="cute-btn neutral" id="btn-back-to-main" style="width: 100%;">이전으로 돌아가기</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-submit-create').addEventListener('click', () => {
      const name = container.querySelector('#create-user-name').value.trim() || "동글이";
      const pin = container.querySelector('#create-user-pin').value.trim();

      if (pin.length !== 4 || isNaN(Number(pin))) {
        alert("비밀번호는 숫자 4자리로 정확히 입력해 주세요.");
        return;
      }

      store.createWallet(name, pin);
    });

    container.querySelector('#btn-back-to-main').addEventListener('click', () => {
      landingStepState = 'main';
      renderLandingScreen(userId, container);
    });
  }
  
  // 3️⃣ [Step 3: 참여] 닉네임 + 초대코드 + PIN번호 원페이지 통합
  else if (landingStepState === 'join') {
    container.innerHTML = `
      <div style="padding: 20px; display: flex; flex-direction: column; height: 100%; justify-content: center; overflow-y: auto;">
        <div style="font-size: 2.5rem; text-align:center; margin-bottom:12px;">🔑</div>
        <h3 class="cute-card-title" style="font-size:1.4rem; text-align:center; margin-bottom:8px;">포켓 참여 및 복원</h3>
        <p style="font-size:0.82rem; color:var(--color-text-light); text-align:center; line-height:1.5; margin-bottom:20px;">
          파트너가 공유해 준 초대코드를 입력하고 조인합니다.<br>사용할 닉네임과 내 전용 비밀번호를 정하세요.
        </p>

        <div class="cute-card" style="border: 1px solid var(--color-border); padding: 16px 20px; background: #FFFFFF; margin-bottom:14px;">
          <label class="cute-label" style="font-size: 0.8rem; margin-bottom: 6px;">사용할 닉네임</label>
          <input type="text" class="cute-input" id="join-user-name" placeholder="닉네임 입력" style="margin-bottom: 12px;">

          <label class="cute-label" style="font-size: 0.8rem; margin-bottom: 6px;">초대 코드</label>
          <input type="text" class="cute-input" id="join-invite-code" placeholder="SWEET-XXXXXX" style="text-align: center; text-transform: uppercase; font-weight:700; margin-bottom: 12px;">

          <label class="cute-label" style="font-size: 0.8rem; margin-bottom: 6px;">개인 비밀번호 (숫자 4자리)</label>
          <input type="password" class="cute-input" id="join-user-pin" placeholder="숫자 4자리 입력" maxlength="4" pattern="[0-8]*" inputmode="numeric" style="text-align: center; font-size:1.2rem; letter-spacing:8px;">
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="cute-btn primary" id="btn-submit-join" style="width: 100%;">포켓 연결 및 복원</button>
          <button class="cute-btn neutral" id="btn-back-to-main-join" style="width: 100%;">이전으로 돌아가기</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-submit-join').addEventListener('click', () => {
      const name = container.querySelector('#join-user-name').value.trim() || "몽글이";
      const code = container.querySelector('#join-invite-code').value.trim().toUpperCase();
      const pin = container.querySelector('#join-user-pin').value.trim();

      if (!code) {
        alert("초대 코드를 입력해 주세요.");
        return;
      }
      if (pin.length !== 4 || isNaN(Number(pin))) {
        alert("비밀번호는 숫자 4자리로 정확히 입력해 주세요.");
        return;
      }

      // acceptInvitation 시에 신규 닉네임과 핀정보(partnerName, partnerPin)를 함께 동적 주입
      store.acceptInvitation(code, null, null, name, pin).then(res => {
        if (res.status === 'success') {
          showToast(container, "성공적으로 지갑방에 연결되었습니다.");
        } else if (res.status === 'require_role_choice') {
          // 이미 기존에 생성 및 매칭 완료된 방일 때 역할 선택 복원 팝업으로 연계
          showRoleChoiceModal(code, container, res.dbData);
        } else {
          showToast(container, "초대 코드가 유효하지 않습니다.");
        }
      });
    });

    container.querySelector('#btn-back-to-main-join').addEventListener('click', () => {
      landingStepState = 'main';
      renderLandingScreen(userId, container);
    });
  }

  // 디버깅용 파이어베이스 설정 리스너 연결
  if (isLocalEnv && container.querySelector('#btn-landing-go-firebase')) {
    container.querySelector('#btn-landing-go-firebase').addEventListener('click', () => {
      showFirebaseConfigModal(container);
    });
  }
}

// 1. 초대 대기 중 화면 렌더링
export function renderInvitationScreen(userId, container) {
  const data = store.data;
  const isA = userId === 'user_a';
  
  if (isA) {
    container.innerHTML = `
      <div class="cute-card" style="border-color: var(--color-blue); margin-top: 10px;">
        <div class="sticker blue">투포켓 연결대기</div>
        <h3 class="cute-card-title">상대방의 포켓 연동을 기다려요</h3>
        <p style="margin-bottom: 20px; font-size: 0.9rem; color: var(--color-text-light); line-height: 1.5;">
          아래의 포켓 초대 코드를 복사해서 파트너에게 전송해 주세요. 상대방이 코드를 입력하면 투포켓이 가동됩니다.
        </p>
        
        <div style="background: #F2F4F6; padding: 16px; border-radius: var(--border-radius-md); text-align: center; margin-bottom: 20px;">
          <span style="font-size: 1.6rem; font-weight: 700; letter-spacing: 2px; color: var(--color-blue);">
            ${data.invitationCode}
          </span>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <button class="cute-btn primary cute-btn-sm" id="btn-copy-code" style="flex:1;">코드 복사하기</button>
          <button class="cute-btn neutral cute-btn-sm" id="btn-regen-code">새로 만들기</button>
        </div>

        <button class="cute-btn neutral cute-btn-sm" id="btn-invite-cancel-go" style="width:100%; color:var(--color-red); background-color: var(--color-red-bg);">
          가계부 개설 취소
        </button>
      </div>
    `;
    
    container.querySelector('#btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(data.invitationCode);
      showToast(container, "초대 코드가 복사되었습니다.");
    });
    
    container.querySelector('#btn-regen-code').addEventListener('click', () => {
      store.regenerateInvitation();
      showToast(container, "새로운 코드가 생성되었습니다.");
    });

    container.querySelector('#btn-invite-cancel-go').addEventListener('click', () => {
      if (confirm("정말 개설을 취소하고 첫 화면으로 돌아가시겠습니까?")) {
        store.disconnectWallet();
        window.location.reload();
      }
    });
  } else {
    // 로컬 호스트(개발환경)일 때만 디버깅용 설정 링크 노출
    const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const localSettingHtml = isLocalEnv 
      ? `<button class="cute-btn secondary cute-btn-sm" id="btn-invite-go-firebase-b" style="width: 100%; font-size: 0.78rem;">
          📡 실시간 동기화(Firebase) 설정하기
         </button>`
      : '';

    container.innerHTML = `
      <div class="cute-card" style="border-color: var(--color-green); margin-top: 10px;">
        <div class="sticker mint">포켓 참여 / 가계부 복원</div>
        <h3 class="cute-card-title">초대코드로 지갑 동화하기</h3>
        <p style="margin-bottom: 20px; font-size: 0.9rem; color: var(--color-text-light); line-height: 1.5;">
          파트너에게 공유받은 초대 코드(예: SWEET-XXXX)를 입력창에 적어주세요. 
          이미 사용 중이던 지갑일 경우, 본인의 원래 역할을 선택해 동기화 상태를 그대로 복구할 수 있습니다.
        </p>
        
        <input type="text" class="cute-input" id="input-invite-code" placeholder="초대 코드 입력" style="text-align: center; text-transform: uppercase;">
        
        <button class="cute-btn primary" id="btn-submit-code" style="width: 100%; margin-bottom: 12px;">초대 코드 확인</button>
        
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${localSettingHtml}
          <button class="cute-btn neutral cute-btn-sm" id="btn-invite-cancel-go-b" style="width: 100%; color:var(--color-red);">
            취소 및 돌아가기
          </button>
        </div>
      </div>
    `;
    
    container.querySelector('#btn-submit-code').addEventListener('click', () => {
      const code = container.querySelector('#input-invite-code').value.trim().toUpperCase();
      if (!code) {
        showToast(container, "코드를 입력해 주세요.");
        return;
      }
      
      store.acceptInvitation(code).then(res => {
        if (res.status === 'success') {
          showToast(container, "성공적으로 연결되었습니다.");
        } else if (res.status === 'require_role_choice') {
          showRoleChoiceModal(code, container, res.dbData);
        } else {
          showToast(container, "초대 코드가 유효하지 않습니다.");
        }
      });
    });

    if (isLocalEnv) {
      container.querySelector('#btn-invite-go-firebase-b').addEventListener('click', () => {
        showFirebaseConfigModal(container);
      });
    }

    container.querySelector('#btn-invite-cancel-go-b').addEventListener('click', () => {
      store.disconnectWallet();
      window.location.reload();
    });
  }
}

// 👑 가계부 복원 선택 다이얼로그 모달 모듈 (2단계 PIN 패스워드 검증 연계)
function showRoleChoiceModal(code, container, dbData = null) {
  const nameA = (dbData && dbData.users && dbData.users.A && dbData.users.A.name) ? dbData.users.A.name : "동글이";
  const nameB = (dbData && dbData.users && dbData.users.B && dbData.users.B.name) ? dbData.users.B.name : "몽글이";

  const modal = document.createElement('div');
  modal.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.45); display: flex; align-items: center;
    justify-content: center; z-index: 9999; padding: 20px;
    backdrop-filter: blur(4px);
  `;
  
  modal.innerHTML = `
    <div class="cute-card" style="width: 100%; max-width: 330px; background: white; margin-bottom: 0; text-align: center; animation: bounce-cute 0.3s forwards;">
      <div style="font-size: 2.5rem; margin-bottom: 8px;">🔑</div>
      <h3 class="cute-card-title" style="margin-bottom: 8px; font-size: 1.15rem;">기존 가계부 복원</h3>
      <p style="font-size: 0.82rem; color: var(--color-text-light); line-height: 1.5; margin-bottom: 22px;">
        이미 활성화 완료된 지갑이 감지되었습니다.<br>이 기기에서 복구하실 역할을 선택해 주세요.
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="cute-btn primary cute-btn-sm" id="btn-choice-a" style="background-color: var(--color-pink); color: white; width: 100%; font-size: 0.85rem;">
          ${nameA} (방장)로 복원하기
        </button>
        <button class="cute-btn primary cute-btn-sm" id="btn-choice-b" style="background-color: var(--color-green); color: white; width: 100%; font-size: 0.85rem;">
          ${nameB} (파트너)로 복원하기
        </button>
        <button class="cute-btn neutral cute-btn-sm" id="btn-choice-cancel" style="width: 100%;">
          취소
        </button>
      </div>
    </div>
  `;
  
  if (!document.getElementById('style-bounce-modal')) {
    const style = document.createElement('style');
    style.id = 'style-bounce-modal';
    style.innerHTML = `
      @keyframes bounce-cute {
        0% { transform: scale(0.9); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(modal);

  // 🔒 2차 PIN 확인 서브 다이얼로그 호출 헬퍼
  function askForPin(chosenRole, roleName) {
    const pinModal = document.createElement('div');
    pinModal.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.45); display: flex; align-items: center;
      justify-content: center; z-index: 10000; padding: 20px;
      backdrop-filter: blur(4px);
    `;
    
    pinModal.innerHTML = `
      <div class="cute-card" style="width: 100%; max-width: 310px; background: white; margin-bottom: 0; text-align: center; animation: bounce-cute 0.25s forwards;">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">🛡️</div>
        <h4 style="margin-bottom: 4px; font-weight:700; font-size: 1.1rem; color:var(--color-text);">${roleName} 비밀번호 확인</h4>
        <p style="font-size: 0.78rem; color: var(--color-text-light); line-height: 1.4; margin-bottom: 16px;">
          정보 보호를 위해 설정하신 개인 비밀번호를 입력하세요.
        </p>

        <input type="password" class="cute-input" id="input-verify-pin" placeholder="비밀번호 4자리" maxlength="4" pattern="[0-8]*" inputmode="numeric" style="text-align: center; font-size:1.1rem; letter-spacing:6px; margin-bottom:12px;">

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="cute-btn primary cute-btn-sm" id="btn-pin-confirm" style="width: 100%;">비밀번호 확인</button>
          <button class="cute-btn neutral cute-btn-sm" id="btn-pin-cancel" style="width: 100%;">취소</button>
          
          <button class="cute-btn neutral cute-btn-sm" id="btn-forgot-pin" style="font-size: 0.72rem; text-decoration: underline; background: transparent; border: none; color: var(--color-text-muted); padding: 4px 0; cursor: pointer;">
            비밀번호를 분실하셨나요?
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(pinModal);

    pinModal.querySelector('#btn-pin-confirm').addEventListener('click', () => {
      const pin = pinModal.querySelector('#input-verify-pin').value.trim();
      if (pin.length !== 4) {
        alert("비밀번호는 숫자 4자리입니다.");
        return;
      }

      store.acceptInvitation(code, chosenRole, pin).then(res => {
        if (res.status === 'success') {
          pinModal.remove();
          modal.remove();
          showToast(container, `${roleName}로 복원되었습니다.`);
        } else if (res.status === 'pin_failed') {
          alert("비밀번호가 일치하지 않습니다. 다시 입력해 주세요.");
        } else {
          alert("네트워크 통신 오류가 발생했습니다.");
        }
      });
    });

    pinModal.querySelector('#btn-pin-cancel').addEventListener('click', () => {
      pinModal.remove();
    });

    // 💡 비밀번호 분실 시 파트너 승인 복구 안내 바인딩
    pinModal.querySelector('#btn-forgot-pin').addEventListener('click', () => {
      const partnerRole = chosenRole === 'user_a' ? '몽글이' : '동글이';
      alert(`[🔒 투포켓 비밀번호 찾기 안내]\n\n이메일이나 회원가입을 거치지 않는 무가입 구조이므로, 이미 로그인되어 정상 작동 중인 파트너(${partnerRole})의 스마트폰 가계부 앱 내 [마이] 탭에 접속하셔서 멤버 목록 옆의 [PIN 확인] 버튼을 누르시면, 본인의 4자리 비밀번호를 안전하게 확인하실 수 있습니다!`);
    });
  }

  modal.querySelector('#btn-choice-a').addEventListener('click', () => {
    askForPin('user_a', nameA);
  });
  
  modal.querySelector('#btn-choice-b').addEventListener('click', () => {
    askForPin('user_b', nameB);
  });
  
  modal.querySelector('#btn-choice-cancel').addEventListener('click', () => {
    modal.remove();
  });
}

// 🏠 [홈 탭] 소비분석 및 요약 렌더러
export function renderHomeTab(userId, container) {
  if (store.data.status === 'landing') {
    renderLandingScreen(userId, container);
    return;
  }
  if (store.data.status === 'waiting_invitation') {
    renderInvitationScreen(userId, container);
    return;
  }

  assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
  txSubViewState[userId] = { mode: 'list' };

  const summary = store.getFinancialSummary(userId);
  const currentMonth = new Date().getMonth() + 1;

  let chartSvgSegments = "";
  let accumPercent = 0;
  
  if (summary.categoryStats.length > 0) {
    summary.categoryStats.forEach((stat) => {
      const dashArray = `${stat.ratio} ${100 - stat.ratio}`;
      const dashOffset = 100 - accumPercent + 25;
      accumPercent += stat.ratio;

      chartSvgSegments += `
        <circle cx="21" cy="21" r="15.915" fill="transparent" 
                stroke="${stat.color}" stroke-width="4.5" 
                stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}">
        </circle>
      `;
    });
  } else {
    chartSvgSegments = `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E5E8EB" stroke-width="4.5" stroke-dasharray="100 0"></circle>`;
  }

  const legendHtml = summary.categoryStats.map(stat => {
    return `
      <div class="legend-item">
        <div class="legend-color" style="background-color: ${stat.color};"></div>
        <span style="font-weight: 500; font-size: 0.85rem;">
          ${stat.emoji} ${stat.name}: <strong style="color:var(--color-text);">${formatMoney(stat.amount)}</strong> (${stat.ratio}%)
        </span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <!-- 1. 합산 포켓 자산 요약 카드 -->
    <div class="cute-card summary-card-full" id="total-asset-box" style="cursor: pointer;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 0.85rem; font-weight: 600; color: #E8F3FF;">합산 포켓 자산</span>
        <span style="font-size: 0.75rem; color: #D9EBFF;">공유 포켓 기준</span>
      </div>
      <div class="total-asset-val">${formatMoney(summary.totalJointAsset)}</div>
      <div style="margin-top: 8px;"></div>
    </div>

    <!-- 소비 요약 카드 -->
    <div class="cute-card">
      <div class="sticker blue">${currentMonth}월 지출 총액</div>
      <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 12px;">${formatMoney(summary.totalExpense)}</h3>
      
      <div style="display: flex; gap: 8px; margin-bottom: 24px;">
        <span style="background: #F2F4F6; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
          내 포켓 지출: ${formatMoney(summary.myExpenseSum)}
        </span>
        <span style="background: #F2F4F6; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
          ${summary.partnerName} 지출: ${formatMoney(summary.partnerExpenseSum)}
        </span>
      </div>

      <div class="donut-chart-container">
        <div class="chart-graphic">
          <svg viewBox="0 0 42 42" width="130" height="130" style="border-radius: 50%;">
            ${chartSvgSegments}
          </svg>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none;">
            <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block;">지출비중</span>
            <span style="font-size: 1.1rem; font-weight: 700;">${currentMonth}월</span>
          </div>
        </div>
        <div class="chart-legend">
          ${legendHtml || '<div style="font-size:0.85rem; color:var(--color-text-muted);">등록된 지출이 없습니다.</div>'}
        </div>
      </div>
    </div>

    <!-- 최근 거래 리스트 -->
    <div class="cute-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="font-weight: 700; font-size: 1rem;">최근 거래</h4>
        <button class="cute-btn neutral cute-btn-sm" id="btn-go-tx-tab-link" style="padding: 4px 8px; font-size: 0.8rem;">전체 보기</button>
      </div>
      <div id="recent-timeline-list"></div>
      
      <button class="cute-btn primary" id="btn-go-record-tx" style="width: 100%; margin-top: 16px; font-size: 0.9rem;">거래 기록하기</button>
    </div>

    <!-- 공유 설정 안내 박스 -->
    <div class="info-box" id="share-info-banner" style="cursor: pointer;">
      <span>숨김(비공개) 포켓 자산은 합산 자산에 포함되지 않아요.</span>
      <strong style="color: var(--color-blue); font-size: 0.8rem;">포켓 공개 설정 ›</strong>
    </div>
  `;

  const txs = store.getTransactions(userId).slice(0, 3);
  const timelineList = container.querySelector('#recent-timeline-list');
  const allCategories = store.getCategories();

  if (txs.length === 0) {
    timelineList.innerHTML = `<div style="text-align:center; padding:16px; font-size:0.85rem; color:var(--color-text-muted);">최근 거래 내역이 없습니다.</div>`;
  } else {
    timelineList.innerHTML = txs.map(tx => {
      const isMyTx = tx.userId === userId;
      let title = tx.memo;
      let txColor = 'var(--color-text)';
      let sign = '';

      if (tx.type === 'transfer') {
        const fromAsset = store.data.assets.find(a => a.id === tx.linkedAssetId)?.name || "포켓";
        const toAsset = store.data.assets.find(a => a.id === tx.targetAssetId)?.name || "포켓";
        title = tx.memo ? `${tx.memo} (이체)` : `${fromAsset} → ${toAsset}`;
        txColor = 'var(--color-text-light)';
        sign = '⇄ ';
      } else {
        const catMeta = allCategories.find(c => c.id === tx.category) || { emoji: "🎈", name: "기타" };
        title = `${catMeta.emoji} ${tx.memo || catMeta.name}`;
        txColor = tx.type === 'expense' ? 'var(--color-red)' : 'var(--color-green)';
        sign = tx.type === 'expense' ? '-' : '+';
      }

      return `
        <div class="item-row">
          <div class="item-info">
            <span class="item-title">${title}</span>
            <span class="item-sub">${tx.date} · ${isMyTx ? '나' : summary.partnerName}</span>
          </div>
          <div class="item-value" style="color: ${txColor};">
            ${sign}${formatMoney(tx.amount)}
          </div>
        </div>
      `;
    }).join('');
  }

  container.querySelector('#total-asset-box').addEventListener('click', () => {
    document.querySelector('.nav-btn[data-tab="assets"]').click();
  });
  container.querySelector('#btn-go-tx-tab-link').addEventListener('click', () => {
    document.querySelector('.nav-btn[data-tab="txs"]').click();
  });
  container.querySelector('#btn-go-record-tx').addEventListener('click', () => {
    document.querySelector('.nav-btn[data-tab="txs"]').click();
  });
  container.querySelector('#share-info-banner').addEventListener('click', () => {
    document.querySelector('.nav-btn[data-tab="assets"]').click();
  });
}

// 🏦 [자산 관리 탭] 렌더러
export function renderAssetsTab(userId, container) {
  if (store.data.status === 'landing') {
    renderLandingScreen(userId, container);
    return;
  }
  if (store.data.status === 'waiting_invitation') {
    renderInvitationScreen(userId, container);
    return;
  }

  const state = assetSubViewState[userId];
  if (state.mode === 'add') {
    renderAssetAddScreen(userId, container);
  } else if (state.mode === 'edit') {
    renderAssetEditScreen(userId, container, state.editId);
  } else if (state.mode === 'detail') {
    renderAssetDetailScreen(userId, container, state.detailId);
  } else {
    renderAssetListScreen(userId, container);
  }
}

// [자산 관리 - 메인 리스트 뷰]
function renderAssetListScreen(userId, container) {
  const partnerId = userId === 'user_a' ? 'user_b' : 'user_a';
  const partnerName = store.data.users[partnerId]?.name || "상대방";

  const calculateTypeSum = (type) => {
    return store.data.assets
      .filter(a => a.type === type && (a.userId === userId || a.isShared))
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const cashAndSavingSum = calculateTypeSum('saving') + calculateTypeSum('cash');
  const investSum = calculateTypeSum('invest');
  const loanSum = calculateTypeSum('loan');
  const etcSum = store.data.assets
    .filter(a => !['saving', 'cash', 'invest', 'loan'].includes(a.type) && (a.userId === userId || a.isShared))
    .reduce((sum, a) => sum + a.amount, 0);

  container.innerHTML = `
    <!-- 1. 자산 통계 요약 -->
    <div class="cute-card" style="border-color: var(--color-blue); background-color: var(--color-card-bg);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
        <span style="font-size:0.85rem; font-weight:600; color:var(--color-text-light);">합산 포켓 자산</span>
        <span style="font-size:0.75rem; color:var(--color-text-muted);">공유 포켓 기준</span>
      </div>
      <div class="total-asset-val" style="margin: 8px 0;">${formatMoney(store.getFinancialSummary(userId).totalJointAsset)}</div>
      <div style="margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;"></div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.85rem;">
        <div>
          <span style="color:var(--color-text-muted); display:block; font-size:0.75rem;">내 포켓</span>
          <strong style="color:var(--color-blue);">${formatMoney(store.getFinancialSummary(userId).myAssetSum)}</strong>
        </div>
        <div>
          <span style="color:var(--color-text-muted); display:block; font-size:0.75rem;">상대 포켓</span>
          <strong>${formatMoney(store.getFinancialSummary(userId).partnerAssetSum)}</strong>
        </div>
      </div>
    </div>

    <!-- 2. 유형별 자산 요약 그리드 -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; margin-top: 16px;">
      <h4 style="font-weight:700; font-size:1rem;">유형별 포켓 분배</h4>
    </div>
    <div class="asset-type-grid">
      <div class="asset-type-box">
        <div class="asset-type-label">현금·예금</div>
        <div class="asset-type-val">${formatMoney(cashAndSavingSum)}</div>
      </div>
      <div class="asset-type-box">
        <div class="asset-type-label">투자</div>
        <div class="asset-type-val">${formatMoney(investSum)}</div>
      </div>
      <div class="asset-type-box">
        <div class="asset-type-label">대출·부채</div>
        <div class="asset-type-val" style="color: var(--color-red);">${formatMoney(loanSum)}</div>
      </div>
      <div class="asset-type-box">
        <div class="asset-type-label">기타</div>
        <div class="asset-type-val">${formatMoney(etcSum)}</div>
      </div>
    </div>

    <!-- 3. 자산 항목 리스트 -->
    <div class="cute-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <h4 style="font-weight:700; font-size:1rem;">보관 포켓 목록</h4>
        <button class="cute-btn primary cute-btn-sm" id="btn-go-add-asset" style="padding: 6px 12px; font-size:0.8rem;">새 포켓 추가</button>
      </div>
      
      <div id="my-assets-list"></div>
      
      <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:16px; border-top:1px solid var(--color-border); padding-top:12px;">
        ℹ️ 포켓 이름을 클릭하면 입출금 및 상세 거래 내역을 확인할 수 있어요.
      </div>
    </div>

    <!-- 4. 상대방이 공유한 자산 -->
    <div class="cute-card">
      <div class="sticker mint">${partnerName}님이 오픈한 포켓</div>
      <div id="partner-assets-list"></div>
    </div>
  `;

  const assets = store.data.assets;
  const myAssets = assets.filter(a => a.id !== undefined && a.userId === userId);
  const partnerAssets = assets.filter(a => a.id !== undefined && a.userId === partnerId && a.isShared);

  const myContainer = container.querySelector('#my-assets-list');
  const partnerContainer = container.querySelector('#partner-assets-list');

  if (myAssets.length === 0) {
    myContainer.innerHTML = `<div style="text-align:center; padding:16px; color:var(--color-text-muted); font-size:0.85rem;">보관 중인 포켓이 없습니다.</div>`;
  } else {
    myContainer.innerHTML = myAssets.map(a => {
      const typeMeta = ASSET_TYPE_META[a.type] || { name: "기타 포켓", emoji: "📁" };
      return `
        <div class="item-row" style="cursor: pointer;">
          <div class="item-info asset-click-area" data-id="${a.id}" style="flex: 1; padding: 4px 0;">
            <span class="item-title" style="text-decoration: underline; text-underline-offset: 4px; color: var(--color-blue);">${a.name} ›</span>
            <span class="item-sub">
              ${typeMeta.name} · 내 포켓
            </span>
          </div>
          <div style="display:flex; align-items:center; gap: 14px;">
            <span class="item-value" style="color: ${a.type === 'loan' ? 'var(--color-red)' : 'inherit'};">
              ${a.type === 'loan' ? '-' : ''}${formatMoney(a.amount)}
            </span>
            
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:0.72rem; font-weight:600; color:var(--color-text-light);">${a.isShared ? '공유' : '숨김'}</span>
              <label class="cute-switch" style="transform: scale(0.85); width:40px;">
                <input type="checkbox" class="asset-share-toggle-switch" data-id="${a.id}" ${a.isShared ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <button class="cute-btn cute-btn-sm secondary btn-edit-asset-go" data-id="${a.id}" style="padding: 4px 8px; font-size:0.75rem;">수정</button>
            <button class="cute-btn cute-btn-sm neutral btn-delete-asset" data-id="${a.id}" style="color: var(--color-red); padding: 4px 8px; font-size:0.75rem;">삭제</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (partnerAssets.length === 0) {
    partnerContainer.innerHTML = `<div style="text-align:center; padding:16px; color:var(--color-text-muted); font-size:0.85rem;">공유 상태로 오픈된 파트너 포켓이 없습니다.</div>`;
  } else {
    partnerContainer.innerHTML = partnerAssets.map(a => {
      const typeMeta = ASSET_TYPE_META[a.type] || { name: "기타 포켓", emoji: "📁" };
      return `
        <div class="item-row" style="cursor: pointer;">
          <div class="item-info asset-click-area" data-id="${a.id}" style="flex: 1; padding: 4px 0;">
            <span class="item-title" style="text-decoration: underline; text-underline-offset: 4px; color: var(--color-blue);">${a.name} ›</span>
            <span class="item-sub">${typeMeta.name} · ${partnerName} 포켓</span>
          </div>
          <span class="item-value" style="color: ${a.type === 'loan' ? 'var(--color-red)' : 'inherit'};">
            ${a.type === 'loan' ? '-' : ''}${formatMoney(a.amount)}
          </span>
        </div>
      `;
    }).join('');
  }

  container.querySelectorAll('.asset-click-area').forEach(el => {
    el.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      assetSubViewState[userId] = { mode: 'detail', editId: null, detailId: id };
      renderAssetsTab(userId, container);
    });
  });

  container.querySelector('#btn-go-add-asset').addEventListener('click', () => {
    assetSubViewState[userId] = { mode: 'add', editId: null, detailId: null };
    renderAssetsTab(userId, container);
  });

  myContainer.querySelectorAll('.asset-share-toggle-switch').forEach(sw => {
    sw.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const nextShared = e.target.checked;
      store.updateAsset(id, { isShared: nextShared, hideFromTotal: !nextShared }, null);
      showToast(container, nextShared ? "포켓을 파트너에게 공개했습니다." : "포켓을 숨김 처리했습니다.");
      renderAssetListScreen(userId, container);
    });
  });

  myContainer.querySelectorAll('.btn-edit-asset-go').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      assetSubViewState[userId] = { mode: 'edit', editId: id, detailId: null };
      renderAssetsTab(userId, container);
    });
  });

  myContainer.querySelectorAll('.btn-delete-asset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      if (confirm("해당 포켓을 삭제하시겠습니까?")) {
        store.deleteAsset(id);
        showToast(container, "포켓이 삭제되었습니다.");
        renderAssetListScreen(userId, container);
      }
    });
  });
}

// ➕ [자산 관리 - 자산 추가 등록 화면]
function renderAssetAddScreen(userId, container) {
  container.innerHTML = `
    <div class="cute-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px;">
        <button class="cute-btn neutral cute-btn-sm" id="btn-back-to-list" style="padding:4px 8px;">‹ 뒤로</button>
        <h3 class="cute-card-title" style="margin-bottom:0;">새 보관 포켓 추가</h3>
      </div>
      <form id="form-add-asset-screen">
        <label class="cute-label">포켓 이름</label>
        <input type="text" class="cute-input" id="new-asset-name" placeholder="예: 카카오 월급통장, 비상금 봉투" required>
        
        <label class="cute-label">포켓 자산 유형</label>
        <select class="cute-select" id="new-asset-type">
          <option value="saving">🏦 예적금 포켓</option>
          <option value="cash">💵 현금 주머니</option>
          <option value="invest">📈 투자 포켓</option>
          <option value="loan">📉 대출 포켓 (부채)</option>
        </select>

        <label class="cute-label">현재 잔액</label>
        <input type="number" class="cute-input" id="new-asset-amount" placeholder="금액 입력" required>

        <label class="cute-label">메모 (선택)</label>
        <input type="text" class="cute-input" id="new-asset-memo" placeholder="상세 용도 메모">

        <div style="background:#F2F4F6; padding:12px; border-radius:var(--border-radius-md); margin-bottom: 20px;">
          <div class="switch-container" style="margin-bottom:8px;">
            <label class="cute-switch">
              <input type="checkbox" id="new-asset-shared" checked>
              <span class="slider"></span>
            </label>
            <span style="font-size:0.85rem; font-weight:600; color:var(--color-text-light);">파트너에게 이 포켓 공개</span>
          </div>
          <div class="switch-container" style="margin-bottom:0;">
            <label class="cute-switch">
              <input type="checkbox" id="new-asset-hidetotal">
              <span class="slider"></span>
            </label>
            <span style="font-size:0.85rem; font-weight:600; color:var(--color-text-light);">합산 포켓 자산에서 제외</span>
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="cute-btn neutral" id="btn-cancel-add" style="flex:1;">취소</button>
          <button type="submit" class="cute-btn primary" style="flex:2;">개설 완료</button>
        </div>
      </form>
    </div>
  `;

  const goBack = () => {
    assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
    renderAssetsTab(userId, container);
  };

  container.querySelector('#btn-back-to-list').addEventListener('click', goBack);
  container.querySelector('#btn-cancel-add').addEventListener('click', goBack);

  container.querySelector('#form-add-asset-screen').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#new-asset-name').value;
    const type = container.querySelector('#new-asset-type').value;
    const amount = container.querySelector('#new-asset-amount').value;
    const memo = container.querySelector('#new-asset-memo').value;
    const isShared = container.querySelector('#new-asset-shared').checked;
    const hideFromTotal = container.querySelector('#new-asset-hidetotal').checked;

    store.addAsset(userId, { name, type, amount, isShared, hideFromTotal, memo });
    showToast(container, "포켓이 성공적으로 개설되었습니다.");
    goBack();
  });
}

// ✏️ [자산 관리 - 자산 수정 화면]
function renderAssetEditScreen(userId, container, assetId) {
  const asset = store.data.assets.find(a => a.id === assetId);
  if (!asset) {
    assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
    renderAssetsTab(userId, container);
    return;
  }

  container.innerHTML = `
    <div class="cute-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px;">
        <button class="cute-btn neutral cute-btn-sm" id="btn-back-to-list-edit" style="padding:4px 8px;">‹ 뒤로</button>
        <h3 class="cute-card-title" style="margin-bottom:0;">포켓 설정 수정</h3>
      </div>
      <form id="form-edit-asset-screen">
        <label class="cute-label">포켓 이름</label>
        <input type="text" class="cute-input" id="edit-asset-name" value="${asset.name}" required>
        
        <label class="cute-label">포켓 자산 유형</label>
        <select class="cute-select" id="edit-asset-type">
          <option value="saving" ${asset.type === 'saving' ? 'selected' : ''}>🏦 예적금 포켓</option>
          <option value="cash" ${asset.type === 'cash' ? 'selected' : ''}>💵 현금 주머니</option>
          <option value="invest" ${asset.type === 'invest' ? 'selected' : ''}>📈 투자 포켓</option>
          <option value="loan" ${asset.type === 'loan' ? 'selected' : ''}>📉 대출 포켓 (부채)</option>
        </select>

        <label class="cute-label">현재 잔액</label>
        <input type="number" class="cute-input" id="edit-asset-amount" value="${asset.amount}" required>

        <label class="cute-label">메모 (선택)</label>
        <input type="text" class="cute-input" id="edit-asset-memo" value="${asset.memo || ''}">

        <div style="background:#F2F4F6; padding:12px; border-radius:var(--border-radius-md); margin-bottom: 20px;">
          <div class="switch-container" style="margin-bottom:8px;">
            <label class="cute-switch">
              <input type="checkbox" id="edit-asset-shared" ${asset.isShared ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span style="font-size:0.85rem; font-weight:600; color:var(--color-text-light);">파트너에게 이 포켓 공개</span>
          </div>
          <div class="switch-container" style="margin-bottom:0;">
            <label class="cute-switch">
              <input type="checkbox" id="edit-asset-hidetotal" ${asset.hideFromTotal ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span style="font-size:0.85rem; font-weight:600; color:var(--color-text-light);">합산 포켓 자산에서 제외</span>
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="cute-btn neutral" id="btn-cancel-edit" style="flex:1;">취소</button>
          <button type="submit" class="cute-btn primary" style="flex:2;">수정 완료</button>
        </div>
      </form>
    </div>
  `;

  const goBack = () => {
    assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
    renderAssetsTab(userId, container);
  };

  container.querySelector('#btn-back-to-list-edit').addEventListener('click', goBack);
  container.querySelector('#btn-cancel-edit').addEventListener('click', goBack);

  container.querySelector('#form-edit-asset-screen').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#edit-asset-name').value;
    const type = container.querySelector('#edit-asset-type').value;
    const newAmount = Number(container.querySelector('#edit-asset-amount').value);
    const memo = container.querySelector('#edit-asset-memo').value;
    const isShared = container.querySelector('#edit-asset-shared').checked;
    const hideFromTotal = container.querySelector('#edit-asset-hidetotal').checked;

    const oldAmount = asset.amount;
    const diff = newAmount - oldAmount;

    let includeInSummary = null;

    if (diff !== 0) {
      const formattedDiff = formatMoney(Math.abs(diff));
      const message = `잔액이 변경되었습니다.\n차액: ${diff > 0 ? '+' : '-'}${formattedDiff}\n\n이 잔액 변동 차액을 이번 달 지출/수입 분석 통계에 반영할까요?\n\n[확인] - 반영하여 거래 내역으로 남기기\n[취소] - 단순 잔액 보정으로 처리 (통계 합산 제외)`;
      
      const confirmSum = confirm(message);
      includeInSummary = confirmSum; 
    }

    store.updateAsset(assetId, { name, type, amount: newAmount, isShared, hideFromTotal, memo }, includeInSummary);
    showToast(container, "포켓 수정 및 잔액이 정상 반영되었습니다.");
    goBack();
  });
}

// 🔍 [자산 관리 - 자산 상세 내역 타임라인 화면]
function renderAssetDetailScreen(userId, container, assetId) {
  const asset = store.data.assets.find(a => a.id === assetId);
  if (!asset) {
    assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
    renderAssetsTab(userId, container);
    return;
  }

  const partnerId = userId === 'user_a' ? 'user_b' : 'user_a';
  const partnerName = store.data.users[partnerId]?.name || "상대방";
  const typeMeta = ASSET_TYPE_META[asset.type] || { name: "기타", emoji: "📁" };

  const relatedTxs = store.data.transactions
    .filter(tx => tx.linkedAssetId === assetId || tx.targetAssetId === assetId)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));

  container.innerHTML = `
    <div class="cute-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:12px;">
        <button class="cute-btn neutral cute-btn-sm" id="btn-back-from-detail" style="padding:4px 8px;">‹ 뒤로</button>
        <h3 class="cute-card-title" style="margin-bottom:0; font-size:1.15rem;">${typeMeta.emoji} ${asset.name} 상세</h3>
      </div>

      <div style="background: #F8F9FA; padding: 16px; border-radius: var(--border-radius-md); margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:0.75rem; color:var(--color-text-muted);">포켓 유형 · 소유주</span>
          <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:600;">
            ${ownerName} (${asset.isShared ? '공유 중' : '나만 보기'})
          </span>
        </div>
        <div style="font-size: 1.4rem; font-weight: 700; color: var(--color-text); margin-bottom: 8px;">
          ${formatMoney(asset.amount)}
        </div>
        ${asset.memo ? `<div style="font-size:0.8rem; color:var(--color-text-light);">📝 ${asset.memo}</div>` : ''}
      </div>

      <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:12px; color:var(--color-text);">입출금 및 이체 히스토리</h4>
      <div id="asset-txs-timeline"></div>
    </div>
  `;

  const timelineContainer = container.querySelector('#asset-txs-timeline');

  if (relatedTxs.length === 0) {
    timelineContainer.innerHTML = `<div style="text-align:center; padding:24px; font-size:0.85rem; color:var(--color-text-muted);">연관된 거래 내역이 없습니다.</div>`;
  } else {
    timelineContainer.innerHTML = relatedTxs.map(tx => {
      let displayTitle = tx.memo || "내용 없음";
      let txColor = 'var(--color-text)';
      let sign = '';
      let subDesc = `${tx.date} · ${tx.userId === userId ? '나' : partnerName}`;

      if (tx.type === 'transfer') {
        const fromName = store.data.assets.find(a => a.id === tx.linkedAssetId)?.name || "포켓";
        const toName = store.data.assets.find(a => a.id === tx.targetAssetId)?.name || "포켓";

        if (tx.linkedAssetId === assetId) {
          displayTitle = tx.memo ? `${tx.memo} (이체 출금)` : `→ ${toName} (이체)`;
          txColor = 'var(--color-red)';
          sign = '-';
        } else {
          displayTitle = tx.memo ? `${tx.memo} (이체 입금)` : `← ${fromName} (이체)`;
          txColor = 'var(--color-green)';
          sign = '+';
        }
      } else {
        if (tx.type === 'expense') {
          txColor = 'var(--color-red)';
          sign = '-';
        } else {
          txColor = 'var(--color-green)';
          sign = '+';
        }

        if (tx.id.startsWith('tx_adjust_')) {
          displayTitle = `⚙️ ${tx.memo}`;
          subDesc += ` · ${tx.includeInSummary ? '통계 포함' : '통계 제외'}`;
        }
      }

      return `
        <div class="item-row" style="padding: 10px 0; border-bottom: 1px solid #F2F4F6;">
          <div class="item-info">
            <span class="item-title" style="font-size:0.88rem; font-weight:600;">${displayTitle}</span>
            <span class="item-sub" style="font-size:0.75rem;">${subDesc}</span>
          </div>
          <div class="item-value" style="color: ${txColor}; font-weight: 700; font-size:0.9rem;">
            ${sign}${formatMoney(tx.amount)}
          </div>
        </div>
      `;
    }).join('');
  }

  container.querySelector('#btn-back-from-detail').addEventListener('click', () => {
    assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
    renderAssetsTab(userId, container);
  });
}

// 📝 [거래 내역 및 소비 기록 탭] 렌더러
export function renderTxsTab(userId, container) {
  if (store.data.status === 'landing') {
    renderLandingScreen(userId, container);
    return;
  }
  if (store.data.status === 'waiting_invitation') {
    renderInvitationScreen(userId, container);
    return;
  }

  assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };

  const state = txSubViewState[userId];
  if (state.mode === 'categories') {
    renderCategoriesManagementScreen(userId, container);
  } else {
    renderTxsMainScreen(userId, container);
  }
}

// [거래 - 메인 거래 리스트 및 등록 폼]
function renderTxsMainScreen(userId, container) {
  const myAssets = store.data.assets.filter(a => a.userId === userId);
  const partnerId = userId === 'user_a' ? 'user_b' : 'user_a';
  const partnerName = store.data.users[partnerId]?.name || "상대방";
  const categories = store.getCategories();

  container.innerHTML = `
    <!-- 상단 카테고리 편집 링크 바 -->
    <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
      <button class="cute-btn neutral cute-btn-sm" id="btn-go-categories-edit" style="font-size:0.8rem; padding: 6px 12px;">⚙️ 카테고리 설정</button>
    </div>

    <!-- 소비/이체 기록 폼 -->
    <div class="cute-card" style="background-color: #FAFBFB;">
      <div class="sticker mint">오늘의 소비 기록하기</div>
      <form id="form-add-tx" style="margin-top: 12px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="cute-label">날짜</label>
            <input type="date" class="cute-input" id="tx-date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div>
            <label class="cute-label">구분</label>
            <select class="cute-select" id="tx-type">
              <option value="expense">지출 🍩</option>
              <option value="income">수입 🥕</option>
              <option value="transfer">이체 ⇄</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="cute-label">금액</label>
            <input type="number" class="cute-input" id="tx-amount" placeholder="금액 입력" required>
          </div>
          <div>
            <label class="cute-label">내용 (선택)</label>
            <input type="text" class="cute-input" id="tx-memo" placeholder="예: 저녁 외식, 마트 장보기 등">
          </div>
        </div>

        <!-- 조건부 필드 영역: 수입/지출 시 카테고리 & 자산 선택 -->
        <div id="regular-tx-fields" style="display: block;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="cute-label">카테고리</label>
              <select class="cute-select" id="tx-category">
                ${categories.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="cute-label">연동할 내 포켓 (선택)</label>
              <select class="cute-select" id="tx-asset">
                <option value="">연동 안 함</option>
                ${myAssets.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- 조건부 필드 영역: 이체(transfer) 선택 시 활성화 -->
        <div id="transfer-tx-fields" style="display: none; background: #FFFDF9; border: 1px dashed var(--color-border); padding: 14px; border-radius: var(--border-radius-md); margin-bottom: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="cute-label" style="color:var(--color-red);">보내는 포켓 📤</label>
              <select class="cute-select" id="tx-from-asset" style="margin-bottom:0;">
                <option value="">선택해 주세요</option>
                ${myAssets.map(a => `<option value="${a.id}">${a.name} (${formatMoney(a.amount)})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="cute-label" style="color:var(--color-green);">받는 포켓 📥</label>
              <select class="cute-select" id="tx-to-asset" style="margin-bottom:0;">
                <option value="">선택해 주세요</option>
                ${myAssets.map(a => `<option value="${a.id}">${a.name} (${formatMoney(a.amount)})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; background: #FAFBFB; border:1px solid var(--color-border); border-radius:var(--border-radius-md); padding: 12px; margin-bottom: 16px;">
          <div class="switch-container" style="margin-bottom:0;">
            <label class="cute-switch">
              <input type="checkbox" id="tx-shared" checked>
              <span class="slider"></span>
            </label>
            <span style="font-size:0.85rem; font-weight:600; color:var(--color-text-light);">파트너에게 이 거래 공유</span>
          </div>
        </div>

        <button type="submit" class="cute-btn primary" style="width: 100%;">기록 완료</button>
      </form>
    </div>

    <!-- 타임라인 -->
    <div class="cute-card">
      <div class="sticker pink">거래 내역</div>
      <div id="txs-list"></div>
    </div>
  `;

  const txTypeSelect = container.querySelector('#tx-type');
  const regularFields = container.querySelector('#regular-tx-fields');
  const transferFields = container.querySelector('#transfer-tx-fields');

  txTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'transfer') {
      regularFields.style.display = 'none';
      transferFields.style.display = 'block';
    } else {
      regularFields.style.display = 'block';
      transferFields.style.display = 'none';
    }
  });

  container.querySelector('#btn-go-categories-edit').addEventListener('click', () => {
    txSubViewState[userId] = { mode: 'categories' };
    renderTxsTab(userId, container);
  });

  const renderTxList = () => {
    const txs = store.getTransactions(userId);
    const txsListContainer = container.querySelector('#txs-list');
    
    if (txs.length === 0) {
      txsListContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--color-text-muted); font-size:0.85rem;">거래 내역이 없습니다.</div>`;
      return;
    }

    txsListContainer.innerHTML = txs.map(tx => {
      const isMyTx = tx.userId === userId;
      let title = tx.memo || "내용 없음";
      let txColor = 'var(--color-text)';
      let sign = '';

      if (tx.type === 'transfer') {
        const fromAsset = store.data.assets.find(a => a.id === tx.linkedAssetId)?.name || "포켓";
        const toAsset = store.data.assets.find(a => a.id === tx.targetAssetId)?.name || "포켓";
        title = tx.memo ? `${tx.memo} (이체)` : `${fromAsset} → ${toAsset}`;
        txColor = 'var(--color-text-light)';
        sign = '⇄ ';
      } else {
        const catMeta = categories.find(c => c.id === tx.category) || { emoji: "🎈", name: "기타" };
        title = `${catMeta.emoji} ${tx.memo || catMeta.name}`;
        txColor = tx.type === 'expense' ? 'var(--color-red)' : 'var(--color-green)';
        sign = tx.type === 'expense' ? '-' : '+';
      }

      if (tx.id.startsWith('tx_adjust_')) {
        title = `⚙️ ${tx.memo}`;
      }

      return `
        <div class="item-row">
          <div class="item-info">
            <span class="item-title">${title}</span>
            <span class="item-sub">
              ${tx.date} · ${isMyTx ? '나' : partnerName} 
              ${isMyTx ? `· ${tx.isShared ? '공개' : '비공개'}` : ''}
              ${tx.id.startsWith('tx_adjust_') ? ` · ${tx.includeInSummary ? '통계합산' : '통계제외'}` : ''}
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="item-value" style="color: ${txColor}; font-weight:700;">
              ${sign}${formatMoney(tx.amount)}
            </span>
            ${isMyTx ? `<button class="cute-btn cute-btn-sm neutral btn-delete-tx" data-id="${tx.id}" style="color: var(--color-red); padding: 4px 8px;">삭제</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    txsListContainer.querySelectorAll('.btn-delete-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm("이 기록을 삭제하시겠습니까?")) {
          store.deleteTransaction(id);
          showToast(container, "기록이 삭제되었습니다.");
          renderTxList();
        }
      });
    });
  };

  renderTxList();

  container.querySelector('#form-add-tx').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = txTypeSelect.value;
    const amount = container.querySelector('#tx-amount').value;
    const date = container.querySelector('#tx-date').value;
    const memo = container.querySelector('#tx-memo').value.trim();

    const isShared = container.querySelector('#tx-shared').checked;

    let linkedAssetId = null;
    let targetAssetId = null;
    let category = "etc";

    if (type === 'transfer') {
      linkedAssetId = container.querySelector('#tx-from-asset').value;
      targetAssetId = container.querySelector('#tx-to-asset').value;

      if (!linkedAssetId || !targetAssetId) {
        alert("보내는 포켓과 받는 포켓을 모두 선택해 주세요.");
        return;
      }
      if (linkedAssetId === targetAssetId) {
        alert("보내는 포켓과 받는 포켓은 같을 수 없습니다.");
        return;
      }
    } else {
      category = container.querySelector('#tx-category').value;
      linkedAssetId = container.querySelector('#tx-asset').value;
    }

    store.addTransaction(userId, {
      type, category, amount, date, memo: memo || null, isShared, includeInSummary: true, linkedAssetId, targetAssetId
    });

    showToast(container, "거래가 저장 및 연동 포켓에 반영되었습니다.");
    e.target.reset();
    container.querySelector('#tx-date').value = new Date().toISOString().split('T')[0];
    txTypeSelect.value = 'expense';
    regularFields.style.display = 'block';
    transferFields.style.display = 'none';
    renderTxList();
  });
}

// ⚙️ [거래 - 카테고리 편집 및 추가 화면]
function renderCategoriesManagementScreen(userId, container) {
  const categories = store.getCategories();
  let selectedEmoji = "🎈";

  container.innerHTML = `
    <div class="cute-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 16px;">
        <button class="cute-btn neutral cute-btn-sm" id="btn-back-to-txs" style="padding:4px 8px;">‹ 뒤로</button>
        <h3 class="cute-card-title" style="margin-bottom:0;">카테고리 관리</h3>
      </div>
      
      <p style="font-size:0.8rem; color:var(--color-text-light); margin-bottom:16px;">
        카테고리의 <strong>아이콘(이모지)</strong>을 클릭하면 다른 이모지로 즉시 변경할 수 있습니다. (최대 10개, 현재: ${categories.length}/10)
      </p>

      <form id="form-add-category" style="background:#F2F4F6; padding:12px; border-radius:var(--border-radius-md); margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <!-- 이모지 선택 버튼 -->
          <button type="button" id="btn-add-cat-emoji" style="width:42px; height:42px; border-radius:50%; border:none; font-size:1.35rem; display:flex; align-items:center; justify-content:center; background-color:#E9ECEF; color:var(--color-text); cursor:pointer; transition:transform 0.1s; box-shadow:0px 2px 4px rgba(0,0,0,0.05);" title="아이콘 변경">
            ${selectedEmoji}
          </button>
          
          <div style="flex:1;">
            <input type="text" class="cute-input" id="new-cat-name" placeholder="카테고리 이름 (예: 데이트, 구독료)" style="margin-bottom:0; height:42px;" required>
          </div>
          
          <button type="submit" class="cute-btn primary" id="btn-submit-cat" style="height:42px; padding:0 16px; min-width:60px;">추가</button>
        </div>
      </form>

      <div id="categories-list-box"></div>
    </div>
  `;

  // 🎨 이모지 픽커 공용 팝업 헬퍼 (컬러 선택 걷어냄)
  function showEmojiPicker(currentEmoji, onConfirm) {
    const emojis = ["🍔", "🧼", "🚌", "🎬", "🎁", "🛒", "💊", "🏠", "👕", "✈️", "☕", "💡", "💰", "🐾", "👶", "🎈"];
    let activeEmoji = currentEmoji;

    const picker = document.createElement('div');
    picker.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.45); display: flex; align-items: center;
      justify-content: center; z-index: 10008; padding: 20px;
      backdrop-filter: blur(4px);
    `;

    picker.innerHTML = `
      <div class="cute-card" style="width:100%; max-width:275px; background:white; text-align:center; padding:20px; animation: bounce-cute 0.2s forwards; margin-bottom:0;">
        <h4 style="font-weight:700; font-size:1.05rem; margin-bottom:12px; color:var(--color-text);">카테고리 아이콘 선택</h4>
        
        <!-- 프리뷰 아바타 -->
        <div style="display:flex; justify-content:center; margin-bottom:16px;">
          <div id="picker-preview" style="width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.75rem; background-color:#F2F4F6; border:1px solid var(--color-border);">
            ${activeEmoji}
          </div>
        </div>

        <!-- 이모지 그리드 -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:20px;">
          ${emojis.map(emo => `
            <button type="button" class="picker-emoji-btn" data-emoji="${emo}" style="font-size:1.35rem; background:none; border:none; cursor:pointer; padding:6px; border-radius:8px; transition:background 0.1s; ${emo === activeEmoji ? 'background-color:#E9ECEF;' : ''}">
              ${emo}
            </button>
          `).join('')}
        </div>

        <div style="display:flex; gap:6px;">
          <button type="button" class="cute-btn primary cute-btn-sm" id="btn-picker-confirm" style="flex:1;">확인</button>
          <button type="button" class="cute-btn neutral cute-btn-sm" id="btn-picker-close" style="flex:1;">취소</button>
        </div>
      </div>
    `;

    document.body.appendChild(picker);

    const preview = picker.querySelector('#picker-preview');

    // 이모지 선택 리스너
    picker.querySelectorAll('.picker-emoji-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        picker.querySelectorAll('.picker-emoji-btn').forEach(b => b.style.backgroundColor = 'transparent');
        activeEmoji = e.currentTarget.getAttribute('data-emoji');
        e.currentTarget.style.backgroundColor = '#E9ECEF';
        preview.textContent = activeEmoji;
      });
    });

    // 최종 컨펌
    picker.querySelector('#btn-picker-confirm').addEventListener('click', () => {
      onConfirm(activeEmoji);
      picker.remove();
    });

    picker.querySelector('#btn-picker-close').addEventListener('click', () => {
      picker.remove();
    });
  }

  // 등록 폼 이모지 피커 트리거
  const formEmojiBtn = container.querySelector('#btn-add-cat-emoji');
  formEmojiBtn.addEventListener('click', () => {
    showEmojiPicker(selectedEmoji, (emoji) => {
      selectedEmoji = emoji;
      formEmojiBtn.textContent = emoji;
    });
  });

  const goBack = () => {
    txSubViewState[userId] = { mode: 'list' };
    renderTxsTab(userId, container);
  };

  container.querySelector('#btn-back-to-txs').addEventListener('click', goBack);

  const renderCatList = () => {
    const cats = store.getCategories();
    const listBox = container.querySelector('#categories-list-box');
    const submitBtn = container.querySelector('#btn-submit-cat');

    if (cats.length >= 10) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
      submitBtn.textContent = '가득참';
    } else {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.textContent = '추가';
    }

    listBox.innerHTML = cats.map(c => {
      const isDefaultEtc = c.id === 'etc';
      
      return `
        <div class="item-row" style="padding:12px 0; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <!-- 순수 이모지 노출 (클릭해서 변경 가능) -->
            <span class="cat-avatar-btn" data-id="${c.id}" data-emoji="${c.emoji}" style="font-size:1.45rem; cursor:pointer; padding: 4px; border-radius: 8px; transition: background 0.15s;" title="아이콘 변경" onmouseover="this.style.backgroundColor='#F2F4F6'" onmouseout="this.style.backgroundColor='transparent'">
              ${c.emoji}
            </span>
            
            <span style="font-weight:600; font-size:0.92rem; color:var(--color-text);">${c.name}</span>
            ${isDefaultEtc ? `<span style="font-size:0.72rem; color:var(--color-text-muted);">(기본 카테고리)</span>` : ''}
          </div>
          ${isDefaultEtc ? '' : `<button class="cute-btn cute-btn-sm neutral btn-delete-cat" data-id="${c.id}" style="color:var(--color-red); padding:4px 8px; border:none; font-size:0.75rem;">삭제</button>`}
        </div>
      `;
    }).join('');

    // 리스트 내 이모지 클릭 시 변경 핸들러
    listBox.querySelectorAll('.cat-avatar-btn').forEach(avatar => {
      avatar.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const id = target.getAttribute('data-id');
        const currentEmoji = target.getAttribute('data-emoji');

        showEmojiPicker(currentEmoji, (newEmoji) => {
          store.updateCategory(id, { emoji: newEmoji });
          showToast(container, "아이콘이 변경되었습니다.");
          renderCatList();
        });
      });
    });

    listBox.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm("이 카테고리를 정말 삭제하시겠습니까? 삭제 시 기존 거래들은 '기타'로 변경됩니다.")) {
          const res = store.deleteCategory(id);
          if (res.success) {
            showToast(container, "카테고리가 삭제되었습니다.");
            renderCatList();
          } else {
            alert(res.message);
          }
        }
      });
    });
  };

  renderCatList();

  container.querySelector('#form-add-category').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#new-cat-name').value;

    const res = store.addCategory(name, selectedEmoji);
    if (res.success) {
      showToast(container, "새 카테고리가 추가되었습니다.");
      e.target.reset();
      
      // 상태 초기화
      selectedEmoji = "🎈";
      formEmojiBtn.textContent = selectedEmoji;

      renderCatList();
    } else {
      alert(res.message);
    }
  });
}

// ⚙️ [마이 탭] 렌더러 (Firebase 자격증명 관리 창 탑재)
export function renderMyTab(userId, container) {
  const data = store.data;
  const isA = userId === 'user_a';
  const partnerId = userId === 'user_a' ? 'user_b' : 'user_a';
  const partnerName = data.users[partnerId]?.name || "상대방";

  assetSubViewState[userId] = { mode: 'list', editId: null, detailId: null };
  txSubViewState[userId] = { mode: 'list' };

  if (store.data.status === 'landing') {
    renderLandingScreen(userId, container);
    return;
  }

  // Firebase 활성화 상태 배지
  const isFirebaseSyncActive = store.syncManager.isActive();
  const syncBadge = isFirebaseSyncActive 
    ? `<span class="sticker mint" style="margin-bottom:0; font-size:0.75rem;">실시간 연동 완료 📡</span>` 
    : `<span class="sticker yellow" style="margin-bottom:0; font-size:0.75rem;">오프라인 (로컬 모드) 🔒</span>`;

  // 모바일 1인 기기 뷰포트로 각각 접속할 수 있는 실주소 계산
  const baseLink = window.location.origin + window.location.pathname;
  const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  container.innerHTML = `
    <!-- 1. 공유 지갑 정보 -->
    <div class="setting-section-title">투포켓 공유 정보</div>
    <div class="cute-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">투포켓 코드</span>
          <span class="setting-sub" style="font-weight: 700; color: var(--color-blue); font-size: 0.95rem;">${data.invitationCode}</span>
        </div>
        <button class="cute-btn cute-btn-sm secondary" id="btn-copy-wallet-code-my">복사</button>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">지갑 멤버 목록</span>
          <span class="setting-sub">
            A: ${data.users.A.name} (관리자) ${!isA && data.status === 'active' ? `<button class="cute-btn cute-btn-sm secondary" id="btn-show-partner-pin" style="display:inline-block; font-size:0.65rem; padding: 2px 6px; margin-left: 6px; background-color: var(--color-pink-bg); color: var(--color-pink); border:none; vertical-align:middle;">PIN 확인</button>` : ''}<br>
            B: ${data.status === 'active' ? `${data.users.B.name} ${isA ? `<button class="cute-btn cute-btn-sm secondary" id="btn-show-partner-pin" style="display:inline-block; font-size:0.65rem; padding: 2px 6px; margin-left: 6px; background-color: var(--color-green-bg); color: var(--color-green); border:none; vertical-align:middle;">PIN 확인</button>` : ''}` : '초대 대기 중'}
          </span>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">내 개인 비밀번호</span>
          <span class="setting-sub">정보 복원(재로그인) 시 본인 확인을 위해 사용하는 4자리 PIN</span>
        </div>
        <button class="cute-btn cute-btn-sm secondary" id="btn-change-my-pin">변경</button>
      </div>
    </div>

    ${isLocalEnv ? `
    <!-- 2. Firebase 실시간 무선 동기화 셋팅 영역 -->
    <div class="setting-section-title">실시간 무선 동기화 (Firebase Cloud)</div>
    <div class="cute-card" style="border-color: ${isFirebaseSyncActive ? 'var(--color-green)' : 'var(--color-border)'}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-weight:700; font-size:0.9rem;">클라우드 데이터 무선 연동</span>
        ${syncBadge}
      </div>
      
      <p style="font-size:0.75rem; color:var(--color-text-light); line-height:1.5; margin-bottom:14px;">
        각자의 스마트폰에서 동일한 가계부를 실시간으로 공유하려면, Firebase 콘솔에서 발급받은 <strong>웹 자격증명 JSON</strong>을 입력창에 등록하세요.
      </p>

      <textarea class="cute-textarea" id="textarea-firebase-config-${userId}" placeholder='{
  "apiKey": "AIzaSy...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}' style="font-family: monospace; font-size: 0.72rem; height: 110px; margin-bottom:12px; line-height:1.3;">${data.firebaseConfig ? JSON.stringify(data.firebaseConfig, null, 2) : ''}</textarea>

      <div style="display:flex; gap:6px; margin-bottom:16px;">
        <button class="cute-btn primary cute-btn-sm" id="btn-save-firebase-${userId}" style="flex:2; font-size:0.78rem;">동기화 활성화</button>
        <button class="cute-btn neutral cute-btn-sm" id="btn-clear-firebase-${userId}" style="flex:1; color:var(--color-red); font-size:0.78rem;">연동 해제</button>
      </div>

      <button class="cute-btn secondary cute-btn-sm" id="btn-fill-demo-firebase-${userId}" style="width:100%; font-size:0.75rem; background-color: var(--color-blue-bg); margin-bottom:12px;">
        💡 테스트용 공용 데모 계정으로 자동 입력
      </button>

      ${isFirebaseSyncActive ? `
      <div style="background:#FAFBFB; border: 1px dashed var(--color-border); padding: 10px; border-radius: var(--border-radius-md); font-size:0.72rem; line-height:1.5;">
        <strong>📱 폰 접속 공유 링크:</strong><br>
        <a href="${baseLink}" target="_blank" style="color:var(--color-blue); text-decoration:underline; word-break:break-all;">${baseLink}</a><br>
        - 동기화 후 파트너가 최초 접속하면 자동으로 <strong>'몽글이'</strong> 역할이 기기에 귀속됩니다.
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- 3. 지갑 관리 및 데이터 백업 -->
    <div class="setting-section-title">데이터 및 연동 관리</div>
    <div class="cute-card">
      <!-- 엑셀 백업하기 -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">엑셀(CSV) 백업 받기</span>
          <span class="setting-sub">현재 가계부의 전체 내역을 엑셀로 열 수 있는 CSV로 다운로드합니다.</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <button class="cute-btn primary cute-btn-sm" id="btn-backup-csv" style="padding: 6px 12px; font-size:0.8rem;">내보내기</button>
          <button class="cute-btn neutral cute-btn-sm" id="btn-download-template" style="padding: 4px 8px; font-size:0.7rem;">템플릿 받기</button>
        </div>
      </div>

      <!-- 엑셀 파일로 가져오기/복구 -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">엑셀(CSV) 파일로 복구</span>
          <span class="setting-sub">저장해 둔 엑셀(CSV) 백업 파일을 가져와서 가계부 상태를 덮어씁니다.</span>
        </div>
        <input type="file" id="input-restore-csv-${userId}" accept=".csv" style="display:none;">
        <button class="cute-btn secondary cute-btn-sm" id="btn-trigger-restore">가져오기</button>
      </div>

      <!-- 연결 끊기 -->
      ${data.status === 'active' ? `
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">투포켓 지갑 공유 해제</span>
          <span class="setting-sub">상대방과의 지갑 연동을 즉시 해제합니다.</span>
        </div>
        <button class="cute-btn cute-btn-sm" id="btn-my-disconnect" style="background-color: var(--color-red-bg); color: var(--color-red);">연결 끊기</button>
      </div>
      ` : ''}

      <!-- 초기화 -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">전체 데이터 초기화</span>
          <span class="setting-sub">모든 설정을 초기 상태로 완전히 초기화합니다.</span>
        </div>
        <button class="cute-btn neutral cute-btn-sm" id="btn-my-reset" style="color: var(--color-red);">전체 초기화</button>
      </div>
    </div>
  `;

  // --- 이벤트 리스너 바인딩 ---

  // 로컬 환경일 때만 Firebase 셋팅 관련 버튼 리스너 바인딩
  if (isLocalEnv) {
    const txtConfig = container.querySelector(`#textarea-firebase-config-${userId}`);
    
    container.querySelector(`#btn-save-firebase-${userId}`).addEventListener('click', () => {
      const rawVal = txtConfig.value.trim();
      if (!rawVal) {
        alert("Firebase Config JSON 코드를 입력해 주세요.");
        return;
      }
      try {
        const parsedConfig = JSON.parse(rawVal);
        const res = store.setupFirebase(parsedConfig);
        if (res.success) {
          alert(res.message);
          window.location.reload();
        } else {
          alert(res.message);
        }
      } catch (e) {
        alert("올바른 JSON 형식이 아닙니다. 입력값을 확인해 주세요.");
      }
    });

    container.querySelector(`#btn-clear-firebase-${userId}`).addEventListener('click', () => {
      if (confirm("클라우드 실시간 동기화를 끄고 로컬 모드로 복귀하시겠습니까? (로컬의 데이터는 유지됩니다)")) {
        store.setupFirebase(null);
        alert("실시간 동기화가 해제되고 기기 로컬 모드로 전환되었습니다.");
        window.location.reload();
      }
    });

    container.querySelector(`#btn-fill-demo-firebase-${userId}`).addEventListener('click', () => {
      const demoConfig = {
        apiKey: "AIzaSyAs1-U90kDemoTwoPocketCloudKeyMockUp",
        authDomain: "two-pocket-demo.firebaseapp.com",
        projectId: "two-pocket-demo",
        storageBucket: "two-pocket-demo.appspot.com",
        messagingSenderId: "987654321012",
        appId: "1:987654321012:web:demo123456789abcde"
      };
      txtConfig.value = JSON.stringify(demoConfig, null, 2);
      showToast(container, "데모 계정 설정이 임시 작성되었습니다.");
    });
  }

  // 투포켓 코드 복사 버튼 리스너
  container.querySelector('#btn-copy-wallet-code-my').addEventListener('click', () => {
    navigator.clipboard.writeText(data.invitationCode).then(() => {
      showToast(container, "투포켓 코드가 복사되었습니다.");
    });
  });

  container.querySelector('#btn-backup-csv').addEventListener('click', () => {
    const csvContent = store.exportToCSV();
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `two-pocket-backup-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast(container, "엑셀(CSV) 백업 파일이 다운로드되었습니다.");
  });

  container.querySelector('#btn-download-template').addEventListener('click', () => {
    const templateContent = [
      "[자산 목록]",
      "자산이름,유형,금액,공개여부(Y/N),합산제외(Y/N),메모,소유주(동글이/몽글이)",
      "카카오뱅크 통장,saving,1000000,Y,N,비상금 주머니,동글이",
      "주머니 현금,cash,30000,Y,N,지갑 안 현금,몽글이",
      "",
      "[거래 내역]",
      "날짜,구분(지출/수입/이체),금액,내용,카테고리,연동자산이름,받는자산이름(이체시),소유주(동글이/몽글이),공개여부(Y/N)",
      "2026-07-13,지출,15000,마트 장보기,식비,카카오뱅크 통장,,동글이,Y",
      "2026-07-13,이체,10000,잔액 보정,,카카오뱅크 통장,주머니 현금,동글이,Y"
    ].join("\n");

    const blob = new Blob(["\ufeff" + templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", "two-pocket-excel-template.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    showToast(container, "엑셀 템플릿 양식이 다운로드되었습니다.");
  });

  const fileInput = container.querySelector(`#input-restore-csv-${userId}`);
  const triggerBtn = container.querySelector('#btn-trigger-restore');

  triggerBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target.result;
      const res = store.importFromCSV(csvText);
      if (res.success) {
        alert(`복구가 완료되었습니다!\n\n- 복구된 자산 수: ${res.assetsCount}개\n- 복구된 거래 수: ${res.txsCount}개`);
        window.location.reload();
      } else {
        alert(`가져오기에 실패했습니다: ${res.message}`);
      }
    };
    reader.readAsText(file, "UTF-8");
  });

  const disconnectBtn = container.querySelector('#btn-my-disconnect');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      if (confirm(`${partnerName}님과의 지갑 공유 연결을 해제하시겠습니까? 해제 시 공동 기록은 리셋됩니다.`)) {
        store.disconnectWallet();
        showToast(container, "지갑 연동이 해제되었습니다.");
      }
    });
  }

  container.querySelector('#btn-my-reset').addEventListener('click', () => {
    if (confirm("모든 데이터를 초기 상태로 완전히 포맷하시겠습니까?")) {
      store.reset();
      showToast(container, "가계부 데이터가 완전히 초기화되었습니다.");
    }
  });

  // 🔒 1) 상대방 핀번호 확인/원격 초기화 리스너
  const showPartnerPinBtn = container.querySelector('#btn-show-partner-pin');
  if (showPartnerPinBtn) {
    showPartnerPinBtn.addEventListener('click', () => {
      const partnerRole = isA ? 'user_b' : 'user_a';
      const res = store.resetPartnerPin(partnerRole); // PIN 조회
      
      const pinAlertModal = document.createElement('div');
      pinAlertModal.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.45); display: flex; align-items: center;
        justify-content: center; z-index: 10005; padding: 20px;
        backdrop-filter: blur(4px);
      `;
      
      pinAlertModal.innerHTML = `
        <div class="cute-card" style="width: 100%; max-width: 310px; background: white; margin-bottom: 0; text-align: center; animation: bounce-cute 0.25s forwards;">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">🔑</div>
          <h4 style="margin-bottom: 4px; font-weight:700; font-size: 1.1rem; color:var(--color-text);">${partnerName} PIN 확인</h4>
          <p style="font-size: 0.8rem; color: var(--color-text-light); line-height: 1.4; margin-bottom: 20px;">
            상대방의 현재 개인 비밀번호는 <br>
            <strong style="font-size:1.3rem; color:var(--color-blue); letter-spacing:2px; display:block; margin: 8px 0;">${res.pin}</strong> 입니다.
          </p>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="cute-btn secondary cute-btn-sm" id="btn-partner-pin-reset" style="width: 100%; background-color: var(--color-red-bg); color:var(--color-red); border:none;">0000으로 비밀번호 초기화</button>
            <button class="cute-btn neutral cute-btn-sm" id="btn-partner-pin-close" style="width: 100%;">닫기</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(pinAlertModal);
      
      pinAlertModal.querySelector('#btn-partner-pin-reset').addEventListener('click', () => {
        if (confirm(`${partnerName}님의 비밀번호를 '0000'으로 강제 초기화하시겠습니까?`)) {
          store.resetPartnerPin(partnerRole, '0000');
          alert("비밀번호가 '0000'으로 초기화되었습니다.");
          pinAlertModal.remove();
          renderMyTab(userId, container); // 화면 새로고침
        }
      });
      
      pinAlertModal.querySelector('#btn-partner-pin-close').addEventListener('click', () => {
        pinAlertModal.remove();
      });
    });
  }

  // 🔒 2) 내 비밀번호 변경 리스너
  container.querySelector('#btn-change-my-pin').addEventListener('click', () => {
    const myRole = isA ? 'A' : 'B';
    const currentPin = data.users[myRole].pin;
    
    const changePinModal = document.createElement('div');
    changePinModal.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.45); display: flex; align-items: center;
      justify-content: center; z-index: 10005; padding: 20px;
      backdrop-filter: blur(4px);
    `;
    
    changePinModal.innerHTML = `
      <div class="cute-card" style="width: 100%; max-width: 310px; background: white; margin-bottom: 0; text-align: center; animation: bounce-cute 0.25s forwards;">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">🔒</div>
        <h4 style="margin-bottom: 4px; font-weight:700; font-size: 1.1rem; color:var(--color-text);">내 비밀번호 변경</h4>
        <p style="font-size: 0.78rem; color: var(--color-text-light); line-height: 1.4; margin-bottom: 16px;">
          본인 확인 및 변경할 새 비밀번호를 입력하세요.
        </p>

        <input type="password" class="cute-input" id="input-my-old-pin" placeholder="기존 비밀번호 4자리" maxlength="4" pattern="[0-8]*" inputmode="numeric" style="text-align: center; font-size:0.95rem; letter-spacing:4px; margin-bottom:8px;">
        <input type="password" class="cute-input" id="input-my-new-pin" placeholder="새 비밀번호 4자리" maxlength="4" pattern="[0-8]*" inputmode="numeric" style="text-align: center; font-size:0.95rem; letter-spacing:4px; margin-bottom:12px;">

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="cute-btn primary cute-btn-sm" id="btn-change-pin-confirm" style="width: 100%;">비밀번호 변경</button>
          <button class="cute-btn neutral cute-btn-sm" id="btn-change-pin-close" style="width: 100%;">취소</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(changePinModal);
    
    changePinModal.querySelector('#btn-change-pin-confirm').addEventListener('click', () => {
      const oldPin = changePinModal.querySelector('#input-my-old-pin').value.trim();
      const newPin = changePinModal.querySelector('#input-my-new-pin').value.trim();
      
      if (oldPin !== currentPin) {
        alert("기존 비밀번호가 일치하지 않습니다.");
        return;
      }
      if (newPin.length !== 4 || isNaN(Number(newPin))) {
        alert("새 비밀번호는 숫자 4자리로 정확히 입력해 주세요.");
        return;
      }
      
      store.updateMyPin(newPin);
      alert("개인 비밀번호가 성공적으로 변경되었습니다.");
      changePinModal.remove();
      renderMyTab(userId, container);
    });
    
    changePinModal.querySelector('#btn-change-pin-close').addEventListener('click', () => {
      changePinModal.remove();
    });
  });
}
