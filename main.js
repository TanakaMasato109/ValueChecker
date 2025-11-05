// --- 1. HTML要素を最初にすべて取得 ---
const video = document.getElementById('video');
const checkButton = document.getElementById('checkButton');
const loadingSpinner = document.getElementById('loading-spinner');
const resultText = document.getElementById('result-text');

// スナップショット用のcanvasを取得
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
        resultText.style.color = '#e0245e';
        resultText.innerText = "カメラの許可が必要です。設定を確認してリロードしてください。";
        checkButton.disabled = true;
        checkButton.innerText = 'カメラがありません';
    }
}

// --- 3. バックエンド(GAS)を呼び出す関数 ---
async function fetchPrice(title) {
    console.log(`[API Checkpoint A] GAS呼び出し開始。タイトル: ${title}`);
    try {
        const response = await fetch(`${GAS_URL}?title=${encodeURIComponent(title)}`);
        console.log("[API Checkpoint B] GASから応答あり:", response.status);
        
        if (!response.ok) {
            throw new Error('サーバーエラーが発生しました');
        }
        const data = await response.json();
        console.log("[API Checkpoint C] GASのデータをJSONに変換完了:", data);

        if (data.error) {
            throw new Error(data.error);
        }
        if (data.price === 'データなし') {
            return '相場データが見つかりません';
        }
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
    resultText.innerText = '';
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    // Tesseract.jsでOCR
    try {
        
        // --- ★★★ ここが「切り抜き処理」です ★★★ ---
        console.log("[Canvas Checkpoint 1] ガイド枠の切り抜きスナップショットを作成します...");
        
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // 1. CSSのガイド枠（幅80%, 高さ30%）のサイズを計算
        const cropWidth = videoWidth * 0.8; 
        const cropHeight = videoHeight * 0.3;

        // 2. ガイド枠の開始座標（左上）を計算 (中央配置のため)
        const cropX = (videoWidth - cropWidth) / 2; // (100% - 80%) / 2 = 10%
        const cropY = (videoHeight - cropHeight) / 2; // (100% - 30%) / 2 = 35%

        // 3. canvasのサイズを「切り抜くサイズ」に設定
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        
        // 4. videoの「指定範囲」をcanvasの「全体」に描き写す
        ctx.drawImage(
            video,      // ソース
            cropX,      // ソースのX座標
            cropY,      // ソースのY座標
            cropWidth,  // ソースの幅
            cropHeight, // ソースの高さ
            0,          // 描画先のX座標
            0,          // 描画先のY座標
            cropWidth,  // 描画先の幅
            cropHeight  // 描画先の高さ
        );
        console.log("[Canvas Checkpoint 2] 切り抜き完了。");
        // --- ★★★ 切り抜き処理ここまで ★★★ ---


        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します...");
        const worker = await Tesseract.createWorker('jpn');
        console.log("[OCR Checkpoint 2] ワーカー作成完了。認識を開始します...");
        
        // 変更点: 'video' ではなく、切り抜いた 'canvas' を渡す
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
        
        // バックエンドAPIを呼び出す
        resultText.innerText = `「${title}」の相場を検索中...`;
        const priceText = await fetchPrice(title);
        console.log(`[API Checkpoint D] 最終結果: ${priceText}`);
        
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
