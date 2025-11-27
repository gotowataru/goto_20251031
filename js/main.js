import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDt69H-dBGMB4HANbwVj007vJ3yblEZdqE",
    authDomain: "goto6234.firebaseapp.com",
    projectId: "goto6234",
    storageBucket: "goto6234.firebaseapp.com",
    messagingSenderId: "730149609843",
    appId: "1:730149609843:web:d11237de52723fc45b2506"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let favoriteEventIds = [];
let allEvents = [];
let isLoading = false;
let lastVisible = null;
const PAGE_SIZE = 20;

const modal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn-header');
const closeBtn = document.querySelector('.close-btn');
loginBtn.onclick = () => { if (!currentUser) modal.style.display = 'block'; };
closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, googleProvider).then(() => modal.style.display = 'none').catch(e => alert(e.message));
document.getElementById('github-login-btn').onclick = () => signInWithPopup(auth, githubProvider).then(() => modal.style.display = 'none').catch(e => alert(e.message));
document.getElementById('email-signup-btn').onclick = () => {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('password-input').value;
    if (email && pass.length >= 6) createUserWithEmailAndPassword(auth, email, pass).then(() => modal.style.display = 'none').catch(e => alert(e.message));
    else alert("メールと6文字以上のパスワードを入力してください");
};
document.getElementById('email-login-btn').onclick = () => {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('password-input').value;
    if (email && pass) signInWithEmailAndPassword(auth, email, pass).then(() => modal.style.display = 'none').catch(e => alert(e.message));
    else alert("メールとパスワードを入力してください");
};

const categoryNames = { matsuri: "祭り", music: "音楽", learn: "学び", workshop: "ワークショップ", sports: "スポーツ", gourmet: "グルメ", exhibition: "展示・芸術" };
let filters = { category: "all", search: "", tag: "", organizer: "", venue: "" };

const renderEvents = () => {
    const grid = document.getElementById('event-grid');
    let filtered = allEvents.filter(e => {
        const matchCat = filters.category === "all" || e.category === filters.category;
        const keywords = filters.search.toLowerCase().split(/\s+/).filter(k => k);
        const targetText = [e.name, e.description, e.summary, e.venue, e.organizer].join(" ").toLowerCase();
        const matchSearch = keywords.length === 0 || keywords.every(k => targetText.includes(k));
        const matchTag = !filters.tag || e.tags?.includes(filters.tag);
        const matchOrg = !filters.organizer || e.organizer === filters.organizer;
        const matchVenue = !filters.venue || e.venue === filters.venue;
        return matchCat && matchSearch && matchTag && matchOrg && matchVenue;
    });

    if (filtered.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1;text-align:center;padding:100px;color:#999;font-size:1.3em;'>該当するイベントがありません</p>";
        return;
    }

    grid.innerHTML = filtered.map(ev => {
        const isFav = favoriteEventIds.includes(ev.id);
        const catLabel = ev.category ? `<span class="category-tag">${categoryNames[ev.category] || ev.category}</span>` : "";
        const img = ev.imageUrl ? `<img src="${ev.imageUrl}" alt="${ev.name}" loading="lazy">` : `<div style="height:200px;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.9em;">画像なし</div>`;
        const timeStr = ev.startTime ? `${ev.startTime} 〜 ${ev.endTime || ""}` : "終日";
        const displayDesc = ev.summary || (ev.description ? ev.description.substring(0, 80) + "..." : "");

        return `
            <div class="event-card">
                <a href="detail.html?id=${ev.id}" style="text-decoration:none;color:inherit;display:block;flex:1;">
                    ${img}
                    <div class="content">
                        ${catLabel}
                        <h2>${ev.name}</h2>
                        <div class="meta"><strong>${ev.date}</strong> ${timeStr}</div>
                        <p>${displayDesc}</p>
                    </div>
                </a>
                <button class="favorite-btn ${isFav ? 'is-favorite' : ''}" data-id="${ev.id}">
                    ${isFav ? 'お気に入り解除' : 'お気に入りに追加'}
                </button>
            </div>
        `;
    }).join("");

    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(btn.dataset.id); };
    });
};

