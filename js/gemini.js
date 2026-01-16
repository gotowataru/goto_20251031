/* ============================================
      Gemini API（Cloudflare Worker）連携
      AIチャットUI制御（完全独立）
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
================================ */
async function askGemini(userMessage) {
    const events = extractEvents();

    const body = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text:
                            "以下はイベント一覧です。ユーザーの質問に基づいて、最適なイベントを提案してください。\n\n" +
                            JSON.stringify(events, null, 2) +
                            "\n\nユーザーの質問: " +
                            userMessage
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

        const reply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "すみません、うまく応答できませんでした。";

        return reply;
    } catch (e) {
        console.error(e);
        return "エラーが発生しました。時間をおいて再度お試しください。";
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

    const reply = await askGemini(text);
    addMessage(reply, "ai");
}

if (aiSend) {
    aiSend.onclick = sendMessage;
}

if (aiInput) {
    aiInput.addEventListener("keypress", e => {
        if (e.key === "Enter") sendMessage();
    });
}
