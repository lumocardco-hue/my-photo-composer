// ==========================================
// 1. 基本設定とグローバル変数
// ==========================================

// GASのウェブアプリURL（デプロイしたURLを貼り付け）
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbx_BrHzdGC99V8fNMIsdJCjajuM67OPhCj4f5iSNK4bVx8oXMbggF079zRiYuhsovg1/exec";

let masterData = []; // スプレッドシートから読み込んだ全データ

// 選択された商品の「ID」を記録する変数（セキュリティと集計用）
let selectedItems = {
  background: null,
  icon: null,
  frame: null,
  status: null,
};

// 選択された情報の「表示用/保存用」変数
let selectedBgPath = "未選択";
let selectedPersonName = "未選択";
let selectedNumber = "99";
let selectedPosition = "FW";
let selectedLogoPath = "未選択";
let selectedFramePath = "未選択";

// Fabric.js キャンバスの初期化
const canvas = new fabric.Canvas("canvas", {
  width: 400,
  height: 500,
  backgroundColor: null,
  preserveObjectStacking: true,
});

const statusLabel = document.getElementById("status");

// ==========================================
// 2. マスターデータの読み込みとボタン生成
// ==========================================

// ページ読み込み時に実行
async function loadMasterData() {
  try {
    statusLabel.textContent = "Loading Master Data...";
    const response = await fetch(GAS_URL);
    masterData = await response.json();
    console.log("マスターデータの読み込み完了:", masterData);

    // データが取得できたらボタンを生成する
    generateButtons();
    statusLabel.textContent = "Ready";
  } catch (error) {
    console.error("データの取得に失敗しました:", error);
    statusLabel.textContent = "Error loading data.";
  }
}

// スプレッドシートのデータに基づいてHTMLボタンを自動作成
function generateButtons() {
  const containers = {
    background: document.getElementById("bg-container"),
    icon: document.getElementById("logo-container"),
    frame: document.getElementById("frame-container"),
    status: document.getElementById("status-container"),
  };

  // 各コンテナを一旦空にする
  Object.values(containers).forEach((c) => {
    if (c) c.innerHTML = "";
  });

  masterData.forEach((item) => {
    const btn = document.createElement("button");

    if (item.category === "background") {
      btn.className = "img-btn";
      btn.style.backgroundImage = `url('${item.filePath}')`;
      btn.onclick = () => {
        selectedItems.background = item.itemId; // IDを記録
        setBg(item.filePath);
      };
      containers.background.appendChild(btn);
    } else if (item.category === "icon") {
      btn.className = "img-btn";
      btn.style.backgroundImage = `url('${item.filePath}')`;
      btn.onclick = () => {
        selectedItems.icon = item.itemId; // IDを記録
        setLogo(item.filePath);
      };
      containers.icon.appendChild(btn);
    } else if (item.category === "frame") {
      btn.className = "img-btn";
      btn.style.backgroundImage = `url('${item.filePath}')`;
      btn.onclick = () => {
        selectedItems.frame = item.itemId; // IDを記録
        setBg(item.filePath); // 枠も背景と同じ処理（filePathに「外枠」が含まれる判定）
      };
      containers.frame.appendChild(btn);
    } else if (item.category === "status") {
      btn.innerText = item.itemName;
      // 数字ボタンは画像ではないので専用クラスを当てる
      btn.onclick = () => {
        selectedItems.status = item.itemId; // IDを記録
        addBrandElement(item.itemName);
      };
      containers.status.appendChild(btn);
    }
  });
}

// ==========================================
// 3. キャンバス操作（描画関連）
// ==========================================

// レイヤー順序の整理ルール
function sortLayers() {
  const objects = canvas.getObjects();
  // 下から 写真 -> ステータス -> ロゴ -> 枠 の順
  // isPerson を 0番目(最背面)のレイヤーグループに
  objects.filter((o) => o.isPerson).forEach((o) => o.moveTo(0));
  // isStatus を 10番目のレイヤーグループに (写真よりは上)
  objects.filter((o) => o.isStatus).forEach((o) => o.moveTo(10));
  // isLogo を 20番目のレイヤーグループに (ステータスよりは上)
  objects.filter((o) => o.isLogo).forEach((o) => o.moveTo(20));
  // isFrame を最前面に
  objects.filter((o) => o.isFrame).forEach((o) => o.bringToFront());
  canvas.renderAll();
}

