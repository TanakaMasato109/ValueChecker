// --- 1. HTML要素をすべて取得 ---
const video = document.getElementById('video');
const guideBox = document.getElementById('guide-box');
const cameraWrapper = document.getElementById('camera-wrapper'); // ★追加
const checkButton = document.getElementById('checkButton');

const reviewArea = document.getElementById('review-area'); // ★追加
const reviewTextBox = document.getElementById('review-text-box'); // ★追加
const searchButton = document.getElementById('search-button'); // ★追加

const resultArea = document.getElementById('result-area'); // ★追加
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');
const resetButton = document.getElementById('reset-button'); // ★追加

const canvas = document.getElementById('snapshot');
const ctx = canvas.getContext('2d');
const debugCanvas = document.getElementById('debug-canvas');
const debugCtx = debugCanvas.getContext('2d');

// ★★★ あなたのGASのURL ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyeAsOQyRY32hjw9nykBoWLsbT6viS_KKPSv449UmCoMzuUm-0yYzXlzfQzyoq6CkWrNQ/exec';


// --- 2. UIの状態を管理する関数 (新設) ---
function setUIState(state) {
    // 状態: 'camera', 'loading', 'review', 'result'
    cameraWrapper.style.display = (state === 'camera') ? 'block' : 'none';
    checkButton.style.display = (state === 'camera') ? 'block' : 'none';
    
    reviewArea.style.display = (state === 'review') ? 'block' : 'none';
    
    resultArea.style.display = (state === 'loading' || state === 'result') ? 'block' : 'none';
    loadingSpinner.style.display = (state === 'loading') ? 'block' : 'none';
    
    resetButton.style.display = (state === 'review' || state === 'result') ? 'block' : 'none';
}

// --- 3. カメラを起動する処理 (変更なし) ---
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
    } catch (err) { /* (省略) */ }
}

// --- 4. GASを呼び出す関数 (★修正★) ---
// 'step' パラメータ ('correct' or 'search') を追加
async function fetchFromGAS(title, step) {
    console.log(`[GAS Call] Step: ${step}, Title: ${title}`);
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}&step=${step}`);
        if (!response.ok) throw new Error('サーバーエラー');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log("[GAS Response]", data);
        return data;
    } catch (err) {
        console.error('★fetchFromGASでキャッチしたエラー:', err);
        return { error: '通信に失敗しました' };
    }
}

// --- 5. ステップ1：OCR実行＆AI補正 (★checkButtonの処理★) ---
checkButton.onclick = async () => {
    console.log("ステップ1: OCRとAI補正を開始");
    setUIState('loading'); // UIを「ローディング中」に
    resultText.innerText = 'AIがタイトルを補正中です...';

    try {
        // (省略: 高精度切り抜き処理)
        const videoWidth = video.videoWidth; const videoHeight = video.videoHeight;
        const nativeRatio = videoWidth / videoHeight; const clientWidth = video.clientWidth;
        const clientHeight = video.clientHeight; const clientRatio = clientWidth / clientHeight;
        let videoContentX = 0, videoContentY = 0, videoContentWidth = clientWidth, videoContentHeight = clientHeight;
        if (nativeRatio > clientRatio) { videoContentHeight = clientWidth / nativeRatio; videoContentY = (clientHeight - videoContentHeight) / 2; }
        else { videoContentWidth = clientHeight * nativeRatio; videoContentX = (clientWidth - videoContentWidth) / 2; }
        const guideRect = guideBox.getBoundingClientRect(); const videoRect = video.getBoundingClientRect();
        const guideLeft = (guideRect.left - videoRect.left) - videoContentX;
        const guideTop = (guideRect.top - videoRect.top) - videoContentY;
        const guideWidth = guideRect.width; const guideHeight = guideRect.height;
        const scaleX = videoWidth / videoContentWidth; const scaleY = videoHeight / videoContentHeight;
        const cropX = guideLeft * scaleX; const cropY = guideTop * scaleY;
        const cropWidth = guideWidth * scaleX; const cropHeight = guideHeight * scaleY;
        canvas.width = cropWidth; canvas.height = cropHeight;
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        
        // (省略: グレースケール化)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) { const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114; data[i] = avg; data[i + 1] = avg; data[i + 2] = avg; }
        ctx.putImageData(imageData, 0, 0);
        
        // (省略: デバッグ表示)
        debugCanvas.width = cropWidth; debugCanvas.height = cropHeight;
        debugCtx.drawImage(canvas, 0, 0);
        
        // (省略: Tesseract OCR)
        const worker = await Tesseract.createWorker('jpn+eng'); 
        const ret = await worker.recognize(canvas); 
        await worker.terminate();
        const ocrTitle = ret.data.text.replace(/[\s\n]/g, '');

        if (!ocrTitle) {
            alert('文字が認識できませんでした。もう一度試してください。');
            setUIState('camera'); // UIをカメラ状態に戻す
            return;
        }

        // ★ステップ1のGAS呼び出し (AI補正)
        const correctData = await fetchFromGAS(ocrTitle, 'correct');
        if (correctData.error) throw new Error(correctData.error);
        
        // ★UIを「確認・修正」状態へ
        reviewTextBox.value = correctData.correctedTitle; // テキストボックスにAI補正結果を入れる
        setUIState('review');

    } catch (error) {
        console.error("★ステップ1でエラー:", error);
        alert(`エラーが発生しました: ${error.message}`);
        setUIState('camera'); // UIをカメラ状態に戻す
    }
};

// --- 6. ステップ2：人間が確認＆相場検索 (★searchButtonの処理★) ---
searchButton.onclick = async () => {
    const finalTitle = reviewTextBox.value; // 人間が修正した（かもしれない）テキスト
    
    if (!finalTitle) {
        alert('タイトルが空です。');
        return;
    }
    
    console.log("ステップ2: 相場検索を開始", finalTitle);
    setUIState('loading'); // UIを「ローディング中」に
    resultText.innerText = `「${finalTitle}」の相場を検索中...`;

    try {
        // ★ステップ2のGAS呼び出し (価格検索)
        const searchData = await fetchFromGAS(finalTitle, 'search');
        if (searchData.error) throw new Error(searchData.error);

        const price = searchData.price;
        let priceText = '';
        if (typeof price === 'number') {
            resultText.style.color = '#1877f2';
            priceText = `約 <strong>${price} 円</strong>`;
        } else {
            resultText.style.color = '#e0245e';
            priceText = 'データなし';
        }
        
        resultText.innerHTML = `「${searchData.finalTitle}」の<br>相場: ${priceText}`;
        setUIState('result'); // UIを「結果表示」状態に

    } catch (error) {
        console.error("★ステップ2でエラー:", error);
        alert(`エラーが発生しました: ${error.message}`);
        setUIState('review'); // UIをレビュー状態に戻す
    }
};

// --- 7. やり直し処理 (★resetButtonの処理★) ---
resetButton.onclick = () => {
    setUIState('camera'); // UIを最初のカメラ状態に戻す
    resultText.innerHTML = 'ここに相場が表示されます'; // 結果をリセット
    resultText.style.color = '#333';
};


// --- 8. ページ読み込み時に初期化 ---
startCamera();
setUIState('camera'); // 最初の状態を'camera'に設定

