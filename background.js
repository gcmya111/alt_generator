// ============================================================================
// background.js - Service Worker（サイドパネル制御・画像取得・Gemini API呼び出し）
// ----------------------------------------------------------------------------
// 1. 拡張機能アイコン押下時に消えない「サイドパネル」を開くよう設定します。
// 2. カーソルで選択された1枚の画像、またはページ内の対象画像リストを順番に処理し、
//    Gemini API (generateContent) で日本語の alt 文を生成いたします。
// 3. 生成結果はサムネイル・コピーボタン付きでサイドパネルへ即座に反映いたします。
// ============================================================================

// Gemini API で使用するモデル名（定数）
const GEMINI_MODEL = 'gemini-2.5-flash';

// リトライ設定（初回失敗時に最大2回リトライします）
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 2000;

// 実行状態フラグ
let isGenerating = false;
let shouldStop = false;

// ----------------------------------------------------------------------------
// 生成alt文の言語設定（popup.html の alt-lang-select と一致させます）
// ----------------------------------------------------------------------------
const ALT_LANGUAGE_CONFIGS = {
  ja: {
    name: '日本語',
    charLength: '全角40〜60文字程度',
    instruction: '日本語の完結した1文で説明してください',
    constraints: '「画像です」「写真です」「〜の画像」「〜の写真」などの前置きは使わないでください。',
    exampleFormat: '例: 柔らかな間接照明に照らされた木目調の落ち着いた客室です。'
  },
  en: {
    name: 'English',
    charLength: '10-20 words',
    instruction: 'describe in one complete English sentence',
    constraints: 'Do not use phrases like "image of", "photo of", or "picture of".',
    exampleFormat: 'Example: A tranquil wooden guest room softly lit by warm indirect lighting.'
  },
  ko: {
    name: '한국어 (Korean)',
    charLength: '20~40자 정도',
    instruction: '자연스러운 한국어 한 문장으로 설명해 주세요',
    constraints: '"이미지", "사진" 등의 불필요한 서두 표현은 사용하지 마세요.',
    exampleFormat: '예시: 은은한 간접 조명이 비추는 아늑한 원목 객실입니다.'
  },
  vi: {
    name: 'Tiếng Việt (Vietnamese)',
    charLength: '10-20 từ',
    instruction: 'mô tả bằng một câu tiếng Việt tự nhiên và hoàn chỉnh',
    constraints: 'Không dùng các từ mở đầu dư thừa như "Hình ảnh", "Bức ảnh" hay "Ảnh chụp".',
    exampleFormat: 'Ví dụ: Phòng nghỉ ốp gỗ ấm cúng được chiếu sáng dịu nhẹ bằng đèn hắt trần.'
  },
  zh: {
    name: '中文（简体）(Simplified Chinese)',
    charLength: '15-35个字',
    instruction: '用一句自然完整的简体中文描述',
    constraints: '不要使用"图片"、"照片"等冗余词。',
    exampleFormat: '例如: 柔和间接照明映照下的木质宁静客房。'
  },
  tw: {
    name: '中文（繁體）(Traditional Chinese)',
    charLength: '15-35個字',
    instruction: '用一句自然完整的繁體中文描述',
    constraints: '不要使用「圖片」、「照片」等冗餘詞。',
    exampleFormat: '例如: 柔和間接照明映照下的木質寧靜客房。'
  },
  es: {
    name: 'Español (Spanish)',
    charLength: '10-20 palabras',
    instruction: 'describe en una oración completa en español',
    constraints: 'No uses expresiones como "imagen de" o "foto de".',
    exampleFormat: 'Ejemplo: Una habitación tranquila de madera iluminada suavemente por luz indirecta.'
  },
  fr: {
    name: 'Français (French)',
    charLength: '10-20 mots',
    instruction: 'décrivez en une phrase complète en français',
    constraints: 'N\'utilisez pas de formules comme "image de" ou "photo de".',
    exampleFormat: 'Exemple: Une chambre paisible en bois éclairée doucement par une lumière indirecte.'
  },
  de: {
    name: 'Deutsch (German)',
    charLength: '10-20 Wörter',
    instruction: 'beschreiben Sie in einem vollständigen deutschen Satz',
    constraints: 'Verwenden Sie keine Einleitungen wie "Bild von" oder "Foto von".',
    exampleFormat: 'Beispiel: Ein ruhiges Gästezimmer mit Holzverkleidung, sanft beleuchtet von indirektem Licht.'
  },
  id: {
    name: 'Bahasa Indonesia (Indonesian)',
    charLength: '10-20 kata',
    instruction: 'jelaskan dalam satu kalimat bahasa Indonesia yang alami',
    constraints: 'Jangan gunakan kata seperti "gambar" atau "foto".',
    exampleFormat: 'Contoh: Kamar tamu kayu yang tenang dengan pencahayaan tidak langsung yang lembut.'
  },
  ms: {
    name: 'Bahasa Melayu (Malay)',
    charLength: '10-20 words',
    instruction: 'describe in one complete Malay (Bahasa Melayu) sentence',
    constraints: 'Do not use words like "gambar" or "foto". Ensure the language is clearly Malay and not Indonesian.',
    exampleFormat: 'Example: Bilik tetamu kayu yang tenang dengan pencahayaan tidak langsung yang lembut.'
  }
};

