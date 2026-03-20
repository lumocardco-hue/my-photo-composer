// ==========================================
// 1. 基本設定とグローバル定数
// ==========================================
// 外部サービスとの連携に必要なURLやキーを設定します。
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbx_BrHzdGC99V8fNMIsdJCjajuM67OPhCj4f5iSNK4bVx8oXMbggF079zRiYuhsovg1/exec";
const stripe = Stripe(
  "pk_test_51T7mqvDLyro3HnGt8BxSF7Y3rQ3vKnuZiUdrpugHDzeAExH0aSr9cg7ZmyhbRD1pNeyE3n1KRx5zEhKjTPyzqlNo00HrVDw7tV",
);
const statusLabel = document.getElementById("status");

// ==========================================
// 2. 状態管理（State Management）
// ==========================================
// アプリケーション全体で使うデータ（今何が選択されているか）をここで一元管理します。
// これにより、「どこで変数が書き換わったか分からない」バグを防ぎます。
const AppState = {
  masterData: [], // スプレッドシートから読み込んだ全データ

  // ユーザーが選択した項目のIDやパスをまとめて保持します
  selections: {
    background: { id: null, path: "未選択" },
    person: { name: "未選択" },
    status: { id: null, number: "99", position: "FW" },
    logo: { id: null, path: "未選択" },
    frame: { id: null, path: "未選択" },
    skill: { ids: [], paths: [] }, // ★ 追加
  },

  // キャンバス上で動的に変更・削除される特定のオブジェクトへの参照を保持します
  canvasObjects: {
    customImage: null, // カスタム画像
    textGroup: null, // 追加したテキスト
  },
};

// ==========================================
// 3. ユーティリティ関数（共通処理）
// ==========================================
// 画像を別の画像の形（マスク）で切り抜く非同期関数です。
// 元コードにあった2つの重複した関数を、より安全な最新のロジックに統合しました。
async function maskImageWithShape(imageUrl, maskUrl) {
  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");

  // 画像を読み込んでPromiseを返すヘルパー関数
  const loadImage = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // CORSエラー回避
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error(`画像の読み込みに失敗しました: ${url}`));
      // キャッシュを回避して常に最新の画像を読み込む
      img.src = url + "?t=" + new Date().getTime();
    });

  try {
    // 枠画像とマスク画像を並行して読み込む
    const [imageToMask, maskShape] = await Promise.all([
      loadImage(imageUrl),
      loadImage(maskUrl),
    ]);

    // キャンバスのサイズを枠画像に合わせる
    tempCanvas.width = imageToMask.width;
    tempCanvas.height = imageToMask.height;

    // 1. まず枠画像を描画
    ctx.drawImage(imageToMask, 0, 0);
    // 2. 重なる部分だけを残す合成モードに変更
    ctx.globalCompositeOperation = "destination-in";
    // 3. マスク画像（盾の形など）を重ねて描画し、型抜きする
    ctx.drawImage(maskShape, 0, 0, tempCanvas.width, tempCanvas.height);
    // 4. 合成モードを元に戻す
    ctx.globalCompositeOperation = "source-over";

    // 型抜きされた画像をBase64データとして返す
    return tempCanvas.toDataURL("image/png");
  } catch (error) {
    console.error("マスキング処理中にエラーが発生しました:", error);
    throw error;
  }
}

// ==========================================
// 4. キャンバス管理（Canvas Manager）
// ==========================================
// Fabric.jsに関する複雑な操作をすべてこのクラスの中に隠蔽（カプセル化）します。
class CanvasManager {
  constructor(canvasId) {
    // キャンバスの初期化
    this.canvas = new fabric.Canvas(canvasId, {
      width: 400,
      height: 500,
      backgroundColor: null,
      preserveObjectStacking: true, // レイヤー順序を勝手に変えさせない設定
    });
  }

  // キャンバス上のオブジェクトの重なり順（レイヤー）を正しく並び替える
  sortLayers() {
    const objects = this.canvas.getObjects();
    // 下から順番に並び替える。数値が大きいほど手前に表示されます。
    objects.filter((o) => o.isBackground).forEach((o) => o.moveTo(0));
    objects.filter((o) => o.isPerson).forEach((o) => o.moveTo(1));
    objects.filter((o) => o.isCustom).forEach((o) => o.moveTo(5));
    objects.filter((o) => o.isText).forEach((o) => o.moveTo(8));
    objects.filter((o) => o.isStatus).forEach((o) => o.moveTo(10));
    objects.filter((o) => o.isSkill).forEach((o) => o.moveTo(15)); // ★ 追加
    objects.filter((o) => o.isLogo).forEach((o) => o.moveTo(20));
    // フレームは一番手前に配置
    objects.filter((o) => o.isFrame).forEach((o) => o.bringToFront());
    this.canvas.renderAll();
  }

