// --- 1. HTML要素を最初にすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');
const guideBox = document.getElementById('guide-box'); // ★ガイド枠の要素も取得

// スナップショット用のcanvas (非表示)
const canvas = document.getElementById('snapshot');
const ctx = canvas.getContext('2d');

// デバッグ用のcanvas
const debugCanvas = document.getElementById('debug-canvas');
const debugCtx = debugCanvas.getContext('2d');


// ★★★ あなたのGASのURL ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPp-S95CAMRvq0GPs7ykdaAkcvUcXsTamG-3AxJGXK9IqFKcMi9re5ruDckfnM6DLstw/exec';


// --- 2. カメラを起動する処理 ---
async function startCamera() {
    // (省略: 変更なし)
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
    } catch (err) { /* (省略) */ }
}

// --- 3. バックエンド(GAS)を呼び出す関数 ---
async function fetchPrice(title) {
    // (省略: 変更なし)
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        if (!response.ok) throw new Error('サーバーエラー');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (data.price === 'データなし') return '相場データが見つかりません';
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
    
    // (省略: UIの変更)
    loadingSpinner.style.display = 'block';
    resultText.innerText = '';
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    try {
        
        // --- ★★★ ここからが「高精度切り抜き処理」です ★★★ ---
        console.log("[Canvas Checkpoint 1] ガイド枠の「高精度」切り抜きを開始します...");

        // 1. ビデオの「表示サイズ」と「ネイティブ解像度」を両方取得
        const videoWidth = video.videoWidth;   // 例: 1280 (ネイティブ解像度)
        const videoHeight = video.videoHeight;  // 例: 720
        const clientWidth = video.clientWidth; // 例: 390 (スマホの画面幅での表示サイズ)
        const clientHeight = video.clientHeight; // 例: 219 (↑から計算された表示上の高さ)

        // 2. CSSのガイド枠の「表示上の」実際の位置とサイズを取得
        const guideRect = guideBox.getBoundingClientRect();
        const videoRect = video.getBoundingClientRect();

        // 3. ビデオの表示領域(videoRect)基準での、ガイド枠の相対位置を計算
        const guideLeft = guideRect.left - videoRect.left;
        const guideTop = guideRect.top - videoRect.top;
        const guideWidth = guideRect.width;
        const guideHeight = guideRect.height;
        
        // 4. 「表示サイズ」から「ネイティブ解像度」への拡大率（スケール）を計算
        const scaleX = videoWidth / clientWidth;
        const scaleY = videoHeight / clientHeight;

        // 5. 表示上の座標(guideLeftなど)を、ネイティブ解像度の座標にスケーリング
        const cropX = guideLeft * scaleX;
        const cropY = guideTop * scaleY;
        const cropWidth = guideWidth * scaleX;
        const cropHeight = guideHeight * scaleY;

        // 6. canvasのサイズを「切り抜くサイズ」に設定
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // 7. videoの「ネイティブ解像度」から「スケーリングした座標」を切り抜く
        ctx.drawImage(
            video,      // ソース
            cropX,      // ソースのX座標 (ネイティブ基準)
            cropY,      // ソースのY座標 (ネイティブ基準)
            cropWidth,  // ソースの幅 (ネイティブ基準)
            cropHeight, // ソースの高さ (ネイティブ基準)
            0,          // 描画先のX座標
            0,          // 描画先のY座標
            cropWidth,  // 描画先の幅
            cropHeight  // 描画先の高さ
        );
        console.log("[Canvas Checkpoint 2] 切り抜き完了。");
        // --- ★★★ 高精度切り抜きここまで ★★★ ---


        // --- ★ ステップB: 「グレースケール化」 ---
        console.log("[Image Preprocessing 1] 画像をグレースケール化します...");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
        }
        ctx.putImageData(imageData, 0, 0);
        console.log("[Image Preprocessing 2] グレースケール化完了。");
        
        // --- ★ ステップC: 「デバッグ表示」 ---
        debugCanvas.width = cropWidth;
        debugCanvas.height = cropHeight;
        debugCtx.drawImage(canvas, 0, 0);


        // --- ★ ステップD: Tesseract (OCR) ---
        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します (jpn+eng)...");
        const worker = await Tesseract.createWorker('jpn+eng'); 
        
        console.log("[OCR Checkpoint 2] ワーカー作成完了。認識を開始します...");
        const ret = await worker.recognize(canvas); 
        console.log("[OCR Checkpoint 3] 認識完了。");
        await worker.terminate();
        console.log("[OCR Checkpoint 4] ワーカー終了。");

        const title = ret.data.text.replace(/[\s\n]/g, '');
        if (!title) {
            // (省略)
            return;
        }

        console.log(`[OCR Checkpoint 5] 認識したタイトル: ${title}`);
        
        // (省略: バックエンドAPI呼び出し)
        resultText.innerText = `「${title}」の相場を検索中...`;
        const priceText = await fetchPrice(title);
        
        // (省略: UIの変更)
        loadingSpinner.style.display = 'none';
        if (priceText.includes('円')) {
            resultText.style.color = '#1877f2';
        } else {
            resultText.style.color = '#e0245e';
        }
        resultText.innerText = `相場: 約 ${priceText}`;
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // (省略: エラー処理)
        console.error("★onclick処理全体でエラーが発生しました:", error);
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
start
