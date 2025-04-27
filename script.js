let cards = [];
let reviewQueue = []; // 全体の復習待ちキュー
let currentReviewBatch = []; // 現在の復習バッチ (最大20枚 + 再追加分)
let batchIndex = 0; // 現在のバッチ内でのインデックス
let totalReviewableCount = 0; // 今回の復習セッション開始時の復習対象総数

// DOM要素の取得
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
const reviewProgressDiv = document.getElementById('review-progress');
const nextBatchBtn = document.getElementById('next-batch-btn');
const listBody = document.getElementById('list-body');
const paginationDiv = document.getElementById('pagination');

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
  if (showAnswerBtn && nextBatchBtn) {
    showAnswerBtn.onclick = showAnswer;
    nextBatchBtn.onclick = loadNextBatch;
  }

  // カードデータの読み込みと初期表示
  loadCards();
  showSection('import'); // 最初にインポートセクションを表示 (これによりアクティブタブも設定される)
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

// セクション表示切り替え & アクティブタブ設定
function showSection(name) {
  // セクションの表示/非表示
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.id === name ? sec.classList.remove('hidden') : sec.classList.add('hidden');
  });

  // ナビゲーションボタンのアクティブ状態を更新
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === name) {
      // aria-selected を使うことで、CSSでスタイルを適用しやすくする
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.removeAttribute('aria-selected');
    }
  });

  // セクションに応じた初期化処理
  if (name === 'review') {
    startReview();
  } else if (name === 'list') {
    renderList(1);
  }
}

// TSVファイルからカードをインポート (変更なし)
function importCards() {
  const file = tsvFileInput.files[0];
  if (!file || !Papa) return;
  importBtn.disabled = true;
  Papa.parse(file, {
    delimiter: '\t',
    skipEmptyLines: true,
    complete: results => {
      let addedCount = 0, skippedCount = 0;
      results.data.forEach(row => {
        if (row.length >= 2) {
          const front = String(row[0]).trim(), back = String(row[1]).trim();
          if (front && back) {
            if (!cards.some(c => c.front === front && c.back === back)) {
              cards.push({ front, back, ease: 2.5, interval: 1, next: new Date() });
              addedCount++;
            } else skippedCount++;
          } else skippedCount++;
        } else skippedCount++;
      });
      saveCards();
      if (importMsgDiv) importMsgDiv.textContent = `${addedCount}件のカードを追加しました。`;
      if (skipMsgDiv) skipMsgDiv.textContent = skippedCount > 0 ? `重複または無効なデータのため${skippedCount}件スキップしました。` : '';
      if (tsvFileInput) tsvFileInput.value = '';
      if (fileNameSpan) fileNameSpan.textContent = '';
    },
    error: (error) => {
      console.error("CSV Parse Error:", error);
      if (importMsgDiv) importMsgDiv.textContent = `ファイルの解析中にエラーが発生しました: ${error.message}`;
      if (importBtn) importBtn.disabled = false;
    }
  });
}

// カードを手動で追加 (変更なし)
function addCard() {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    if (front && back) {
        if (cards.some(c => c.front === front && c.back === back)) {
            addMsgDiv.textContent = 'このカードは既に追加されています。';
            addMsgDiv.className = 'mt-2 text-red-600 font-medium';
            return;
        }
        cards.push({ front, back, ease: 2.5, interval: 1, next: new Date() });
        saveCards();
        addMsgDiv.textContent = '1件のカードを追加しました。';
        addMsgDiv.className = 'mt-2 text-green-600 font-medium';
        frontInput.value = '';
        backInput.value = '';
        frontInput.focus();
    } else {
        addMsgDiv.textContent = '表面と裏面の両方を入力してください。';
        addMsgDiv.className = 'mt-2 text-red-600 font-medium';
    }
}

// 復習セッションを開始または再開
function startReview() {
  const now = new Date();
  // 復習キューを毎回生成する（前回のバッチで再追加されたカードも対象になるように）
  reviewQueue = cards.filter(c => c.next <= now);
  totalReviewableCount = reviewQueue.length;
  reviewQueue.sort(() => Math.random() - 0.5); // ランダム化

  console.log(`復習開始: 対象 ${totalReviewableCount}枚`);

  loadNextBatch(); // 最初のバッチを読み込む
}