  // [機能1] 背景のセット（元コードの onclick 呼び出しに対応）
  setBackground(url) {
    statusLabel.textContent = `Loading background...`;
    // 古い背景があれば削除
    this.canvas.getObjects().forEach((obj) => {
      if (obj.isBackground) this.canvas.remove(obj);
    });

    fabric.Image.fromURL(
      url + "?t=" + Date.now(),
      (img) => {
        img.set({
          left: 0,
          top: 0,
          scaleX: this.canvas.width / img.width,
          scaleY: this.canvas.height / img.height,
          selectable: false,
          evented: false,
          isBackground: true, // 目印
        });
        this.canvas.add(img);
        this.sortLayers();
        statusLabel.textContent = "Background Set!";
      },
      { crossOrigin: "anonymous" },
    );
  }

  // [機能2] 枠（フレーム）のセットとクリッピング（型抜き）処理
  async setFrame(frameUrl) {
    statusLabel.textContent = `Loading ${frameUrl}...`;
    // 古い枠を削除
    this.canvas.getObjects().forEach((obj) => {
      if (obj.isFrame) this.canvas.remove(obj);
    });

    // waku101〜104の場合は特別なマスク処理（型抜き）を実行
    const isWakuClip = /waku10[1-4]\.png$/.test(frameUrl);

    if (isWakuClip) {
      // ご指定のパスを設定（Web用にスラッシュを使用）
      const maskUrl = "画像/Group 2424.png";
      statusLabel.textContent = `Applying Shield Mask...`;

      // Fabric.jsの機能を使って、キャンバス全体を盾の画像で型抜きする
      fabric.Image.fromURL(
        maskUrl + "?t=" + Date.now(),
        (maskImg) => {
          // マスク画像をキャンバスのサイズにピッタリ合わせる
          maskImg.set({
            originX: "left",
            originY: "top",
            left: 0,
            top: 0,
            scaleX: this.canvas.width / maskImg.width,
            scaleY: this.canvas.height / maskImg.height,
          });

          // キャンバス全体の「表示領域（クリッピングパス）」として設定
          this.canvas.clipPath = maskImg;

          // 型抜きが完了したら、通常の枠を上から被せる
          this._addFrameToCanvas(frameUrl + "?t=" + Date.now());
        },
        { crossOrigin: "anonymous" },
      );
    } else {
      // 通常の四角い枠の場合は、キャンバス全体の型抜き設定を「なし」に戻す
      this.canvas.clipPath = null;
      this._addFrameToCanvas(frameUrl + "?t=" + Date.now());
    }
  }

  // （内部処理用）枠画像を実際にキャンバスに配置する処理
  _addFrameToCanvas(sourceUrl) {
    fabric.Image.fromURL(
      sourceUrl,
      (img) => {
        img.set({
          left: 0,
          top: 0,
          scaleX: this.canvas.width / img.width,
          scaleY: this.canvas.height / img.height,
          selectable: false,
          evented: false,
          isFrame: true,
        });
        this.canvas.add(img);
        this.sortLayers();
        statusLabel.textContent = "Frame Set!";
      },
      { crossOrigin: "anonymous" },
    );
  }

