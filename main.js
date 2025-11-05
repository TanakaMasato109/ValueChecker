// --- 1. HTML要素をすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');
const guideBox = document.getElementById('guide-box');
const canvas = document.getElementById('snapshot');
const ctx = canvas.getContext('2d');
const debugCanvas = document.getElementById('debug-canvas');
const debugCtx = debugCanvas.getContext('2d');

// ★★★ あなたのGASのURL (GASを再デプロイしたら更新してください) ★★★
const GAS_URL = 'https://script.google.com/macros/s/AKfycby07BVZ_PB1R49VZyjdl-ecoYMnwQXxXhUEZT8EzKA1uIlZHfgUL6UN33-EdZ2HxAJVCQ/exec';

// --- 2. カメラを起動する処理 (変更なし) ---
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
    } catch (err) { console.error("カメラエラー: ", err); /* (省略) */ }
}

// --- 3. バックエンド(GAS)を呼び出す関数 (変更なし) ---
async function fetchFromGAS(title) {
    console.log(`[GAS Call] OCR Title: ${title}`);
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        if (!response.ok) throw new Error('サーバーエラー');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log("[GAS Response]", data);
        // data = {correctedTitle: "...", searchResults: [...]}
        return data; 
    } catch (err) {
        console.error('★fetchPriceでキャッチしたエラー:', err);
        return { error: '通信に失敗しました', correctedTitle: title };
    }
}

// --- 4. 「相場チェック」ボタンが押されたときの処理 ---
checkButton.onclick = async () => {
    console.clear(); 
    console.log("「相場チェック」が押されました。");
    
    // (省略: UIの変更)
    loadingSpinner.style.display = 'block';
    resultText.innerText = '';
    resultText.style.color = '#333';
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    let title = ''; // エラー表示用に 'title' を保持

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
        const guideTop = (guideRect.top - videoDect.top) - videoContentY;
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
        title = ret.data.text.replace(/[\s\n]/g, '');
        if (!title) { /* (省略: OCR失敗時の処理) */ return; }
        console.log(`[OCR Checkpoint 5] 認識したタイトル: ${title}`);
        
        // --- ★ バックエンドAPI呼び出し ★ ---
        resultText.innerText = `「${title}」の相場を検索中... (AIが補正中...)`;
        // GASを呼び出し、{correctedTitle, searchResults} を受け取る
        const resultData = await fetchFromGAS(title);
        
        if (resultData.error) throw new Error(resultData.error);
        
        // --- ★★★ ここからが修正点 ★★★ ---
        loadingSpinner.style.display = 'none';
        const correctedTitle = resultData.correctedTitle; // AIが補正したタイトル
        const searchResults = resultData.searchResults; // Google検索結果（スニペットの配列）
        const finalQuery = resultData.query; // 実際に検索したキーワード

        resultText.style.color = '#333';
        resultText.style.textAlign = 'left'; // 左揃えに変更
        
        let html = `
            <div style="font-size: 0.8em; color: #666;">
                OCR結果: <span style="color: #e0245e;">${title}</span>
            </div>
            <div style="font-size: 0.8em; color: #666; margin-top: 5px;">
                AI補正: <span style="color: #1877f2;">${correctedTitle}</span>
            </div>
            <div style="font-size: 0.8em; color: #666; margin-top: 5px;">
                検索クエリ: <span style="color: #333;">${finalQuery}</span>
            </div>
            <hr style="margin: 10px 0;">
            <strong>Google検索結果 (生データ):</strong>
        `;
        
        if (searchResults.length > 0) {
            html += '<ul style="font-size: 0.7em; margin: 0; padding-left: 20px;">';
            searchResults.forEach(snippet => {
                // スニペットに含まれる価格らしき部分をハイライト
                const highlighted = snippet.replace(/([¥￥]?\d{1,3}(,\d{3})*円?)/g, '<strong style="color: red;">$1</strong>');
                html += `<li style="margin-top: 5px;">${highlighted}</li>`;
            });
            html += '</ul>';
        } else {
            html += '<p style="font-size: 0.9em; color: red; font-weight: bold;">Google検索で 0件 でした。</p>';
        }

        resultText.innerHTML = html;
        // --- ★★★ 修正点ここまで ★★★ ---
        
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // (省略: エラー処理)
        console.error("★onclick処理全体でエラーが発生しました:", error);
        loadingSpinner.style.display = 'none';
        resultText.style.color = '#e0245e';
        resultText.innerHTML = `エラー: ${error.message}<br>(OCR結果: ${title})`;
        checkButton.disabled = false;
        checkButton.innerText = '相場をチェック！';
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();
