// 【切り分け用】超シンプル版 script.js
const canvas = new fabric.Canvas('canvas', { width: 400, height: 500 });

function setBg(fileName) {
    // ボタンが押されたことだけをまず確認
    alert(fileName + " を読み込みます"); 

    fabric.Image.fromURL(fileName, function(img) {
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height
        });
    });
}

function addNumber(text) {
    alert("数字 " + text + " を追加します");
    const t = new fabric.Text(text, { left: 50, top: 50, fontSize: 50, fill: 'red' });
    canvas.add(t);
}
