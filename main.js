// --- 1. HTML要素を最初にすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');

// ★ 変更点: canvas要素を取得
const canvas = document.getElementById('snapshot');
const ctx = canvas.getContext('2d');


// ★★★ あなたのGASのURL ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPp-S95CAMRvq0GPs7ykdaAkcvUcXsTamG-3AxJGXK9IqFKcMi9re5ruDckfnM6DLstw/exec';


// --- 2. カメラを起動する処理 ---
async function startCamera() {
    console.log("カメラ起動を試みます...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        console.log("カメラ起動成功。");
    } catch (err) {
        console.error("カメラエラー: ", err);
        alert("カメラの起動に失敗しました。ブラウザの許可設定を確認してください。");
        // (省略)
    }
}

// --- 3. バックエンド(GAS)を呼び出す関数 ---
async function fetchPrice(title) {
    console.log(`[API Checkpoint A] GAS呼び出し開始。タイトル: ${title}`);
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        // (省略)
        return `${data.price} 円`;

    } catch (err) {
        console.error('★fetchPriceでキャッチしたエラー:', err);
        return '価格の取得に失敗しました';
    }
}

// --- 4. 「相場チェック」ボタンが押されたときの処理 ---
checkButton.onclick = async () => {
    console.clear(); 
    console.log("「相場チェック」が押されました。");
    
    // UIの変更
    loadingSpinner.style.display = 'block';
    // (省略)
    checkButton.innerText = '解析中...';

    // Tesseract.jsでOCR
    try {
        // --- ★★★ ここからが変更点 ★★★ ---
        console.log("[Canvas Checkpoint 1] スナップショットを作成します...");
        // 1. canvasのサイズをvideoの実際のサイズに合わせる
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 2. videoの現在のフレームをcanvasに描画する
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        console.log("[Canvas Checkpoint 2] スナップショット作成完了。");
        // --- ★★★ 変更点ここまで ★★★ ---


        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します...");
        const worker = await Tesseract.createWorker('jpn');
        console.log("[OCR Checkpoint 2] ワーカー作成完了。認識を開始します...");

        // ★ 変更点: 'video' ではなく 'canvas' を渡す
        const ret = await worker.recognize(canvas); 

        console.log("[OCR Checkpoint 3] 認識完了。");
        await worker.terminate();
        // (省略)

        const title = ret.data.text.replace(/[\s\n]/g, '');
        if (!title) {
            // (省略)
            return;
        }

        console.log(`[OCR Checkpoint 5] 認識したタイトル: ${title}`);

        // バックエンドAPIを呼び出す
        resultText.innerText = `「${title}」の相場を検索中...`;
        const priceText = await fetchPrice(title);
        // (省略)
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // (省略)
        console.error("★onclick処理全体でエラーが発生しました:", error);
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();
