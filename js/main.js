import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    increment,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Firebase 設定 (ご自身のものに差し替えてください) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- 状態管理用変数 ---
let currentUser = null;
let allEvents = [];
let favoriteEventIds = [];
let likedEventIds = []; // 自分がいいねしたイベントIDのリスト

// --- DOM 要素の取得 ---
const eventList = document.getElementById('event-list');
const loginBtnHeader = document.getElementById('login-btn-header');
const loginModal = document.getElementById('login-modal');
const closeModal = document.querySelector('.close-btn');
const googleLoginBtn = document.getElementById('google-login-btn');

// --- 初期化と認証監視 ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtnHeader.textContent = "マイページ / ログアウト";
        // ユーザーデータの取得（お気に入り・いいねリスト）
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            favoriteEventIds = data.favorites || [];
            likedEventIds = data.likes || [];
        }
    } else {
        loginBtnHeader.textContent = "ログイン / マイページ";
        favoriteEventIds = [];
        likedEventIds = [];
    }
    loadEvents();
});

// --- イベントデータの取得 ---
async function loadEvents() {
    try {
        const q = query(collection(db, "events"), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);
        allEvents = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderEvents();
    } catch (error) {
        console.error("Error loading events:", error);
    }
}

// --- 「いいね」切り替えロジック ---
async function toggleLike(eventId) {
    if (!currentUser) {
        loginModal.style.display = "block";
        return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const eventRef = doc(db, "events", eventId);
    const isAlreadyLiked = likedEventIds.includes(eventId);

    try {
        if (isAlreadyLiked) {
            // 解除: 配列から削除 & カウント-1
            await updateDoc(userRef, { likes: arrayRemove(eventId) });
            await updateDoc(eventRef, { likeCount: increment(-1) });
            likedEventIds = likedEventIds.filter(id => id !== eventId);
        } else {
            // 登録: 配列に追加 & カウント+1
            await setDoc(userRef, { likes: arrayUnion(eventId) }, { merge: true });
            await updateDoc(eventRef, { likeCount: increment(1) });
            likedEventIds.push(eventId);
        }

        // ローカルデータの更新（通信を減らすため手動で数値をいじる）
        const ev = allEvents.find(e => e.id === eventId);
        if (ev) {
            ev.likeCount = (ev.likeCount || 0) + (isAlreadyLiked ? -1 : 1);
        }
        renderEvents();
    } catch (error) {
        console.error("Like toggle failed:", error);
    }
}

// --- 「お気に入り」切り替えロジック ---
async function toggleFavorite(eventId) {
    if (!currentUser) {
        loginModal.style.display = "block";
        return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const isFav = favoriteEventIds.includes(eventId);

    try {
        if (isFav) {
            await updateDoc(userRef, { favorites: arrayRemove(eventId) });
            favoriteEventIds = favoriteEventIds.filter(id => id !== eventId);
        } else {
            await setDoc(userRef, { favorites: arrayUnion(eventId) }, { merge: true });
            favoriteEventIds.push(eventId);
        }
        renderEvents();
    } catch (error) {
        console.error("Favorite toggle failed:", error);
    }
}

// --- レンダリング ---
function renderEvents() {
    if (!eventList) return;
    
    eventList.innerHTML = allEvents.map(ev => {
        const isFav = favoriteEventIds.includes(ev.id);
        const isLiked = likedEventIds.includes(ev.id);
        const likeCount = ev.likeCount || 0;

        return `
            <div class="event-card">
                <img src="${ev.imageUrl || 'https://via.placeholder.com/400x200'}" alt="${ev.name}">
                <div class="content">
                    <h3 style="margin:0; font-size:1.2em; color:var(--primary);">${ev.name}</h3>
                    
                    <div class="event-rating">
                        <span class="stars">★ 4.8</span>
                        <span class="rev-count">(24)</span>
                        
                        <div class="like-container ${isLiked ? 'is-liked' : ''}" data-id="${ev.id}">
                            <span class="like-heart">${isLiked ? '❤️' : '♡'}</span>
                            <span class="like-count">${likeCount}</span>
                        </div>
                    </div>

                    <p class="meta">📅 ${ev.date} | 📍 ${ev.venue}</p>
                    <p style="font-size:0.9em; color:#666; line-height:1.4;">${ev.summary || 'イベントの詳細情報は近日公開予定です。'}</p>
                </div>
                <button class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-id="${ev.id}">
                    ${isFav ? '★ お気に入り解除' : '★ お気に入りに追加'}
                </button>
            </div>
        `;
    }).join('');

    // 各ボタンにイベントリスナーを登録
    document.querySelectorAll('.like-container').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleLike(btn.dataset.id);
        };
    });

    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.id);
        };
    });
}

// --- モーダル・認証関連のイベント ---
loginBtnHeader.onclick = () => {
    if (currentUser) {
        if (confirm("ログアウトしますか？")) signOut(auth);
    } else {
        loginModal.style.display = "block";
    }
};

closeModal.onclick = () => loginModal.style.display = "none";
window.onclick = (e) => { if (e.target == loginModal) loginModal.style.display = "none"; };

googleLoginBtn.onclick = async () => {
    try {
        await signInWithPopup(auth, provider);
        loginModal.style.display = "none";
    } catch (error) {
        console.error("Login failed:", error);
    }
};

// --- AI チャット UI 制御 ---
const chatToggle = document.getElementById('ai-chat-toggle');
const chatWindow = document.getElementById('ai-chat-window');
const chatClose = document.getElementById('ai-chat-close');

if (chatToggle) {
    chatToggle.onclick = () => chatWindow.classList.toggle('ai-chat-hidden');
}
if (chatClose) {
    chatClose.onclick = () => chatWindow.classList.add('ai-chat-hidden');
}
