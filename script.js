const canvas = new fabric.Canvas('canvas', {
    width: 400,
    height: 500,
    backgroundColor: '#fff'
});

// 1. 背景をセットする関数
function setBg(fileName) {
    fabric.Image.fromURL(fileName, function(img) {
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height
        });
    });
}

// 2. 数字とアイコンを「左下」に固定して追加する関数
function addNumber(text) {
    // 既存の数字やアイコンがあれば消す（重複防止）
    canvas.getObjects().forEach(obj => {
        if (obj.type === 'text' || obj.isIcon) canvas.remove(obj);
    });

    // 数字の設定
    const numText = new fabric.Text(text, {
        left: 20,
        top: canvas.height - 100,
        fontSize: 80,
        fill: '#FFD700', // ゴールド
        fontWeight: 'bold',
        shadow: '2px 2px 5px rgba(0,0,0,0.5)'
    });

    // アイコンの設定（icon.pngがアップロードされている前提）
    fabric.Image.fromURL('icon.png', function(img) {
        img.set({
            left: 20,
            top: canvas.height - 160,
            scaleX: 0.2,
            scaleY: 0.2,
            isIcon: true
        });
        canvas.add(img);
        canvas.add(numText);
        canvas.bringToFront(numText);
    });
}

// 3. 背景削除付きの画像アップロード
document.getElementById('upload').onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // ボタンを「処理中...」に変える（UX向上）
    const btn = document.querySelector('h1');
    btn.innerText = "背景削除中...";

    try {
        // AIで背景を削除 (imglyライブラリを使用)
        const blob = await imglyRemoveBackground(file);
        const url = URL.createObjectURL(blob);

        fabric.Image.fromURL(url, function(img) {
            img.scaleToWidth(300);
            canvas.centerObject(img);
            canvas.add(img);
            btn.innerText = "lumocardco-hue"; // 元に戻す
        });
    } catch (error) {
        console.error("背景削除に失敗:", error);
        btn.innerText = "エラー発生（そのまま読み込みます）";
        // 失敗した場合はそのまま表示
        const reader = new FileReader();
        reader.onload = f => {
            fabric.Image.fromURL(f.target.result, img => {
                img.scaleToWidth(300);
                canvas.centerObject(img);
                canvas.add(img);
            });
        };
        reader.readAsDataURL(file);
    }
};

// 4. ダウンロード機能
document.getElementById('download').onclick = function() {
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 });
    const link = document.createElement('a');
    link.download = 'lumo-card.png';
    link.href = dataURL;
    link.click();
};
