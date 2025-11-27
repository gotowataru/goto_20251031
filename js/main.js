import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

// （以下、以前貼っていただいたコードと全く同じでOKです。変更点は loadFeatured 内のカルーセル部分のみ）

// ...（省略：以前のコード全部そのまま）...

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

    // カルーセル初期化
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const scrollAmount = 405;

    nextBtn.onclick = () => grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    prevBtn.onclick = () => grid.scrollBy({ left: -scrollAmount, behavior: 'smooth' });

    // 8秒ごとに自動スライド
    setInterval(() => {
        if (grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 50) {
            grid.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }, 8000);
};

// 残りのコードは以前の完全版と100%同じでOKです
// （loadInitialEvents(); の最後までそのまま）

loadInitialEvents();
