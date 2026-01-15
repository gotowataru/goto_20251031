import { GoogleGenerativeAI } from "https://cdn.skypack.dev/@google/generative-ai";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Gemini API 設定 ---
// Google AI Studioで取得した最新のAPIキーを貼り付けてください
const GEMINI_API_KEY = "AIzaSyBnEl1VJ9qhAHNrCwQs7yrsQZuVElk3qKM"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * AIチャット機能を初期化・管理するクラス
 */
export class AIChatManager {
    constructor(db, auth) {
        this.db = db;
        this.auth = auth;
        // DOM要素の取得
        this.chatContainer = document.getElementById('ai-chat-container');
        this.chatMessages = document.getElementById('ai-chat-messages');
        this.chatInput = document.getElementById('ai-chat-input');
        this.sendBtn = document.getElementById('ai-chat-send');
        this.toggleBtn = document.getElementById('ai-chat-toggle');
        this.closeBtn = document.getElementById('close-chat-btn');
        
        // 生成モデルの初期化 (安定版の指定形式)
        this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
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

    // メッセージを画面に表示する
    addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.textContent = text;
        this.chatMessages.appendChild(div);
        
        // 常に最新のメッセージまでスクロール
        this.chatMessages.scrollTo({
            top: this.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    async askAI() {
        const userText = this.chatInput.value.trim();
        if (!userText) return;

        // ユーザーのメッセージを表示
        this.addMessage('user', userText);
        this.chatInput.value = '';

        // main.js の window.allEvents から最新のイベント情報を取得
        const currentEvents = window.allEvents || [];
        
        // AIに渡す背景知識（コンテキスト）の構築
        const eventContext = currentEvents.map(e => 
            `- ${e.name} (日付:${e.date}, 会場:${e.venue || '未定'}, カテゴリ:${e.category || 'その他'})`
        ).join('\n');

        const prompt = `あなたは親切なイベント案内人です。以下の「最新のイベントリスト」に基づいてユーザーの質問に日本語で答えてください。
リストにないイベントについては「現在のリストにはありません」と答えつつ、似たものがあれば提案してください。

【最新のイベントリスト】
${eventContext}

ユーザーの質問：${userText}`;

        try {
            // ローディング表示（簡易版）
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'msg ai loading-msg';
            loadingDiv.textContent = '考え中...';
            this.chatMessages.appendChild(loadingDiv);

            // Gemini API 呼び出し
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiResponse = response.text();

            // ローディング表示を削除してAIの回答を表示
            this.chatMessages.removeChild(loadingDiv);
            this.addMessage('ai', aiResponse);

            // ログイン中であれば会話履歴をFirestoreの「chats」コレクションに保存
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
            console.error("Gemini API Error:", e);
            // 既存のローディング表示があれば削除
            const loadingMsg = this.chatMessages.querySelector('.loading-msg');
            if (loadingMsg) this.chatMessages.removeChild(loadingMsg);
            
            this.addMessage('ai', "申し訳ありません。通信エラーが発生しました。APIキーの設定や制限を確認してください。");
        }
    }
}
