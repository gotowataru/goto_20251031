// --- Gemini API をブラウザから直接叩く版（v1beta + gemini-pro） ---
// ※ APIキーは公開されるので研究用途以外では絶対に使わないこと
const GEMINI_API_KEY = "YOUR_API_KEY_HERE"; 

// Firestore
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/**
 * AIチャット機能を初期化・管理するクラス
 */
export class AIChatManager {
    constructor(db, auth) {
        this.db = db;
        this.auth = auth;

        // DOM要素
        this.chatContainer = document.getElementById('ai-chat-container');
        this.chatMessages = document.getElementById('ai-chat-messages');
        this.chatInput = document.getElementById('ai-chat-input');
        this.sendBtn = document.getElementById('ai-chat-send');
        this.toggleBtn = document.getElementById('ai-chat-toggle');
        this.closeBtn = document.getElementById('close-chat-btn');

        this.initEventListeners();
    }

    initEventListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.onclick = () => {
                this.chatContainer.classList.toggle('ai-chat-closed');
            };
        }
        if (this.closeBtn) {
            this.closeBtn.onclick = () => {
                this.chatContainer.classList.add('ai-chat-closed');
            };
        }
        if (this.sendBtn) {
            this.sendBtn.onclick = () => this.askAI();
        }
        if (this.chatInput) {
            this.chatInput.onkeypress = (e) => {
                if (e.key === 'Enter') this.askAI();
            };
        }
    }

    // メッセージを画面に表示
    addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.textContent = text;
        this.chatMessages.appendChild(div);

        this.chatMessages.scrollTo({
            top: this.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    // --- Gemini API を fetch で直接叩く ---
    async callGeminiAPI(prompt) {
        const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

        const headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        };

        const body = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ]
        };

        const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API Error: ${res.status} ${errText}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "（返答を取得できませんでした）";
    }

    // --- メイン処理 ---
    async askAI() {
        const userText = this.chatInput.value.trim();
        if (!userText) return;

        this.addMessage('user', userText);
        this.chatInput.value = '';

        // main.js の window.allEvents からイベント情報を取得
        const currentEvents = window.allEvents || [];

        const eventContext = currentEvents.map(e =>
            `- ${e.name} (日付:${e.date}, 会場:${e.venue || '未定'}, カテゴリ:${e.category || 'その他'})`
        ).join('\n');

        const prompt = `あなたは親切なイベント案内人です。以下の「最新のイベントリスト」に基づいてユーザーの質問に日本語で答えてください。
リストにないイベントについては「現在のリストにはありません」と答えつつ、似たものがあれば提案してください。

【最新のイベントリスト】
${eventContext}

ユーザーの質問：${userText}`;

        // ローディング表示
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'msg ai loading-msg';
        loadingDiv.textContent = '考え中...';
        this.chatMessages.appendChild(loadingDiv);

        try {
            const aiResponse = await this.callGeminiAPI(prompt);

            // ローディング削除
            this.chatMessages.removeChild(loadingDiv);

            // AIの返答表示
            this.addMessage('ai', aiResponse);

            // Firestore 保存
            const user = this.auth.currentUser;
            if (user) {
                await addDoc(collection(this.db, "chats"), {
                    userId: user.uid,
                    userName: user.displayName || user.email,
                    message: userText,
                    reply: aiResponse,
                    createdAt: serverTimestamp()
                });
            }
        } catch (e) {
            console.error(e);

            const loadingMsg = this.chatMessages.querySelector('.loading-msg');
            if (loadingMsg) this.chatMessages.removeChild(loadingMsg);

            this.addMessage('ai', "申し訳ありません。Gemini API との通信でエラーが発生しました。");
        }
    }
}