// 次の復習バッチ（最大20件）を読み込む
function loadNextBatch() {
  nextBatchBtn.classList.add('hidden');
  controlsDiv.innerHTML = '';
  showAnswerBtn.classList.add('hidden');

  if (reviewQueue.length === 0 && currentReviewBatch.length === 0) { // reviewQueueも空、かつcurrentBatchも空の場合
    cardBox.innerHTML = '<div class="text-center text-xl font-semibold">今回の復習は完了しました！</div>';
    reviewProgressDiv.textContent = '';
    const upcomingCards = cards.filter(c => c.next > new Date()).length;
    if (upcomingCards > 0) {
      cardBox.innerHTML += `<div class="mt-2 text-sm text-gray-600">${upcomingCards}枚のカードが次の復習を待っています。</div>`;
    }
    return;
  }

  // reviewQueueから最大20件取り出して現在のバッチとする
  // ただし、currentReviewBatchに残っているカード（再追加されたもの）はそのまま引き継ぐべきかもしれない
  // いや、バッチごとに区切るので、reviewQueueから新たに取得する
  currentReviewBatch = reviewQueue.splice(0, 20);
  batchIndex = 0;

  if (currentReviewBatch.length === 0) {
    // spliceした結果が空なら、実質完了
     cardBox.innerHTML = '<div class="text-center text-xl font-semibold">今回の復習は完了しました！</div>';
     reviewProgressDiv.textContent = '';
     // upcomingの表示は省略（上のifでカバーされるはず）
     return;
  }


  console.log(`次のバッチ読み込み: ${currentReviewBatch.length}枚 (全体残り ${reviewQueue.length}枚)`);

  showCard(); // バッチの最初のカードを表示
}


