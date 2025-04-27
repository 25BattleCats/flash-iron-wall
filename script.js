let cards = [];
let reviewQueue = [];
let reviewIndex = 0;

// DOM要素の取得（頻繁に使うものを最初に取得しておくと効率が良い場合がある）
const tsvFileInput = document.getElementById('tsv-file');
const fileNameSpan = document.getElementById('file-name');
const importBtn = document.getElementById('import-btn');
const importMsgDiv = document.getElementById('import-msg');
const skipMsgDiv = document.getElementById('skip-msg');
const frontInput = document.getElementById('front-input');
const backInput = document.getElementById('back-input');
const addBtn = document.getElementById('add-btn');
const addMsgDiv = document.getElementById('add-msg');
const cardBox = document.getElementById('card-box');
const showAnswerBtn = document.getElementById('show-answer-btn');
const controlsDiv = document.getElementById('controls');
const moreBtn = document.getElementById('more-btn');
const listBody = document.getElementById('list-body');
const paginationDiv = document.getElementById('pagination');

// グローバル変数に以下を追加
let currentReviewBatch = []; // 現在の復習バッチ (最大20枚)
let batchIndex = 0; // 現在のバッチ内でのインデックス
let totalReviewableCount = 0; // 今回の復習セッション開始時の復習対象総数

// DOM要素の取得に追加
const reviewProgressDiv = document.getElementById('review-progress');
const nextBatchBtn = document.getElementById('next-batch-btn'); // ID変更に対応

// 初期化処理
window.onload = () => {
    // タブボタンのイベントリスナー設定
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => showSection(btn.dataset.tab);
    });

    // インポート関連のイベントリスナー設定
    if (tsvFileInput && importBtn && fileNameSpan && importMsgDiv && skipMsgDiv) {
        tsvFileInput.onchange = handleFileSelect;
        importBtn.onclick = importCards;
    }

    // 手動追加関連のイベントリスナー設定
    if (addBtn && frontInput && backInput && addMsgDiv) {
        addBtn.onclick = addCard;
    }

    // 復習関連のイベントリスナー設定
    if (showAnswerBtn && nextBatchBtn) { // nextBatchBtn を使用
        showAnswerBtn.onclick = showAnswer;
        nextBatchBtn.onclick = loadNextBatch; // nextBatchBtn クリックで次のバッチを読み込む
    }

    // カードデータの読み込みと初期表示
    loadCards();
    showSection('import'); // 最初にインポートセクションを表示
};

// ファイル選択時の処理
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (fileNameSpan && importBtn && importMsgDiv && skipMsgDiv) {
        fileNameSpan.textContent = file ? file.name : '';
        importBtn.disabled = !file;
        importMsgDiv.textContent = '';
        skipMsgDiv.textContent = '';
    }
}

// セクション表示切り替え
function showSection(name) {
    document.querySelectorAll('.tab-section').forEach(sec => {
        sec.id === name ? sec.classList.remove('hidden') : sec.classList.add('hidden');
    });

    // セクションに応じた初期化処理
    if (name === 'review') {
        startReview();
    } else if (name === 'list') {
        renderList(1); // 初回は1ページ目を表示
    }
}

