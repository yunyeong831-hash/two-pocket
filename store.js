// 공동가계부 로컬 상태 관리 및 데이터 레이어 (store.js)

const STORAGE_KEY = 'joint_wallet_data';

// 📡 사용자님의 진짜 Firebase 클라우드 서버 설정 정보 (기본 빌트인 내장)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAhW48DE-CVYi1KOy9MIhpklvAKOlTLcM4",
  authDomain: "two-pocket-94d21.firebaseapp.com",
  projectId: "two-pocket-94d21",
  storageBucket: "two-pocket-94d21.firebasestorage.app",
  messagingSenderId: "699385640372",
  appId: "1:699385640372:web:5bd41aab2c8bae5730aee1"
};

const DEFAULT_CATEGORIES = [
  { id: "food", name: "식비", emoji: "🍔" },
  { id: "living", name: "생활", emoji: "🧼" },
  { id: "trans", name: "교통", emoji: "🚌" },
  { id: "culture", name: "문화/여가", emoji: "🎬" },
  { id: "etc", name: "기타", emoji: "🎈" }
];

const INITIAL_DATA = {
  walletName: "우리들의 투포켓 지갑",
  status: "landing", 
  invitationCode: "",
  invitationExpiredAt: "",
  
  users: {
    A: { id: "user_a", name: "동글이", role: "admin", color: "pink", pin: "" }, // pin 추가
    B: { id: "user_b", name: "몽글이", role: "member", color: "mint", pin: "" } // pin 추가
  },

  categories: [...DEFAULT_CATEGORIES],
  assets: [], 
  transactions: [], 

  settings: {
    includeHiddenTxInSummary: true
  },

  firebaseConfig: DEFAULT_FIREBASE_CONFIG, 
  walletId: null,
  myUserId: null 
};