// 復習カードを表示 (表面のみ)
function showCard() {
  controlsDiv.innerHTML = '';
  showAnswerBtn.classList.add('hidden');
  nextBatchBtn.classList.add('hidden');

  if (batchIndex >= currentReviewBatch.length) {
    // 現在のバッチが終了した場合 (再追加されたカードも含む)
    console.log("現在のバッチ完了");
    currentReviewBatch = []; // 現在のバッチをクリア

    if (reviewQueue.length > 0) {
      // まだ全体の復習キューにカードが残っている場合
      cardBox.innerHTML = `<div class="text-center text-lg">バッチ完了！<br>休憩して、準備ができたら次に進んでください。</div>`;
      reviewProgressDiv.textContent = `全体残り: ${reviewQueue.length} 枚`;
      nextBatchBtn.classList.remove('hidden'); // 「次のバッチへ」ボタンを表示
    } else {
      // 全ての復習が完了した場合
      cardBox.innerHTML = '<div class="text-center text-xl font-semibold">今回の復習は全て完了しました！</div>';
      reviewProgressDiv.textContent = '';
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

  // 進捗状況を表示 (バッチ内の残り枚数で表示)
  const remainingInBatch = currentReviewBatch.length - batchIndex;
  // 全体の残りは reviewQueue の枚数 + バッチ内の残り枚数(現在表示中のカードを除く)
  const totalRemaining = reviewQueue.length + (remainingInBatch > 0 ? remainingInBatch -1 : 0) ;

  reviewProgressDiv.textContent = `バッチ内残り: ${remainingInBatch} 枚 / 全体残り: ${totalRemaining} 枚`;


  showAnswerBtn.classList.remove('hidden');
}

// カードの答えを表示し、難易度選択ボタンを表示 (変更なし)
function showAnswer() {
  showAnswerBtn.classList.add('hidden');
  if (batchIndex >= currentReviewBatch.length) return;

  const currentCard = currentReviewBatch[batchIndex];
  const frontHtml = escapeHtml(currentCard.front);
  const backHtml = escapeHtml(currentCard.back).replace(/\n/g, '<br>');

  cardBox.innerHTML = `
    <div class="font-bold text-lg mb-2">${frontHtml}</div>
    <hr class="w-full my-2">
    <div>${backHtml}</div>
  `;

  controlsDiv.innerHTML = '';
  const ratings = { 1: '忘れた', 2: '難しい', 3: '普通', 4: '良い', 5: '完璧' };
  const colors = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-blue-500', 5: 'bg-green-500' };

  for (let q = 1; q <= 5; q++) {
    const ratingLabel = ratings[q];
    const colorClass = colors[q];
    const btn = document.createElement('button');
    btn.textContent = ratingLabel;
    btn.className = `py-2 border rounded ${colorClass} text-white hover:opacity-80 transition-opacity`;
    btn.onclick = () => handleAnswer(currentCard, q);
    controlsDiv.appendChild(btn);
  }
}

// ユーザーの回答(難易度)を処理し、カード情報を更新、必要なら再追加
function handleAnswer(card, quality) {
  const q = quality;
  let reAddCard = false; // バッチに再追加するかどうかのフラグ

  // SM-2風アルゴリズムで next, interval, ease を更新
  if (q < 3) { // 忘れた (1), 難しい (2)
    // ease を下げる
    card.ease = Math.max(1.3, card.ease - 0.2);
    // 次回は短時間後に設定（セッション内で再表示するため）
    let minutesToAdd = (q === 1) ? 1 : 5; // 1分 or 5分
    card.next = new Date(Date.now() + minutesToAdd * 60 * 1000);
    // ★ バッチの最後に再追加するフラグを立てる
    reAddCard = true;
    // interval はリセットする（次に q>=3 になった時に1から計算し直すため）
    card.interval = 1;

  } else { // 普通 (3), 良い (4), 完璧 (5)
    // 通常の更新ロジック
     if (card.interval <= 1 && q >= 3) { // 前回間違えたか初回
        card.interval = (q === 3) ? 1 : (q === 4 ? 2 : 3); // 日数
    } else if (q >= 3) { // 2回目以降の正解
        card.interval = Math.ceil(card.interval * card.ease);
    }
    // Ease Factorの更新
    card.ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    // 次回の復習日時を計算 (現在時刻 + interval日数)
    card.next = new Date(Date.now() + card.interval * 24 * 60 * 60 * 1000);
    // reAddCard フラグは false のまま
  }

  saveCards(); // カードデータの変更を保存

  // ★ 間違えたカードをバッチの最後に追加
  if (reAddCard) {
      currentReviewBatch.push(card); // 配列の末尾に追加
      console.log(`Card "${card.front}" re-added to the end of the batch. New batch size: ${currentReviewBatch.length}`);
  }

  batchIndex++; // バッチ内の次のカードへ (インデックスを進める)

  showCard(); // 次のカード表示 or バッチ終了処理
}


// カード一覧レンダリング (変更なし)
function renderList(page) {
  const itemsPerPage = 100;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCards = cards.slice(startIndex, endIndex);

  listBody.innerHTML = '';

  paginatedCards.forEach((card, index) => {
    const originalIndex = startIndex + index;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-100';
    const nextReviewDate = card.next.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
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

  listBody.querySelectorAll('tr').forEach(row => {
    const frontInput = row.querySelector('.front-in');
    const backInput = row.querySelector('.back-in');
    const editBtn = row.querySelector('.edit-btn');
    const delBtn = row.querySelector('.del-btn');
    const idx = parseInt(editBtn.dataset.idx);

    const handleInputChange = () => {
        const frontChanged = frontInput.value !== frontInput.dataset.originalValue;
        const backChanged = backInput.value !== backInput.dataset.originalValue;
        editBtn.disabled = !(frontChanged || backChanged);
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
            frontInput.dataset.originalValue = newFront;
            backInput.dataset.originalValue = newBack;
            editBtn.disabled = true;
        } else {
            alert("表面と裏面は空にできません。");
        }
    });

    delBtn.addEventListener('click', () => {
        if (confirm(`「${cards[idx].front}」を削除してもよろしいですか？`)) {
            cards.splice(idx, 1);
            saveCards();
            renderList(page);
        }
    });
  });

  renderPagination(page, itemsPerPage);
}

// ページネーションレンダリング (変更なし)
function renderPagination(currentPage, itemsPerPage) {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(cards.length / itemsPerPage);
    if (totalPages <= 1) return;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (currentPage > 1) paginationDiv.appendChild(createPageButton(1, '« 最初'));
    if (currentPage > 1) paginationDiv.appendChild(createPageButton(currentPage - 1, '‹ 前'));

    for (let i = startPage; i <= endPage; i++) {
        paginationDiv.appendChild(createPageButton(i, i, currentPage));
    }

    if (currentPage < totalPages) paginationDiv.appendChild(createPageButton(currentPage + 1, '次 ›'));
    if (currentPage < totalPages) paginationDiv.appendChild(createPageButton(totalPages, '最後 »'));
}

// ページネーションボタン作成 (変更なし)
function createPageButton(pageNumber, text, currentPage = -1) {
    const btn = document.createElement('button');
    btn.textContent = text;
    const isCurrent = pageNumber === currentPage;
    btn.className = `px-3 py-1 rounded text-sm ${ isCurrent ? 'bg-blue-600 text-white cursor-default' : 'bg-gray-200 text-gray-700 hover:bg-gray-300' }`;
    if (!isCurrent) {
        btn.onclick = () => renderList(pageNumber);
    } else {
        btn.disabled = true;
    }
    return btn;
}

// ローカルストレージ保存 (変更なし)
function saveCards() {
    const cardsToSave = cards.map(card => ({ ...card, next: card.next.toISOString() }));
    localStorage.setItem('flashiron_cards', JSON.stringify(cardsToSave));
}

// ローカルストレージ読み込み (変更なし)
function loadCards() {
    const storedCards = localStorage.getItem('flashiron_cards');
    if (storedCards) {
        try {
            const parsedCards = JSON.parse(storedCards);
            cards = parsedCards.map(card => ({ ...card, next: card.next && !isNaN(new Date(card.next)) ? new Date(card.next) : new Date() }));
        } catch (e) {
            console.error("Error parsing cards from localStorage:", e);
            cards = [];
            localStorage.removeItem('flashiron_cards');
        }
    } else {
        cards = [];
    }
}

// HTMLエスケープ (変更なし)
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "\"").replace(/'/g, "'");
}
