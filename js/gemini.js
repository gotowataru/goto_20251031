/* ============================================
      Gemini API（Cloudflare Worker）連携
      AIチャットUI制御（パーソナライズ版）
============================================ */

// Cloudflare Worker のエンドポイント
const GEMINI_ENDPOINT = "https://geminiapi.nattofromtheworld.workers.dev";

// DOM 要素取得
const aiToggle = document.getElementById("ai-chat-toggle");
const aiWindow = document.getElementById("ai-chat-window");
const aiClose = document.getElementById("ai-chat-close");
const aiMessages = document.getElementById("ai-chat-messages");
const aiInput = document.getElementById("ai-chat-input");
const aiSend = document.getElementById("ai-chat-send");

/* ================================
      チャットウィンドウ開閉
================================ */
if (aiToggle) {
    aiToggle.onclick = () => {
        aiWindow.classList.remove("ai-chat-hidden");
    };
}

if (aiClose) {
    aiClose.onclick = () => {
        aiWindow.classList.add("ai-chat-hidden");
    };
}

/* ================================
      メッセージ追加
================================ */
function addMessage(text, sender = "ai") {
    const div = document.createElement("div");
    div.className = sender === "user" ? "ai-chat-msg ai-chat-msg-user" : "ai-chat-msg ai-chat-msg-ai";
    div.textContent = text;
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
}

/* ================================
      イベント一覧とユーザーの好みを抽出
================================ */
function extractContext() {
    const cards = document.querySelectorAll(".event-card");
    const events = [];
    const userFavorites = [];

    // 現在表示されているカードから情報を抽出
    cards.forEach(card => {
        // タイトル取得（いいねボタンを除去）
        const titleEl = card.querySelector("h2")?.cloneNode(true);
        const likeContainer = titleEl?.querySelector(".like-container");
        if (likeContainer) likeContainer.remove();
        
        const title = titleEl?.innerText.trim() || "";
        const date = card.querySelector(".meta")?.innerText || "";
        const description = card.querySelector("p")?.innerText || "";
        const category = card.querySelector(".category-tag")?.innerText || "";
        const likes = parseInt(card.querySelector(".like-count")?.innerText || "0", 10);
        const eventId = card.querySelector(".favorite-btn")?.dataset.id;

        const eventInfo = { id: eventId, title, date, description, category, likes };
        events.push(eventInfo);

        // main.jsの favoriteEventIds（お気に入りID配列）に含まれていればユーザーの好みとして記録
        if (typeof favoriteEventIds !== 'undefined' && favoriteEventIds.includes(eventId)) {
            userFavorites.push(eventInfo);
        }
    });

    // ユーザーが好むタグやカテゴリを特定
    const favoriteCategories = [...new Set(userFavorites.map(e => e.category))];
    
    return {
        events,
        userPreferences: {
            favoriteCategories,
            favoriteTitles: userFavorites.map(e => e.title)
        }
    };
}

/* ================================
      Gemini（Cloudflare Worker）へ送信
=============================== */
async function askGemini(userMessage) {
    const context = extractContext();
    
    // 現在の日付
    const now = new Date();
    const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    // AIへの具体的な指示（プロンプト）
    const systemPrompt = `
# 役割
あなたはイベント案内専門のAIコンシェルジュです。

# 今日の日付
${todayStr}

# ユーザーの好み
- お気に入り登録済みのカテゴリ: ${context.userPreferences.favoriteCategories.join(", ") || "なし"}
- お気に入り登録済みのイベント名: ${context.userPreferences.favoriteTitles.join(", ") || "なし"}

# 現在掲載中のイベントリスト（likesはいいね数です）
${JSON.stringify(context.events, null, 2)}

# 回答ルール
1. ユーザーの質問に対し、リストの中から最適なものを提案してください。
2. 「いいねが多い」「人気」と聞かれたら、likes の数値が大きい順に紹介してください。
3. 「おすすめ」や「何かいいのある？」と聞かれたら、ユーザーの好みに近いカテゴリやイベントを優先的に提案してください。
4. 「今月」「今週末」などの期間指定は、今日の日付（${todayStr}）を基準に判断してください。
5. 該当がない場合は「あいにく...」と断った上で、ユーザーの好みに基づいた代替案を出してください。
6. 回答は簡潔に、最大3つまでに留めてください。
7. 架空のイベントを捏造しないでください。
`;

    const body = {
        contents: [{
            role: "user",
            parts: [{
                text: `${systemPrompt}\n\nユーザーの質問: ${userMessage}`
            }]
        }]
    };

    try {
        const res = await fetch(GEMINI_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "すみません、適切な回答が見つかりませんでした。";

    } catch (e) {
        console.error("Gemini Error:", e);
        return "通信エラーが発生しました。接続状況を確認してください。";
    }
}

/* ================================
      送信処理
================================ */
async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    aiInput.value = "";

    // 応答待ち表示
    const loadingId = "loading-" + Date.now();
    const loadingDiv = document.createElement("div");
    loadingDiv.id = loadingId;
    loadingDiv.className = "ai-chat-msg ai-chat-msg-ai";
    loadingDiv.textContent = "考え中...";
    aiMessages.appendChild(loadingDiv);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    const reply = await askGemini(text);
    
    // 待ち表示を消して回答を表示
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    addMessage(reply, "ai");
}

if (aiSend) aiSend.onclick = sendMessage;

if (aiInput) {
    aiInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
}