  // [機能3] ロゴのセット
  setLogo(fileName) {
    this.canvas.getObjects().forEach((obj) => {
      if (obj.isLogo) this.canvas.remove(obj);
    });

 // ロゴ画像を読み込み、キャッシュを無効化してキャンバスに追加
    fabric.Image.fromURL(
      // 1. 画像のURL。末尾に「?t=タイムスタンプ」を付けてブラウザキャッシュを回避
      fileName + "?t=" + Date.now(),
      
      // 2. 画像の読み込みが完了した後に実行されるコールバック関数
      (img) => {
        // 3. 画像のプロパティ（位置、大きさ、属性）を一括設定
        img.set({
          left: 280,                       // キャンバス左端からの距離を300pxに設定
          top: this.canvas.height - 420,   // キャンバス下端から420pxの位置に配置
          scaleX: 0.15,                    // 横方向の倍率を0.12倍に縮小
          scaleY: 0.15,                    // 縦方向の倍率を0.12倍に縮小
          isLogo: true,                    // 自作のカスタム属性。後でロゴを特定しやすくするため
          selectable: false,               // ユーザーがマウスで選択したり動かしたりできないように固定
        });

        // 4. 設定した画像オブジェクトをキャンバス上に追加
        this.canvas.add(img);

        // 5. 重なり順（レイヤー）を整理する独自の関数を実行（ロゴを背面に回すなどの処理）
        this.sortLayers();

        // 6. 画面上のステータス表示用ラベルを「ロゴ設置完了」に変更
        statusLabel.textContent = "Logo Set!";
      },
      
      // 7. 他のドメインから画像を読み込む際のCORS（セキュリティ）設定を「匿名」で許可
      { crossOrigin: "anonymous" },
    );
  }


  // [機能4] ステータス（数字とポジション）の描画
  addBrandElement(num, position) {
    this.canvas.getObjects().forEach((obj) => {
      if (obj.isStatus) this.canvas.remove(obj);
    });

    const numText = new fabric.Text(String(num), {
      left: 45,
      top: this.canvas.height - 450,
      fontSize: 80,
      fill: "#ffffff",
      fontWeight: "bold",
      fontFamily: "Impact",
      isStatus: true,
      selectable: false,
    });

    const posDisplay = new fabric.Text(position, {
      top: this.canvas.height - 360,
      fontSize: 40,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      paintFirst: "stroke",
      fontWeight: "bold",
      fontFamily: "Arial",
      isStatus: true,
      selectable: false,
      originX: "center",
    });

    this.canvas.add(numText, posDisplay);

    // Dynamically set the position of posDisplay based on numText's calculated width.
    posDisplay.set("left", numText.left + numText.getScaledWidth() / 2);

    this.sortLayers();
  }

  // [機能5] 人物画像の追加（背景削除処理など）
  addPerson(imgUrl) {
    fabric.Image.fromURL(imgUrl, (img) => {
      img.scaleToWidth(300);
      img.isPerson = true;
      this.canvas.add(img);
      this.canvas.centerObject(img);
      this.sortLayers();
      this.canvas.setActiveObject(img);
      statusLabel.textContent = "Person Added!";
    });
  }

  // [機能6] カスタム画像の追加
  addCustomImage(dataUrl) {
    if (AppState.canvasObjects.customImage) {
      this.canvas.remove(AppState.canvasObjects.customImage);
    }
    fabric.Image.fromURL(dataUrl, (img) => {
      img.set({
        left: 150,
        top: 150,
        scaleX: 0.5,
        scaleY: 0.5,
        isCustom: true,
        selectable: true,
        uniScaleTransform: true,
        lockScalingFlip: true,
      });
      this.canvas.add(img);
      AppState.canvasObjects.customImage = img;
      this.canvas.setActiveObject(img);
      this.sortLayers();
    });
  }

  // [機能7] テキストの追加と更新（縦書き・横書き対応）
  updateText(textValue, writingMode, font, fontSize) {
    if (AppState.canvasObjects.textGroup) {
      this.canvas.remove(AppState.canvasObjects.textGroup);
      AppState.canvasObjects.textGroup = null;
    }

    if (!textValue) {
      this.canvas.renderAll();
      return;
    }

    const textOptions = {
      fontFamily: font,
      fontSize: fontSize,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2,
      paintFirst: "stroke",
    };

    let textObject;
    if (writingMode === "vertical") {
      const chars = textValue.split("");
      const charObjects = [];
      let currentY = 0;
      chars.forEach((char) => {
        const charObj = new fabric.Text(char, {
          ...textOptions,
          top: currentY,
          left: 0,
        });
        charObjects.push(charObj);
        currentY += charObj.getScaledHeight();
      });
      textObject = new fabric.Group(charObjects, {
        left: 150,
        top: 50,
        selectable: true,
        isText: true,
      });
    } else {
      textObject = new fabric.Text(textValue, {
        ...textOptions,
        left: 100,
        top: 100,
        selectable: true,
        isText: true,
      });
    }

    this.canvas.add(textObject);
    AppState.canvasObjects.textGroup = textObject;
    this.canvas.setActiveObject(textObject);
    this.sortLayers();
  }