// 背景または外枠のセット
function setBg(fileName) {
  statusLabel.textContent = `Loading ${fileName}...`;

  if (
    fileName.includes("外枠") ||
    fileName.includes("frame") ||
    fileName.includes("waku")
  ) {
    selectedFramePath = fileName;
    fabric.Image.fromURL(
      fileName + "?t=" + Date.now(),
      function (img, isError) {
        if (isError) return;
        // 既存の枠を削除
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
        sortLayers();
        statusLabel.textContent = "Frame Set!";
      },
      { crossOrigin: "anonymous" },
    );
  } else {
    selectedBgPath = fileName;
    fabric.Image.fromURL(
      fileName + "?t=" + Date.now(),
      function (img, isError) {
        if (isError) return;
        canvas.setBackgroundImage(
          img,
          () => {
            sortLayers();
            statusLabel.textContent = "Background Set!";
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

// ロゴのセット
function setLogo(fileName) {
  selectedLogoPath = fileName;
  canvas.getObjects().forEach((obj) => {
    if (obj.isLogo) canvas.remove(obj);
  });

  fabric.Image.fromURL(
    fileName + "?t=" + Date.now(),
    function (img) {
      img.set({
        left: 320,
        top: canvas.height - 420,
        scaleX: 0.12,
        scaleY: 0.12,
        isLogo: true,
        selectable: false,
      });
      canvas.add(img);
      sortLayers();
      statusLabel.textContent = "Logo Set!";
    },
    { crossOrigin: "anonymous" },
  );
}

// 人物写真のアップロードと背景削除
document.getElementById("upload").onchange = async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedPersonName = file.name;
  statusLabel.textContent = "AI Removing Background...";

  try {
    const blob = await imglyRemoveBackground(file, {
      publicPath:
        "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/assets/",
    });
    const url = URL.createObjectURL(blob);
    fabric.Image.fromURL(url, function (img) {
      img.scaleToWidth(300);
      img.isPerson = true;
      canvas.add(img);
      canvas.centerObject(img);
      sortLayers();
      canvas.setActiveObject(img);
      statusLabel.textContent = "Person Added!";
    });
  } catch (err) {
    // AI削除失敗時のフォールバック
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

// ステータス（数字とポジション）の描画
function addBrandElement(num) {
  selectedNumber = num;
  selectedPosition = document.getElementById("position-select").value;

  canvas.getObjects().forEach((obj) => {
    if (obj.isStatus) canvas.remove(obj);
  });

  const numText = new fabric.Text(String(num), {
    left: 20,
    top: canvas.height - 450,
    fontSize: 90,
    fill: "#ffffff",
    fontWeight: "bold",
    fontFamily: "Impact",
    isStatus: true,
    selectable: false,
  });

  const posDisplay = new fabric.Text(selectedPosition, {
    left: 42,
    top: canvas.height - 360,
    fontSize: 40,
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: 1,
    paintFirst: "stroke",
    fontWeight: "bold",
    fontFamily: "Arial",
    isStatus: true,
    selectable: false,
  });

  canvas.add(numText, posDisplay);
  sortLayers();
}

// ポジション選択変更時
function updatePositionText() {
  if (selectedNumber) addBrandElement(selectedNumber);
}

// ==========================================
// 4. フォーム処理と注文送信
// ==========================================

// 住所自動取得
function fetchAddress() {
  const postalCode = document
    .getElementById("postal-code")
    .value.replace("-", "");
  if (postalCode.length < 7) return;

  fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.results) {
        const res = data.results[0];
        document.getElementById("auto-address").value =
          res.address1 + res.address2 + res.address3;
      }
    });
}

// 最終確認ページへデータを渡して遷移
function showConfirmModal() {
  const name = document.getElementById("name").value;
  const agree = document.getElementById("agree-terms").checked;

  if (!name || !agree) {
    alert("必須項目を入力し、規約に同意してください。");
    return;
  }

  // キャンバスを画像化（multiplier:2で高画質化）
  const highResImg = canvas.toDataURL({
    format: "png", // jpeg -> png に変更して透明度を維持
    multiplier: 2.0,
  });

  // 送信用データオブジェクト（スプシIDを含める）
  const orderData = {
    orderId: "ORD-" + Date.now(),
    name: name,
    postalCode: document.getElementById("postal-code").value,
    autoAddress: document.getElementById("auto-address").value,
    address: document.getElementById("address").value,
    birthYear: document.getElementById("birth-year").value,
    playerNumber: selectedNumber,
    playerPosition: selectedPosition,
    image: highResImg,
    // セキュリティ：パスではなくスプシのIDを送る
    usedItems: [
      selectedItems.background,
      selectedItems.icon,
      selectedItems.frame,
      selectedItems.status,
    ]
      .filter(Boolean)
      .join(", "),
    // 予備としてパスも保持
    details: `背景:${selectedBgPath}, ロゴ:${selectedLogoPath}, 枠:${selectedFramePath}, 番号:${selectedNumber}, ポジション:${selectedPosition}`,
  };

  sessionStorage.setItem("orderData", JSON.stringify(orderData));
  window.location.href = "confirm.html";
}

function showAddressForm() {
  document.getElementById("form-section").style.display = "block";
  document
    .getElementById("form-section")
    .scrollIntoView({ behavior: "smooth" });
}

function resetCanvas() {
  if (confirm("全ての作業を消去して、最初からやり直しますか？")) {
    location.reload();
  }
}

// 実行
loadMasterData();