// TSVファイルからカードをインポート
function importCards() {
    const file = tsvFileInput.files[0];
    if (!file || !Papa) return; // ファイルがない、またはPapaParseが読み込まれていない場合は処理しない

    importBtn.disabled = true; // 処理中はボタンを無効化

    Papa.parse(file, {
        delimiter: '\t',
        skipEmptyLines: true,
        complete: results => {
            let addedCount = 0;
            let skippedCount = 0;
            results.data.forEach(row => {
                if (row.length >= 2) {
                    const front = String(row[0]).trim(); // 文字列に変換し、トリム
                    const back = String(row[1]).trim(); // 文字列に変換し、トリム

                    if (front && back) { // frontとbackが空でないことを確認
                        if (!cards.some(c => c.front === front && c.back === back)) {
                            cards.push({
                                front: front,
                                back: back,
                                ease: 2.5,
                                interval: 1,
                                next: new Date() // Dateオブジェクトとして保存
                            });
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        // 空の行やデータが不足している行はスキップとしてカウントしても良い
                        skippedCount++;
                        console.warn("Skipped row due to empty front/back:", row);
                    }
                } else {
                    skippedCount++;
                    console.warn("Skipped row due to insufficient columns:", row);
                }
            });

            saveCards(); // ローカルストレージに保存

            if (importMsgDiv) importMsgDiv.textContent = `${addedCount}件のカードを追加しました。`;
            if (skipMsgDiv) skipMsgDiv.textContent = skippedCount > 0 ? `重複または無効なデータのため${skippedCount}件スキップしました。` : '';

            // フォームリセット
            if (tsvFileInput) tsvFileInput.value = '';
            if (fileNameSpan) fileNameSpan.textContent = '';
            // インポートボタンはdisabledのまま
        },
        error: (error) => {
            console.error("CSV Parse Error:", error);
            if (importMsgDiv) importMsgDiv.textContent = `ファイルの解析中にエラーが発生しました: ${error.message}`;
            if (importBtn) importBtn.disabled = false; // エラー時は再度有効化
        }
    });
}

// カードを手動で追加
function addCard() {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();

    if (front && back) {
        // 重複チェック (任意)
        if (cards.some(c => c.front === front && c.back === back)) {
            addMsgDiv.textContent = 'このカードは既に追加されています。';
            addMsgDiv.className = 'mt-2 text-red-600 font-medium'; // エラーメッセージ風に
            return;
        }

        cards.push({
            front: front,
            back: back,
            ease: 2.5,
            interval: 1,
            next: new Date() // Dateオブジェクトとして保存
        });
        saveCards();

        addMsgDiv.textContent = '1件のカードを追加しました。';
        addMsgDiv.className = 'mt-2 text-green-600 font-medium'; // 成功メッセージの色
        frontInput.value = '';
        backInput.value = '';
        frontInput.focus(); // 次の入力を促す
    } else {
        addMsgDiv.textContent = '表面と裏面の両方を入力してください。';
        addMsgDiv.className = 'mt-2 text-red-600 font-medium';
    }
}

// 復習セッションを開始または再開
function startReview() {
    const now = new Date();
    reviewQueue = cards.filter(c => c.next <= now); // 復習対象を抽出
    totalReviewableCount = reviewQueue.length; // 今回の復習対象総数を記録
    // reviewQueue.sort(() => Math.random() - 0.5); // 必要ならランダム化

    console.log(`復習開始: 対象 ${totalReviewableCount}枚`); // デバッグ用

    loadNextBatch(); // 最初のバッチを読み込む
}

// 次の復習バッチ（最大20件）を読み込む
function loadNextBatch() {
    nextBatchBtn.classList.add('hidden'); // 「次のバッチへ」ボタンを隠す
    controlsDiv.innerHTML = ''; // 難易度ボタンをクリア
    showAnswerBtn.classList.add('hidden'); // 答えを見るボタンを隠す

    if (reviewQueue.length === 0) {
        // 読み込むべきカードがもうない場合
        cardBox.innerHTML = '<div class="text-center text-xl font-semibold">今回の復習は完了しました！</div>';
        reviewProgressDiv.textContent = ''; // 進捗表示もクリア
        // 次回復習可能なカードがあるかチェック (任意)
        const upcomingCards = cards.filter(c => c.next > new Date()).length;
        if (upcomingCards > 0) {
            cardBox.innerHTML += `<div class="mt-2 text-sm text-gray-600">${upcomingCards}枚のカードが次の復習を待っています。</div>`;
        }
        return;
    }

    // reviewQueueから最大20件取り出して現在のバッチとする
    currentReviewBatch = reviewQueue.splice(0, 20);
    batchIndex = 0; // バッチ内のインデックスをリセット

    console.log(`次のバッチ読み込み: ${currentReviewBatch.length}枚 (全体残り ${reviewQueue.length}枚)`); // デバッグ用

    showCard(); // バッチの最初のカードを表示
}

// 復習カードを表示 (表面のみ)
function showCard() {
    controlsDiv.innerHTML = ''; // 難易度ボタンをクリア
    showAnswerBtn.classList.add('hidden'); // 「答えを見る」ボタンを隠す
    nextBatchBtn.classList.add('hidden'); // 「次のバッチへ」ボタンを隠す

    if (batchIndex >= currentReviewBatch.length) {
        // 現在のバッチが終了した場合
        console.log("現在のバッチ完了"); // デバッグ用
        if (reviewQueue.length > 0) {
            // まだ全体の復習キューにカードが残っている場合
            cardBox.innerHTML = `<div class="text-center text-lg">現在のバッチ(${currentReviewBatch.length}枚)が完了しました。<br>休憩して、準備ができたら次に進んでください。</div>`;
            reviewProgressDiv.textContent = `全体残り: ${reviewQueue.length} 枚`; // 全体の残りだけ表示
            nextBatchBtn.classList.remove('hidden'); // 「次の20件へ」ボタンを表示
        } else {
            // 全ての復習が完了した場合
            cardBox.innerHTML = '<div class="text-center text-xl font-semibold">今回の復習は全て完了しました！</div>';
            reviewProgressDiv.textContent = ''; // 進捗表示クリア
            // 次回復習可能なカードがあるかチェック (任意)
            const upcomingCards = cards.filter(c => c.next > new Date()).length;
            if (upcomingCards > 0) {
                cardBox.innerHTML += `<div class="mt-2 text-sm text-gray-600">${upcomingCards}枚のカードが次の復習を待っています。</div>`;
            }
        }
        return;
    }

    // 現在のバッチ内のカードを表示
    const currentCard = currentReviewBatch[batchIndex];
    const frontHtml = escapeHtml(currentCard.front);
    cardBox.innerHTML = `<div class="font-bold text-lg mb-2">${frontHtml}</div>`;

    // 進捗状況を表示
    const batchTotal = currentReviewBatch.length;
    const remainingInQueue = reviewQueue.length;
    reviewProgressDiv.textContent = `現在のバッチ: ${batchIndex + 1} / ${batchTotal} 枚 (全体残り: ${remainingInQueue} 枚)`;

    showAnswerBtn.classList.remove('hidden'); // 「答えを見る」ボタンを表示
}

// カードの答えを表示し、難易度選択ボタンを表示
function showAnswer() {
    showAnswerBtn.classList.add('hidden'); // 「答えを見る」ボタンを隠す

    if (batchIndex >= currentReviewBatch.length) return; // 既にバッチ完了している場合は何もしない

    const currentCard = currentReviewBatch[batchIndex]; // currentReviewBatch から取得
    const frontHtml = escapeHtml(currentCard.front);
    const backHtml = escapeHtml(currentCard.back).replace(/\n/g, '<br>');

    cardBox.innerHTML = `
      <div class="font-bold text-lg mb-2">${frontHtml}</div>
      <hr class="w-full my-2">
      <div>${backHtml}</div>
    `;

    controlsDiv.innerHTML = ''; // 既存のボタンをクリア
    const ratings = { 1: '忘れた', 2: '難しい', 3: '普通', 4: '良い', 5: '完璧' };
    const colors = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-blue-500', 5: 'bg-green-500' };

    for (let q = 1; q <= 5; q++) {
        const ratingLabel = ratings[q];
        const colorClass = colors[q];
        const btn = document.createElement('button');
        btn.textContent = ratingLabel;
        btn.className = `py-2 border rounded ${colorClass} text-white hover:opacity-80 transition-opacity`;
        // handleAnswer に渡すカードを currentCard に修正
        btn.onclick = () => handleAnswer(currentCard, q);
        controlsDiv.appendChild(btn);
    }
}

// ユーザーの回答(難易度)を処理し、カード情報を更新
function handleAnswer(card, quality) {
    const q = quality;

    // SM-2風のアルゴリズムで next, interval, ease を更新 (変更なし)
    if (q < 3) {
        card.interval = 1;
        card.ease = Math.max(1.3, card.ease - 0.2);
        let minutesToAdd = (q === 1) ? 1 : 10;
        card.next = new Date(Date.now() + minutesToAdd * 60 * 1000);
    } else {
        if (card.interval === 1 && q >= 3) { // 初めて正解した場合や間違えた直後
            card.interval = (q === 3) ? 1 : (q === 4 ? 2 : 3); // 例: 普通なら1日、良いなら2日、完璧なら3日
        } else if (card.interval < 6 && q >= 3) { // 2回目以降で間隔が短い場合
            card.interval = Math.ceil(card.interval * card.ease * (1 + (q - 3) * 0.1)); // qが高いほど伸びやすく
        } else if (q >= 3) { // 十分な間隔が空いている場合
            card.interval = Math.ceil(card.interval * card.ease);
        }
        // Ease Factorの更新
        card.ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
        card.next = new Date(Date.now() + card.interval * 24 * 60 * 60 * 1000);
    }


    saveCards(); // カードデータの変更を保存
    batchIndex++; // バッチ内の次のカードへ

    // 20件ごとのボタン表示ロジックは不要になったので削除
    // if (reviewIndex < reviewQueue.length && reviewIndex % 20 === 0) { ... } else { ... } の分岐を削除

    showCard(); // 次のカード表示（またはバッチ終了処理）へ
}

// カード一覧を指定されたページで表示
function renderList(page) {
    const itemsPerPage = 100; // 1ページあたりの表示件数
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCards = cards.slice(startIndex, endIndex);

    listBody.innerHTML = ''; // 一覧をクリア

    paginatedCards.forEach((card, index) => {
        const originalIndex = startIndex + index; // cards配列全体でのインデックス
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';

        // 日付を読みやすい形式にフォーマット
        const nextReviewDate = card.next.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });

        // HTMLエンティティをエスケープしてvalueに設定
        const frontValue = escapeHtml(card.front);
        const backValue = escapeHtml(card.back);

        tr.innerHTML = `
      <td class="py-2 px-4 border-b">
        <input value="${frontValue}" data-idx="${originalIndex}" class="w-full p-1 border rounded front-in bg-white" data-original-value="${frontValue}">
      </td>
      <td class="py-2 px-4 border-b">
        <input value="${backValue}" data-idx="${originalIndex}" class="w-full p-1 border rounded back-in bg-white" data-original-value="${backValue}">
      </td>
      <td class="py-2 px-4 border-b text-center text-sm">${nextReviewDate}</td>
      <td class="py-2 px-4 border-b text-center space-x-2">
        <button data-idx="${originalIndex}" class="edit-btn px-2 py-1 bg-green-500 text-white rounded disabled:bg-gray-400 disabled:opacity-70" disabled>保存</button>
        <button data-idx="${originalIndex}" class="del-btn px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">削除</button>
      </td>
    `;
        listBody.appendChild(tr);
    });

    // イベントリスナーを行ごとに追加 (入力変更とボタンクリック)
    listBody.querySelectorAll('tr').forEach(row => {
        const frontInput = row.querySelector('.front-in');
        const backInput = row.querySelector('.back-in');
        const editBtn = row.querySelector('.edit-btn');
        const delBtn = row.querySelector('.del-btn');
        const idx = parseInt(editBtn.dataset.idx); // parseIntで数値に変換

        const handleInputChange = () => {
            const frontChanged = frontInput.value !== frontInput.dataset.originalValue;
            const backChanged = backInput.value !== backInput.dataset.originalValue;
            editBtn.disabled = !(frontChanged || backChanged); // 変更があれば有効化
        };

        frontInput.addEventListener('input', handleInputChange);
        backInput.addEventListener('input', handleInputChange);

        editBtn.addEventListener('click', () => {
            const newFront = frontInput.value.trim();
            const newBack = backInput.value.trim();

            if (newFront && newBack) {
                cards[idx].front = newFront;
                cards[idx].back = newBack;
                saveCards();
                // 元の値を更新して、保存直後は「変更なし」状態にする
                frontInput.dataset.originalValue = newFront;
                backInput.dataset.originalValue = newBack;
                editBtn.disabled = true; // 保存後は無効化
                // 必要であれば一覧全体を再描画しても良いが、今回はその行だけ更新
                // renderList(page); // 再描画する場合
            } else {
                alert("表面と裏面は空にできません。");
            }
        });

        delBtn.addEventListener('click', () => {
            if (confirm(`「${cards[idx].front}」を削除してもよろしいですか？`)) {
                cards.splice(idx, 1); // 配列から削除
                saveCards();
                renderList(page); // 削除後は一覧を再描画
            }
        });
    });


    // ページネーションの生成
    renderPagination(page, itemsPerPage);
}