const toggleFavorite = async (eventId) => {
    if (!currentUser) { modal.style.display = "block"; return; }
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
    } catch (e) {
        console.error(e);
        alert("お気に入り処理に失敗しました");
    }
};

const startCarousel = () => {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.featured-card');
    if (cards.length === 0) return;

    const cardWidth = cards[0].offsetWidth; // 1枚のカードの幅を取得
    let currentIndex = 0;
    const intervalTime = 2000; // 2秒

    // カルーセルをスライドさせる関数
    const slide = () => {
        currentIndex++;
        // ループ処理: 最後のカードまで行ったら、最初のカードに戻る
        if (currentIndex >= cards.length) {
            // CSSアニメーションを無効にして瞬時に最初の位置に戻す
            grid.style.transition = 'none';
            grid.scrollLeft = 0;
            currentIndex = 1;
            
            // わずかな遅延の後にCSSアニメーションを再度有効にする
            setTimeout(() => {
                grid.style.transition = 'scroll-left 0.5s ease-in-out';
                grid.scrollLeft = currentIndex * (cardWidth + 20); // 20pxはfeatured-gridのgap
            }, 50);

        } else {
            grid.style.transition = 'scroll-left 0.5s ease-in-out';
            // カードの幅 + gap(20px) 分だけスクロール
            grid.scrollLeft = currentIndex * (cardWidth + 20); 
        }
    };

    // 最初のカードの幅を取得できることを確認してからインターバルを設定
    if (cardWidth > 0) {
        setInterval(slide, intervalTime);
    }
};


const loadFeatured = async () => {
    const q = query(collection(db, "events"), where("isFeatured", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) return;
    document.getElementById('featured-section').style.display = "block";
    document.getElementById('featured-grid').innerHTML = snap.docs.map(d => {
        const e = d.data(); e.id = d.id;
        const img = e.imageUrl ? `<img src="${e.imageUrl}" alt="${e.name}" loading="lazy">` : `<div style="height:240px;background:#eee;"></div>`;
        return `<div class="featured-card">
            <span class="featured-label">おすすめ</span>
            <a href="detail.html?id=${e.id}" style="text-decoration:none;color:inherit;display:block;">
                ${img}
                <div class="content"><h3>${e.name}</h3><p><strong>${e.date}</strong> ${e.venue || ""}</p></div>
            </a>
        </div>`;
    }).join("");
    
    // カルーセル機能の開始
    startCarousel(); 
};

const loadNewEvents = async () => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    document.getElementById('new-events-list').innerHTML = snap.docs.map(d => {
        const e = d.data();
        return `<li><a href="detail.html?id=${d.id}">${e.name}</a><br><small>${e.date}</small></li>`;
    }).join("") || "<li>新着イベントはありません</li>";
};

const generateSidebarFilters = () => {
    const tags = new Set(), organizers = new Set(), venues = new Set();
    allEvents.forEach(e => {
        if (Array.isArray(e.tags)) e.tags.forEach(t => tags.add(t));
        if (e.organizer) organizers.add(e.organizer);
        if (e.venue) venues.add(e.venue);
    });
    
    // フィルターの表示件数
    const MAX_ITEMS = 10; 

    const createButtons = (containerId, items, type) => {
        const container = document.getElementById(containerId);
        const filterGroup = document.getElementById(containerId.replace('-container', '-filter'));

        if (!container || items.size === 0) {
             filterGroup.style.display = "none";
             return;
        }
        filterGroup.style.display = "block";
        container.innerHTML = "";
        
        const sortedItems = Array.from(items).sort();
        let itemsCount = 0;

        sortedItems.forEach(item => {
            const btn = document.createElement('span');
            btn.className = "tag-btn";
            btn.textContent = item;
            
            // 10件を超えたら非表示にするクラスを付与
            if (itemsCount >= MAX_ITEMS) {
                btn.classList.add('hidden-tag');
            }
            
            btn.onclick = () => {
                const isActive = btn.classList.contains('active');
                container.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
                if (!isActive) { filters[type] = item; btn.classList.add('active'); }
                else { filters[type] = ""; }
                renderEvents();
            };
            container.appendChild(btn);
            itemsCount++;
        });

        // 10件を超えた場合、「もっと見る」ボタンを追加
        if (itemsCount > MAX_ITEMS) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = "show-more-btn";
            showMoreBtn.textContent = `もっと見る (${itemsCount - MAX_ITEMS}件)`;
            showMoreBtn.onclick = () => {
                // 非表示のタグを表示する
                container.querySelectorAll('.hidden-tag').forEach(tag => {
                    tag.classList.remove('hidden-tag');
                });
                // ボタン自身を非表示にする
                showMoreBtn.style.display = 'none';
            };
            container.appendChild(showMoreBtn);
        }
    };
    
    createButtons('tags-container', tags, 'tag');
    createButtons('organizer-container', organizers, 'organizer');
    createButtons('venue-container', venues, 'venue');
};