// ----------------------------------------------------------------------------
// バックグラウンド処理ログ用の4言語メッセージヘルパー
// ----------------------------------------------------------------------------
const BG_MESSAGES = {
  ja: {
    missingKey: 'エラー：APIキーが設定されておりません。先にAPIキーを入力・保存してください。',
    alreadyRunning: 'すでにalt生成処理を実行中でございます。',
    scanning: 'ページ内の画像をスキャンしております...',
    csError: (msg) => `エラー：ページのコンテンツスクリプトと通信できませんでした。ページを再読み込みしてから再度お試しください（${msg}）。`,
    collectError: (msg) => `エラー：対象画像の収集に失敗いたしました（${msg}）。`,
    noTargets: (total) => `ページ内の画像（全${total}枚）を確認いたしましたが、処理対象の画像が見つかりませんでした。`,
    foundTargets: (count, total, langName) => `対象画像が ${count} 枚見つかりました（全${total}枚中）。言語「${langName}」で1枚ずつ順番に生成いたします。`,
    analyzingSingle: (name, langName) => `選択された画像を解析しております（${langName}）: ${name}`,
    analyzingItem: (prefix, name) => `${prefix} 解析中: ${name}`,
    stopped: (done, total) => `停止リクエストを受け付けましたため、処理を中断いたしました（${done}/${total}枚完了）。`,
    decorativeSingle: (name) => `生成完了 (${name}): （装飾画像のため空文字）`,
    generatedSingle: (name, alt) => `生成完了 (${name}): 「${alt}」`,
    decorativeBatch: (prefix, name) => `${prefix} 装飾目的と判定（空文字）: ${name}`,
    generatedBatch: (prefix, name, alt) => `${prefix} 生成完了 (${name}): 「${alt}」`,
    errorSingle: (name, msg) => `生成エラー (${name}): ${msg}`,
    skipBatch: (prefix, name, msg) => `${prefix} スキップ (${name}): ${msg}`,
    errorBatch: (prefix, name, msg) => `${prefix} エラーによりスキップ (${name}): ${msg}`,
    allDone: (ok, ng) => `すべての処理が完了いたしました（成功: ${ok}枚 / スキップ・失敗: ${ng}枚）。上の生成結果リストからコピーしてご利用いただけます。`,
    unexpectedError: (msg) => `予期せぬエラーが発生いたしました: ${msg}`,
    stopRequested: '停止リクエストを受け付けました。現在の画像の処理が完了次第、中断いたします...',
    pickedErrorFallback: '選択された画像は処理対象外です。',
    imgEmpty: '画像データが空です',
    imgSkippedFormat: (mime) => `対象外の画像形式（${mime}）です`,
    imgFetchRetry: (sec, attempt, max, err) => `画像の取得に失敗いたしました。${sec}秒後にリトライいたします（${attempt}/${max}回目）: ${err}`,
    imgFetchFailed: (err) => `画像の取得に失敗いたしました（${err}）`,
    geminiBadRequest: (err) => `Gemini APIリクエストエラー（${err}）`,
    geminiRetry: (err, sec, attempt, max) => `Gemini API呼び出しでエラーが発生いたしました（${err}）。${sec}秒後にリトライいたします（${attempt}/${max}回目）。`,
    geminiFailed: (err) => `Gemini APIでの生成に失敗いたしました（${err}）`
  },
  en: {
    missingKey: 'Error: API key is missing. Please enter and save your API key first.',
    alreadyRunning: 'Generation is already in progress.',
    scanning: 'Scanning images on the page...',
    csError: (msg) => `Error: Could not communicate with page content script. Please reload the page and try again (${msg}).`,
    collectError: (msg) => `Error: Failed to collect target images (${msg}).`,
    noTargets: (total) => `Checked ${total} image(s) on the page, but no eligible target images were found.`,
    foundTargets: (count, total, langName) => `Found ${count} target image(s) out of ${total}. Generating in "${langName}" one by one...`,
    analyzingSingle: (name, langName) => `Analyzing selected image (${langName}): ${name}`,
    analyzingItem: (prefix, name) => `${prefix} Analyzing: ${name}`,
    stopped: (done, total) => `Stop requested. Process aborted (${done}/${total} completed).`,
    decorativeSingle: (name) => `Generated (${name}): (Empty string for decorative image)`,
    generatedSingle: (name, alt) => `Generated (${name}): "${alt}"`,
    decorativeBatch: (prefix, name) => `${prefix} Decorative image (empty alt): ${name}`,
    generatedBatch: (prefix, name, alt) => `${prefix} Generated (${name}): "${alt}"`,
    errorSingle: (name, msg) => `Generation error (${name}): ${msg}`,
    skipBatch: (prefix, name, msg) => `${prefix} Skipped (${name}): ${msg}`,
    errorBatch: (prefix, name, msg) => `${prefix} Error skipped (${name}): ${msg}`,
    allDone: (ok, ng) => `All tasks finished (Succeeded: ${ok} / Skipped or Failed: ${ng}). You can copy the results above.`,
    unexpectedError: (msg) => `Unexpected error occurred: ${msg}`,
    stopRequested: 'Stop requested. Stopping after the current image finishes...',
    pickedErrorFallback: 'The selected image is not supported.',
    imgEmpty: 'Image data is empty',
    imgSkippedFormat: (mime) => `Unsupported image format (${mime})`,
    imgFetchRetry: (sec, attempt, max, err) => `Failed to fetch image. Retrying in ${sec}s (${attempt}/${max}): ${err}`,
    imgFetchFailed: (err) => `Failed to fetch image (${err})`,
    geminiBadRequest: (err) => `Gemini API request error (${err})`,
    geminiRetry: (err, sec, attempt, max) => `Gemini API error (${err}). Retrying in ${sec}s (${attempt}/${max}).`,
    geminiFailed: (err) => `Gemini API generation failed (${err})`
  },
  ko: {
    missingKey: '오류: API 키가 설정되지 않았습니다. 먼저 API 키를 입력하고 저장해 주세요.',
    alreadyRunning: '이미 alt 생성 작업이 실행 중입니다.',
    scanning: '페이지 내 이미지를 스캔하고 있습니다...',
    csError: (msg) => `오류: 페이지 스크립트와 통신하지 못했습니다. 페이지를 새로고침 후 다시 시도해 주세요 (${msg}).`,
    collectError: (msg) => `오류: 대상 이미지를 수집하지 못했습니다 (${msg}).`,
    noTargets: (total) => `페이지 내 이미지(총 ${total}장)를 확인했으나 처리할 대상 이미지가 없습니다.`,
    foundTargets: (count, total, langName) => `대상 이미지 ${count}장을 찾았습니다 (전체 ${total}장 중). "${langName}" 언어로 순차 생성합니다.`,
    analyzingSingle: (name, langName) => `선택한 이미지를 분석 중입니다 (${langName}): ${name}`,
    analyzingItem: (prefix, name) => `${prefix} 분석 중: ${name}`,
    stopped: (done, total) => `중지 요청으로 작업을 중단했습니다 (${done}/${total}장 완료).`,
    decorativeSingle: (name) => `생성 완료 (${name}): (장식용 이미지로 빈 문자열 처리)`,
    generatedSingle: (name, alt) => `생성 완료 (${name}): "${alt}"`,
    decorativeBatch: (prefix, name) => `${prefix} 장식용 이미지 판정(빈 문자열): ${name}`,
    generatedBatch: (prefix, name, alt) => `${prefix} 생성 완료 (${name}): "${alt}"`,
    errorSingle: (name, msg) => `생성 오류 (${name}): ${msg}`,
    skipBatch: (prefix, name, msg) => `${prefix} 건너뜀 (${name}): ${msg}`,
    errorBatch: (prefix, name, msg) => `${prefix} 오류로 건너뜀 (${name}): ${msg}`,
    allDone: (ok, ng) => `모든 작업이 완료되었습니다 (성공: ${ok}장 / 건너뜀·실패: ${ng}장). 위 목록에서 복사하여 사용하세요.`,
    unexpectedError: (msg) => `예기치 않은 오류가 발생했습니다: ${msg}`,
    stopRequested: '중지 요청을 접수했습니다. 현재 이미지 처리 후 중단합니다...',
    pickedErrorFallback: '선택한 이미지는 처리 대상이 아닙니다.',
    imgEmpty: '이미지 데이터가 비어 있습니다',
    imgSkippedFormat: (mime) => `지원하지 않는 이미지 형식(${mime})입니다`,
    imgFetchRetry: (sec, attempt, max, err) => `이미지 가져오기에 실패했습니다. ${sec}초 후 재시도합니다 (${attempt}/${max}): ${err}`,
    imgFetchFailed: (err) => `이미지 가져오기에 실패했습니다 (${err})`,
    geminiBadRequest: (err) => `Gemini API 요청 오류 (${err})`,
    geminiRetry: (err, sec, attempt, max) => `Gemini API 오류가 발생했습니다 (${err}). ${sec}초 후 재시도합니다 (${attempt}/${max}).`,
    geminiFailed: (err) => `Gemini API 생성에 실패했습니다 (${err})`
  },
  vi: {
    missingKey: 'Lỗi: Chưa cài đặt API Key. Vui lòng nhập và lưu API Key trước.',
    alreadyRunning: 'Quá trình tạo alt đang được thực hiện.',
    scanning: 'Đang quét hình ảnh trên trang...',
    csError: (msg) => `Lỗi: Không thể kết nối với trang web. Vui lòng tải lại trang và thử lại (${msg}).`,
    collectError: (msg) => `Lỗi: Không thể thu thập ảnh mục tiêu (${msg}).`,
    noTargets: (total) => `Đã kiểm tra ${total} ảnh trên trang nhưng không tìm thấy ảnh phù hợp.`,
    foundTargets: (count, total, langName) => `Tìm thấy ${count} ảnh mục tiêu (trong tổng số ${total} ảnh). Đang tạo lần lượt bằng ngôn ngữ "${langName}"...`,
    analyzingSingle: (name, langName) => `Đang phân tích ảnh đã chọn (${langName}): ${name}`,
    analyzingItem: (prefix, name) => `${prefix} Đang phân tích: ${name}`,
    stopped: (done, total) => `Đã nhận yêu cầu dừng. Quá trình đã tạm ngưng (${done}/${total} hoàn thành).`,
    decorativeSingle: (name) => `Hoàn tất (${name}): (Chuỗi rỗng cho ảnh trang trí)`,
    generatedSingle: (name, alt) => `Hoàn tất (${name}): "${alt}"`,
    decorativeBatch: (prefix, name) => `${prefix} Ảnh trang trí (alt rỗng): ${name}`,
    generatedBatch: (prefix, name, alt) => `${prefix} Hoàn tất (${name}): "${alt}"`,
    errorSingle: (name, msg) => `Lỗi tạo alt (${name}): ${msg}`,
    skipBatch: (prefix, name, msg) => `${prefix} Bỏ qua (${name}): ${msg}`,
    errorBatch: (prefix, name, msg) => `${prefix} Lỗi, đã bỏ qua (${name}): ${msg}`,
    allDone: (ok, ng) => `Hoàn tất tất cả (Thành công: ${ok} / Bỏ qua hoặc lỗi: ${ng}). Bạn có thể sao chép kết quả ở trên.`,
    unexpectedError: (msg) => `Đã xảy ra lỗi không mong muốn: ${msg}`,
    stopRequested: 'Đã nhận yêu cầu dừng. Sẽ dừng sau khi xử lý xong ảnh hiện tại...',
    pickedErrorFallback: 'Ảnh đã chọn không được hỗ trợ.',
    imgEmpty: 'Dữ liệu ảnh trống',
    imgSkippedFormat: (mime) => `Định dạng ảnh không được hỗ trợ (${mime})`,
    imgFetchRetry: (sec, attempt, max, err) => `Tải ảnh thất bại. Đang thử lại sau ${sec} giây (${attempt}/${max}): ${err}`,
    imgFetchFailed: (err) => `Tải ảnh thất bại (${err})`,
    geminiBadRequest: (err) => `Lỗi yêu cầu Gemini API (${err})`,
    geminiRetry: (err, sec, attempt, max) => `Lỗi Gemini API (${err}). Thử lại sau ${sec} giây (${attempt}/${max}).`,
    geminiFailed: (err) => `Tạo alt bằng Gemini API thất bại (${err})`
  }
};

