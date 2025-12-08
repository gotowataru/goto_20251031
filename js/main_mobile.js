import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Firebase 設定 ---
const firebaseConfig = {
    apiKey: "AIzaSyDt69H-dBGMB4HANbwVj007vJ3yblEZdqE",
    authDomain: "goto6234.firebaseapp.com",
    projectId: "goto6234",
    storageBucket: "goto6234.firebaseapp.com",
    messagingSenderId: "730149609843",
    appId: "1:730149609843:web:d11237782723fc45b2506"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- グローバル状態管理変数 ---
let currentUser = null;
let favoriteEventIds = [];
let allEvents = [];
let isLoading = false;
let lastVisible = null;
const PAGE_SIZE = 20;
const CATEGORY_NAMES = { matsuri: "祭り", music: "音楽", learn: "学び", workshop: "ワークショップ", sports: "スポーツ", gourmet: "グルメ", exhibition: "展示・芸術" };
let filters = { category: "all", search: "", tag: "", organizer: "", venue: "" }; 

// ----------------------------------------------------------------------
// 🚨 DOMContentLoaded: DOM読み込み後にすべての処理を開始
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素の取得（DOM読み込み完了後） ---
    const modal = document.getElementById('login-modal');
    const loginBtn = document.getElementById('login-btn-header');
    const closeBtn = document.querySelector('.close-btn');

    const filterDrawer = document.getElementById('filter-drawer');
    const openFilterBtn = document.getElementById('open-filter-btn');
    const closeFilterBtn = document.getElementById('close-filter-btn');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const mobileClearBtn = document.getElementById('clear-filters-btn-mobile');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    const googleProvider = new GoogleAuthProvider();
    const githubProvider = new GithubAuthProvider();

    // --- 認証関連のイベントリスナー ---
    loginBtn.onclick = () => { if (!currentUser) modal.style.display = 'block'; };
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

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

    // --- モバイルドロワー機能 ---
    openFilterBtn.onclick = () => {
        filterDrawer.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };

    closeFilterBtn.onclick = () => {
        filterDrawer.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    applyFilterBtn.onclick = () => {
        renderEvents();
        filterDrawer.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    // --- イベント表示とフィルター関連 (関数定義) ---

    /**
     * イベントカードをレンダリングし、DOMに反映する
     */
    const renderEvents = () => {
        const grid = document.getElementById('event-grid');
        let filtered = allEvents.filter(e => {
            const matchCat = filters.category === "all" || e.category === filters.category;
            const keywords = filters.search.toLowerCase().split(/\s+/).filter(k => k);
            const targetText = [e.name, e.description, e.summary, e.venue, e.organizer].join(" ").toLowerCase();
            const matchSearch = keywords.length === 0 || keywords.every(k => targetText.includes(k));
            const matchTag = !filters.tag || (Array.isArray(e.tags) && e.tags.includes(filters.tag));
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
            const catLabel = ev.category ? `<span class="category-tag">${CATEGORY_NAMES[ev.category] || ev.category}</span>` : "";
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

    /**
     * お気に入り状態をトグルし、Firestoreとローカル状態を更新する
     */
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

    /**
     * カルーセル機能を開始し、自動移動と左右ボタンを設定する
     */
    const startCarousel = () => {
        const grid = document.getElementById('featured-grid');
        const cards = Array.from(grid.querySelectorAll('.featured-card')); 
        const prevBtn = document.getElementById('prev-slide-btn');
        const nextBtn = document.getElementById('next-slide-btn');

        if (cards.length === 0 || !grid) return;

        // 無限ループのためのクローン作成
        const firstClone = cards[0].cloneNode(true);
        const lastClone = cards[cards.length - 1].cloneNode(true);
        grid.prepend(lastClone);
        grid.appendChild(firstClone);
         
        const allCards = Array.from(grid.querySelectorAll('.featured-card')); 
        const cardWidth = cards[0].offsetWidth; 
        const GAP_SIZE = 24; 
         
        let currentIndex = 1;
        grid.style.scrollBehavior = 'smooth'; 
        grid.scrollLeft = currentIndex * (cardWidth + GAP_SIZE);

        const slideTo = (index) => {
            grid.style.scrollBehavior = 'smooth';
            grid.scrollLeft = index * (cardWidth + GAP_SIZE);
            currentIndex = index;
        };

        const checkLoop = () => {
            if (currentIndex === 0) {
                setTimeout(() => {
                    grid.style.scrollBehavior = 'auto'; 
                    currentIndex = allCards.length - 2; 
                    grid.scrollLeft = currentIndex * (cardWidth + GAP_SIZE);
                }, 500); 
                setTimeout(() => {
                    grid.style.scrollBehavior = 'smooth'; 
                }, 550);
            } else if (currentIndex === allCards.length - 1) {
                setTimeout(() => {
                    grid.style.scrollBehavior = 'auto'; 
                    currentIndex = 1; 
                    grid.scrollLeft = currentIndex * (cardWidth + GAP_SIZE);
                }, 500);
                setTimeout(() => {
                    grid.style.scrollBehavior = 'smooth'; 
                }, 550);
            }
        };

        const autoSlide = () => {
            let nextIndex = currentIndex + 1;
            slideTo(nextIndex);
            checkLoop();
        };

        let slideInterval = setInterval(autoSlide, 4000);

        const handleSlide = (direction) => {
            clearInterval(slideInterval); 
            let nextIndex = currentIndex + direction;
            slideTo(nextIndex);
            checkLoop();
            slideInterval = setInterval(autoSlide, 4000); 
        };

        nextBtn.onclick = () => handleSlide(1);
        prevBtn.onclick = () => handleSlide(-1);

        grid.addEventListener('scroll', () => {
            clearInterval(slideInterval);
             
            clearTimeout(grid.scrollTimeout);
            grid.scrollTimeout = setTimeout(() => {
                const scrollPos = grid.scrollLeft;
                const newIndex = Math.round(scrollPos / (cardWidth + GAP_SIZE));
                 
                slideTo(newIndex);
                 
                checkLoop();
                 
                slideInterval = setInterval(autoSlide, 4000);
            }, 150); 
        });
    };

    /**
     * おすすめイベントをロードし、カルーセルを開始する
     */
    const loadFeatured = async () => {
        const q = query(collection(db, "events"), where("isFeatured", "==", true), where("status", "==", "approved")); 
        const snap = await getDocs(q);
         
        const grid = document.getElementById('featured-grid');
        if (snap.empty || !grid) return;
         
        document.getElementById('featured-section').style.display = "block";
         
        grid.innerHTML = snap.docs.map(d => {
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
         
        startCarousel(); 
    };

    /**
     * サイドバーのタグ/主催者/会場フィルターボタンを生成する (ドロワー用)
     */
    const generateSidebarFilters = () => {
        const tags = new Set(), organizers = new Set(), venues = new Set();
         
        const approvedEvents = allEvents.filter(e => e.status === "approved" || !e.status); 

        approvedEvents.forEach(e => {
            if (Array.isArray(e.tags)) e.tags.forEach(t => tags.add(t));
            if (e.organizer) organizers.add(e.organizer);
            if (e.venue) venues.add(e.venue);
        });
         
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
                 
                if (itemsCount >= MAX_ITEMS) {
                    btn.classList.add('hidden-tag');
                }
                 
                // 既存のフィルターが設定されていればactiveを付与
                if (filters[type] === item) {
                    btn.classList.add('active');
                }
                 
                btn.onclick = () => {
                    const isActive = btn.classList.contains('active');
                    container.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
                    if (!isActive) { 
                        filters[type] = item; 
                        btn.classList.add('active'); 
                    } else { 
                        filters[type] = ""; 
                    }
                    renderEvents(); 
                };
                container.appendChild(btn);
                itemsCount++;
            });

            if (itemsCount > MAX_ITEMS) {
                const showMoreBtn = document.createElement('button');
                showMoreBtn.className = "show-more-btn";
                showMoreBtn.textContent = `もっと見る (${itemsCount - MAX_ITEMS}件)`;
                showMoreBtn.onclick = () => {
                    container.querySelectorAll('.hidden-tag').forEach(tag => {
                        tag.classList.remove('hidden-tag');
                    });
                    showMoreBtn.style.display = 'none';
                };
                container.appendChild(showMoreBtn);
            }
        };
         
        createButtons('tags-container', tags, 'tag');
        createButtons('organizer-container', organizers, 'organizer');
        createButtons('venue-container', venues, 'venue');
    };

    /**
     * 追加のイベントをロードし、無限スクロールを実装する
     */
    const loadMoreEvents = async () => {
        if (isLoading || !lastVisible) return;
        isLoading = true;
        document.getElementById('load-more-trigger').innerHTML = '<span style="color:#999;">読み込み中...</span>';

        const q = query(collection(db, "events"), where("status", "==", "approved"), orderBy("date"), startAfter(lastVisible), limit(PAGE_SIZE));
        const snap = await getDocs(q);

        if (snap.empty) {
            document.getElementById('load-more-trigger').style.display = 'none';
            document.getElementById('load-more-trigger').innerHTML = '<span style="color:#999;">これ以上イベントはありません</span>';
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

    /**
     * 初期イベントとすべての関連データをロードする
     */
    const loadInitialEvents = async () => {
        const snap = await getDocs(query(collection(db, "events"), where("status", "==", "approved"), orderBy("date"), limit(PAGE_SIZE)));
        allEvents = snap.docs.map(d => { const data = d.data(); data.id = d.id; return data; });
        lastVisible = snap.docs[snap.docs.length - 1] || null;

        document.getElementById('event-grid').innerHTML = ""; 

        renderEvents();
        loadFeatured();
        // loadNewEvents() はモバイル版HTMLではDOM操作がないためスキップ
        generateSidebarFilters();

        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !isLoading) loadMoreEvents();
        }, { rootMargin: "400px" });
        observer.observe(document.getElementById('load-more-trigger'));
         
        if (!lastVisible) {
            document.getElementById('load-more-trigger').style.display = 'none';
            document.getElementById('load-more-trigger').innerHTML = '<span style="color:#999;">これ以上イベントはありません</span>';
        } else {
            document.getElementById('load-more-trigger').style.display = 'block';
        }
    };

    // --- 起動とイベントリスナー ---

    // 認証状態の変化を監視
    onAuthStateChanged(auth, async user => {
        currentUser = user;
        if (user) {
            loginBtn.textContent = `${user.displayName || user.email.split('@')[0]} さん`;
            loginBtn.onclick = () => location.href = 'mypage.html'; 
             
            const snap = await getDoc(doc(db, 'users', user.uid));
            favoriteEventIds = snap.exists() ? snap.data().favorites || [] : [];
        } else {
            loginBtn.textContent = 'ログイン';
            loginBtn.onclick = () => modal.style.display = 'block';
            favoriteEventIds = [];
        }
        renderEvents(); 
    });

    // モバイル用フィルタークリアボタンのロジック
    mobileClearBtn.onclick = () => {
        filters = { category: "all", search: "", tag: "", organizer: "", venue: "" };
        searchInput.value = "";
         
        // カテゴリのラジオボタンをリセット
        const allRadio = document.querySelector('.category-nav input[name="category"][value="all"]');
        if (allRadio) allRadio.checked = true;
        
        // ドロワー内のタグボタンのアクティブ状態をすべてリセット
        document.querySelectorAll('.filter-tags .tag-btn.active').forEach(b => b.classList.remove('active'));
        
        loadInitialEvents(); 
    };

    // 検索ボタン
    searchBtn.onclick = () => {
        filters.search = searchInput.value.trim();
        renderEvents();
    };
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchBtn.click();
    });

    // カテゴリフィルターのイベントリスナー
    document.querySelectorAll('.category-nav input[name="category"]').forEach(r => {
        r.onchange = () => { filters.category = r.value; renderEvents(); };
    });

    // ページ起動
    loadInitialEvents();
});
