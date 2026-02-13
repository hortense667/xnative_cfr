/**
 * ネイティブマップ用設定（APIキーなど）
 * - ここに GEMINI_API_KEY を設定するか、ビルド/実行環境で環境変数 GEMINI_API_KEY を注入してください。
 */
(function () {
  if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
    window.GEMINI_API_KEY = GEMINI_API_KEY;
  } else {
    window.GEMINI_API_KEY = ''; // ここにGemini APIキーを文字列で入れてください
  }
})();
