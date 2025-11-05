// --- 1. HTML要素を最初にすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');

// ★★★ あなたのGASのURL ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPp-S95CAMRvq0GPs7ykdaAkcvUcXsTamG-3AxJGXK9IqFKcMi9re5ruDckfnM6DLstw/exec';


// --- 2. カメラを起動する処理 (★これが抜けていました★) ---
async function startCamera() {
    try {
        // 背面カメラを優先して起動を試みる
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("カメラエラー: ", err);
        // エラーメッセージを分かりやすく表示
        alert("カメラの起動に失敗しました。ブラウザの許可設定を確認してください。");
        resultText.style.color = '#e0245e'; // 赤文字
        resultText.innerText = "カメラの許可が必要です。設定を確認してリロードしてください。";
        checkButton.disabled = true; // カメラが使えないのでボタンも無効化
        checkButton.innerText = 'カメラがありません';
    }
}


// --- 3. バックエンド(GAS)を呼び出す関数 (変更なし) ---
async function fetchPrice(title) {
    try {
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
        return `${data.price} 円`;

    } catch (err) {
        console.error('APIエラー:', err);
        return '価格の取得に失敗しました';
    }
}

// --- 4. 「相場チェック」ボタンが押されたときの処理 (変更なし) ---
checkButton.onclick = async () => {
    // UIの変更
    loadingSpinner.style.display = 'block';
    resultText.innerText = '';
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    // Tesseract.jsでOCR
    const worker = await Tesseract.createWorker('jpn');
    const ret = await worker.recognize(video); // これで 'video' 要素が使える
    const title = ret.data.text.replace(/[\s\n]/g, '');
    await worker.terminate();

    if (!title) {
        // UIの変更
        loadingSpinner.style.display = 'none';
        resultText.innerText = '文字が認識できませんでした。';
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';
        return;
    }

    // バックエンドAPIを呼び出す
    resultText.innerText = `「${title}」の相場を検索中...`;
    const priceText = await fetchPrice(title);
    
    // UIの変更
    loadingSpinner.style.display = 'none';
    if (priceText.includes('円')) {
        resultText.style.color = '#1877f2';
    } else {
        resultText.style.color = '#e0245e';
    }
    resultText.innerText = `相場: 約 ${priceText}`;
    checkButton.disabled = false;
    checkButton.innerText = '相場をチェック！';
};


// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();
