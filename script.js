// プログラムが読み込まれた瞬間に実行
console.log("Script loaded!");

const canvas = new fabric.Canvas("canvas", {
  width: 400,
  height: 500,
  backgroundColor: null,
  preserveObjectStacking: true,
});

const status = document.getElementById("status");

/**
 * ★レイヤー順序の絶対ルール★
 * 下から順に固定します。
 * 0: 背景 (setBackgroundImage)
 * 1: 人物写真 (isPerson)
 * 2: ブランド要素 (isBrand / ロゴ・数字)
 * 3: 外枠 (isFrame)
 */
function sortLayers() {
  const objects = canvas.getObjects();

  // 1. 人物写真をレイヤー1へ
  objects.filter((o) => o.isPerson).forEach((o) => o.moveTo(1));

  // 2. ブランド要素をレイヤー2へ
  objects.filter((o) => o.isBrand).forEach((o) => o.moveTo(2));

  // 3. 外枠を最前面（一番上）へ
  objects.filter((o) => o.isFrame).forEach((o) => o.bringToFront());

  canvas.renderAll();
}

// 背景・外枠セット関数
function setBg(fileName) {
  status.textContent = `Loading ${fileName}...`;

  if (fileName.includes("外枠")) {
    fabric.Image.fromURL(
      fileName + "?t=" + Date.now(),
      function (img, isError) {
        if (isError) {
          alert("画像が見つかりません。");
          return;
        }
        // 既存の外枠を削除
        canvas.getObjects().forEach((obj) => {
          if (obj.isFrame) canvas.remove(obj);
        });

        img.set({
          left: 0,
          top: 0,
          scaleX: canvas.width / img.width,
          scaleY: canvas.height / img.height,
          selectable: false,
          isFrame: true,
        });
        canvas.add(img);
        sortLayers(); // 追加後に順序整理
        status.textContent = "Frame Set!";
      },
    );
  } else {
    // 通常の背景画像
    fabric.Image.fromURL(
      fileName + "?t=" + Date.now(),
      function (img, isError) {
        if (isError) return;
        canvas.setBackgroundImage(
          img,
          function () {
            sortLayers(); // 背景設定後に整理
            status.textContent = "Background Set!";
          },
          {
            scaleX: canvas.width / img.width,
            scaleY: canvas.height / img.height,
            crossOrigin: "anonymous",
          },
        );
      },
    );
  }
}

// ロゴ設置関数
function setLogo(fileName) {
  status.textContent = `Loading ${fileName}...`;

  // 既存のロゴを削除 (isBrandフラグを持つ画像オブジェクトをロゴと判断)
  canvas.getObjects().forEach((obj) => {
    if (obj.isBrand && obj.type === "image") {
      canvas.remove(obj);
    }
  });

  fabric.Image.fromURL(fileName + "?t=" + Date.now(), function (img, isError) {
    if (isError) {
      alert("画像が見つかりません。");
      return;
    }
    img.set({
      left: 320,
      top: canvas.height - 420,
      scaleX: 0.12,
      scaleY: 0.12,
      isBrand: true, // レイヤー順序のためにisBrandフラグを使用
      selectable: false,
    });
    canvas.add(img);
    sortLayers(); // レイヤー順序を整理
    status.textContent = "Logo Set!";
  });
}

// 人物アップロード & 背景削除
document.getElementById("upload").onchange = async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  status.textContent = "AI Removing Background...";
  try {
    const blob = await imglyRemoveBackground(file);
    const url = URL.createObjectURL(blob);
    fabric.Image.fromURL(url, function (img) {
      img.scaleToWidth(300);
      img.isPerson = true;
      canvas.add(img);
      canvas.centerObject(img);

      sortLayers(); // 順序整理

      canvas.setActiveObject(img);
      status.textContent = "Person Added!";
    });
  } catch (err) {
    const reader = new FileReader();
    reader.onload = (f) =>
      fabric.Image.fromURL(f.target.result, (img) => {
        img.scaleToWidth(300);
        img.isPerson = true;
        canvas.add(img);
        canvas.centerObject(img);
        sortLayers();
      });
    reader.readAsDataURL(file);
  }
};

// ロゴと数字、ポジションをセットする
function addBrandElement(num) {
  status.textContent = "Adding Branding...";

  // 既存のブランド要素（ロゴ、数字、ポジション）をすべて削除
  canvas.getObjects().forEach((obj) => {
    if (obj.isBrand) canvas.remove(obj);
  });

  // プルダウンから選択されたポジションを取得
  const posText = document.getElementById("position-select").value;

  // 2. 背番号の設定
  const numText = new fabric.Text(num, {
    left: 20,
    top: canvas.height - 450,
    fontSize: 90,
    fill: "#ffffff",
    fontWeight: "bold",
    fontFamily: "Impact",
    isBrand: true,
    selectable: false,
  });

  // 3. ポジションの設定
  const posDisplay = new fabric.Text(posText, {
    left: 42, // 左端からの位置
    top: canvas.height - 360, // 下端からの配置位置（番号の下に配置）
    fontSize: 40, // 文字サイズ
    fill: "#ffffff", // 文字色（白）
    stroke: "#000000", // 縁取りの色（黒）
    strokeWidth: 1, // 縁取りの太さ
    paintFirst: "stroke", // 縁取りを文字の下に描画（文字が潰れない設定）
    fontWeight: "bold", // 太字設定
    fontFamily: "Arial", // フォント種類（Arial）
    isBrand: true, // 独自フラグ（管理用）
    selectable: false, // ユーザー操作による移動を禁止
  });

  canvas.add(numText, posDisplay);

  sortLayers(); // 順序整理を呼び出し
  status.textContent = "Branding Applied!";
}

