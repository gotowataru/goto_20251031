// js/main.js  ← このファイルに全コピーして上書きしてください！！

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
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
  query,
  where,
  orderBy,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDt69H-dBGMB4HANbwVj007vJ3yblEZdqE",
  authDomain: "goto6234.firebaseapp.com",
  projectId: "goto6234",
  storageBucket: "goto6234.firebasestorage.app",
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

// モーダル
const modal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn-header');
const closeBtn = document.querySelector('.close-btn');

loginBtn.onclick = () => { if (!currentUser) modal.style.display = 'block'; };
closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

// 認証
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, googleProvider).then(() => modal.style.display = 'none').catch(e => alert(e.message));
document.getElementById('github-login-btn').onclick = () => signInWithPopup(auth, githubProvider).then(() => modal.style.display = 'none').catch(e => alert(e.message));

document.getElementById('email-signup-btn').onclick = () => {
  const email = document.getElementById('email-input').value.trim();
  const pass = document.getElementById('password-input').value;
  if (email && pass.length >= 6) {
    createUserWithEmailAndPassword(auth, email, pass)
      .then(() => modal.style.display = 'none')
      .catch(e => alert(e.message));
  } else alert("メールと6文字以上のパスワードを入力してください");
};

document.getElementById('email-login-btn').onclick = () => {
  const email = document.getElementById('email-input').value.trim();
  const pass = document.getElementById('password-input').value;
  if (email && pass) {
    signInWithEmailAndPassword(auth, email, pass)
      .then(() => modal.style.display = 'none')
      .catch(e => alert(e.message));
  } else alert("メールとパスワードを入力してください");
};

const categoryNames = {
  matsuri: "祭り",
  music: "音楽",
  learn: "学び",
  workshop: "ワークショップ",
  sports: "スポーツ",
  gourmet: "グルメ",
  exhibition: "展示・芸術"
};

let filters = { category: "all", search: "", tag: "", organizer: "", venue: "" };

// イベント描画
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
    const img = ev.imageUrl ? `<img src="${ev.imageUrl}" alt="${ev.name}" loading="lazy">` : `<div style="height:200px;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;">画像なし</div>`;
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

// お気に入り
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

// おすすめイベント＋カルーセル
const loadFeatured = async () => {
  const q = query(collection(db, "events"), where("isFeatured", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) return;

  document.getElementById('featured-section').style.display = "block";
  const grid = document.getElementById('featured-grid');
  grid.innerHTML = snap.docs.map(d => {
    const e = d.data(); e.id = d.id;
    const img = e.imageUrl ? `<img src="${e.imageUrl}" alt="${e.name}" loading="lazy">` : `<div style="height:260px;background:#eee;"></div>`;
    return `<div class="featured-card">
      <span class="featured-label">おすすめ</span>
      <a href="detail.html?id=${e.id}" style="text-decoration:none;color:inherit;display:block;">
        ${img}
        <div class="content">
          <h3>${e.name}</h3>
          <p><strong>${e.date}</strong> ${e.venue || ""}</p>
        </div>
      </a>
    </div>`;
  }).join("");

  // カルーセル機能
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const scrollAmount = 405; // 380pxカード + 25px gap

  nextBtn.onclick = () => grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  prevBtn.onclick = () => grid.scrollBy({ left: -scrollAmount, behavior: 'smooth' });

  // 自動スライド（8秒ごと）
  setInterval(() => {
    if (grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 50) {
      grid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, 8000);
};

// 新着イベント
const loadNewEvents = async () => {
  const q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(5));
  const snap = await getDocs(q);
  document.getElementById('new-events-list').innerHTML = snap.docs.map(d => {
    const e = d.data();
    return `<li><a href="detail.html?id=${d.id}">${e.name}</a><br><small>${e.date}</small></li>`;
  }).join("") || "<li>新着イベントはありません</li>";
};

// サイドバーフィルタ生成
const generateSidebarFilters = () => {
  const tags = new Set(), organizers = new Set(), venues = new Set();
  allEvents.forEach(e => {
    if (Array.isArray(e.tags)) e.tags.forEach(t => tags.add(t));
    if (e.organizer) organizers.add(e.organizer);
    if (e.venue) venues.add(e.venue);
  });

  const createButtons = (containerId, items, type) => {
    const container = document.getElementById(containerId);
    if (!container || items.size === 0) return;
    document.getElementById(containerId.replace('-container', '-filter')).style.display = "block";
    container.innerHTML = "";
    items.forEach(item => {
      const btn = document.createElement('span');
      btn.className = "tag-btn";
      btn.textContent = item;
      btn.onclick = () => {
        const isActive = btn.classList.contains('active');
        container.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
        if (!isActive) {
          btn.classList.add('active');
          filters[type] = item;
        } else {
          filters[type] = "";
        }
        renderEvents();
      };
      container.appendChild(btn);
    });
  };

  createButtons('tags-container', tags, 'tag');
  createButtons('organizer-container', organizers, 'organizer');
  createButtons('venue-container', venues, 'venue');
};

// 無限スクロール
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

// 初回読み込み
const loadInitialEvents = async () => {
  const snap = await getDocs(query(collection(db, "events"), orderBy("date"), limit(PAGE_SIZE)));
  allEvents = snap.docs.map(d => { const data = d.data(); data.id = d.id; return data; });
  lastVisible = snap.docs[snap.docs.length - 1] || null;

  renderEvents();
  loadFeatured();
  loadNewEvents();
  generateSidebarFilters();

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !isLoading) loadMoreEvents();
  }, { rootMargin: "400px" });
  observer.observe(document.getElementById('load-more-trigger'));
};

// 認証状態監視
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

// 検索・フィルタ
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
  document.querySelector('input[name="category"][value="all"]').checked = true;
  document.querySelectorAll('.tag-btn.active').forEach(b => b.classList.remove('active'));
  renderEvents();
};
document.querySelectorAll('input[name="category"]').forEach(r => {
  r.onchange = () => { filters.category = r.value; renderEvents(); };
});

// スタート！
loadInitialEvents();
