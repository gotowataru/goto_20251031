import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"; 
import { getAuth, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, arrayRemove, query, where, getDocs, collection, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Firebase 設定 ---
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

// --- DOM Elements ---
const userInfo = document.getElementById('user-info-text');
const favoritesList = document.getElementById('favorites-list');
const submittedEventsList = document.getElementById('submitted-events-list'); 
const editModal = document.getElementById('edit-modal');
const newDisplayNameInput = document.getElementById('new-display-name');

let currentUser = null;

const STATUS_MAP = {
    pending: '申請中',
    approved: '承認済み',
    rejected: '却下'
};

// --- 共通ユーティリティ関数 ---

const formatToCalendarDate = (date, start, end) => {
    if (!start || !end) return null;
    const startDate = new Date(`${date}T${start}:00`);
    const endDate = new Date(`${date}T${end}:00`);

    const formatPart = (dt) => {
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        const hour = String(dt.getHours()).padStart(2, '0');
        const minute = String(dt.getMinutes()).padStart(2, '0');
        const second = String(dt.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hour}${minute}${second}`;
    };
    return `${formatPart(startDate)}/${formatPart(endDate)}`;
};

const removeFavorite = async (eventId) => {
    if (!confirm('お気に入りから解除しますか？')) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { favorites: arrayRemove(eventId) });
        displayFavoriteEvents();
    } catch (error) {
        console.error("Error removing favorite:", error);
        alert("お気に入り解除に失敗しました。");
    }
};
window.removeFavorite = removeFavorite; 

// --- 1. 登録イベントの表示 ---

const displaySubmittedEvents = async () => {
    submittedEventsList.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#777;">イベントを読み込み中...</p>';
    
    if (!currentUser) return;

    try {
        const q = query(collection(db, 'events'), where('submittedBy', '==', currentUser.uid));
        const snap = await getDocs(q);

        if (snap.empty) {
            submittedEventsList.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:1.3em;">あなたが登録したイベントはありません。</p>';
            return;
        }

        let html = '';
        snap.forEach(s => {
            const d = s.data();
            const id = s.id;
            const status = d.status || 'pending';
            const statusText = STATUS_MAP[status] || '不明';

            const img = d.imageUrl ? `<img src="${d.imageUrl}" alt="${d.name}">` : '<div style="height:180px; background:#eee; display:flex; align-items:center; justify-content:center; color:#999;">画像なし</div>';
            const displayDesc = d.summary || (d.description ? d.description.substring(0,80) + '...' : '詳細なし...');

            html += `
                <div class="event-card">
                    ${img}
                    <div class="event-content">
                        <h3 class="event-title">
                            ${d.name}
                            <span class="status-badge ${status}">${statusText}</span>
                        </h3>
                        <p style="font-size:0.9em;"><strong>${d.date}</strong> ${d.startTime || '開始時間未定'} 〜 ${d.endTime || '終日'}</p>
                        <p style="font-size:0.9em;">${displayDesc}</p>
                        
                        <a href="submit_event.html?editId=${id}" class="edit-link">編集/詳細確認</a>
                    </div>
                    ${status === 'rejected' && d.adminNotes ? `<p style="color:var(--rejected); font-size:0.8em; padding:10px 20px 0;">却下理由: ${d.adminNotes.substring(0, 50)}...</p>` : ''}
                </div>
            `;
        });

        submittedEventsList.innerHTML = html;

    } catch (error) {
        console.error("Error fetching submitted events:", error);
        submittedEventsList.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--accent);">登録イベントの読み込み中にエラーが発生しました。</p>';
    }
};

// --- 2. お気に入りイベントの表示 ---

const displayFavoriteEvents = async () => {
    favoritesList.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#777;">読み込み中...</p>';
    
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userSnap.exists() || !userSnap.data().favorites?.length) {
        favoritesList.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:1.3em;">まだお気に入りは登録されていません</p>';
        return;
    }

    const favIds = userSnap.data().favorites;
    const batches = [];
    for (let i = 0; i < favIds.length; i += 10) {
        batches.push(favIds.slice(i, i + 10));
    }

    let allEvents = [];
    for (const batch of batches) {
        const q = query(collection(db, 'events'), where('__name__', 'in', batch));
        const snaps = await getDocs(q);
        snaps.forEach(s => {
            const data = s.data();
            data.id = s.id;
            allEvents.push(data);
        });
    }
    
    let html = '';
    if (allEvents.length === 0) {
        favoritesList.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:1.3em;">お気に入りのイベントが見つかりません</p>';
        return;
    }
    
    allEvents.forEach(d => {
        const dates = formatToCalendarDate(d.date, d.startTime, d.endTime);
        
        const calBtn = dates ? `<a href="https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(d.name)}&dates=${dates}Z&details=${encodeURIComponent(d.venue || '会場')}&location=${encodeURIComponent(d.venue || '')}" target="_blank" class="calendar-btn">Googleカレンダーに追加</a>` : '';

        const img = d.imageUrl ? `<img src="${d.imageUrl}" alt="${d.name}">` : '<div style="height:180px; background:#eee; display:flex; align-items:center; justify-content:center; color:#999;">画像なし</div>';

        const displayDesc = d.summary || (d.description ? d.description.substring(0,80) + '...' : '詳細なし...');

        html += `
            <div class="event-card">
                <a href="detail.html?id=${d.id}" style="text-decoration:none; color:inherit; display:block;">
                    ${img}
                    <div class="event-content" style="padding-bottom:0;">
                        <h3 class="event-title">${d.name}</h3>
                        <p style="font-size:0.9em;"><strong>${d.date}</strong> ${d.startTime || '開始時間未定'} 〜 ${d.endTime || '終日'}</p>
                        <p style="font-size:0.9em;">${displayDesc}</p>
                    </div>
                </a>
                <div class="event-content" style="padding-top:0;">
                     ${calBtn}
                </div>
                <button class="remove-btn" onclick="removeFavorite('${d.id}')">×</button>
            </div>
        `;
    });
    favoritesList.innerHTML = html;
};

// --- 3. プロフィール管理と認証 ---

const updateUserInfoDisplay = (user) => {
    const displayName = user.displayName || user.email.split('@')[0];
    userInfo.innerHTML = `<strong>${displayName}</strong> さん、ようこそ！<br>Email: ${user.email}`;
    newDisplayNameInput.value = user.displayName || '';
};

document.getElementById('save-profile-btn').onclick = async () => {
    const newName = newDisplayNameInput.value.trim();
    if (newName && currentUser) {
        try {
            await updateProfile(currentUser, { displayName: newName });
            await setDoc(doc(db, 'users', currentUser.uid), { displayName: newName }, { merge: true });
            
            alert('プロフィールが更新されました！');
            editModal.style.display = 'none';
            updateUserInfoDisplay(auth.currentUser); 
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("プロフィールの更新に失敗しました。");
        }
    } else {
        alert("表示名を入力してください。");
    }
};

document.getElementById('edit-profile-btn').onclick = () => {
    if(currentUser) {
        newDisplayNameInput.value = currentUser.displayName || '';
        editModal.style.display = 'block';
    }
};
editModal.onclick = (e) => { if(e.target === editModal) editModal.style.display = 'none'; };

// 起動時処理
onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) {
        updateUserInfoDisplay(user);
        displaySubmittedEvents(); 
        displayFavoriteEvents();
    } else {
        setTimeout(() => { alert('ログインが必要です'); location.href = 'index.html'; }, 200);
    }
});

document.getElementById('logout-btn').onclick = async () => {
    await signOut(auth);
    location.href = 'index.html?logout=success';
};
