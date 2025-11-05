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
    resultText.innerText = '';
    checkButton.disabled = true;
    checkButton.innerText = '解析中...';

    // Tesseract.jsでOCR
    try {
        
        // --- ★ ステップA: 「切り抜き処理」 ---
        console.log("[Canvas Checkpoint 1] ガイド枠の切り抜きスナップショットを作成します...");
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
        
        
        // --- ★ ステップB: 「二値化処理」を追加 ---
        console.log("[Image Preprocessing 1] 画像を二値化します...");
        
        // 1. canvasから切り抜いた画像データを取得
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data; // ピクセルデータの配列 (R, G, B, A, R, G, B, A, ...)
        
        // 2. ピクセルを1つずつ処理 (4つ飛ばし)
        for (let i = 0; i < data.length; i += 4) {
            // グレースケール（白黒の濃淡）に変換 (R,G,Bの平均)
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            
            // 閾値（しきい_ち）を設定 (128を基準)
            // 128より暗ければ黒(0)、明るければ白(255)にする
            const color = (avg > 128) ? 255 : 0; 
            
            data[i] = color;     // Red
            data[i + 1] = color; // Green
            data[i + 2] = color; // Blue
            // data[i + 3] (Alpha/透明度) はそのまま
        }
        
        // 3. 処理した画像データをcanvasに戻す
        ctx.putImageData(imageData, 0, 0);
        console.log("[Image Preprocessing 2] 二値化完了。");
        // --- ★ 二値化処理ここまで ★ ---


        console.log("[OCR Checkpoint 1] Tesseractワーカーを作成します...");
        const worker = await Tesseract.createWorker('jpn');
        console.log("[OCR Checkpoint 2] ワーカー作成完了。認識を開始します...");
        
        // 二値化された 'canvas' を渡す
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
        
        // (省略)
        checkButton.innerText = '相場をチェック！';

    } catch (error) {
        // (省略)
        console.error("★onclick処理全体でエラーが発生しました:", error);
    }
};

// --- 5. ページが読み込まれたらすぐにカメラを起動 ---
startCamera();