  // [機能8] スキルアイコンの描画（★ 追加）
  renderSkills(skillPaths) {
    // 既存のスキル画像をすべて削除
    this.canvas.getObjects().forEach((obj) => {
      if (obj.isSkill) this.canvas.remove(obj);
    });

    const startX = 70; // 左からの基準位置
    const startY = 220; // 上からの開始Y位置
    const spacing = 5; // アイコン間の間隔
    const iconSize = 30; // アイコンのサイズ

    skillPaths.forEach((path, index) => {
      // インデックスに基づいてY位置を計算（上から下にスタック）
      const currentY = startY + (iconSize + spacing) * index;
      fabric.Image.fromURL(
        path + "?t=" + Date.now(),
        (img) => {
          img.set({
            left: startX,
            top: currentY, // 計算されたY位置を使用
            scaleX: iconSize / img.width,
            scaleY: iconSize / img.height,
            isSkill: true,
            selectable: false,
            evented: false,
          });
          this.canvas.add(img);
          this.sortLayers();
        },
        { crossOrigin: "anonymous" },
      );
    });
  }

  // 高解像度でのデータ書き出し
  generateHighResImage() {
    return this.canvas.toDataURL({ format: "png", multiplier: 2.0 });
  }
}

// キャンバス管理クラスをインスタンス化
const myCanvas = new CanvasManager("canvas");

// ==========================================
// 5. データ読み込みとUI構築
// ==========================================

// スプレッドシートからデータを取得
async function loadMasterData() {
  try {
    statusLabel.textContent = "Loading Master Data...";
    const response = await fetch(GAS_URL);
    AppState.masterData = await response.json();
    console.log("マスターデータの読み込み完了:", AppState.masterData);
    generateButtons();
    statusLabel.textContent = "Ready";
  } catch (error) {
    console.error("データの取得に失敗しました:", error);
    statusLabel.textContent = "Error loading data.";
  }
}

// 取得したデータから選択ボタンを自動生成
function generateButtons() {
  const containers = {
    background: document.getElementById("bg-container"),
    icon: document.getElementById("logo-container"),
  };
  const frameContainer1 = document.getElementById("frame-container-1");
  const frameContainer2 = document.getElementById("frame-container-2");

  const skillContainers = {
    1: document.getElementById("skill-container-1"),
    2: document.getElementById("skill-container-2"),
    3: document.getElementById("skill-container-3"),
  };

  const skillNameMapping = {
    sukiru001: "リフティング 50回",
    sukiru002: "ジンガ",
    sukiru003: "ダブルタッチ",
    sukiru004: "スピード",
    sukiru005: "シュート",
    sukiru011: "リフティング 100回",
    sukiru012: "高速ジンガ",
    sukiru013: "高速ダブルタッチ",
    sukiru014: "スピードスター",
    sukiru015: "インパクトシュート",
    sukiru101: "リフティング 200回",
    sukiru102: "爆速ジンガ",
    sukiru103: "爆速ダブルタッチ",
    sukiru104: "スーパースピードマスター",
    sukiru105: "サイドネットシュート",
  };

  // コンテナの初期化
  Object.values(containers).forEach((c) => {
    if (c) c.innerHTML = "";
  });
  if (frameContainer1) frameContainer1.innerHTML = "";
  if (frameContainer2) frameContainer2.innerHTML = "";

  Object.values(skillContainers).forEach((c) => {
    if (c) {
      c.innerHTML = "";
      c.classList.remove("controls");
    }
  });

  let frameCount = 0;
  AppState.masterData.forEach((item) => {
    if (item.category === "skill") {
      let targetContainer;
      const baseName = item.itemName.split(".")[0];
      const isSelectableSkill = baseName.startsWith("sukiru00");

      if (isSelectableSkill) {
        targetContainer = skillContainers[1];
      } else if (baseName.startsWith("sukiru01")) {
        targetContainer = skillContainers[2];
      } else if (baseName.startsWith("sukiru10")) {
        targetContainer = skillContainers[3];
      }

      if (targetContainer) {
        const skillItemContainer = document.createElement("div");
        skillItemContainer.className = "skill-item";
        skillItemContainer.style.cursor = "pointer";

        const img = document.createElement("img");
        img.src = item.filePath;
        img.className = "skill-icon";

        const label = document.createElement("label");
        label.textContent = skillNameMapping[baseName] || item.itemName;

        if (isSelectableSkill) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `skill-check-${item.itemId}`;
          checkbox.value = item.itemId;
          checkbox.onchange = (e) => {
            window.addSkill(item.itemId, item.filePath, e.target);
          };
          label.htmlFor = `skill-check-${item.itemId}`;
          skillItemContainer.appendChild(checkbox);
        } else {
          skillItemContainer.onclick = () => {
            window.toggleSkill(item.itemId, item.filePath, skillItemContainer);
          };
        }

        skillItemContainer.appendChild(img);
        skillItemContainer.appendChild(label);
        targetContainer.appendChild(skillItemContainer);
      }
    } else if (item.category === "frame") {
      const btn = document.createElement("button");
      btn.className = "img-btn";
      btn.style.backgroundImage = `url('${item.filePath}')`;
      btn.onclick = () => {
        AppState.selections.frame.id = item.itemId;
        AppState.selections.frame.path = item.filePath;
        window.setFrame(item.filePath);
      };

      if (frameCount < 4) {
        frameContainer1.appendChild(btn);
      } else {
        frameContainer2.appendChild(btn);
      }
      frameCount++;
    } else if (containers[item.category]) {
      const btn = document.createElement("button");
      btn.className = "img-btn";
      btn.style.backgroundImage = `url('${item.filePath}')`;

      // カテゴリ別のクリックイベント
      btn.onclick = () => {
        if (item.category === "background") {
          AppState.selections.background.id = item.itemId;
          AppState.selections.background.path = item.filePath;
          window.setBackground(item.filePath);
        } else if (item.category === "icon") {
          AppState.selections.logo.id = item.itemId;
          AppState.selections.logo.path = item.filePath;
          window.setLogo(item.filePath);
        }
      };
      containers[item.category].appendChild(btn);
    }
  });
}