// 🌐 Firebase Firestore 실시간 동기화 브릿지 매니저
class FirebaseSyncManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.active = false;
    this.unsubscribers = [];
  }

  init(config) {
    if (!config) return false;
    if (config.apiKey && config.apiKey.includes("MockUp")) {
      this.active = true;
      this.isMockDemo = true;
      console.log("투포켓 가상 데모 클라우드 채널이 활성화되었습니다!");
      return true;
    }

    try {
      if (typeof window === 'undefined' || !window.firebase) {
        console.warn("Firebase SDK가 감지되지 않았습니다.");
        return false;
      }
      
      const appName = "two_pocket_app";
      const existingApp = window.firebase.apps.find(a => a.name === appName);
      if (existingApp) {
        this.app = existingApp;
      } else {
        this.app = window.firebase.initializeApp(config, appName);
      }
      
      this.db = this.app.firestore();
      this.active = true;
      this.isMockDemo = false;
      console.log("Firebase Firestore 실시간 동기화 가동 완료!");
      return true;
    } catch (err) {
      console.error("Firebase 초기화 에러:", err);
      this.active = false;
      return false;
    }
  }

  isActive() {
    return this.active && (this.isMockDemo || this.db !== null);
  }

  disconnect() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.active = false;
    this.db = null;
    this.app = null;
    this.isMockDemo = false;
  }

  subscribe(walletId, onWalletUpdate, onAssetsUpdate, onTxsUpdate) {
    if (!this.isActive() || this.isMockDemo || !walletId) return;

    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    const unsubWallet = this.db.collection('wallets').doc(walletId).onSnapshot(doc => {
      if (doc.exists) {
        onWalletUpdate(doc.data());
      }
    }, err => console.error("지갑 정보 구독 에러 (Rules 설정을 확인하세요):", err));
    this.unsubscribers.push(unsubWallet);

    const unsubAssets = this.db.collection('wallets').doc(walletId).collection('assets').onSnapshot(snap => {
      const assets = [];
      snap.forEach(doc => {
        assets.push({ id: doc.id, ...doc.data() });
      });
      onAssetsUpdate(assets);
    }, err => console.error("자산 목록 구독 에러 (Rules 설정을 확인하세요):", err));
    this.unsubscribers.push(unsubAssets);

    const unsubTxs = this.db.collection('wallets').doc(walletId).collection('transactions').onSnapshot(snap => {
      const txs = [];
      snap.forEach(doc => {
        txs.push({ id: doc.id, ...doc.data() });
      });
      txs.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
      onTxsUpdate(txs);
    }, err => console.error("거래 내역 구독 에러 (Rules 설정을 확인하세요):", err));
    this.unsubscribers.push(unsubTxs);
  }

  async uploadInitialWallet(walletId, walletData, assets, txs) {
    if (!this.isActive() || this.isMockDemo) return;
    try {
      const walletRef = this.db.collection('wallets').doc(walletId);
      
      await walletRef.set({
        walletName: walletData.walletName,
        status: walletData.status,
        invitationCode: walletData.invitationCode,
        invitationExpiredAt: walletData.invitationExpiredAt,
        users: walletData.users,
        categories: walletData.categories,
        settings: walletData.settings,
        createdAt: new Date().toISOString()
      });

      const assetPromises = assets.map(a => {
        return walletRef.collection('assets').doc(a.id).set({
          userId: a.userId,
          name: a.name,
          type: a.type,
          amount: a.amount,
          currency: a.currency || "KRW",
          isShared: a.isShared,
          hideFromTotal: a.hideFromTotal,
          memo: a.memo || "",
          updatedAt: a.updatedAt || new Date().toISOString()
        });
      });
      await Promise.all(assetPromises);

      const txPromises = txs.map(t => {
        return walletRef.collection('transactions').doc(t.id).set({
          userId: t.userId,
          type: t.type,
          category: t.category,
          amount: t.amount,
          date: t.date,
          memo: t.memo || "",
          isShared: t.isShared,
          includeInSummary: t.includeInSummary,
          linkedAssetId: t.linkedAssetId || null,
          targetAssetId: t.targetAssetId || null,
          receipts: t.receipts || []
        });
      });
      await Promise.all(txPromises);

      console.log("Firestore 데이터 최초 업로드 성공!");
    } catch (e) {
      console.error("Firestore 초기 업로드 실패 (구글 콘솔 Rules 설정을 허용해 주세요):", e);
    }
  }

  async saveDocument(walletId, collectionName, docId, data) {
    if (!this.isActive() || this.isMockDemo || !walletId) return;
    try {
      await this.db.collection('wallets').doc(walletId).collection(collectionName).doc(docId).set(data, { merge: true });
    } catch (e) {
      console.error(`Firestore 저장 에러 (${collectionName}):`, e);
    }
  }

  async deleteDocument(walletId, collectionName, docId) {
    if (!this.isActive() || this.isMockDemo || !walletId) return;
    try {
      await this.db.collection('wallets').doc(walletId).collection(collectionName).doc(docId).delete();
    } catch (e) {
      console.error(`Firestore 삭제 에러 (${collectionName}):`, e);
    }
  }

  async updateWalletMeta(walletId, data) {
    if (!this.isActive() || this.isMockDemo || !walletId) return;
    try {
      await this.db.collection('wallets').doc(walletId).update(data);
    } catch (e) {
      console.error("Firestore 지갑 메타 갱신 에러:", e);
    }
  }
}