// ポジション選択が変更されたときにテキストを更新する
function updatePositionText() {
  // 現在の番号を取得（なければデフォルト値）
  let currentNum = "99"; // デフォルト
  canvas.getObjects().forEach((obj) => {
    if (obj.isBrand && obj.type === "text" && !isNaN(obj.text)) {
      currentNum = obj.text;
    }
  });

  // isBrandを持つテキストオブジェクト（ポジションと数字）を一度削除
  // filterを使って削除対象をリストアップしてから削除（ループ中の削除漏れ防止）
  const objectsToRemove = canvas
    .getObjects()
    .filter((obj) => obj.isBrand && obj.type === "text");
  objectsToRemove.forEach((obj) => {
    canvas.remove(obj);
  });

  // ポジションの値をHTMLから取得
  const posText = document.getElementById("position-select").value;
  // 背番号テキストの生成
  const numText = new fabric.Text(currentNum, {
    left: 20, // 左端からの位置
    top: canvas.height - 450, // 下端からの配置位置
    fontSize: 90, // 文字サイズ
    fill: "#ffffff", // 文字色（白）
    fontWeight: "bold", // 太字設定
    fontFamily: "Impact", // フォント種類（Impact）
    isBrand: true, // 独自フラグ（管理用）
    selectable: false, // ユーザー操作による移動を禁止
  });

  // ポジション表示用テキストの生成
  const posDisplay = new fabric.Text(posText, {
    left: 42, // 左端からの位置
    top: canvas.height - 360, // 下端からの配置位置（番号の下に配置）
    fontSize: 40, // 文字サイズ
    fill: "#ffffff", // 文字色（白）
    stroke: "#000000", // 縁取りの色（黒）
    strokeWidth: 1, // 縁取りの太さ
    paintFirst: "stroke", // 縁取りを文字の下に描画（文字が潰れない設定）
    fontWeight: "bold", // 太字設定
    fontFamily: "Arial", // フォント種類（Arial）
    isBrand: true, // 独自フラグ（管理用）
    selectable: false, // ユーザー操作による移動を禁止
  });

  canvas.add(numText, posDisplay);
  sortLayers();
}

// 郵便番号から住所を自動取得
function fetchAddress() {
  const postalCode = document
    .getElementById("postal-code")
    .value.replace("-", "");
  if (postalCode.length < 7) return;

  fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.results) {
        const res = data.results[0];
        document.getElementById("auto-address").value =
          res.address1 + res.address2 + res.address3;
      }
    });
}

// フォーム送信
async function submitForm() {
  const name = document.getElementById("name").value;
  const postalCode = document.getElementById("postal-code").value;
  const autoAddress = document.getElementById("auto-address").value;
  const address = document.getElementById("address").value;
  const birthYear = document.getElementById("birth-year").value;

  if (!name || !postalCode || !autoAddress || !address || !birthYear) {
    alert("すべての項目を入力してください");
    return;
  }

  // 修正1: canvasからのデータ取得を確実にする
  // 引数なしだとデフォルトで png になります
  const imgData = canvas.toDataURL("image/png");

  const gasUrl =
    "https://script.google.com/macros/s/AKfycbx_BrHzdGC99V8fNMIsdJCjajuM67OPhCj4f5iSNK4bVx8oXMbggF079zRiYuhsovg1/exec";

  const submitBtn = document.querySelector("button");
  submitBtn.disabled = true;

  const div = document.body.appendChild(document.createElement("div"));
  div.textContent = "送信中... 少々お待ちください";
  div.style.cssText =
    "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;z-index:9999;border-radius:5px;transition:opacity 0.5s;";

  try {
    // 修正2: bodyの構造を明確にする
    const payload = {
      name: name,
      postalCode: postalCode,
      autoAddress: autoAddress,
      address: address,
      birthYear: birthYear,
      image: imgData, // ここに data:image/png;base64,... が入る
    };

    await fetch(gasUrl, {
      method: "POST",
      mode: "no-cors", // GASへのPOSTは基本的にこれ
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });

    // 送信完了アラートを出しつつ移動
    div.textContent = "送信完了！決済画面へ移動します。";
    setTimeout(() => {
      window.location.href = "https://buy.stripe.com/bJe8wP8CY1xT67N2TrfIs01";
    }, 1000);
  } catch (e) {
    submitBtn.disabled = false;
    div.remove();
    alert("通信エラーが発生しました。");
    console.error(e);
  }
}

// 画像保存
function downloadImage() {
  const formSection = document.getElementById("form-section");
  formSection.style.display = "block";
  formSection.scrollIntoView({ behavior: "smooth" });
}

// キャンバスを初期状態に戻す
function resetCanvas() {
  if (confirm("全ての作業を消去して、最初からやり直しますか？")) {
    location.reload();
  }
}