// ==========================================
// 6. UIのイベントリスナー設定
// ==========================================

// [2. 人物写真をアップロード]
document.getElementById("upload").onchange = async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  AppState.selections.person.name = file.name;
  statusLabel.textContent = "AI Removing Background...";

  try {
    const blob = await imglyRemoveBackground(file, {
      publicPath:
        "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/assets/",
    });
    const url = URL.createObjectURL(blob);
    myCanvas.addPerson(url);
  } catch (err) {
    console.warn("AI切り抜き失敗、元の画像をそのまま使用します:", err);
    const reader = new FileReader();
    reader.onload = (f) => myCanvas.addPerson(f.target.result);
    reader.readAsDataURL(file);
  }
};

// [カスタム画像のアップロード]
document.getElementById("custom-image-upload").onchange = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (f) {
    myCanvas.addCustomImage(f.target.result);
  };
  reader.readAsDataURL(file);
};

// [テキストツールのイベントリスナー]
function handleTextUpdate() {
  const textValue = document.getElementById("text-input").value;
  const writingMode = document.getElementById("writing-mode-select").value;
  const font = document.getElementById("font-select").value;
  const fontSize = parseInt(
    document.getElementById("font-size-input").value,
    10,
  );
  myCanvas.updateText(textValue, writingMode, font, fontSize);
}

document
  .getElementById("add-text-btn")
  .addEventListener("click", handleTextUpdate);
document
  .getElementById("writing-mode-select")
  .addEventListener("change", handleTextUpdate);
document
  .getElementById("font-size-input")
  .addEventListener("input", handleTextUpdate);
document
  .getElementById("text-input")
  .addEventListener("input", handleTextUpdate);
document.getElementById("font-select").addEventListener("change", () => {
  if (AppState.canvasObjects.textGroup) handleTextUpdate();
});

// ==========================================
// 7. グローバル関数の露出（index.htmlから呼ばれるもの）
// ==========================================
// HTML側の onclick="関数名()" から直接呼び出せるように window オブジェクトに登録します

// ボタン生成時に使われる関数
window.setBackground = (url) => myCanvas.setBackground(url);
window.setLogo = (url) => myCanvas.setLogo(url);
window.setFrame = (url) => myCanvas.setFrame(url);