// ページネーションボタンを生成・表示
function renderPagination(currentPage, itemsPerPage) {
    paginationDiv.innerHTML = ''; // 既存のページネーションをクリア
    const totalPages = Math.ceil(cards.length / itemsPerPage);

    if (totalPages <= 1) return; // ページが1つ以下の場合は表示しない

    // 表示するページ番号の範囲を決定 (例: 現在ページ±2)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    // startPageの調整 (endPageがtotalPagesより小さい場合)
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    // 「最初へ」ボタン
    if (currentPage > 1) {
        paginationDiv.appendChild(createPageButton(1, '« 最初'));
    }

    // 「前へ」ボタン
    if (currentPage > 1) {
        paginationDiv.appendChild(createPageButton(currentPage - 1, '‹ 前'));
    }


    // ページ番号ボタン
    for (let i = startPage; i <= endPage; i++) {
        paginationDiv.appendChild(createPageButton(i, i, currentPage));
    }

    // 「次へ」ボタン
    if (currentPage < totalPages) {
        paginationDiv.appendChild(createPageButton(currentPage + 1, '次 ›'));
    }

    // 「最後へ」ボタン
    if (currentPage < totalPages) {
        paginationDiv.appendChild(createPageButton(totalPages, '最後 »'));
    }
}

// ページネーションボタン要素を作成するヘルパー関数
function createPageButton(pageNumber, text, currentPage = -1) {
    const btn = document.createElement('button');
    btn.textContent = text;
    const isCurrent = pageNumber === currentPage;
    // Tailwindクラスを適用
    btn.className = `px-3 py-1 rounded text-sm ${isCurrent
        ? 'bg-blue-600 text-white cursor-default'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`;
    if (!isCurrent) {
        btn.onclick = () => renderList(pageNumber);
    } else {
        btn.disabled = true; // 現在のページボタンはクリック不可
    }
    return btn;
}


