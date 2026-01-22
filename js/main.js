import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit, startAfter, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Firebase 設定 ---
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

// --- グローバル状態管理変数 ---
let currentUser = null;
let favoriteEventIds = [];
let allEvents = [];
let isLoading = false;
let lastVisible = null;
const PAGE_SIZE = 20;
const CATEGORY_NAMES = { matsuri: "祭り", music: "音楽", learn: "学び", workshop: "ワークショップ", sports: "スポーツ", gourmet: "グルメ", exhibition: "展示・芸術" };
let filters = { category: "all", search: "", tag: "", organizer: "", venue: "", date: "" }; 

// --- 共通関数：レビュー統計の取得 ---
const getReviewStats = async (eventId) => {
    try {
        const reviewsRef = collection(db, "events", eventId, "reviews");
        const snap = await getDocs(reviewsRef);
        if (snap.empty) return { avg: 0, count: 0 };

        let total = 0;
        snap.forEach(doc => {
            total += doc.data().reviewRating || 0;
        });
        return {
            avg: (total / snap.size).toFixed(1),
            count: snap.size
        };
    } catch (e) {
        console.error("レビュー取得エラー:", e);
        return { avg: 0, count: 0 };
    }
};

// --- レンダリング関連 ---
const renderEvents = () => {
    const grid = document.getElementById('event-grid');
    if(!grid) return;

    let filtered = allEvents.filter(e => {
        const matchCat = filters.category === "all" || e.category === filters.category;
        const keywords = filters.search.toLowerCase().split(/\s+/).filter(k => k);
        const targetText = [e.name, e.description, e.summary, e.venue, e.organizer].join(" ").toLowerCase();
        const matchSearch = keywords.length === 0 || keywords.every(k => targetText.includes(k));
        const matchTag = !filters.tag || (Array.isArray(e.tags) && e.tags.includes(filters.tag));
        const matchOrg = !filters.organizer || e.organizer === filters.organizer;
        const matchVenue = !filters.venue || e.venue === filters.venue;
        const matchDate = !filters.date || e.date === filters.date;
        return matchCat && matchSearch && matchTag && matchOrg && matchVenue && matchDate;
    });

    if (filtered.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1;text-align:center;padding:100px;color:#999;font-size:1.3em;'>該当するイベントがありません</p>";
        return;
    }

    grid.innerHTML = filtered.map(ev => {
        const isFav = favoriteEventIds.includes(ev.id);
        // いいね済み判定 (likedBy 配列に自分のUIDが含まれているか)
        const isLiked = currentUser && ev.likedBy && ev.likedBy.includes(currentUser.uid);
        
        const catLabel = ev.category ? `<span class="category-tag">${CATEGORY_NAMES[ev.category] || ev.category}</span>` : "";
        const img = ev.imageUrl ? `<img src="${ev.imageUrl}" alt="${ev.name}" loading="lazy">` : `<div style="height:200px;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.9em;">画像なし</div>`;
        const timeStr = ev.startTime ? `${ev.startTime} 〜 ${ev.endTime || ""}` : "終日";
        const displayDesc = ev.summary || (ev.description ? ev.description.substring(0, 80) + "..." : "");

        // いいねボタンHTML
        const likeHtml = `
            <div class="like-container ${isLiked ? 'is-liked' : ''}" data-id="${ev.id}">
                <span class="like-heart">♥</span>
                <span class="like-count">${ev.likeCount || 0}</span>
            </div>
        `;

        let ratingHtml = "";
        if (ev.stats && ev.stats.count > 0) {
            const starNum = Math.round(ev.stats.avg);
            const stars = '★'.repeat(starNum) + '☆'.repeat(5 - starNum);
            ratingHtml = `
                <div class="event-rating">
                    <span class="stars">${stars}</span>
                    <span class="avg-num">${ev.stats.avg}</span>
                    <span class="rev-count">(${ev.stats.count}件)</span>
                    ${likeHtml}
                </div>
            `;
        } else {
            ratingHtml = `
                <div class="event-rating">
                    <span class="rev-count">まだレビューがありません</span>
                    ${likeHtml}
                </div>
            `;
        }

        return `
            <div class="event-card">
                <a href="detail.html?id=${ev.id}" style="text-decoration:none;color:inherit;display:block;flex:1;">
                    ${img}
                    <div class="content">
                        ${catLabel}
                        <h2>${ev.name}</h2>
                        ${ratingHtml}
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

    // イベントリスナーの再設定
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(btn.dataset.id); };
    });
    document.querySelectorAll('.like-container').forEach(btn => {
        btn.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleLike(btn.dataset.id); };
    });
};

// --- いいね処理の追加 ---
const toggleLike = async (eventId) => {
    if (!currentUser) { 
        document.getElementById('login-modal').style.display = "block"; 
        return; 
    }

    const eventRef = doc(db, "events", eventId);
    const eventData = allEvents.find(e => e.id === eventId);
    if (!eventData) return;

    const isLiked = eventData.likedBy && eventData.likedBy.includes(currentUser.uid);

    try {
        if (isLiked) {
            // いいね解除
            await updateDoc(eventRef, {
                likeCount: increment(-1),
                likedBy: arrayRemove(currentUser.uid)
            });
            eventData.likeCount = (eventData.likeCount || 1) - 1;
            eventData.likedBy = eventData.likedBy.filter(uid => uid !== currentUser.uid);
        } else {
            // いいね追加
            await updateDoc(eventRef, {
                likeCount: increment(1),
                likedBy: arrayUnion(currentUser.uid)
            });
            eventData.likeCount = (eventData.likeCount || 0) + 1;
            if (!eventData.likedBy) eventData.likedBy = [];
            eventData.likedBy.push(currentUser.uid);
        }
        renderEvents();
    } catch (e) {
        console.error("いいねエラー:", e);
        alert("処理に失敗しました。権限設定を確認してください。");
    }
};

// --- データ読み込み ---
const loadInitialEvents = async () => {
    const snap = await getDocs(query(collection(db, "events"), where("status", "==", "approved"), orderBy("date"), limit(PAGE_SIZE)));
    
    allEvents = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        data.id = d.id;
        data.stats = await getReviewStats(d.id); 
        return data;
    }));

    lastVisible = snap.docs[snap.docs.length - 1] || null;
    document.getElementById('event-grid').innerHTML = ""; 
    renderEvents();
    loadFeatured();
    loadNewEvents();
    generateSidebarFilters();

    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !isLoading) loadMoreEvents();
    }, { rootMargin: "400px" });
    const trigger = document.getElementById('load-more-trigger');
    if(trigger) observer.observe(trigger);
    
    if(trigger) trigger.style.display = lastVisible ? 'block' : 'none';
};

const loadMoreEvents = async () => {
    if (isLoading || !lastVisible) return;
    isLoading = true;
    const trigger = document.getElementById('load-more-trigger');
    if(trigger) trigger.innerHTML = '<span style="color:#999;">読み込み中...</span>';
    
    const q = query(collection(db, "events"), where("status", "==", "approved"), orderBy("date"), startAfter(lastVisible), limit(PAGE_SIZE));
    const snap = await getDocs(q);
    if (snap.empty) { if(trigger) trigger.style.display = 'none'; isLoading = false; return; }

    const newEvents = await Promise.all(snap.docs.map(async d => {
        const data = d.data();
        data.id = d.id;
        data.stats = await getReviewStats(d.id);
        return data;
    }));

    allEvents = [...allEvents, ...newEvents];
    lastVisible = snap.docs[snap.docs.length - 1];
    renderEvents();
    generateSidebarFilters();
    if(trigger) trigger.innerHTML = '<span>もっと見る</span>';
    isLoading = false;
};

// --- 認証・モーダル関連 ---
const modal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn-header');
const closeBtn = document.querySelector('.close-btn');
if(loginBtn) loginBtn.onclick = () => { if (!currentUser) modal.style.display = 'block'; };
if(closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
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
    const cards = Array.from(grid.querySelectorAll('.featured-card'));
    const prevBtn = document.getElementById('prev-slide-btn');
    const nextBtn = document.getElementById('next-slide-btn');
    if (cards.length === 0) return;
    
    // クローン処理
    const firstClone = cards[0].cloneNode(true);
    const lastClone = cards[cards.length - 1].cloneNode(true);
    grid.prepend(lastClone);
    grid.appendChild(firstClone);
    
    const allCards = Array.from(grid.querySelectorAll('.featured-card')); 
    const cardWidth = cards[0].offsetWidth; 
    const GAP_SIZE = 24; 
    let currentIndex = 1;
    grid.style.scrollBehavior = 'auto'; 
    grid.scrollLeft = currentIndex * (cardWidth + GAP_SIZE);

    const slideTo = (index) => {
        grid.style.scrollBehavior = 'smooth';
        grid.scrollLeft = index * (cardWidth + GAP_SIZE);
        currentIndex = index;
    };

    const checkLoop = () => {
        if (currentIndex === 0) {
            setTimeout(() => { grid.style.scrollBehavior = 'auto'; currentIndex = allCards.length - 2; grid.scrollLeft = currentIndex * (cardWidth + GAP_SIZE); }, 500); 
        } else if (currentIndex === allCards.length - 1) {
            setTimeout(() => { grid.style.scrollBehavior = 'auto'; currentIndex = 1; grid.scrollLeft = currentIndex * (cardWidth + GAP_SIZE); }, 500);
        }
    };

    const autoSlide = () => { slideTo(currentIndex + 1); checkLoop(); };
    let slideInterval = setInterval(autoSlide, 4000);
    if(nextBtn) nextBtn.onclick = () => { clearInterval(slideInterval); slideTo(currentIndex + 1); checkLoop(); slideInterval = setInterval(autoSlide, 4000); };
    if(prevBtn) prevBtn.onclick = () => { clearInterval(slideInterval); slideTo(currentIndex - 1); checkLoop(); slideInterval = setInterval(autoSlide, 4000); };
};

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

const loadNewEvents = async () => {
    const q = query(collection(db, "events"), where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    const container = document.getElementById('new-events-list');
    if(container) {
        container.innerHTML = snap.docs.map(d => {
            const e = d.data();
            return `<li><a href="detail.html?id=${d.id}">${e.name}</a><br><small>${e.date}</small></li>`;
        }).join("") || "<li>新着イベントはありません</li>";
    }
};

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
        if (!container || items.size === 0) { if(filterGroup) filterGroup.style.display = "none"; return; }
        filterGroup.style.display = "block";
        container.innerHTML = "";
        const sortedItems = Array.from(items).sort();
        let itemsCount = 0;
        sortedItems.forEach(item => {
            const btn = document.createElement('span');
            btn.className = "tag-btn";
            btn.textContent = item;
            if (itemsCount >= MAX_ITEMS) btn.classList.add('hidden-tag');
            if (filters[type] === item) btn.classList.add('active');
            btn.onclick = () => {
                const isActive = btn.classList.contains('active');
                container.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
                if (!isActive) { filters[type] = item; btn.classList.add('active'); } else { filters[type] = ""; }
                renderEvents();
            };
            container.appendChild(btn);
            itemsCount++;
        });
        if (itemsCount > MAX_ITEMS) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = "show-more-btn";
            showMoreBtn.textContent = `もっと見る (${itemsCount - MAX_ITEMS}件)`;
            showMoreBtn.onclick = () => { container.querySelectorAll('.hidden-tag').forEach(tag => tag.classList.remove('hidden-tag')); showMoreBtn.style.display = 'none'; };
            container.appendChild(showMoreBtn);
        }
    };
    createButtons('tags-container', tags, 'tag');
    createButtons('organizer-container', organizers, 'organizer');
    createButtons('venue-container', venues, 'venue');
};

const initCalendar = () => {
    const calInput = document.getElementById("calendar-input");
    if(!calInput) return;
    flatpickr("#calendar-input", {
        inline: true, locale: "ja", dateFormat: "Y/m/d",
        onChange: (selectedDates, dateStr) => { filters.date = dateStr; renderEvents(); }
    });
};

onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (user) {
        if(loginBtn) {
            loginBtn.textContent = `${user.displayName || user.email.split('@')[0]} さん`;
            loginBtn.onclick = () => location.href = 'mypage.html'; 
        }
        const snap = await getDoc(doc(db, 'users', user.uid));
        favoriteEventIds = snap.exists() ? snap.data().favorites || [] : [];
    } else {
        if(loginBtn) {
            loginBtn.textContent = 'ログイン / サインアップ';
            loginBtn.onclick = () => modal.style.display = 'block';
        }
        favoriteEventIds = [];
    }
    renderEvents(); 
});

const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
if(searchBtn) searchBtn.onclick = () => { filters.search = searchInput.value.trim(); renderEvents(); };
if(searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchBtn.click(); });

const clearBtn = document.getElementById('clear-filters-btn');
if(clearBtn) clearBtn.onclick = () => {
    filters = { category: "all", search: "", tag: "", organizer: "", venue: "", date: "" };
    if(searchInput) searchInput.value = "";
    const allRadio = document.querySelector('.category-nav input[name="category"][value="all"]');
    if (allRadio) allRadio.checked = true;
    const fp = document.querySelector("#calendar-input")?._flatpickr;
    if (fp) fp.clear();
    loadInitialEvents(); 
};

document.querySelectorAll('.category-nav input[name="category"]').forEach(r => {
    r.onchange = () => { filters.category = r.value; renderEvents(); };
});

loadInitialEvents();
initCalendar();
