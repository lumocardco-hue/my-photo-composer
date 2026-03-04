// プログラムが読み込まれた瞬間に実行
console.log("Script loaded!");

const canvas = new fabric.Canvas('canvas', {
    width: 400,
    height: 500,
    backgroundColor: '#ffffff'
});

// 関数を window オブジェクトに登録して、HTMLから確実に見えるようにする
window.setBg = function(fileName) {
    alert(fileName + " を読み込みます..."); 
    
    fabric.Image.fromURL(fileName, function(img, isError) {
        if (isError) {
            alert("エラー: " + fileName + " が見つかりません。GitHubに画像があるか確認してください。");
            return;
        }
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height
        });
    }, { crossOrigin: 'anonymous' });
};

window.addNumber = function(text) {
    alert("数字 " + text + " を追加します");
    const t = new fabric.Text(text, {
        left: 50,
        top: 50,
        fontSize: 100,
        fill: 'red',
        fontWeight: 'bold'
    });
    canvas.add(t);
};

// 以下、アップロードと保存の処理（これらは後回しでも、まずは背景と数字を確認）
document.getElementById('upload').onchange = function(e) {
    const reader = new FileReader();
    reader.onload = f => fabric.Image.fromURL(f.target.result, img => {
        img.scaleToWidth(200);
        canvas.centerObject(img);
        canvas.add(img);
    });
    reader.readAsDataURL(e.target.files[0]);
};