async function getBgMessages() {
  try {
    const { uiLang = 'ja' } = await chrome.storage.local.get({ uiLang: 'ja' });
    return BG_MESSAGES[uiLang] || BG_MESSAGES.ja;
  } catch {
    return BG_MESSAGES.ja;
  }
}

// ----------------------------------------------------------------------------
// サイドパネルをツールバーアイコンのクリックで開くように設定します
// （ページ外をクリックしても閉じないようにするため）
// ----------------------------------------------------------------------------
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {});
  }
});

// ----------------------------------------------------------------------------
// ログ出力＆保存ヘルパー関数
// ----------------------------------------------------------------------------
async function addLog(message, level = 'info') {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  const entry = { time, message, level };

  try {
    const data = await chrome.storage.local.get({ altGenLogs: [] });
    const updatedLogs = [...data.altGenLogs, entry].slice(-200);
    await chrome.storage.local.set({ altGenLogs: updatedLogs });
  } catch {
    // 無視します
  }

  chrome.runtime.sendMessage({ type: 'LOG_ADDED', entry }).catch(() => {});
}

// ----------------------------------------------------------------------------
// 生成結果カード（サムネイル・ファイル名・生成alt文）の保存＆通知ヘルパー関数
// ----------------------------------------------------------------------------
async function addResultItem(resultItem) {
  try {
    const data = await chrome.storage.local.get({ altGenResults: [] });
    // 同じ targetId または imageUrl が既にあれば最新結果で更新し、なければ先頭に追加します
    const filtered = data.altGenResults.filter(
      (r) => !(r.targetId && r.targetId === resultItem.targetId)
    );
    const updatedResults = [resultItem, ...filtered].slice(0, 200);
    await chrome.storage.local.set({ altGenResults: updatedResults });
  } catch {
    // 無視します
  }

  chrome.runtime.sendMessage({ type: 'RESULT_ADDED', result: resultItem }).catch(() => {});
}