// カードデータをローカルストレージに保存
function saveCards() {
    // 保存する前に Date オブジェクトを ISO 文字列に変換する
    const cardsToSave = cards.map(card => ({
        ...card,
        next: card.next.toISOString() // Dateを文字列に変換
    }));
    localStorage.setItem('flashiron_cards', JSON.stringify(cardsToSave));
}

// ローカルストレージからカードデータを読み込み
function loadCards() {
    const storedCards = localStorage.getItem('flashiron_cards');
    if (storedCards) {
        try {
            const parsedCards = JSON.parse(storedCards);
            // 読み込む際に ISO 文字列から Date オブジェクトに変換する
            cards = parsedCards.map(card => ({
                ...card,
                // next が有効な日付文字列か確認してからDateオブジェクトに変換
                next: card.next && !isNaN(new Date(card.next)) ? new Date(card.next) : new Date() // 無効な場合は現在時刻
            }));
        } catch (e) {
            console.error("Error parsing cards from localStorage:", e);
            cards = []; // パースエラー時は空にする
            localStorage.removeItem('flashiron_cards'); // 不正なデータを削除
        }

    } else {
        cards = []; // ストレージにデータがなければ空配列
    }
    // ロード後にカードをソートする (例: 次回予定順、任意)
    // cards.sort((a, b) => a.next - b.next);
}

// HTMLエンティティをエスケープする簡単な関数
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        // 文字列でない場合はそのまま返すか、エラー処理を行う
        return unsafe;
    }
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "\"")
        .replace(/'/g, "'");
}
