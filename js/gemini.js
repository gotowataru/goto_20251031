// ===============================
//  Gemini API via Cloudflare Worker
// ===============================

// あなたの Cloudflare Worker の URL
const GEMINI_ENDPOINT = "https://geminiapi.nattofromtheworld.workers.dev";

// チャット欄の要素
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

// ===============================
//  イベント一覧を HTML から抽出
// ===============================
function extractEvents() {
  const cards = document.querySelectorAll(".event-card");
  const events = [];

  cards.forEach(card => {
    const title = card.querySelector(".event-title")?.innerText || "";
    const category = card.dataset.category || "";
    const date = card.querySelector(".event-date")?.innerText || "";
    const description = card.querySelector(".event-description")?.innerText || "";

    events.push({ title, category, date, description });
  });

  return events;
}

// ===============================
//  Gemini に質問を送る
// ===============================
async function askGemini(userMessage) {
  const events = extractEvents();

  const requestBody = {
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

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  const result = await response.json();

  const reply =
    result?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "すみません、うまく応答できませんでした。";

  return reply;
}

// ===============================
//  チャットUIにメッセージを追加
// ===============================
function addMessage(text, sender = "user") {
  const div = document.createElement("div");
  div.className = sender === "user" ? "chat-user" : "chat-ai";
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ===============================
//  送信ボタンの動作
// ===============================
chatSend.addEventListener("click", async () => {
  const message = chatInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  chatInput.value = "";

  const reply = await askGemini(message);
  addMessage(reply, "ai");
});

// Enterキーでも送信
chatInput.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    chatSend.click();
  }
});
