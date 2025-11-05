// --- 1. HTML要素をすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');
const guideBox = document.getElementById('guide-box'); // ガイド枠の要素

// スナップショット用のcanvas (非表示)
const canvas = document.getElementById('snapshot');
const ctx = canvas.getContext('2d');

// デバッグ用のcanvas
const debugCanvas = document.getElementById('debug-canvas');
const debugCtx = debugCanvas.getContext('2d');


// ★★★ あなたのGASのURL ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzC2qSN9kOlewCOrbz2ZS4npqoIeLkQhdDEbPTsEOLj4v6AWskjFQw4OmT9g212miSndQ/exec';


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
        // (省略)
    }
}

// --- 3. バックエンド(GAS)を呼び出す関数 ---
async function fetchPriceAndCorrect(title) {
    console.log(`[GAS Call] OCR Title: ${title}`);
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        if (!response.ok) throw new Error('サーバーエラー');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log("[GAS Response]", data);
        // data = {price: 1500, correctedTitle: "Python入門"}
        return data; 
    } catch (err) {
        console.error('★fetchPriceでキャッチしたエラー:', err);
        return { error: '通信に失敗しました', correctedTitle: title }; // エラー時もcorrectedTitleを返す
    }
}

// --- 4. 「相場チェック」ボタンが押されたときの処理 ---
checkButton.onclick = async () => {
    console.clear(); 
    console.log("「相場チェック」が押されました。");
    
    // UIの変更
    loadingSpinner.style.display = 'block';
    resultText.innerText = '';
    resultText.style.color = '#333'; // 色をリセット
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    // このスコープで 'title' を保持するために try の外で宣言
    let title = ''; 

    try {
        
        // (省略: 高精度切り抜き処理)
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
        
        // (省略: グレースケール化)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
        }
        ctx.putImageData(imageData, 0, 0);
        
        // (省略: デバッグ表示)
        debugCanvas.width = cropWidth;
        debugCanvas.height = cropHeight;
        debugCtx.drawImage(canvas, 0, 0);

        // (省略: Tesseract OCR)
        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します (jpn+eng)...");
        const worker = await Tesseract.createWorker('jpn+eng'); 
        const ret = await worker.recognize(canvas); 
        await worker.terminate();

        // ★ 'title' に生のOCR結果を代入
        title = ret.data.text.replace(/[\s\n]/g, ''); 
        
        if (!title) {
            // (省略: OCR失敗時の処理)
            return;
        }

        console.log(`[OCR Checkpoint 5] 認識したタイトル: ${title}`);
        
        // --- ★ バックエンドAPI呼び出し ★ ---
        resultText.innerText = `「${title}」の相場を検索中... (AIが補正中...)`;
        const resultData = await fetchPriceAndCorrect(title);
        
        if (resultData.error) throw new Error(resultData.error);
        
        // --- ★★★ ここからが修正点 ★★★ ---
        // UIの変更
        loadingSpinner.style.display = 'none';
        const price = resultData.price;
        const correctedTitle = resultData.correctedTitle; // AIが補正したタイトル
        
        let priceText = '';
        if (typeof price === 'number') {
            priceText = `約 <strong>${price} 円</strong>`;
        } else {
            priceText = 'データなし';
        }
        
        // 色をリセット
        resultText.style.color = '#333';
        
        // ★OCR結果とAI補正結果を「両方」表示する
        resultText.innerHTML = `
            <div style="font-size: 0.8em; color: #666; text-align: left;">
                OCR結果: <span style="color: #e0245e;">${title}</span>
            </div>
            <div style="font-size: 0.8em; color: #666; text-align: left; margin-top: 5px;">
                AI補正: <span style="color: #1877f2;">${correctedTitle}</span>
            </div>
            <hr style="margin: 10px 0;">
            <strong>相場: ${priceText}</strong>
        `;
        // --- ★★★ 修正点ここまで ★★★ ---
        
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // (省略: エラー処理)
        console.error("★onclick処理全体でエラーが発生しました:", error);
        loadingSpinner.style.display = 'none';
        resultText.style.color = '#e0245e';
        // エラー時は生のOCR結果(title)を表示
        resultText.innerHTML = `エラー: ${error.message}<br>(OCR結果: ${title})`;
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();



