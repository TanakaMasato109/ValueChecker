// main.js (ステップ1のファイルに追記・修正)

// ★★★ ステップ3で取得したGASのURLに書き換える ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPp-S95CAMRvq0GPs7ykdaAkcvUcXsTamG-3AxJGXK9IqFKcMi9re5ruDckfnM6DLstw/exec';

// バックエンド(GAS)を呼び出す関数
async function fetchPrice(title) {
    try {
        // GASに「title」をパラメータとして渡して呼び出す
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        if (!response.ok) {
            throw new Error('サーバーエラーが発生しました');
        }
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }
        if (data.price === 'データなし') {
            return '相場データが見つかりません';
        }
        return `${data.price} 円`; // GASが計算した相場

    } catch (err) {
        console.error('APIエラー:', err);
        return '価格の取得に失敗しました';
    }
}

// 2. 「相場チェック」ボタンが押されたときの処理 (★修正後★)
// main.js の checkButton.onclick の部分を差し替え

// HTML要素の取得を最初に追加
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');

// 2. 「相場チェック」ボタンが押されたときの処理
checkButton.onclick = async () => {
    // --- UIの変更（ここから） ---
    loadingSpinner.style.display = 'block'; // スピナーを表示
    resultText.innerText = ''; // 前回の結果を消す
    checkButton.disabled = true; // ボタンを一時的に無効化
    checkButton.innerText = '解析中...';
    // --- UIの変更（ここまで） ---

    // 3. Tesseract.jsでOCR
    const worker = await Tesseract.createWorker('jpn');

    // ★ヒント: ガイド枠の部分だけを切り取ってOCRすると精度が上がるかも？
    // （今は画面全体をOCRしています）
    const ret = await worker.recognize(video);
    const title = ret.data.text.replace(/[\s\n]/g, '');
    await worker.terminate();

    if (!title) {
        // --- UIの変更（ここから） ---
        loadingSpinner.style.display = 'none'; // スピナーを非表示
        resultText.innerText = '文字が認識できませんでした。';
        checkButton.disabled = false; // ボタンを有効に戻す
        checkButton.innerText = '相場をチェック！';
        // --- UIの変更（ここまで） ---
        return;
    }

    // 4. バックエンドAPIを呼び出す
    resultText.innerText = `「${title}」の相場を検索中...`;

    const priceText = await fetchPrice(title); // この関数は変更なし

    // --- UIの変更（ここから） ---
    loadingSpinner.style.display = 'none'; // スピナーを非表示

    // 相場の結果に応じて色を変える
    if (priceText.includes('円')) {
        resultText.style.color = '#1877f2'; // 成功時は青文字
    } else {
        resultText.style.color = '#e0245e'; // 失敗時は赤文字
    }
    resultText.innerText = `相場: 約 ${priceText}`;

    checkButton.disabled = false; // ボタンを有効に戻す
    checkButton.innerText = '相場をチェック！';
    // --- UIの変更（ここまで） ---
};

// fetchPrice関数やカメラ起動の部分は変更不要です
