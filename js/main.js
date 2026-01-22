import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, 
    signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, 
    arrayUnion, arrayRemove, increment, query, orderBy, where 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Firebase 設定 (ご自身のプロジェクト設定に書き換えてください) ---
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
const googleProvider = new GoogleAuthProvider();

// --- 状態管理 ---
let currentUser = null;
let allEvents = [];
let favoriteEventIds = [];
let likedEventIds = []; // 自分が「いいね」したイベントID
let currentCategory = "all";

// --- DOM 要素 ---
const eventGrid = document.getElementById('event-grid');
const loginBtnHeader = document.getElementById('login-btn-header');
const loginModal = document.getElementById('login-modal');
const closeModal = document.querySelector('.close-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// --- 1. 認証と初期化 ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtnHeader.textContent = "マイページ / ログアウト";
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            favoriteEventIds = userData.favorites || [];
            likedEventIds = userData.likes || [];
        }
    } else {
        loginBtnHeader.textContent = "ログイン / サインアップ";
        favoriteEventIds = [];
        likedEventIds = [];
    }
    loadEvents();
});

// --- 2. データ取得 ---
async function loadEvents() {
    try {
        const q = query(collection(db, "events"), orderBy("date", "asc"));
        const snap = await getDocs(q);
        allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderEvents(allEvents);
        renderFeatured(); // おすすめセクション
    } catch (e) {
        console.error("Error loading events:", e);
        eventGrid.innerHTML = "データの読み込みに失敗しました。";
    }
}

// --- 3. 「いいね」機能のロジック ---
async function toggleLike(eventId) {
    if (!currentUser) {
        loginModal.style.display = "block";
        return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const eventRef = doc(db, "events", eventId);
    const isLiked = likedEventIds.includes(eventId);

    try {
        if (isLiked) {
            // 解除: ユーザーのlikes配列から削除 & イベントのlikeCountを-1
            await updateDoc(userRef, { likes: arrayRemove(eventId) });
            await updateDoc(eventRef, { likeCount: increment(-1) });
            likedEventIds = likedEventIds.filter(id => id !== eventId);
        } else {
            // 登録: ユーザーのlikes配列に追加 & イベントのlikeCountを+1
            await setDoc(userRef, { likes: arrayUnion(eventId) }, { merge: true });
            await updateDoc(eventRef, { likeCount: increment(1) });
            likedEventIds.push(eventId);
        }
        
        // ローカルデータの数値を即時更新して再描画
        const ev = allEvents.find(e => e.id === eventId);
        if (ev) ev.likeCount = (ev.likeCount || 0) + (isLiked ? -1 : 1);
        
        renderEvents(allEvents);
    } catch (e) {
        console.error("Like toggle error:", e);
    }
}

// --- 4. 「お気に入り」機能のロジック ---
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
        renderEvents(allEvents);
    } catch (e) {
        console.error("Favorite toggle error:", e);
    }
}

// --- 5. レンダリング ---
function renderEvents(events) {
    if (!eventGrid) return;

    // カテゴリフィルタリング
    const filtered = currentCategory === "all" 
        ? events 
        : events.filter(e => e.category === currentCategory);

    if (filtered.length === 0) {
        eventGrid.innerHTML = "<p>該当するイベントが見つかりませんでした。</p>";
        return;
    }

    eventGrid.innerHTML = filtered.map(ev => {
        const isFav = favoriteEventIds.includes(ev.id);
        const isLiked = likedEventIds.includes(ev.id);
        const likes = ev.likeCount || 0;

        return `
            <div class="event-card">
                <img src="${ev.imageUrl || 'https://via.placeholder.com/400x200'}" alt="${ev.name}">
                <div class="content">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h3 style="margin:0; font-size:1.2em; color:var(--primary);">${ev.name}</h3>
                        <div class="like-container ${isLiked ? 'is-liked' : ''}" data-id="${ev.id}">
                            <span class="like-heart">${isLiked ? '❤️' : '♡'}</span>
                            <span class="like-count">${likes}</span>
                        </div>
                    </div>
                    <div class="event-rating">
                        <span class="stars">★ 4.5</span>
                        <span class="rev-count">(12)</span>
                    </div>
                    <p class="meta">📅 ${ev.date} | 📍 ${ev.venue}</p>
                    <p style="font-size:0.9em; color:#666; line-height:1.4;">${ev.summary || ''}</p>
                </div>
                <button class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-id="${ev.id}">
                    ${isFav ? '★ お気に入り解除' : '★ お気に入りに追加'}
                </button>
            </div>
        `;
    }).join('');

    // イベントリスナーの再設定
    document.querySelectorAll('.like-container').forEach(el => {
        el.onclick = (e) => { e.stopPropagation(); toggleLike(el.dataset.id); };
    });
    document.querySelectorAll('.favorite-btn').forEach(el => {
        el.onclick = (e) => { e.stopPropagation(); toggleFavorite(el.dataset.id); };
    });
}

// おすすめイベント (Carousel)
function renderFeatured() {
    const featuredGrid = document.getElementById('featured-grid');
    const featuredSection = document.getElementById('featured-section');
    const featured = allEvents.filter(e => e.isFeatured);
    
    if (featured.length > 0 && featuredGrid) {
        featuredSection.style.display = 'block';
        featuredGrid.innerHTML = featured.map(ev => `
            <div class="featured-card">
                <div class="featured-label">おすすめ</div>
                <img src="${ev.imageUrl}" alt="${ev.name}">
                <div class="content">
                    <h3>${ev.name}</h3>
                    <p>${ev.date} @ ${ev.venue}</p>
                </div>
            </div>
        `).join('');
    }
}

// --- 6. フィルタ・検索・UI制御 ---

// カテゴリ切り替え
document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        renderEvents(allEvents);
    });
});

// 検索機能
const runSearch = () => {
    const term = searchInput.value.toLowerCase();
    const filtered = allEvents.filter(e => 
        e.name.toLowerCase().includes(term) || 
        (e.summary && e.summary.toLowerCase().includes(term))
    );
    renderEvents(filtered);
};
searchBtn.onclick = runSearch;
searchInput.onkeyup = (e) => { if (e.key === "Enter") runSearch(); };

// 条件クリア
document.getElementById('clear-filters-btn').onclick = () => {
    searchInput.value = "";
    currentCategory = "all";
    document.querySelector('input[value="all"]').checked = true;
    renderEvents(allEvents);
};

// モーダル制御
loginBtnHeader.onclick = () => {
    if (currentUser) {
        if (confirm("ログアウトしますか？")) signOut(auth);
    } else {
        loginModal.style.display = "block";
    }
};
closeModal.onclick = () => loginModal.style.display = "none";
window.onclick = (e) => { if (e.target == loginModal) loginModal.style.display = "none"; };

// Googleログイン
document.getElementById('google-login-btn').onclick = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
        loginModal.style.display = "none";
    } catch (e) { console.error(e); }
};

// AIチャット制御
const chatToggle = document.getElementById('ai-chat-toggle');
const chatWindow = document.getElementById('ai-chat-window');
const chatClose = document.getElementById('ai-chat-close');

if (chatToggle) {
    chatToggle.onclick = () => chatWindow.classList.toggle('ai-chat-hidden');
}
if (chatClose) {
    chatClose.onclick = () => chatWindow.classList.add('ai-chat-hidden');
}

// Flatpickr (カレンダー) の初期化
flatpickr("#calendar-input", {
    locale: "ja",
    inline: true,
    onChange: (selectedDates, dateStr) => {
        const filtered = allEvents.filter(e => e.date === dateStr);
        renderEvents(filtered);
    }
});