// ----------------------------------------------------------------------------
// 実行状態の更新＆通知ヘルパー関数
// ----------------------------------------------------------------------------
async function setGeneratingState(running) {
  isGenerating = running;
  try {
    await chrome.storage.local.set({ isGenerating: running });
  } catch {
    // 無視します
  }
  chrome.runtime.sendMessage({ type: 'STATE_CHANGED', isGenerating: running }).catch(() => {});
}

// ----------------------------------------------------------------------------
// 指定ミリ秒だけ待機するヘルパー関数
// ----------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ----------------------------------------------------------------------------
// ArrayBuffer を安全に Base64 文字列へ変換する関数
// ----------------------------------------------------------------------------
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// ----------------------------------------------------------------------------
// URLやContent-TypeヘッダーからMIMEタイプを判定する関数
// ----------------------------------------------------------------------------
function resolveMimeType(contentTypeHeader, imageUrl) {
  if (contentTypeHeader) {
    const cleanType = contentTypeHeader.split(';')[0].trim().toLowerCase();
    if (cleanType.startsWith('image/')) {
      if (cleanType === 'image/jpg') return 'image/jpeg';
      return cleanType;
    }
  }
  const lowerUrl = imageUrl.toLowerCase().split('?')[0];
  if (lowerUrl.endsWith('.png')) return 'image/png';
  if (lowerUrl.endsWith('.webp')) return 'image/webp';
  if (lowerUrl.endsWith('.heic')) return 'image/heic';
  if (lowerUrl.endsWith('.heif')) return 'image/heif';
  if (lowerUrl.endsWith('.svg')) return 'image/svg+xml';
  if (lowerUrl.endsWith('.gif')) return 'image/gif';
  if (lowerUrl.endsWith('.ico')) return 'image/x-icon';
  return 'image/jpeg';
}

