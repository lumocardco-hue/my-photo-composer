<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>決済完了</title>
    <style>
      html {
        height: 100%;
        background-image: url("画像/background.jpg");
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        background-attachment: fixed;
      }
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        margin: 20px;
        line-height: 1.6;
        color: #333;
        text-align: center;
        background: none;
      }
      .container {
        max-width: 600px;
        margin: auto;
        background: #444444;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      h1 {
        color: #ffffff;
      }
      p {
        color: #ffffff;
      }
      .back-link {
        display: inline-block;
        margin-top: 20px;
        padding: 10px 20px;
        background: #1877f2;
        color: #fff;
        text-decoration: none;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>決済が完了しました！</h1>
      <p id="point-message"></p>
      <p>
        ご注文いただきありがとうございます。商品の到着まで今しばらくお待ちください。
      </p>
      <a
        href="javascript:void(0);"
        onclick="window.location.href = 'index.html?t=' + new Date().getTime()"
        class="back-link"
        >トップページに戻る</a
      >
    </div>
    <script>
      window.onload = function () {
        const orderDataString = sessionStorage.getItem("orderData");
        if (orderDataString) {
          const data = JSON.parse(orderDataString);
          const pointMessage = document.getElementById("point-message");
          if (pointMessage && data.email) {
            pointMessage.textContent =
              data.email + " にポイントが付与されました｡";
          } else if (pointMessage) {
            pointMessage.style.display = "none";
          }
        }
      };
    </script>
  </body>
</html>