const loadMoreEvents = async () => {
    if (isLoading) return;
    isLoading = true;
    document.getElementById('load-more-trigger').innerHTML = '<span style="color:#999;">読み込み中...</span>';

    const q = query(collection(db, "events"), orderBy("date"), startAfter(lastVisible), limit(PAGE_SIZE));
    const snap = await getDocs(q);

    if (snap.empty) {
        document.getElementById('load-more-trigger').style.display = 'none';
        isLoading = false;
        return;
    }

    const newEvents = snap.docs.map(d => { const data = d.data(); data.id = d.id; return data; });
    allEvents = [...allEvents, ...newEvents];
    lastVisible = snap.docs[snap.docs.length - 1];

    renderEvents();
    generateSidebarFilters();
    document.getElementById('load-more-trigger').innerHTML = '<span>もっと見る</span>';
    isLoading = false;
};

const loadInitialEvents = async () => {
    const snap = await getDocs(query(collection(db, "events"), orderBy("date"), limit(PAGE_SIZE)));
    allEvents = snap.docs.map(d => { const data = d.data(); data.id = d.id; return data; });
    lastVisible = snap.docs[snap.docs.length - 1] || null;

    // 初回読み込み時には、読み込み中のSVGを削除してイベントグリッドの内容を表示
    document.getElementById('event-grid').innerHTML = ""; 

    renderEvents();
    loadFeatured();
    loadNewEvents();
    generateSidebarFilters();

    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !isLoading) loadMoreEvents();
    }, { rootMargin: "400px" });
    observer.observe(document.getElementById('load-more-trigger'));
};

onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (user) {
        loginBtn.textContent = `${user.displayName || user.email.split('@')[0]} さん`;
        loginBtn.onclick = () => location.href = 'mypage.html';
        const snap = await getDoc(doc(db, 'users', user.uid));
        favoriteEventIds = snap.exists() ? snap.data().favorites || [] : [];
    } else {
        loginBtn.textContent = 'ログイン / サインアップ';
        loginBtn.onclick = () => modal.style.display = 'block';
        favoriteEventIds = [];
    }
    renderEvents();
});

document.getElementById('search-btn').onclick = () => {
    filters.search = document.getElementById('search-input').value.trim();
    renderEvents();
};
document.getElementById('search-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});
document.getElementById('clear-filters-btn').onclick = () => {
    filters = { category: "all", search: "", tag: "", organizer: "", venue: "" };
    document.getElementById('search-input').value = "";
    
    // カテゴリフィルターのチェックをリセット
    const allRadio = document.querySelector('.category-nav input[name="category"][value="all"]');
    if (allRadio) allRadio.checked = true;
    
    // タグ/主催者/会場フィルターのアクティブ状態をリセット
    document.querySelectorAll('.filter-tags .tag-btn.active').forEach(b => b.classList.remove('active'));
    
    // 非表示の要素を再表示するロジック（ボタンを再表示させるために必要）
    loadInitialEvents(); 
};

// カテゴリフィルターのイベントリスナーを新しい nav 要素の input に設定
document.querySelectorAll('.category-nav input[name="category"]').forEach(r => {
    r.onchange = () => { filters.category = r.value; renderEvents(); };
});

// 最初に20件だけ読み込んでスタート！
loadInitialEvents();
