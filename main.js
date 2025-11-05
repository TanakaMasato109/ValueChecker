// --- 1. HTML要素を最初にすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');

// スナップショット用のcanvas (非表示)
const canvas = document.getElementById('snapshot');
const ctx = canvas.getContext('2d');

// ★★★ デバッグ用のcanvas ★★★
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
        
        // --- ★ ステップA: 「切り抜き処理」 ---
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const cropWidth = videoWidth * 0.8; 
        const cropHeight = videoHeight * 0.3;
        const cropX = (videoWidth - cropWidth) / 2;
        const cropY = (videoHeight - cropHeight) / 2;
        
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        
        ctx.drawImage(
            video, cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );
        console.log("[Canvas Checkpoint 2] 切り抜き完了。");
        
        
        // --- ★ ステップB: 「グレースケール化」に変更 ---
        // (二値化よりも文字が消えにくい)
        console.log("[Image Preprocessing 1] 画像をグレースケール化します...");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // グレースケール（白黒の濃淡）に変換
            // (人間の視覚特性を考慮した加重平均)
            const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            
            data[i] = avg;     // Red
            data[i + 1] = avg; // Green
            data[i + 2] = avg; // Blue
        }
        ctx.putImageData(imageData, 0, 0);
        console.log("[Image Preprocessing 2] グレースケール化完了。");
        
        // --- ★ ステップC: 「デバッグ表示」を追加 ---
        // AIが見ている画像を、画面右下のデバッグcanvasにコピーする
        debugCanvas.width = cropWidth;
        debugCanvas.height = cropHeight;
        debugCtx.drawImage(canvas, 0, 0);


        // --- ★ ステップD: Tesseract (OCR) ---
        
        // ★ 変更点: 言語モデルに 'eng' (英語) を追加
        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します (jpn+eng)...");
        const worker = await Tesseract.createWorker('jpn+eng'); 
        
        console.log("[OCR Checkpoint 2] ワーカー作成完了。認識を開始します...");
        
        // グレースケール化された 'canvas' を渡す
        const ret = await worker.recognize(canvas); 
        
        console.log("[OCR Checkpoint 3] 認識完了。");
        await worker.terminate();
        console.log("[OCR Checkpoint 4] ワーカー終了。");

        const title = ret.data.text.replace(/[\s\n]/g, '');
        if (!title) {
            console.warn("OCR結果が空でした。");
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
startCamera();