class JointWalletStore {
  constructor() {
    this.data = this._load();
    this.listeners = [];
    this.syncManager = new FirebaseSyncManager();

    if (!this.data.firebaseConfig) {
      this.data.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
      this._save();
    }

    if (this.data.firebaseConfig) {
      const initialized = this.syncManager.init(this.data.firebaseConfig);
      if (initialized && this.data.walletId) {
        this._startFirebaseSync();
      }
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        console.log("다른 탭에서 변경된 로컬 데이터를 수신하여 실시간 새로고침합니다.");
        this.data = this._load();
        this.listeners.forEach(l => l(this.data));
      }
    });
  }

  _load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const freshData = JSON.parse(JSON.stringify(INITIAL_DATA));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
      return freshData;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.categories) {
        parsed.categories = [...DEFAULT_CATEGORIES];
      }
      if (!parsed.firebaseConfig) {
        parsed.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
      }
      return parsed;
    } catch (e) {
      console.error("데이터 로드 오류", e);
      return JSON.parse(JSON.stringify(INITIAL_DATA));
    }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.listeners.forEach(l => l(this.data));
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  reset() {
    this.syncManager.disconnect();
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.data.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
    this._save();
    
    this.syncManager.init(DEFAULT_FIREBASE_CONFIG);
  }

  getMyUserId() {
    return this.data.myUserId;
  }

  setupFirebase(config) {
    if (!config) {
      this.syncManager.disconnect();
      this.data.firebaseConfig = null;
      this.data.walletId = null;
      this._save();
      return { success: true, message: "동기화가 비활성화되었습니다." };
    }

    const success = this.syncManager.init(config);
    if (success) {
      this.data.firebaseConfig = config;
      if (!this.data.walletId) {
        this.data.walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      }
      this._save();
      
      this._startFirebaseSync();

      if (this.data.status === 'active' || this.data.status === 'waiting_invitation') {
        this.syncManager.uploadInitialWallet(
          this.data.walletId, 
          this.data, 
          this.data.assets, 
          this.data.transactions
        );
      }

      return { success: true, message: "Firebase 동기화가 활성화되었습니다!" };
    } else {
      return { success: false, message: "Firebase 자격증명이 올바르지 않거나 오류가 발생했습니다." };
    }
  }

  _startFirebaseSync() {
    if (!this.syncManager.isActive() || this.syncManager.isMockDemo || !this.data.walletId) return;

    this.syncManager.subscribe(
      this.data.walletId,
      (walletMeta) => {
        this.data.walletName = walletMeta.walletName;
        this.data.status = walletMeta.status;
        this.data.invitationCode = walletMeta.invitationCode;
        this.data.invitationExpiredAt = walletMeta.invitationExpiredAt;
        this.data.users = walletMeta.users;
        this.data.categories = walletMeta.categories || DEFAULT_CATEGORIES;
        this.data.settings = walletMeta.settings;
        this._save();
      },
      (assets) => {
        this.data.assets = assets;
        this._save();
      },
      (txs) => {
        this.data.transactions = txs;
        this._save();
      }
    );
  }

  // 📝 4자리 PIN 저장 연동 개설 기능
  createWallet(creatorName = "동글이", pin = "0000") {
    this.data.myUserId = "user_a";
    this.data.users.A.name = creatorName;
    this.data.users.A.pin = pin; // 핀번호 기입
    this.data.status = "waiting_invitation";
    this.data.walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.data.assets = []; 
    this.data.transactions = []; 
    this.regenerateInvitation();

    if (this.syncManager.isActive()) {
      this.syncManager.uploadInitialWallet(this.data.walletId, this.data, this.data.assets, this.data.transactions);
    }
  }

  joinAsPartner(partnerName = "몽글이") {
    this.data.myUserId = "user_b";
    this.data.users.B.name = partnerName;
    this.data.status = "waiting_invitation";
    this._save();
  }

  // 🔒 내 비밀번호 변경 API
  updateMyPin(newPin) {
    const isA = this.data.myUserId === 'user_a';
    if (isA) {
      this.data.users.A.pin = newPin;
    } else {
      this.data.users.B.pin = newPin;
    }
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.updateWalletMeta(this.data.walletId, { users: this.data.users });
    }
  }

  // 🔒 파트너 핀번호 확인/원격 초기화 API
  resetPartnerPin(partnerRole, newPin = null) {
    const isPartnerA = partnerRole === 'user_a';
    const targetKey = isPartnerA ? 'A' : 'B';
    
    if (newPin) {
      this.data.users[targetKey].pin = newPin;
      this._save();
      if (this.syncManager.isActive()) {
        this.syncManager.updateWalletMeta(this.data.walletId, { users: this.data.users });
      }
      return { success: true, message: "비밀번호가 성공적으로 초기화되었습니다." };
    }
    
    // 단순 조회
    return { success: true, pin: this.data.users[targetKey].pin };
  }

  updateWalletName(newName) {
    this.data.walletName = newName;
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.updateWalletMeta(this.data.walletId, { walletName: newName });
    }
  }

  regenerateInvitation() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.data.invitationCode = `SWEET-${code}`;
    this.data.invitationExpiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.updateWalletMeta(this.data.walletId, {
        invitationCode: this.data.invitationCode,
        invitationExpiredAt: this.data.invitationExpiredAt
      });
    }
  }

  // 🔒 acceptInvitation에서 핀번호 및 몽글이 신규 가입 닉네임과 PIN 셋업
  async acceptInvitation(code, chosenRole = null, chosenPin = null, partnerName = null, partnerPin = null) {
    const cleanCode = code.trim().toUpperCase();
    const storedCode = (this.data.invitationCode || "").trim().toUpperCase();

    console.log("초대 코드 검증 시도:", { 입력값: cleanCode, 지정역할: chosenRole, 제공핀: chosenPin, 신규참여자: partnerName });

    // 1) 로컬 오프라인 매칭 (두 탭 간 LocalStorage 공유 시)
    if (!chosenRole && storedCode && storedCode === cleanCode) {
      if (this.data.status === 'active') {
        return { status: 'require_role_choice', dbData: this.data };
      }
      this.data.myUserId = "user_b";
      this.data.users.B.name = partnerName || "몽글이";
      this.data.users.B.pin = partnerPin || "0000";
      this.data.status = 'active';
      this._save();

      if (this.syncManager.isActive()) {
        await this.syncManager.updateWalletMeta(this.data.walletId, { 
          status: 'active',
          users: this.data.users
        });
      }
      return { status: 'success' };
    }

    // 로컬 모드 역할 복원 시 PIN 검증
    if (chosenRole && storedCode && storedCode === cleanCode) {
      const storedPin = this.data.users[chosenRole === 'user_a' ? 'A' : 'B'].pin || "";
      if (chosenPin !== null && storedPin !== chosenPin) {
        return { status: 'pin_failed' };
      }
      this.data.myUserId = chosenRole;
      this.data.status = 'active';
      this._save();
      return { status: 'success' };
    }

    // 2) Firebase 활성화 상태 실제 데이터베이스 쿼리
    if (this.syncManager.isActive() && !this.syncManager.isMockDemo) {
      try {
        console.log("Firestore에서 초대 코드로 지갑 찾는 중...", cleanCode);
        const querySnap = await this.syncManager.db.collection('wallets')
          .where('invitationCode', '==', cleanCode)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const matchedDoc = querySnap.docs[0];
          const matchedWalletId = matchedDoc.id;
          const dbData = matchedDoc.data();
          const dbUsers = dbData.users || {};

          // A. 역할 복원 시도 케이스 (재로그인)
          if (chosenRole) {
            const storedPin = dbUsers[chosenRole === 'user_a' ? 'A' : 'B']?.pin || "";
            if (chosenPin !== null && storedPin !== chosenPin) {
              return { status: 'pin_failed' };
            }

            this.data.walletId = matchedWalletId;
            this.data.myUserId = chosenRole;
            this.data.status = 'active';
            this.data.walletName = dbData.walletName || this.data.walletName;
            this.data.users = dbData.users || this.data.users;
            this.data.categories = dbData.categories || this.data.categories;
            
            this._save();
            this._startFirebaseSync();
            return { status: 'success' };
          }

          // B. 이미 활성화(active)된 지갑방인데 역할 지정 없이 처음 노크한 경우 ➔ 복원 역할 선택 호출
          if (dbData.status === 'active') {
            return { status: 'require_role_choice', dbData: dbData };
          }

          // C. 신규 조인 참여(몽글이 가입 단계)
          this.data.walletId = matchedWalletId;
          this.data.status = 'active';
          this.data.myUserId = "user_b";
          
          if (dbUsers.B) {
            dbUsers.B.name = partnerName || "몽글이";
            dbUsers.B.pin = partnerPin || "0000";
          }
          
          await this.syncManager.db.collection('wallets').doc(matchedWalletId).update({
            status: 'active',
            users: dbUsers
          });

          this.data.users = dbUsers;
          this._save();
          this._startFirebaseSync();
          return { status: 'success' };
        } else {
          console.warn("Firestore에서 일치하는 초대 코드를 찾지 못했습니다.");
        }
      } catch (err) {
        console.error("Firebase 초대장 매칭 조회 실패 상세 에러:", err);
      }
    }

    return { status: 'failed' };
  }

  disconnectWallet() {
    this.syncManager.disconnect();
    this.data.status = 'landing'; 
    this.data.transactions = [];
    this.data.assets = [];
    this.data.walletId = null;
    this.data.myUserId = null;
    this.data.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
    this._save();

    this.syncManager.init(DEFAULT_FIREBASE_CONFIG);
  }

  getCategories() {
    return this.data.categories || DEFAULT_CATEGORIES;
  }

  addCategory(name, emoji = "🎈") {
    const current = this.getCategories();
    if (current.length >= 10) {
      return { success: false, message: "카테고리는 최대 10개까지만 만들 수 있어요." };
    }
    const cleanName = name.trim();
    if (!cleanName) {
      return { success: false, message: "카테고리 이름을 입력해 주세요." };
    }
    if (current.some(c => c.name === cleanName)) {
      return { success: false, message: "이미 동일한 이름의 카테고리가 있어요." };
    }

    const newCat = {
      id: `cat_${Date.now()}`,
      name: cleanName,
      emoji
    };

    this.data.categories.push(newCat);
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.updateWalletMeta(this.data.walletId, { categories: this.data.categories });
    }

    return { success: true, category: newCat };
  }

  updateCategory(catId, fields) {
    const idx = this.data.categories.findIndex(c => c.id === catId);
    if (idx !== -1) {
      this.data.categories[idx] = {
        ...this.data.categories[idx],
        ...fields
      };
      this._save();

      if (this.syncManager.isActive()) {
        this.syncManager.updateWalletMeta(this.data.walletId, { categories: this.data.categories });
      }
      return { success: true };
    }
    return { success: false, message: "카테고리를 찾을 수 없습니다." };
  }

  deleteCategory(catId) {
    if (catId === 'etc') {
      return { success: false, message: "기본 기타 카테고리는 삭제할 수 없어요." };
    }
    this.data.categories = this.data.categories.filter(c => c.id !== catId);
    this.data.transactions.forEach(tx => {
      if (tx.category === catId) {
        tx.category = 'etc';
        if (this.syncManager.isActive()) {
          this.syncManager.saveDocument(this.data.walletId, 'transactions', tx.id, tx);
        }
      }
    });
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.updateWalletMeta(this.data.walletId, { categories: this.data.categories });
    }

    return { success: true };
  }

  getAssets(targetUserId, viewerUserId) {
    return this.data.assets.filter(asset => {
      if (asset.userId === viewerUserId) return true;
      return asset.isShared;
    });
  }

  addAsset(userId, { name, type, amount, isShared, hideFromTotal, memo }) {
    const newAsset = {
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      name: name || "이름 없는 저금통",
      type,
      amount: Number(amount) || 0,
      isShared: isShared !== undefined ? isShared : true,
      hideFromTotal: hideFromTotal !== undefined ? hideFromTotal : false,
      memo: memo || "",
      updatedAt: new Date().toISOString()
    };
    this.data.assets.push(newAsset);
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.saveDocument(this.data.walletId, 'assets', newAsset.id, newAsset);
    }

    return newAsset;
  }

  updateAsset(assetId, fields, includeInSummary = null) {
    const idx = this.data.assets.findIndex(a => a.id === assetId);
    if (idx !== -1) {
      const asset = this.data.assets[idx];
      const oldAmount = asset.amount;
      const newAmount = fields.amount !== undefined ? Number(fields.amount) : oldAmount;
      const diff = newAmount - oldAmount;

      const updatedAsset = {
        ...this.data.assets[idx],
        ...fields,
        amount: newAmount,
        updatedAt: new Date().toISOString()
      };

      this.data.assets[idx] = updatedAsset;

      if (this.syncManager.isActive()) {
        this.syncManager.saveDocument(this.data.walletId, 'assets', assetId, updatedAsset);
      }

      if (diff !== 0 && includeInSummary !== null) {
        const type = diff > 0 ? "income" : "expense";
        const cleanDiff = Math.abs(diff);
        
        const newTx = {
          id: `tx_adjust_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          userId: asset.userId,
          type, 
          category: "etc",
          amount: cleanDiff,
          date: new Date().toISOString().split('T')[0],
          memo: `금액 보정 수정 (기존: ₩${new Intl.NumberFormat('ko-KR').format(oldAmount)} → 변경: ₩${new Intl.NumberFormat('ko-KR').format(newAmount)})`,
          isShared: asset.isShared,
          includeInSummary: includeInSummary,
          linkedAssetId: asset.id,
          targetAssetId: null,
          receipts: []
        };
        this.data.transactions.push(newTx);

        if (this.syncManager.isActive()) {
          this.syncManager.saveDocument(this.data.walletId, 'transactions', newTx.id, newTx);
        }
      }

      this._save();
    }
  }

  deleteAsset(assetId) {
    this.data.assets = this.data.assets.filter(a => a.id !== assetId);
    if (this.syncManager.isActive()) {
      this.syncManager.deleteDocument(this.data.walletId, 'assets', assetId);
    }

    this.data.transactions.forEach(t => {
      let changed = false;
      if (t.linkedAssetId === assetId) { t.linkedAssetId = null; changed = true; }
      if (t.targetAssetId === assetId) { t.targetAssetId = null; changed = true; }
      
      if (changed && this.syncManager.isActive()) {
        this.syncManager.saveDocument(this.data.walletId, 'transactions', t.id, t);
      }
    });
    this._save();
  }

  getTransactions(viewerUserId) {
    return this.data.transactions.filter(tx => {
      if (tx.userId === viewerUserId) return true;
      return tx.isShared;
    });
  }

  addTransaction(userId, { type, category, amount, date, memo, isShared, includeInSummary, linkedAssetId, targetAssetId, receipts }) {
    const txAmount = Number(amount) || 0;
    const newTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      type, 
      category: type === 'transfer' ? 'etc' : (category || "etc"), 
      amount: txAmount,
      date: date || new Date().toISOString().split('T')[0],
      memo: memo || "",
      isShared: isShared !== undefined ? isShared : true,
      includeInSummary: includeInSummary !== undefined ? includeInSummary : true,
      linkedAssetId: linkedAssetId || null, 
      targetAssetId: targetAssetId || null, 
      receipts: receipts || []
    };

    this.data.transactions.push(newTx);

    if (this.syncManager.isActive()) {
      this.syncManager.saveDocument(this.data.walletId, 'transactions', newTx.id, newTx);
    }

    if (type === 'transfer') {
      if (linkedAssetId) {
        const fromAsset = this.data.assets.find(a => a.id === linkedAssetId);
        if (fromAsset) {
          this.updateAsset(linkedAssetId, { amount: fromAsset.amount - txAmount }, null);
        }
      }
      if (targetAssetId) {
        const toAsset = this.data.assets.find(a => a.id === targetAssetId);
        if (toAsset) {
          this.updateAsset(targetAssetId, { amount: toAsset.amount + txAmount }, null);
        }
      }
    } else {
      if (linkedAssetId) {
        const asset = this.data.assets.find(a => a.id === linkedAssetId);
        if (asset) {
          let newAmount = asset.amount;
          if (type === 'expense') {
            newAmount -= txAmount;
          } else if (type === 'income') {
            newAmount += txAmount;
          }
          this.updateAsset(linkedAssetId, { amount: newAmount }, null);
        }
      }
    }

    this._save();
    return newTx;
  }

  deleteTransaction(txId) {
    this.data.transactions = this.data.transactions.filter(t => t.id !== txId);
    this._save();

    if (this.syncManager.isActive()) {
      this.syncManager.deleteDocument(this.data.walletId, 'transactions', txId);
    }
  }

  exportToCSV() {
    const csvRows = [];
    csvRows.push("[자산 목록]");
    csvRows.push("자산이름,유형,금액,공개여부(Y/N),합산제외(Y/N),메모,소유주(동글이/몽글이)");
    
    this.data.assets.forEach(a => {
      const owner = a.userId === 'user_a' ? '동글이' : '몽글이';
      const shared = a.isShared ? 'Y' : 'N';
      const hideTotal = a.hideFromTotal ? 'Y' : 'N';
      const name = a.name.replace(/,/g, ' ');
      const memo = (a.memo || "").replace(/,/g, ' ');
      csvRows.push(`${name},${a.type},${a.amount},${shared},${hideTotal},${memo},${owner}`);
    });

    csvRows.push("");

    csvRows.push("[거래 내역]");
    csvRows.push("날짜,구분(지출/수입/이체),금액,내용,카테고리,연동자산이름,받는자산이름(이체시),소유주(동글이/몽글이),공개여부(Y/N)");

    const categories = this.getCategories();
    this.data.transactions.forEach(t => {
      const owner = t.userId === 'user_a' ? '동글이' : '몽글이';
      const shared = t.isShared ? 'Y' : 'N';
      const memo = (t.memo || "").replace(/,/g, ' ');
      const catMeta = categories.find(c => c.id === t.category) || { name: "기타" };
      const fromAsset = this.data.assets.find(a => a.id === t.linkedAssetId)?.name || "";
      const toAsset = this.data.assets.find(a => a.id === t.targetAssetId)?.name || "";
      
      let typeKorean = "지출";
      if (t.type === 'income') typeKorean = "수입";
      if (t.type === 'transfer') typeKorean = "이체";

      csvRows.push(`${t.date},${typeKorean},${t.amount},${memo},${catMeta.name},${fromAsset.replace(/,/g, ' ')},${toAsset.replace(/,/g, ' ')},${owner},${shared}`);
    });

    return csvRows.join("\n");
  }

  importFromCSV(csvText) {
    try {
      const lines = csvText.split(/\r?\n/);
      let currentSection = "";
      const parsedAssets = [];
      const parsedTxs = [];

      const categories = this.getCategories();
      let assetHeaderIndexes = {};
      let txHeaderIndexes = {};

      const parseHeader = (cols, fieldsMap) => {
        const indexes = {};
        cols.forEach((col, idx) => {
          const cleanCol = col.replace(/\(.*\)/, "").trim();
          for (let key in fieldsMap) {
            if (fieldsMap[key].some(alias => cleanCol.includes(alias))) {
              indexes[key] = idx;
            }
          }
        });
        return indexes;
      };

      const assetFields = {
        name: ["자산이름", "자산명", "이름"],
        type: ["유형", "종류", "구분"],
        amount: ["금액", "잔액", "잔고"],
        isShared: ["공개여부", "공유", "공개"],
        hideFromTotal: ["합산제외", "제외"],
        memo: ["메모", "상세"],
        owner: ["소유주", "소유", "작성자"]
      };

      const txFields = {
        date: ["날짜", "일자", "date"],
        type: ["구분", "유형", "type"],
        amount: ["금액", "비용", "amount"],
        memo: ["내용", "메모", "상세", "memo"],
        category: ["카테고리", "분류", "category"],
        fromAsset: ["연동자산", "보내는자산", "출금자산", "자산"],
        toAsset: ["받는자산", "입금자산", "대상자산"],
        owner: ["소유주", "작성자", "소유"],
        isShared: ["공개여부", "공유"]
      };

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line === "[자산 목록]") {
          currentSection = "assets";
          continue;
        } else if (line === "[거래 내역]") {
          currentSection = "txs";
          continue;
        }

        const cols = line.split(",").map(c => c.trim());

        if (currentSection === "assets" && (cols[0].includes("자산") || cols[0].includes("이름"))) {
          assetHeaderIndexes = parseHeader(cols, assetFields);
          continue;
        }
        if (currentSection === "txs" && (cols[0].includes("날짜") || cols[0].includes("일자"))) {
          txHeaderIndexes = parseHeader(cols, txFields);
          continue;
        }

        if (currentSection === "assets") {
          const getVal = (field, defaultIdx) => {
            const idx = assetHeaderIndexes[field] !== undefined ? assetHeaderIndexes[field] : defaultIdx;
            return cols[idx];
          };

          const name = getVal("name", 0);
          if (!name) continue;

          const type = getVal("type", 1) || "saving";
          const amount = Number(getVal("amount", 2)) || 0;
          const isShared = (getVal("isShared", 3) || "Y").toUpperCase() === "Y";
          const hideFromTotal = (getVal("hideFromTotal", 4) || "N").toUpperCase() === "Y";
          const memo = getVal("memo", 5) || "";
          const ownerStr = getVal("owner", 6) || "동글이";
          const userId = ownerStr === "몽글이" ? "user_b" : "user_a";

          parsedAssets.push({
            id: `asset_csv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            userId,
            name,
            type,
            amount,
            isShared,
            hideFromTotal,
            memo,
            updatedAt: new Date().toISOString()
          });
        } 
        
        else if (currentSection === "txs") {
          const getVal = (field, defaultIdx) => {
            const idx = txHeaderIndexes[field] !== undefined ? txHeaderIndexes[field] : defaultIdx;
            return cols[idx];
          };

          const date = getVal("date", 0);
          const typeKorean = getVal("type", 1);
          if (!date || !typeKorean) continue;

          const amount = Number(getVal("amount", 2)) || 0;
          const memo = getVal("memo", 3) || "";
          const catName = getVal("category", 4) || "기타";
          const fromAssetName = getVal("fromAsset", 5) || "";
          const toAssetName = getVal("toAsset", 6) || "";
          const ownerStr = getVal("owner", 7) || "동글이";
          const sharedStr = getVal("isShared", 8) || "Y";

          const userId = ownerStr === "몽글이" ? "user_b" : "user_a";
          const isShared = sharedStr.toUpperCase() === "Y";

          let type = "expense";
          if (typeKorean === "수입") type = "income";
          if (typeKorean === "이체") type = "transfer";

          let category = "etc";
          const catMeta = categories.find(c => c.name === catName);
          if (catMeta) category = catMeta.id;

          parsedTxs.push({
            date,
            type,
            amount,
            memo,
            category,
            fromAssetName,
            toAssetName,
            userId,
            isShared
          });
        }
      }

      if (parsedAssets.length === 0 && parsedTxs.length === 0) {
        return { success: false, message: "파싱할 자산 및 거래 데이터가 존재하지 않습니다." };
      }

      this.data.assets = parsedAssets;

      this.data.transactions = parsedTxs.map(tx => {
        let linkedAssetId = null;
        let targetAssetId = null;

        if (tx.fromAssetName) {
          const matched = parsedAssets.find(a => a.name === tx.fromAssetName);
          if (matched) linkedAssetId = matched.id;
        }
        if (tx.toAssetName) {
          const matched = parsedAssets.find(a => a.name === tx.toAssetName);
          if (matched) targetAssetId = matched.id;
        }

        return {
          id: `tx_csv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          userId: tx.userId,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          date: tx.date,
          memo: tx.memo,
          isShared: tx.isShared,
          includeInSummary: true,
          linkedAssetId,
          targetAssetId,
          receipts: []
        };
      });

      this._save();

      if (this.syncManager.isActive()) {
        this.syncManager.uploadInitialWallet(this.data.walletId, this.data, this.data.assets, this.data.transactions);
      }

      return { success: true, assetsCount: parsedAssets.length, txsCount: parsedTxs.length };

    } catch (err) {
      console.error(err);
      return { success: false, message: `오류가 발생했습니다: ${err.message}` };
    }
  }

  getFinancialSummary(viewerUserId) {
    const myId = viewerUserId;
    const partnerId = viewerUserId === 'user_a' ? 'user_b' : 'user_a';

    const getSum = (userId) => {
      return this.data.assets
        .filter(a => a.userId === userId && (userId === myId || a.isShared))
        .reduce((sum, a) => {
          const val = a.type === 'loan' ? -a.amount : a.amount;
          return sum + val;
        }, 0);
    };

    const myAssetSum = getSum(myId);
    const partnerAssetSum = this.data.status === 'active' ? getSum(partnerId) : 0;

    const totalJointAsset = this.data.assets
      .filter(a => {
        if (a.hideFromTotal) return false;
        if (a.userId === myId) return true;
        return a.isShared;
      })
      .reduce((sum, a) => {
        const val = a.type === 'loan' ? -a.amount : a.amount;
        return sum + val;
      }, 0);

    const currentMonth = new Date().toISOString().substring(0, 7);
    const visibleTxs = this.data.transactions.filter(tx => {
      if (!tx.date.startsWith(currentMonth)) return false;
      if (tx.userId === myId) return true;
      return tx.isShared;
    });

    const myExpenseSum = visibleTxs
      .filter(tx => tx.userId === myId && tx.type === 'expense' && tx.includeInSummary !== false)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const partnerExpenseSum = visibleTxs
      .filter(tx => tx.userId === partnerId && tx.type === 'expense' && tx.includeInSummary !== false)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpenseSum = myExpenseSum + partnerExpenseSum;

    const categoryMap = {};
    visibleTxs
      .filter(tx => tx.type === 'expense' && tx.includeInSummary !== false)
      .forEach(tx => {
        categoryMap[tx.category] = (categoryMap[tx.category] || 0) + tx.amount;
      });

    const allCategories = this.getCategories();
    const categoryStats = Object.keys(categoryMap).map(catId => {
      const catMeta = allCategories.find(c => c.id === catId) || { name: "기타", emoji: "🎈", color: "#00D282" };
      return {
        category: catId,
        name: catMeta.name,
        emoji: catMeta.emoji,
        color: catMeta.color,
        amount: categoryMap[catId],
        ratio: totalExpenseSum > 0 ? Math.round((categoryMap[catId] / totalExpenseSum) * 100) : 0
      };
    }).sort((a,b) => b.amount - a.amount);

    return {
      myAssetSum,
      partnerAssetSum,
      totalJointAsset,
      myExpenseSum,
      partnerExpenseSum,
      totalExpense: totalExpenseSum,
      categoryStats,
      partnerName: this.data.users[partnerId]?.name || "상대방"
    };
  }
}

export const store = new JointWalletStore();