// ----------------------------------------------------------------------------
// 画像URLを fetch して Base64 と MIME タイプを取得する関数（リトライ付き）
// ----------------------------------------------------------------------------
async function fetchImageAsBase64(imageUrl) {
  const msg = await getBgMessages();
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(imageUrl, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const mimeType = resolveMimeType(contentType, imageUrl);

      if (
        mimeType.includes('svg') ||
        mimeType.includes('gif') ||
        mimeType.includes('icon')
      ) {
        const skipError = new Error(msg.imgSkippedFormat(mimeType));
        skipError.isSkippedFormat = true;
        throw skipError;
      }

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        throw new Error(msg.imgEmpty);
      }

      const base64Data = arrayBufferToBase64(buffer);
      return { base64Data, mimeType };
    } catch (error) {
      lastError = error;
      if (error.isSkippedFormat) {
        throw error;
      }
      if (attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_DELAY_MS * (attempt + 1);
        await addLog(
          msg.imgFetchRetry(waitMs / 1000, attempt + 1, MAX_RETRIES, error.message),
          'info'
        );
        await sleep(waitMs);
      }
    }
  }

  throw new Error(msg.imgFetchFailed(lastError ? lastError.message : 'unknown error'));
}

// ----------------------------------------------------------------------------
// Gemini に送信するプロンプト文を組み立てる関数（多言語対応＋追加プロンプト対応）
// ----------------------------------------------------------------------------
function buildAltPrompt(pageTitle, surroundingText, recentHistory = [], customPrompt = '', altLang = 'ja') {
  const langKey = ALT_LANGUAGE_CONFIGS[altLang] ? altLang : 'ja';
  const langConfig = ALT_LANGUAGE_CONFIGS[langKey];
  const trimmedCustom = (customPrompt || '').trim();

  if (langKey === 'ja') {
    const historySection =
      recentHistory.length > 0
        ? `\n【これまでに生成したAltテキスト（同じ表現の繰り返しを避けてください）】:\n${recentHistory
            .map((alt) => `- ${alt}`)
            .join('\n')}`
        : '';

    const customSection = trimmedCustom
      ? `\n【ユーザー指定の追加指示（トーン＆マナー・表記ルール等 ※最優先で従ってください）】:\n${trimmedCustom}\n`
      : '';

    return `
あなたはアクセシビリティの専門家です。
以下のページの文脈情報（ページタイトルおよび周辺テキスト）と画像の内容をもとに、HTMLのimgタグのalt属性に記述するための簡潔で自然な日本語のalt文（代替テキスト）を作成してください。

【ページタイトル】: ${pageTitle || '未設定'}
【周辺テキスト】:
${surroundingText || '（周辺テキストなし）'}${historySection}${customSection}

【厳守すべきルール】
1. **画像内の内容最優先と文脈の活用**:
   画像内に写っている内容を最優先しつつ、周辺テキスト（キャプション、見出し、本文）から施設名・場所・固有名詞や文脈を補完して、目的に合った完結した1文のalt文を作成してください。途中で文が途切れないように必ず文末まで完結させてください。
2. **トーン＆マナーと文字数の目安**:
   「ユーザー指定の追加指示」がある場合はそのトーン＆マナーや文字数・文末ルールを最優先してください。特に指定がない場合は、長さは${langConfig.charLength}を目安にし、${langConfig.instruction}。
3. **前置き表現の禁止**:
   ${langConfig.constraints}
4. **文字が含まれる画像の扱い**:
   バナーや見出し画像など、画像内に文字が写っている場合は、その文字を必ず含めてください。
5. **装飾目的の画像の扱い**:
   背景模様、単なる区切り線、意味を持たない装飾用のアイコンなど、装飾目的と判断できる画像は、何も書かずに「NONE」のみを返してください。
6. **語彙の多様化と具体的描写**:
   「重厚感」「落ち着いた」「モダン」などの抽象的な表現の多用を避け、具体的な被写体・素材・色彩・光の具合・状況が伝わるように描写してください。
7. **出力形式**:
   出力は完成したalt文の1文のみとし、説明、挨拶、思考プロセス、カギ括弧（「」や""）、文字数カウントなどの記号は一切含めないでください。

それでは、代替テキストのみを出力してください。
`.trim();
  }

  // 日本語以外の出力言語が選択された場合のプロンプト
  const historySectionEn =
    recentHistory.length > 0
      ? `\n[Previously generated Alt texts (avoid repeating these expressions)]:\n${recentHistory
          .map((alt) => `- ${alt}`)
          .join('\n')}`
      : '';

  const customSectionEn = trimmedCustom
    ? `\n[User Custom Instructions (Tone, Style & Formatting Rules - HIGHEST PRIORITY)]:\n${trimmedCustom}\n`
    : '';

  return `
You are a web accessibility expert.
Based on the image content and the webpage context (page title and surrounding text), write a concise, natural HTML alt attribute text strictly in **${langConfig.name}**.
If the webpage context is in another language, translate/adapt relevant proper nouns and context naturally into **${langConfig.name}**.

[Target Output Language]: ${langConfig.name}
[Page Title]: ${pageTitle || 'Untitled'}
[Surrounding Text]:
${surroundingText || '(None)'}${historySectionEn}${customSectionEn}

[Strict Rules]
1. **Image Content Priority & Completion**:
   Prioritize what is clearly visible in the image while leveraging context from the surrounding text. Ensure the sentence is completely finished and never cut off mid-sentence.
2. **Tone, Length & Language Requirement**:
   Follow [User Custom Instructions] as the highest priority if provided. Otherwise, ${langConfig.instruction} (target length: ${langConfig.charLength}).
3. **Avoid Redundant Prefixes**:
   ${langConfig.constraints}
4. **Text Inside Images**:
   If the image contains meaningful visible text (e.g., banners, signs, headings), include that text (or its natural translation/meaning in ${langConfig.name} if appropriate).
5. **Decorative Images**:
   If the image is purely decorative (background texture, divider line, spacer, non-informative icon), output ONLY "NONE".
6. **Vocabulary Diversity & Specific Details**:
   Avoid vague generic adjectives. Describe specific objects, materials, colors, lighting, and atmosphere.
7. **Output Format**:
   Output ONLY the final alt text in ${langConfig.name} (one sentence). Do NOT include quotes, explanations, thinking process, or character counts.

${langConfig.exampleFormat}

Now output only the alt text in ${langConfig.name}:
`.trim();
}

