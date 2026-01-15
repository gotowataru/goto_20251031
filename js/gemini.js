import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Gemini API 設定 ---
// ※ 勉強用のためここに記述しますが、本来は環境変数などで管理します
const GEMINI_API_KEY = "AIzaSyBnEl1VJ9qhAHNrCwQs7yrsQZuVElk3qKM"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * AIチャット機能を初期化・管理するクラス
 */
export class AIChatManager {
    constructor(db, auth) {
        this.db = db;
        this.auth = auth;
        this.chatContainer = document.getElementById('ai-chat-container');
        this.chatMessages = document.getElementById('ai-chat-messages');
        this.chatInput = document.getElementById('ai-chat-input');
        this.sendBtn = document.getElementById('ai-chat-send');
        this.toggleBtn = document.getElementById('ai-chat-toggle');
        this.closeBtn = document.getElementById('close-chat-btn');
        
        this.initEventListeners();
    }

    initEventListeners() {
        if (this.toggleBtn) this.toggleBtn.onclick = () => this.chatContainer.classList.toggle('ai-chat-closed');
        if (this.closeBtn) this.closeBtn.onclick = () => this.chatContainer.classList.add('ai-chat-closed');
        if (this.sendBtn) this.sendBtn.onclick = () => this.askAI();
        if (this.chatInput) {
            this.chatInput.onkeypress = (e) => { if (e.key === 'Enter') this.askAI(); };
        }
    }

    addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.textContent = text;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async askAI() {
        // 現在の最新イベント情報を main.js 側のグローバル変数から取得するための工夫が必要
        // 今回は window オブジェクト経由または引数経由を想定
        const currentEvents = window.allEvents || [];
        const userText = this.chatInput.value.trim();
        
        if (!userText) return;

        this.addMessage('user', userText);
        this.chatInput.value = '';

        // コンテキスト（背景知識）の作成
        const eventContext = currentEvents.map(e => 
            `- ${e.name} (日時:${e.date}, 会場:${e.venue || '未定'}, カテゴリ:${e.category || '不明'})`
        ).join('\n');

        const prompt = `あなたは親切なイベント案内人です。以下の最新イベント情報を踏まえて、ユーザーの質問に回答してください。
もし該当するイベントがない場合は、似たカテゴリを勧めるか、「現在募集中のリストにはありません」と伝えてください。

【イベントリスト】
${eventContext}

ユーザーの質問：${userText}`;

        try {
            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();
            this.addMessage('ai', aiResponse);

            // ログイン中ならFirestoreに会話を保存
            const user = this.auth.currentUser;
            if (user) {
                await addDoc(collection(this.db, "chats"), {
                    userId: user.uid,
                    message: userText,
                    reply: aiResponse,
                    createdAt: serverTimestamp()
                });
            }
        } catch (e) {
            console.error("Gemini Error:", e);
            this.addMessage('ai', "通信エラーが発生しました。しばらく経ってから再度お試しください。");
        }
    }
}
