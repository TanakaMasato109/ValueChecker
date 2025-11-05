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
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw7TiaoCRFia0TIHF98xwGcjhFmXw8e1ZhuctqxFi2RgYeIzVdLiR8G9hRfZ-QjgA3h5g/exec';


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
// --- 3. バックエンド(GAS)を呼び出す関数 (★修正★) ---
async function fetchPrice(title) {
    console.log(`[API Checkpoint A] GAS呼び出し開始。タイトル: ${title}`);
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        console.log("[API Checkpoint B] GASから応答あり:", response.status);
        
        if (!response.ok) {
            throw new Error('サーバーエラーが発生しました');
        }
        
        const data = await response.json(); // data = {price: ..., correctedTitle: ...}
        console.log("[API Checkpoint C] GASのデータをJSONに変換完了:", data);

        if (data.error) {
            throw new Error(data.error);
        }
        
        // ★GASから返されたオブジェクト全体を返す
        return data; 

    } catch (err) {
        console.error('★fetchPriceでキャッチしたエラー:', err);
        return { price: '価格の取得に失敗しました', correctedTitle: title };
    }
}

// --- 4. 「相場チェック」ボタンが押されたときの処理 (★一部修正★) ---
checkButton.onclick = async () => {
    console.clear(); 
    console.log("「相場チェック」が押されました。");
    
    // (省略: UIの変更)
    loadingSpinner.style.display = 'block';
    resultText.innerText = '';
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    try {
        
        // (省略: 切り抜き処理)
        console.log("[Canvas Checkpoint 1] 黒帯補正・高精度切り抜きを開始します...");
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const nativeRatio = videoWidth / videoHeight;
        const clientWidth = video.clientWidth;
        const clientHeight = video.clientHeight;
        const clientRatio = clientWidth / clientHeight;
        let videoContentX = 0, videoContentY = 0, videoContentWidth = clientWidth, videoContentHeight = clientHeight;
        if (nativeRatio > clientRatio) {
            videoContentHeight = clientWidth / nativeRatio;
            videoContentY = (clientHeight - videoContentHeight) / 2;
        } else {
            videoContentWidth = clientHeight * nativeRatio;
            videoContentX = (clientWidth - videoContentWidth) / 2;
        }
        const guideRect = guideBox.getBoundingClientRect();
        const videoRect = video.getBoundingClientRect();
        const guideLeft = (guideRect.left - videoRect.left) - videoContentX;
        const guideTop = (guideRect.top - videoRect.top) - videoContentY;
        const guideWidth = guideRect.width;
        const guideHeight = guideRect.height;
        const scaleX = videoWidth / videoContentWidth;
        const scaleY = videoHeight / videoContentHeight;
        const cropX = guideLeft * scaleX;
        const cropY = guideTop * scaleY;
        const cropWidth = guideWidth * scaleX;
        const cropHeight = guideHeight * scaleY;
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        console.log("[Canvas Checkpoint 2] 切り抜き完了。");

        // (省略: グレースケール化)
        console.log("[Image Preprocessing 1] 画像をグレースケール化します...");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
        }
        ctx.putImageData(imageData, 0, 0);
        console.log("[Image Preprocessing 2] グレースケール化完了。");
        
        // (省略: デバッグ表示)
        debugCanvas.width = cropWidth;
        debugCanvas.height = cropHeight;
        debugCtx.drawImage(canvas, 0, 0);


        // (省略: Tesseract OCR)
        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します (jpn+eng)...");
        const worker = await Tesseract.createWorker('jpn+eng'); 
        const ret = await worker.recognize(canvas); 
        await worker.terminate();

        const title = ret.data.text.replace(/[\s\n]/g, '');
        if (!title) {
            console.warn("OCR結果が空でした。");
            loadingSpinner.style.display = 'none';
            resultText.innerText = '文字が認識できませんでした。';
            checkButton.disabled = false;
            checkButton.innerText = '相場をチェック！';
            return;
        }

        console.log(`[OCR Checkpoint 5] 認識したタイトル: ${title}`);
        
        // --- ★ここからが修正点★ ---
        resultText.innerText = `「${title}」の相場を検索中... (AIが補正中...)`;
        
        // GASから {price: ..., correctedTitle: ...} の形式で受け取る
        const resultData = await fetchPrice(title); 
        
        const price = resultData.price;
        const correctedTitle = resultData.correctedTitle;

        console.log(`[API Checkpoint D] 最終結果: ${price}, 補正後タイトル: ${correctedTitle}`);
        
        // UIの変更
        loadingSpinner.style.display = 'none';
        
        let priceText = '';
        if (typeof price === 'number') {
            resultText.style.color = '#1877f2';
            priceText = `約 <strong>${price} 円</strong>`;
        } else {
            resultText.style.color = '#e0245e';
            priceText = 'データなし';
        }
        
        // ★表示をリッチにする
        resultText.innerHTML = `「${correctedTitle}」の<br>相場: ${priceText}`;
        // --- ★修正点ここまで★ ---
        
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // (省略: エラー処理)
        console.error("★onclick処理全体でエラーが発生しました:", error);
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();

