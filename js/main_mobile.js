<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <!-- スマホ前提 -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>イベント一覧 | モバイル</title>
    <link rel="stylesheet" href="css/style_mobile.css">
</head>
<body>

    <!-- ヘッダー -->
    <header class="header">
        <h1>イベント一覧</h1>
        <div class="header-controls">
            <!-- フィルタードロワーを開くボタン -->
            <button id="open-filter-btn" aria-label="フィルターを開く" class="filter-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
                </svg>
                <span>フィルター</span>
            </button>
            <!-- ログインボタン -->
            <button id="login-btn-header" class="login-btn-mobile">ログイン</button>
        </div>
    </header>

    <!-- カテゴリナビ（横スクロール前提） -->
    <nav class="category-nav">
        <label class="radio-label"><input type="radio" name="category" value="all" checked><span>すべて</span></label>
        <label class="radio-label"><input type="radio" name="category" value="matsuri"><span>祭り</span></label>
        <label class="radio-label"><input type="radio" name="category" value="music"><span>音楽</span></label>
        <label class="radio-label"><input type="radio" name="category" value="learn"><span>学び</span></label>
        <label class="radio-label"><input type="radio" name="category" value="workshop"><span>ワークショップ</span></label>
        <label class="radio-label"><input type="radio" name="category" value="sports"><span>スポーツ</span></label>
        <label class="radio-label"><input type="radio" name="category" value="gourmet"><span>グルメ</span></label>
        <label class="radio-label"><input type="radio" name="category" value="exhibition"><span>展示・芸術</span></label>
    </nav>

    <!-- メインコンテンツ（1カラム） -->
    <div class="container-mobile">
        <div class="main-mobile">

            <!-- 検索バー -->
            <div class="search-container-mobile">
                <input
                    type="search"
                    id="search-input"
                    name="site_event_search_q"
                    placeholder="イベントを検索..."
                    autocomplete="off"
                    aria-label="イベントキーワード検索"
                >
                <button id="search-btn">検索</button>
            </div>

            <!-- おすすめイベント（カルーセル） -->
            <section class="featured" id="featured-section" style="display:none;">
                <h2 class="featured-title">おすすめイベント</h2>
                <div class="carousel-container">
                    <button id="prev-slide-btn" class="carousel-control prev" aria-label="前のスライド">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z"/>
                        </svg>
                    </button>
                    <button id="next-slide-btn" class="carousel-control next" aria-label="次のスライド">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z"/>
                        </svg>
                    </button>
                    <div class="featured-grid" id="featured-grid"></div>
                </div>
            </section>

            <!-- 開催予定イベント -->
            <section>
                <h2 class="event-list-title">開催予定イベント</h2>
                <div class="event-grid" id="event-grid">
                    <div class="loading">
                        <svg viewBox="0 0 38 38" stroke="var(--primary)" style="width:48px;height:48px;">
                            <g fill="none" stroke-width="4">
                                <circle cx="19" cy="19" r="16" stroke-opacity=".3"/>
                                <path d="M19 3 A16 16 0 0 1 19 35">
                                    <animateTransform attributeName="transform" type="rotate"
                                        from="0 19 19" to="360 19 19"
                                        dur="1s" repeatCount="indefinite"/>
                                </path>
                            </g>
                        </svg>
                        <br>読み込み中...
                    </div>
                </div>
                <div id="load-more-trigger" class="load-more">
                    <span>もっと見る</span>
                </div>
            </section>
        </div>
    </div>

    <!-- モバイル用フィルタードロワー -->
    <div id="filter-drawer" class="drawer-mobile">
        <div class="drawer-header">
            <h2>イベントフィルター</h2>
            <button id="close-filter-btn" aria-label="フィルターを閉じる">×</button>
        </div>
        <div class="drawer-content">
            <div class="filter-group" id="tags-filter">
                <h3>タグ</h3>
                <div class="filter-tags" id="tags-container"></div>
            </div>
            <div class="filter-group" id="organizer-filter">
                <h3>主催者</h3>
                <div class="filter-tags" id="organizer-container"></div>
            </div>
            <div class="filter-group" id="venue-filter">
                <h3>会場</h3>
                <div class="filter-tags" id="venue-container"></div>
            </div>
        </div>
        <div class="drawer-footer">
            <button id="clear-filters-btn-mobile" class="action-btn clear">条件をクリア</button>
            <button id="apply-filter-btn" class="action-btn primary">適用して閉じる</button>
        </div>
    </div>

    <!-- ログインモーダル -->
    <div id="login-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn">×</span>
            <h2 style="text-align:center;">ログイン / サインアップ</h2>
            <div class="auth-buttons">
                <button id="google-login-btn">Googleでログイン</button>
                <button id="github-login-btn">GitHubでログイン</button>
            </div>
            <hr style="margin:20px 0; border:0; border-top:1px solid #eee;">
            <input type="email" id="email-input" placeholder="メールアドレス">
            <input type="password" id="password-input" placeholder="パスワード（6文字以上）">
            <div class="auth-buttons">
                <button id="email-signup-btn">アカウント作成</button>
                <button id="email-login-btn">メールでログイン</button>
            </div>
        </div>
    </div>

    <!-- フッター -->
    <footer class="footer">
        <p>&copy; 2024 Event List App</p>
    </footer>

    <!-- スマホ用 JS -->
    <script type="module" src="js/main_mobile.js"></script>
</body>
</html>