window.toggleSkill = (itemId, filePath, skillDiv) => {
  const { ids, paths } = AppState.selections.skill;
  const index = ids.indexOf(itemId);

  if (index === -1) {
    // Not currently selected, so let's select it
    if (ids.length >= 5) {
      alert("スキルは最大5つまで選択できます。");
      return;
    }
    ids.push(itemId);
    paths.push(filePath);
    skillDiv.classList.add("selected"); // Add a class to show it's selected
  } else {
    // Already selected, so let's deselect it
    ids.splice(index, 1);
    paths.splice(index, 1);
    skillDiv.classList.remove("selected");
  }

  myCanvas.renderSkills(paths); // Redraw canvas
};

// スキル選択の処理（★ 追加）
// チェックボックスが変更されたときに呼び出されます。
// 選択されたスキルのIDとパスを `AppState` に追加または削除し、
// キャンバス上のスキルアイコンを再描画します。
// スキルは最大5つまで選択可能です。
window.addSkill = (itemId, filePath, checkbox) => {
  const { ids, paths } = AppState.selections.skill;
  const index = ids.indexOf(itemId);

  if (checkbox.checked) {
    // 新規選択
    if (ids.length >= 5) {
      alert("スキルは最大5つまで選択できます。");
      checkbox.checked = false; // チェックを元に戻す
      return;
    }
    if (index === -1) {
      ids.push(itemId);
      paths.push(filePath);
    }
  } else {
    // 選択解除
    if (index > -1) {
      ids.splice(index, 1);
      paths.splice(index, 1);
    }
  }

  myCanvas.renderSkills(paths); // キャンバスの再描画
};

// ステータス（数字・ポジション）選択時の処理
window.addBrandElement = (num) => {
  const statusItem = AppState.masterData.find(
    (i) => i.category === "status" && i.itemName == num,
  );
  if (statusItem) AppState.selections.status.id = statusItem.itemId;

  AppState.selections.status.number = num;
  AppState.selections.status.position =
    document.getElementById("position-select").value;
  myCanvas.addBrandElement(
    AppState.selections.status.number,
    AppState.selections.status.position,
  );
};

// ポジション選択変更時
window.updatePositionText = () => {
  if (AppState.selections.status.number) {
    window.addBrandElement(AppState.selections.status.number);
  }
};

// 住所自動取得 API (Zipcloud)
window.fetchAddress = () => {
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
};

// 送付先フォーム表示
window.showAddressForm = () => {
  document.getElementById("form-section").style.display = "block";
  document
    .getElementById("form-section")
    .scrollIntoView({ behavior: "smooth" });
};

// キャンバスリセット
window.resetCanvas = () => {
  if (confirm("全ての作業を消去して、最初からやり直しますか？")) {
    location.reload();
  }
};

