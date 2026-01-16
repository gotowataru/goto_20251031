/* ============================================
      Gemini API（Cloudflare Worker）連携
      AIチャットUI制御（完全独立版）
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
      イベント一覧を抽出
================================ */
function extractEvents() {
    const cards = document.querySelectorAll(".event-card");
    const events = [];

    cards.forEach(card => {
        const title = card.querySelector("h2")?.innerText || "";
        const date = card.querySelector(".meta")?.innerText || "";
        const description = card.querySelector("p")?.innerText || "";
        const category = card.querySelector(".category-tag")?.innerText || "";

        events.push({ title, date, description, category });
    });

    return events;
}

/* ================================
      Gemini（Cloudflare Worker）へ送信
=============================== */
async function askGemini(userMessage) {
    const events = extractEvents();
    
    // 現在の日付を取得（「今月」「今週末」の判断に必須）
    const now = new Date();
    const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

    // AIへの具体的な指示（プロンプト）
    const systemPrompt = `
# 役割
あなたはイベント案内専門のAIコンシェルジュです。

# コンテキスト
- 今日の日付: ${todayStr}
- 現在掲載中のイベント情報:
${JSON.stringify(events, null, 2)}

# 回答ルール
1. ユーザーの質問に対し、提供されたイベント情報の中から最適なものを提案してください。
2. 「今月」「今週末」「今日」と言われたら、今日の日付（${todayStr}）を基準に判断してください。
3. 該当するイベントがない場合は、「あいにく条件に合うイベントは見当たりませんが、こちらのイベントはいかがでしょうか？」と代替案を1つ出してください。
4. 回答は簡潔に、最大3つまでの提案に留めてください。
5. 架空のイベントを捏造しないでください。
`;

    const body = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: `${systemPrompt}\n\nユーザーの質問: ${userMessage}`
                    }
                ]
            }
        ]
    };

    try {
        const res = await fetch(GEMINI_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        // Worker側でエラーが返ってきた場合の処理
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            return "すみません、ただいま混み合っております。少し時間を置いて再度お試しください。";
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "すみません、適切な回答が見つかりませんでした。";
        return reply;

    } catch (e) {
        console.error("Fetch Error:", e);
        return "通信エラーが発生しました。接続状況を確認してください。";
    }
}

/* ================================
      送信処理
================================ */
async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    // ユーザーのメッセージを表示
    addMessage(text, "user");
    aiInput.value = "";

    // 「考え中...」の表示（任意）
    const loadingMsg = "考え中...";
    // addMessage(loadingMsg, "ai"); // 簡易的なローディング表示をしたい場合は有効化

    const reply = await askGemini(text);
    addMessage(reply, "ai");
}

if (aiSend) {
    aiSend.onclick = sendMessage;
}

if (aiInput) {
    aiInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
}
