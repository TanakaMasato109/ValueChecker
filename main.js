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


// ★★★ あなたのGASのURL (GASを再デプロイしたら更新してください) ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyMzE5LJlVU3BP28AbZ6jZhotYxQk9uNlaqdml3b-AOuCUFlWFn8mQPKyT_oq8q91L9/exec';


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
        // ★GASのdoGetを呼ぶ（stepパラメータは不要）
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        if (!response.ok) throw new Error('サーバーエラー');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log("[GAS Response]", data);
        // data = {price: 1500, correctedTitle: "Python入門"}
        return data; 
    } catch (err) {
        console.error('★fetchPriceでキャッチしたエラー:', err);
        return { error: '通信に失敗しました' };
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

    try {
        
        // --- ★ 黒帯補正・高精度切り抜き処理 ★ ---
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
        
        // --- ★ グレースケール化 ★ ---
        console.log("[Image Preprocessing 1] 画像をグレースケール化します...");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
        }
        ctx.putImageData(imageData, 0, 0);
        console.log("[Image Preprocessing 2] グレースケール化完了。");
        
        // --- ★ デバッグ表示 ★ ---
        debugCanvas.width = cropWidth;
        debugCanvas.height = cropHeight;
        debugCtx.drawImage(canvas, 0, 0);

        // --- ★ Tesseract (OCR) ★ ---
        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します (jpn+eng)...");
        const worker = await Tesseract.createWorker('jpn+eng'); 
        console.log("[OCR Checkpoint 2] ワーカー作成完了。認識を開始します...");
        const ret = await worker.recognize(canvas); 
        console.log("[OCR Checkpoint 3] 認識完了。");
        await worker.terminate();
        console.log("[OCR Checkpoint 4] ワーカー終了。");

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
        
        // --- ★ バックエンドAPI呼び出し ★ ---
        resultText.innerText = `「${title}」の相場を検索中... (AIが補正中...)`;
        // GASを呼び出し、{price, correctedTitle} を受け取る
        const resultData = await fetchPriceAndCorrect(title);
        
        if (resultData.error) throw new Error(resultData.error);
        
        // --- ★ UIの変更 ★ ---
        loadingSpinner.style.display = 'none';
        const price = resultData.price;
        const correctedTitle = resultData.correctedTitle; // AIが補正したタイトル
        
        let priceText = '';
        if (typeof price === 'number') {
            resultText.style.color = '#1877f2';
            priceText = `約 <strong>${price} 円</strong>`;
        } else {
            resultText.style.color = '#e0245e';
            priceText = 'データなし';
        }
        
        // 補正後のタイトルで結果を表示
        resultText.innerHTML = `「${correctedTitle}」の<br>相場: ${priceText}`;
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // もしOCRやAPIのどこかでエラーが起きたら、ここでキャッチ
        console.error("★onclick処理全体でエラーが発生しました:", error);
        loadingSpinner.style.display = 'none';
        resultText.style.color = '#e0245e';
        resultText.innerText = '解析中にエラーが発生しました。';
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();