// Stripe決済ページへのデータ引き継ぎとリダイレクト
window.redirectToCheckout = async () => {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const agree = document.getElementById("agree-terms").checked;

  if (!name || !email || !agree) {
    alert("名前、メールアドレスを入力し、規約に同意してください。");
    return;
  }

  statusLabel.textContent = "画像を生成しています...";

  // Stripeの料金IDをここで定義
  const BASE_PRICE_ID = "price_1TCfDZDEJmFzQJ7mBYBiJYyp";
  const LOGO_UPLOAD_PRICE_ID = "price_1TCfdPDEJmFzQJ7mS0AKD15y";
  const SPECIAL_FRAME_PRICE_ID = "price_1TCfdPDEJmFzQJ7mS0AKD15y";

  // lineItems 配列を作成
  const lineItems = [{ price: BASE_PRICE_ID, quantity: "1" }];

  // 条件に応じて商品を追加（重複を避けるためSetを使用）
  const additionalPriceIds = new Set();

  // 1. カスタムロゴがアップロードされているかチェック
  if (AppState.canvasObjects.customImage) {
    additionalPriceIds.add(LOGO_UPLOAD_PRICE_ID);
  }

  // 2. 特別な枠（waku101〜104）が選択されているかチェック
  if (/waku10[1-4]\.png$/.test(AppState.selections.frame.path)) {
    additionalPriceIds.add(SPECIAL_FRAME_PRICE_ID);
  }

  additionalPriceIds.forEach(priceId => {
    lineItems.push({ price: priceId, quantity: "1" });
  });


  // キャンバスクラスから高解像度画像を生成
  const highResImg = myCanvas.generateHighResImage();

  // AppStateに保存したデータから注文情報を組み立てる
  const { background, logo, frame, status, skill } = AppState.selections;

  const totalPoints = 1000;
  // 注文データをまとめるオブジェクト（orderData）を作成します。
  const orderData = {
    lineItems: lineItems, // ★Stripeに渡す商品リストを追加
    // 注文IDを生成します（"ORD-" の後に現在時刻のミリ秒をつなげて他の注文と被らないようにします）。
    orderId: "ORD-" + Date.now(),
    // 入力された名前をセットします（変数 name に入っている値を使用します）。
    name: name,
    // HTMLのメールアドレス入力欄（id="email"）から値を取得してセットします。
    email: email,
    // HTMLの隠し項目（id="referrer_id"）から紹介者IDを取得してセットします。
    referrerId: document.getElementById("referrer_id").value,
    // HTMLの郵便番号入力欄（id="postal-code"）から値を取得してセットします。
    postalCode: document.getElementById("postal-code").value,
    // HTMLの自動入力住所欄（id="auto-address"）から値を取得してセットします。
    autoAddress: document.getElementById("auto-address").value,
    // HTMLの手入力住所欄（id="address"）から値を取得してセットします。
    address: document.getElementById("address").value,
    // HTMLの誕生年入力欄（id="birth-year"）から値を取得してセットします。
    birthYear: document.getElementById("birth-year").value,
    // プレイヤーの背番号を status オブジェクトから取得してセットします。
    playerNumber: status.number,
    // プレイヤーのポジションを status オブジェクトから取得してセットします。
    playerPosition: status.position,
    //画像の合計ポイントを計算してセットします（ここでは仮に1000ポイントとしていますが、実際には選択されたアイテムやスキルの数に応じて動的に計算することができます）。
    totalPoints: totalPoints,
    // 生成された高解像度の画像データ（変数 highResImg）をセットします。
    image: highResImg,
    // 使用された各アイテムのIDを一つの配列にまとめます（...skill.ids で配列を展開して追加しています）。
    usedItems: [background.id, logo.id, frame.id, status.id, ...skill.ids]
      // filter(Boolean) で、配列の中から undefined や空文字などの無効な値を取り除きます。
      .filter(Boolean)
      // 残った有効なIDを、カンマとスペース（", "）で区切って1つの文字列に結合します。
      .join(", "),
    // スキルURLの入力欄から値を取得し、GAS側で直接受け取れるように独立したプロパティとしてセットします。
    skillUrl: document.getElementById("skill-video-url").value,
    // スキルの申請をするかどうかのチェックボックスの状態を追加
    skillRequest: document.getElementById("skill-request").checked,
    // 注文の詳細情報を、各項目のパスや値を組み合わせて確認しやすい1つのテキストとして作成します。
    details: `背景:${background.path}, ロゴ:${logo.path}, 枠:${frame.path}, 番号:${status.number}, ポジション:${status.position}, スキル:${skill.paths.join(
      // 複数あるスキルのパス（skill.paths）をカンマ区切りの文字列に結合します。
      ",",
      // detailsの中にも、確認用としてスキルURLの情報をテキストとして含めておきます。
    )}, スキルURL:${document.getElementById("skill-video-url").value}, スキル申請:${document.getElementById("skill-request").checked}`,
  };

  // fetch を使って、指定したGASのURLに注文データを非同期で送信します。
  fetch(GAS_URL, {
    // データを新しく登録（送信）するため、HTTPメソッドに "POST" を指定します。
    method: "POST",
    // orderData の中身を、GASが受け取れるURL形式に変換して本体にセットします。
    body: new URLSearchParams(orderData),
    // 異なるドメインへの送信エラーを回避するため、"no-cors" モードを指定します。
    mode: "no-cors",
  });

  // 作成した orderData オブジェクトをJSON文字列に変換し、ブラウザの一時保存領域（sessionStorage）に保存します。
  // （これにより、ページを移動しても確認ページでこの注文データを読み込むことができます）
  sessionStorage.setItem("orderData", JSON.stringify(orderData));

  // 確認ページ（confirm.html）へ画面を遷移（リダイレクト）させます。
  window.location.href = "confirm.html";
}; // 関数の閉じカッコ
// ==========================================
// 8. アプリケーション起動
// ==========================================
// 全ての準備が整ったらマスターデータの読み込みを開始します
loadMasterData();
