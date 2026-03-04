// プログラムが読み込まれた瞬間に実行
console.log("Script loaded!");

// キャンバス初期化
const canvas = new fabric.Canvas('canvas', {
    width: 400,
    height: 500,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true // 重なり順を維持
});

// ステータス表示要素
const status = document.getElementById('status');

// 背景セット関数
function setBg(fileName) {
    status.textContent = `Loading ${fileName}...`;
    fabric.Image.fromURL(fileName + '?t=' + Date.now(), function(img, isError) {
        if (isError) {
            alert("画像が見つかりません。ファイル名を確認してください。");
            status.textContent = "Error";
            return;
        }
        canvas.setBackgroundImage(img, function() {
            canvas.renderAll();
            status.textContent = "Background Set!";
        }, {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height,
            crossOrigin: 'anonymous'
        });
    });
}


// 人物アップロード & 背景削除
document.getElementById('upload').onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    status.textContent = "AI Removing Background...";
    try {
        const blob = await imglyRemoveBackground(file);
        const url = URL.createObjectURL(blob);
        fabric.Image.fromURL(url, function(img) {
            img.scaleToWidth(300);
            img.isPerson = true; // 判定用フラグ
            canvas.add(img);
            canvas.centerObject(img);
            
            // 重要：背景(0)のすぐ上(1)に移動させる
            img.moveTo(1); 
            
            canvas.setActiveObject(img);
            canvas.renderAll();
            status.textContent = "Person Added!";
        });
    } catch (err) {
        // エラー時の処理も同様にレイヤー指定
        const reader = new FileReader();
        reader.onload = f => fabric.Image.fromURL(f.target.result, img => {
            img.scaleToWidth(300);
            img.isPerson = true;
            canvas.add(img);
            canvas.centerObject(img);
            img.moveTo(1); 
            canvas.renderAll();
        });
        reader.readAsDataURL(file);
    }
};

// ロゴ(icon.png)と数字をセット
function addBrandElement(num) {
    status.textContent = "Adding Branding...";
    canvas.getObjects().forEach(obj => {
        if (obj.isBrand) canvas.remove(obj);
    });

    fabric.Image.fromURL('画像/icon.png' + '?t=' + Date.now(), function(img) {
        img.set({
            left: 20, top: canvas.height - 140,
            scaleX: 0.12, scaleY: 0.12,
            isBrand: true, selectable: false
        });

        const text = new fabric.Text(num, {
            left: 20, top: canvas.height - 85,
            fontSize: 70, fill: '#ff0000',
            fontWeight: 'bold', fontFamily: 'Impact',
            isBrand: true, selectable: false
        });

        // status3 用フラグ
        const isStatus3 = num === '3';
        if (isStatus3) {
            img.isStatus3 = true;
            text.isStatus3 = true;
        }

        canvas.add(img, text);
        
        img.bringToFront();
        text.bringToFront();
        
        canvas.renderAll();
        status.textContent = "Branding Applied!";
    });
}


// 画像保存
function downloadImage() {
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 });
    const link = document.createElement('a');
    link.download = 'lumocard.png';
    link.href = dataURL;
    link.click();
    // フォームセクションを表示
    document.getElementById('form-section').style.display = 'block';
}


async function submitForm() {
    // 1. 項目を取得
    const name = document.getElementById('name').value;
    const postalCode = document.getElementById('postal-code').value;
    const autoAddress = document.getElementById('auto-address').value;
    const address = document.getElementById('address').value;
    const birthYear = document.getElementById('birth-year').value;

    // 2. 空欄チェック
    if (!name || !postalCode || !pref || !autoAddress || !address || !birthYear) {
        alert('すべての項目を入力してください');
        return;
    }

    const imgData = canvas.toDataURL({ format: 'png', quality: 0.7 });
    const gasUrl = "https://script.google.com/macros/s/AKfycbza5IRgPaQMH6RPPZH6vfyZJ3h3WzEcTFkJgtiPxC403JaQrEfAfAWJ0QtRAgm0wW8/exec";

    try {
        // 3. データを送信
        await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                name, 
                postalCode, 
                pref, 
                autoAddress, 
                address, 
                birthYear, 
                image: imgData 
            })
        });
        
        alert("ご注文情報を保存しました。決済画面へ移動します。");
        // window.location.href = "決済URL"; 
    } catch (e) {
        alert("送信に失敗しました。");
    }
}


// 郵便番号から住所を自動取得
function fetchAddress() {
    const postalCode = document.getElementById('postal-code').value.replace('-', '');
    if (postalCode.length < 7) return;
    
    fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`)
        .then(response => response.json())
        .then(data => {
            if (data.results) {
                const res = data.results[0];
                // 都道府県 + 市区町村 + 町域名 をすべて auto-address に入れる
                document.getElementById('auto-address').value = res.address1 + res.address2 + res.address3;
            }
        });
}

// フォーム送信
async function submitForm() {
    const name = document.getElementById('name').value;
    const postalCode = document.getElementById('postal-code').value;
    const autoAddress = document.getElementById('auto-address').value;
    const address = document.getElementById('address').value;
    const birthYear = document.getElementById('birth-year').value;

    // 空欄チェック（prefを削除）
    if (!name || !postalCode || !autoAddress || !address || !birthYear) {
        alert('すべての項目を入力してください');
        return;
    }

    const imgData = canvas.toDataURL({ format: 'png', quality: 0.7 });
    const gasUrl = "https://script.google.com/macros/s/AKfycbza5IRgPaQMH6RPPZH6vfyZJ3h3WzEcTFkJgtiPxC403JaQrEfAfAWJ0QtRAgm0wW8/exec";

    try {
        await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                name: name, 
                postalCode: postalCode, 
                autoAddress: autoAddress, // ここに都道府県も含まれています
                address: address, 
                birthYear: birthYear,
                image: imgData 
            })
        });
        alert("情報を保存しました。決済画面へ移動します。");
    } catch (e) {
        alert("送信に失敗しました。");
    }
}

// canvas レンダー前に status3 をトップに移動
canvas.on('before:render', function() {
    canvas.getObjects().forEach(o => {
        if (o.isStatus3) {
            o.bringToFront();
        }
    });
});

// キャンバスを初期状態に戻す
function resetCanvas() {
    if (confirm("全ての作業を消去して、最初からやり直しますか？")) {
        location.reload();
    }
}