// ----------------------------------------------------------------------------
// Gemini API（generateContent）を呼び出して alt 文を生成する関数（リトライ付き）
// ----------------------------------------------------------------------------
async function callGeminiGenerateAlt({
  apiKey,
  base64Data,
  mimeType,
  pageTitle,
  surroundingText,
  recentHistory,
  customPrompt,
  altLang
}) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const promptText = buildAltPrompt(pageTitle, surroundingText, recentHistory, customPrompt, altLang);

  // gemini-2.5系モデルはデフォルトで内部思考（Thinking）トークンを消費するため、
  // maxOutputTokens が小さいと出力途中で切れてしまいます。
  // thinkingBudget: 0 で思考トークン消費を抑えつつ、十分な maxOutputTokens を確保します。
  const generationConfig = {
    temperature: 0.5,
    maxOutputTokens: 800
  };
  if (GEMINI_MODEL.includes('2.5')) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 0
    };
  }

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig
  };

  const msg = await getBgMessages();
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errorDetail += `: ${errJson.error.message}`;
          }
        } catch {
          // 無視します
        }

        const apiError = new Error(errorDetail);
        apiError.status = response.status;
        throw apiError;
      }

      const data = await response.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          ?.map((p) => p.text || '')
          .join('')
          .trim() || '';

      let cleaned = rawText
        .replace(/\r?\n/g, ' ')
        .replace(/^[\s「『"']+/, '')
        .replace(/[\s」』"']+$/, '')
        .trim();

      if (cleaned === 'NONE' || cleaned === '空文字' || cleaned === '""' || cleaned === "''") {
        cleaned = '';
      }

      return cleaned;
    } catch (error) {
      lastError = error;

      const status = error.status;
      const isAuthOrBadRequest = status === 400 || status === 401 || status === 403;
      if (isAuthOrBadRequest) {
        throw new Error(msg.geminiBadRequest(error.message));
      }

      if (attempt < MAX_RETRIES) {
        const waitMs = RETRY_BASE_DELAY_MS * (attempt + 1);
        await addLog(
          msg.geminiRetry(error.message, waitMs / 1000, attempt + 1, MAX_RETRIES),
          'info'
        );
        await sleep(waitMs);
      }
    }
  }

  throw new Error(msg.geminiFailed(lastError ? lastError.message : 'unknown error'));
}

// ----------------------------------------------------------------------------
// タブ内の content.js へメッセージを送信する関数（未注入時は自動注入）
// ----------------------------------------------------------------------------
async function sendMessageToContentScript(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

// ----------------------------------------------------------------------------
// 単一画像（カーソル選択時）の alt 生成処理
// ----------------------------------------------------------------------------
async function processSinglePickedImage(tabId, item) {
  const msg = await getBgMessages();
  const {
    geminiApiKey,
    customPrompt = '',
    altLang = 'ja',
    altGenResults = []
  } = await chrome.storage.local.get({
    geminiApiKey: '',
    customPrompt: '',
    altLang: 'ja',
    altGenResults: []
  });

  if (!geminiApiKey || geminiApiKey.trim() === '') {
    await addLog(msg.missingKey, 'error');
    return;
  }

  const langConfig = ALT_LANGUAGE_CONFIGS[altLang] || ALT_LANGUAGE_CONFIGS.ja;
  const shortFileName = item.imageUrl.split('/').pop().split('?')[0] || item.imageUrl;
  await addLog(msg.analyzingSingle(shortFileName, langConfig.name), 'info');

  try {
    const { base64Data, mimeType } = await fetchImageAsBase64(item.imageUrl);
    const recentHistory = altGenResults
      .map((r) => r.altText)
      .filter(Boolean)
      .slice(0, 10);

    const altText = await callGeminiGenerateAlt({
      apiKey: geminiApiKey.trim(),
      base64Data,
      mimeType,
      pageTitle: item.pageTitle,
      surroundingText: item.surroundingText,
      recentHistory,
      customPrompt,
      altLang
    });

    if (tabId) {
      await sendMessageToContentScript(tabId, {
        type: 'APPLY_ALT',
        targetId: item.targetId,
        altText
      }).catch(() => {});
    }

    const now = new Date();
    const resultItem = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetId: item.targetId,
      imageUrl: item.imageUrl,
      fileName: shortFileName,
      altText,
      existingAlt: item.existingAlt || '',
      time: now.toTimeString().split(' ')[0]
    };

    await addResultItem(resultItem);
    if (altText === '') {
      await addLog(msg.decorativeSingle(shortFileName), 'info');
    } else {
      await addLog(msg.generatedSingle(shortFileName, altText), 'info');
    }
  } catch (error) {
    await addLog(msg.errorSingle(shortFileName, error.message), 'error');
  }
}

// ----------------------------------------------------------------------------
// ページ内画像の一括 alt 生成処理
// ----------------------------------------------------------------------------
async function runAltGenerationProcess(tabId, overwriteExisting = true, passedAltLang = null) {
  const msg = await getBgMessages();
  if (isGenerating) {
    await addLog(msg.alreadyRunning, 'info');
    return;
  }

  shouldStop = false;
  await setGeneratingState(true);

  try {
    const {
      geminiApiKey,
      customPrompt = '',
      altLang: storedAltLang = 'ja',
      uiLang = 'ja'
    } = await chrome.storage.local.get({
      geminiApiKey: '',
      customPrompt: '',
      altLang: 'ja',
      uiLang: 'ja'
    });
    const altLang = passedAltLang || storedAltLang || 'ja';
    const langConfig = ALT_LANGUAGE_CONFIGS[altLang] || ALT_LANGUAGE_CONFIGS.ja;

    if (!geminiApiKey || geminiApiKey.trim() === '') {
      await addLog(msg.missingKey, 'error');
      return;
    }

    await addLog(msg.scanning, 'info');

    let collectResult;
    try {
      collectResult = await sendMessageToContentScript(tabId, {
        type: 'COLLECT_IMAGES',
        overwriteExisting,
        uiLang
      });
    } catch (error) {
      await addLog(msg.csError(error.message), 'error');
      return;
    }

    if (!collectResult || !collectResult.ok) {
      await addLog(msg.collectError(collectResult?.error || 'unknown error'), 'error');
      return;
    }

    if (Array.isArray(collectResult.skippedLogs)) {
      for (const skipMsg of collectResult.skippedLogs) {
        await addLog(skipMsg, 'info');
      }
    }

    const targets = collectResult.targets || [];
    if (targets.length === 0) {
      await addLog(msg.noTargets(collectResult.totalImgCount || 0), 'info');
      return;
    }

    await addLog(msg.foundTargets(targets.length, collectResult.totalImgCount || 0, langConfig.name), 'info');

    const recentHistory = [];
    let successCount = 0;
    let skipOrErrorCount = 0;

    for (let i = 0; i < targets.length; i++) {
      if (shouldStop) {
        await addLog(msg.stopped(i, targets.length), 'info');
        break;
      }

      const item = targets[i];
      const shortFileName = item.imageUrl.split('/').pop().split('?')[0] || item.imageUrl;
      const progressPrefix = `[${i + 1}/${targets.length}]`;

      try {
        await addLog(msg.analyzingItem(progressPrefix, shortFileName), 'info');

        const { base64Data, mimeType } = await fetchImageAsBase64(item.imageUrl);

        if (shouldStop) {
          await addLog(msg.stopped(i, targets.length), 'info');
          break;
        }

        const altText = await callGeminiGenerateAlt({
          apiKey: geminiApiKey.trim(),
          base64Data,
          mimeType,
          pageTitle: item.pageTitle,
          surroundingText: item.surroundingText,
          recentHistory: recentHistory.slice(-10),
          customPrompt,
          altLang
        });

        await sendMessageToContentScript(tabId, {
          type: 'APPLY_ALT',
          targetId: item.targetId,
          altText
        }).catch(() => {});

        const now = new Date();
        const resultItem = {
          id: `res-${Date.now()}-${i}`,
          targetId: item.targetId,
          imageUrl: item.imageUrl,
          fileName: shortFileName,
          altText,
          existingAlt: item.existingAlt || '',
          time: now.toTimeString().split(' ')[0]
        };
        await addResultItem(resultItem);

        if (altText === '') {
          await addLog(msg.decorativeBatch(progressPrefix, shortFileName), 'info');
        } else {
          recentHistory.push(altText);
          await addLog(msg.generatedBatch(progressPrefix, shortFileName, altText), 'info');
        }
        successCount++;
      } catch (error) {
        skipOrErrorCount++;
        if (error.isSkippedFormat) {
          await addLog(msg.skipBatch(progressPrefix, shortFileName, error.message), 'info');
        } else {
          await addLog(msg.errorBatch(progressPrefix, shortFileName, error.message), 'error');
        }
      }
    }

    if (!shouldStop) {
      await addLog(msg.allDone(successCount, skipOrErrorCount), 'info');
    }
  } catch (unexpectedError) {
    await addLog(msg.unexpectedError(unexpectedError.message), 'error');
  } finally {
    shouldStop = false;
    await setGeneratingState(false);
  }
}

// ----------------------------------------------------------------------------
// メッセージ受信リスナー
// ----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'GET_STATUS') {
    sendResponse({ ok: true, isGenerating });
    return false;
  }

  // カーソル選択モードで画像がクリックされた場合
  if (message.type === 'GENERATE_SINGLE_IMAGE' && message.item) {
    const tabId = sender?.tab?.id || message.tabId;
    processSinglePickedImage(tabId, message.item);
    sendResponse({ ok: true });
    return false;
  }

  // カーソル選択モードで対象外画像（SVG等）がクリックされた場合
  if (message.type === 'PICKED_IMAGE_ERROR') {
    getBgMessages().then((msg) => {
      addLog(message.error || msg.pickedErrorFallback, 'error');
    });
    sendResponse({ ok: true });
    return false;
  }

  // ページ一括生成の開始
  if (message.type === 'START_GENERATION') {
    if (isGenerating) {
      getBgMessages().then((msg) => {
        sendResponse({ ok: false, message: msg.alreadyRunning });
      });
      return true;
    }
    const tabId = message.tabId;
    const overwriteExisting =
      typeof message.overwriteExisting === 'boolean' ? message.overwriteExisting : true;
    const altLang = message.altLang || null;
    runAltGenerationProcess(tabId, overwriteExisting, altLang);
    sendResponse({ ok: true });
    return false;
  }

  // 処理の停止
  if (message.type === 'STOP_GENERATION') {
    if (isGenerating) {
      shouldStop = true;
      getBgMessages().then((msg) => {
        addLog(msg.stopRequested, 'info');
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
