const canvas = new fabric.Canvas('canvas', {
    width: 400,
    height: 500,
    backgroundColor: '#fff'
});

// 背景をセットする関数（強化版）
function setBg(fileName) {
    console.log("読み込み試行:", fileName);
    
    // キャッシュ対策として、ファイル名の後ろにランダムな数字を付けて強制読み込み
    const cacheBuster = fileName + "?t=" + new Date().getTime();

    fabric.Image.fromURL(cacheBuster, function(img, isError) {
        if (isError) {
            console.error("読み込みエラー:", fileName);
            alert("画像 '" + fileName + "' が読み込めません。リポジトリに画像があるか、ファイル名が正しいか再確認してください。");
            return;
        }
        
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height,
            originX: 'left',
            originY: 'top'
        });
        
        console.log("読み込み成功:", fileName);
    }, { crossOrigin: 'anonymous' }); // 外部サーバー制限対策
}

// 数字とアイコン追加（左下固定）
function addNumber(text) {
    canvas.getObjects().forEach(obj => {
        if (obj.type === 'text' || obj.isIcon) canvas.remove(obj);
    });

    const numText = new fabric.Text(text, {
        left: 20,
        top: canvas.height - 100,
        fontSize: 80,
        fill: '#FFD700',
        fontWeight: 'bold'
    });

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
    }, { crossOrigin: 'anonymous' });
}

// 背景削除付きアップロード
document.getElementById('upload').onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const title = document.querySelector('h1');
    title.innerText = "AI処理中...";

    try {
        const blob = await imglyRemoveBackground(file);
        const url = URL.createObjectURL(blob);
        fabric.Image.fromURL(url, function(img) {
            img.scaleToWidth(300);
            canvas.centerObject(img);
            canvas.add(img);
            title.innerText = "lumocardco-hue";
        });
    } catch (err) {
        title.innerText = "そのまま読み込みます";
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

// 保存
document.getElementById('download').onclick = () => {
    const link = document.createElement('a');
    link.download = 'result.png';
    link.href = canvas.toDataURL();
    link.click();
};
