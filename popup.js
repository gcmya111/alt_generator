// ============================================================================
// popup.js - サイドパネル画面（4言語UI切り替え・alt言語選択・画像選択・結果コピー）
// ----------------------------------------------------------------------------
// 【セキュリティに関するご注意】
// 入力された Gemini API キーは chrome.storage.local に平文で保存されます。
// ============================================================================

// UI表示用の多言語翻訳辞書（日本語 / 英語 / 韓国語 / ベトナム語）
const I18N_DICT = {
  ja: {
    appTitle: 'alt自動生成（Gemini使用）',
    statusIdle: '待機中',
    statusRunning: '処理中',
    statusPicker: '画像選択モード',
    labelApiKey: 'Gemini APIキー',
    saveBtn: '保存',
    noteApiKey: '※APIキーはお使いのブラウザ内（chrome.storage.local）に平文で保存されます。',
    labelAltLang: '生成するaltの言語',
    labelCustomPrompt: '追加プロンプト（トーン＆マナー・表記ルール）',
    customPromptPlaceholder:
      '例：体言止めで簡潔にする／上質で落ち着いたトーンにする／30文字以内にする 等（空欄でも使用可能です）',
    labelOverwrite: '一括生成時：既存のalt（ダミー等）がある画像も対象にする',
    cautionTitle: '⚠️ 機密情報の取り扱いに関するご注意',
    cautionDesc:
      '選択・検出された画像および周辺テキストは Gemini API へ送信されます。個人情報・社外秘・未公開の機密情報が含まれる箇所には使用しないでください。',
    pickerBtnStart: '🎯 カーソルで画像を選択してaltを作成',
    pickerBtnStop: '⏹ 画像選択モードを終了する（ページ上の画像をクリックで生成）',
    startBtn: 'ページ内の画像を一括生成',
    stopBtn: '停止',
    titleResults: '生成されたalt一覧（HTML貼り付け用）',
    copyAllBtn: '全件コピー',
    clearResultsBtn: 'クリア',
    emptyStateLine1:
      '「🎯 カーソルで画像を選択してaltを作成」を押してページ上の画像をクリックするか、「ページ内の画像を一括生成」を押してください。',
    emptyStateLine2: 'ここに画像のプレビューとコピー用のalt文が表示されます。',
    thumbTitle: 'クリックするとページ内の該当画像の場所へスクロールします',
    scrollHint: '📍 ページ内のこの画像を表示',
    altPlaceholder: '（装飾目的の画像のため空文字）',
    copyAltBtn: 'alt文をコピー',
    copyAttrBtn: 'alt="..." 形式でコピー',
    copiedFeedback: '✅ コピーしました',
    titleLogs: '処理ログ',
    clearLogBtn: 'ログを消去',
    titlePrivacy: '🔒 プライバシーポリシー・ご利用上の注意',
    privacySections: [
      {
        heading: '1. 外部へ送信されるデータと送信先',
        items: [
          '本拡張機能で「画像を選択」または「一括生成」を実行した際、対象の画像データ・ページタイトル・画像の周辺テキスト（最大500文字）が、Google社の Gemini API（generativelanguage.googleapis.com）へ直接送信されます。',
          '本拡張機能の開発者サーバーや第三者へデータが送信・収集されることは一切ございません。'
        ]
      },
      {
        heading: '2. 機密情報・個人情報に関する禁止事項',
        items: [
          '個人情報（氏名・顔写真・住所・連絡先・マイナンバー等）、社外秘情報、公開前の案件情報、顧客の機密データが含まれる画像やWebページでは使用しないでください。'
        ]
      },
      {
        heading: '3. AIモデルの学習利用について',
        items: [
          'Google AI Studio / Gemini API の無料枠（Free Tier）のAPIキーを使用した場合、送信したデータが Google のモデル改善（学習）に利用される場合があります。',
          '業務利用や機密性が求められる環境では、送信データがAI学習に利用されない有料プラン（Pay-as-you-go）のAPIキーをご利用ください。'
        ]
      },
      {
        heading: '4. APIキーおよび履歴の保存について',
        items: [
          '入力されたAPIキー、追加プロンプト、生成結果履歴はお使いのブラウザ内（chrome.storage.local）にのみ平文で保存されます。共用端末でご利用の際は、使用後にAPIキーおよび生成結果を消去してください。'
        ]
      }
    ],
    logSaved: '設定（APIキー・追加プロンプト・言語）を保存いたしました。',
    logClearedKey: 'APIキーの入力欄が空のため、保存データを消去いたしました。',
    logNoApiKey: 'エラー：Gemini APIキーが入力されておりません。先にAPIキーを入力して保存してください。',
    logPickerStarted:
      '画像選択モードを開始いたしました。Webページ上のaltを作成したい画像をクリックしてください（Escキーで終了できます）。',
    logPickerStopped: '画像選択モードを終了いたしました。',
    logNoTab: 'エラー：対象のアクティブなタブが見つかりませんでした。',
    logRestrictedPage:
      'エラー：ブラウザの内部ページ（chrome:// 等）では実行できません。通常のWebページまたは http://localhost でお試しください。',
    logBgError: 'エラー：バックグラウンド処理との通信に失敗いたしました。',
    logNoResultsToCopy: 'コピー対象の結果がまだございません。',
    logCopyFailed: 'クリップボードへのコピーに失敗いたしました。'
  },
  en: {
    appTitle: 'Alt Auto Generator (Gemini)',
    statusIdle: 'Idle',
    statusRunning: 'Running',
    statusPicker: 'Picker Mode',
    labelApiKey: 'Gemini API Key',
    saveBtn: 'Save',
    noteApiKey: '* Your API key is stored in plain text locally in your browser (chrome.storage.local).',
    labelAltLang: 'Output Alt Text Language',
    labelCustomPrompt: 'Additional Prompt (Tone & Style Rules)',
    customPromptPlaceholder:
      'e.g. Keep under 15 words / Use a refined, objective tone / Avoid brand names (optional)',
    labelOverwrite: 'Batch mode: Include images that already have alt text (e.g. placeholders)',
    cautionTitle: '⚠️ Confidentiality & Privacy Notice',
    cautionDesc:
      'Selected/detected images and surrounding text are sent to the Gemini API. Do NOT use on pages containing personal, confidential, or unreleased information.',
    pickerBtnStart: '🎯 Pick an Image on Page to Generate Alt',
    pickerBtnStop: '⏹ Exit Picker Mode (Click any image on page to generate)',
    startBtn: 'Generate All on Page',
    stopBtn: 'Stop',
    titleResults: 'Generated Alt List (For HTML)',
    copyAllBtn: 'Copy All',
    clearResultsBtn: 'Clear',
    emptyStateLine1:
      'Click "🎯 Pick an Image on Page to Generate Alt" and click an image on the page, or click "Generate All on Page".',
    emptyStateLine2: 'Image previews and copyable alt texts will appear here.',
    thumbTitle: 'Click to scroll to this image on the page',
    scrollHint: '📍 Show this image on page',
    altPlaceholder: '(Empty string for decorative image)',
    copyAltBtn: 'Copy alt text',
    copyAttrBtn: 'Copy as alt="..."',
    copiedFeedback: '✅ Copied',
    titleLogs: 'Activity Log',
    clearLogBtn: 'Clear Logs',
    titlePrivacy: '🔒 Privacy Policy & Usage Notice',
    privacySections: [
      {
        heading: '1. Data Sent & Destination',
        items: [
          'When you run "Pick an Image" or "Generate All", the target image, page title, and surrounding text (up to 500 chars) are sent directly to Google Gemini API (generativelanguage.googleapis.com).',
          'No data is ever collected or sent to any developer server or third party.'
        ]
      },
      {
        heading: '2. Prohibited Content (Confidential / Personal Data)',
        items: [
          'Do not use this extension on images or pages containing personal data (names, faces, addresses, IDs), internal company secrets, or unreleased client projects.'
        ]
      },
      {
        heading: '3. AI Model Training',
        items: [
          'If you use a Gemini API Free Tier key, submitted data may be used by Google to improve their models.',
          'For business or sensitive work, please use a Paid (Pay-as-you-go) API key where data is not used for model training.'
        ]
      },
      {
        heading: '4. Local Storage',
        items: [
          'Your API key, custom prompt, and generated results are stored only locally in plain text (chrome.storage.local). Clear them after use on shared computers.'
        ]
      }
    ],
    logSaved: 'Settings (API key, custom prompt, and language) have been saved.',
    logClearedKey: 'API key field is empty; saved API key has been cleared.',
    logNoApiKey: 'Error: Gemini API key is missing. Please enter and save your API key first.',
    logPickerStarted: 'Picker mode started. Click an image on the webpage to generate alt text (press Esc to exit).',
    logPickerStopped: 'Picker mode stopped.',
    logNoTab: 'Error: No active browser tab found.',
    logRestrictedPage: 'Error: Cannot run on internal browser pages (chrome://). Please test on a normal webpage or http://localhost.',
    logBgError: 'Error: Failed to communicate with background service.',
    logNoResultsToCopy: 'No generated results to copy yet.',
    logCopyFailed: 'Failed to copy to clipboard.'
  },
  ko: {
    appTitle: 'alt 자동 생성 (Gemini 사용)',
    statusIdle: '대기 중',
    statusRunning: '처리 중',
    statusPicker: '이미지 선택 모드',
    labelApiKey: 'Gemini API 키',
    saveBtn: '저장',
    noteApiKey: '※ API 키는 브라우저 내부(chrome.storage.local)에 평문으로 저장됩니다.',
    labelAltLang: '생성할 alt 언어',
    labelCustomPrompt: '추가 프롬프트 (톤앤매너·표기 규칙)',
    customPromptPlaceholder:
      '예: 명사형으로 간결하게 작성 / 고급스럽고 차분한 톤 / 30자 이내로 작성 등 (비워두어도 됩니다)',
    labelOverwrite: '일괄 생성 시: 기존 alt(더미 등)가 있는 이미지도 포함하기',
    cautionTitle: '⚠️ 기밀 및 개인정보 취급 주의',
    cautionDesc:
      '선택·감지된 이미지와 주변 텍스트는 Gemini API로 전송됩니다. 개인정보, 사내 기밀, 미공개 정보가 포함된 페이지에서는 사용하지 마세요.',
    pickerBtnStart: '🎯 커서로 이미지 선택하여 alt 생성',
    pickerBtnStop: '⏹ 선택 모드 종료 (페이지 이미지를 클릭하면 생성됩니다)',
    startBtn: '페이지 이미지 일괄 생성',
    stopBtn: '중지',
    titleResults: '생성된 alt 목록 (HTML 붙여넣기용)',
    copyAllBtn: '전체 복사',
    clearResultsBtn: '지우기',
    emptyStateLine1:
      '"🎯 커서로 이미지 선택하여 alt 생성"을 눌러 웹페이지의 이미지를 클릭하거나 "페이지 이미지 일괄 생성"을 눌러주세요.',
    emptyStateLine2: '여기에 이미지 미리보기와 복사용 alt 텍스트가 표시됩니다.',
    thumbTitle: '클릭하면 페이지 내 해당 이미지 위치로 스크롤합니다',
    scrollHint: '📍 페이지에서 이 이미지 보기',
    altPlaceholder: '(장식용 이미지이므로 빈 문자열)',
    copyAltBtn: 'alt 문구 복사',
    copyAttrBtn: 'alt="..." 형식으로 복사',
    copiedFeedback: '✅ 복사됨',
    titleLogs: '처리 로그',
    clearLogBtn: '로그 지우기',
    titlePrivacy: '🔒 개인정보 처리방침 및 이용 주의사항',
    privacySections: [
      {
        heading: '1. 외부 전송 데이터 및 전송 대상',
        items: [
          '이 확장 프로그램에서 이미지 선택 또는 일괄 생성을 실행하면 대상 이미지, 페이지 제목, 주변 텍스트(최대 500자)가 Google Gemini API(generativelanguage.googleapis.com)로 직접 전송됩니다.',
          '개발자 서버나 제3자에게 데이터가 전송되거나 수집되지 않습니다.'
        ]
      },
      {
        heading: '2. 기밀·개인정보 사용 금지',
        items: [
          '개인정보(이름, 얼굴 사진, 주소, 연락처 등), 사내 기밀 정보, 미공개 프로젝트가 포함된 이미지나 웹페이지에는 사용하지 마세요.'
        ]
      },
      {
        heading: '3. AI 모델 학습 이용 안내',
        items: [
          'Gemini API 무료 플랜(Free Tier) 키를 사용하면 전송된 데이터가 Google의 모델 개선(학습)에 활용될 수 있습니다.',
          '업무 및 기밀이 필요한 환경에서는 학습에 사용되지 않는 유료 플랜(Pay-as-you-go) API 키를 사용하세요.'
        ]
      },
      {
        heading: '4. 로컬 저장소 보관',
        items: [
          '입력한 API 키, 추가 프롬프트, 생성 기록은 사용자의 브라우저(chrome.storage.local)에만 평문으로 저장됩니다. 공용 PC에서는 사용 후 삭제해 주세요.'
        ]
      }
    ],
    logSaved: '설정(API 키, 추가 프롬프트, 언어)이 저장되었습니다.',
    logClearedKey: 'API 키 입력란이 비어 있어 저장된 키를 삭제하였습니다.',
    logNoApiKey: '오류: Gemini API 키가 입력되지 않았습니다. 먼저 API 키를 입력하고 저장해 주세요.',
    logPickerStarted: '이미지 선택 모드를 시작했습니다. 웹페이지에서 alt를 생성할 이미지를 클릭하세요 (Esc 키로 종료).',
    logPickerStopped: '이미지 선택 모드를 종료했습니다.',
    logNoTab: '오류: 활성화된 브라우저 탭을 찾을 수 없습니다.',
    logRestrictedPage: '오류: 브라우저 내부 페이지(chrome:// 등)에서는 실행할 수 없습니다. 일반 웹페이지나 http://localhost에서 사용해 주세요.',
    logBgError: '오류: 백그라운드 서비스와의 통신에 실패했습니다.',
    logNoResultsToCopy: '복사할 생성 결과가 아직 없습니다.',
    logCopyFailed: '클립보드 복사에 실패했습니다.'
  },
  vi: {
    appTitle: 'Tạo alt tự động (Gemini)',
    statusIdle: 'Đang chờ',
    statusRunning: 'Đang xử lý',
    statusPicker: 'Chế độ chọn ảnh',
    labelApiKey: 'Gemini API Key',
    saveBtn: 'Lưu',
    noteApiKey: '* API Key được lưu dưới dạng văn bản thuần trong trình duyệt của bạn (chrome.storage.local).',
    labelAltLang: 'Ngôn ngữ văn bản alt đầu ra',
    labelCustomPrompt: 'Prompt bổ sung (Giọng văn & Quy tắc)',
    customPromptPlaceholder:
      'VD: Viết ngắn gọn dưới 15 từ / Giọng văn trang trọng, khách quan / Không dùng tên thương hiệu (tùy chọn)',
    labelOverwrite: 'Tạo hàng loạt: Bao gồm cả ảnh đã có alt (VD: alt mẫu/giả)',
    cautionTitle: '⚠️ Lưu ý về Bảo mật & Thông tin cá nhân',
    cautionDesc:
      'Ảnh được chọn và văn bản xung quanh sẽ được gửi tới Gemini API. KHÔNG sử dụng trên các trang chứa thông tin cá nhân, bí mật nội bộ hoặc dữ liệu chưa công bố.',
    pickerBtnStart: '🎯 Chọn ảnh trên trang để tạo alt',
    pickerBtnStop: '⏹ Thoát chế độ chọn (Nhấp vào ảnh trên trang để tạo)',
    startBtn: 'Tạo hàng loạt trên trang',
    stopBtn: 'Dừng',
    titleResults: 'Danh sách alt đã tạo (Dán vào HTML)',
    copyAllBtn: 'Sao chép tất cả',
    clearResultsBtn: 'Xóa',
    emptyStateLine1:
      'Nhấn "🎯 Chọn ảnh trên trang để tạo alt" rồi nhấp vào ảnh trên web, hoặc nhấn "Tạo hàng loạt trên trang".',
    emptyStateLine2: 'Ảnh xem trước và mã alt để sao chép sẽ hiển thị tại đây.',
    thumbTitle: 'Nhấp để cuộn tới vị trí ảnh này trên trang',
    scrollHint: '📍 Xem ảnh này trên trang',
    altPlaceholder: '(Chuỗi rỗng cho ảnh trang trí)',
    copyAltBtn: 'Sao chép alt',
    copyAttrBtn: 'Sao chép dạng alt="..."',
    copiedFeedback: '✅ Đã sao chép',
    titleLogs: 'Nhật ký xử lý',
    clearLogBtn: 'Xóa nhật ký',
    titlePrivacy: '🔒 Chính sách bảo mật & Lưu ý sử dụng',
    privacySections: [
      {
        heading: '1. Dữ liệu được gửi & Đích đến',
        items: [
          'Khi bạn chọn ảnh hoặc tạo hàng loạt, dữ liệu ảnh, tiêu đề trang và văn bản xung quanh (tối đa 500 ký tự) sẽ được gửi trực tiếp tới Google Gemini API (generativelanguage.googleapis.com).',
          'Không có dữ liệu nào được thu thập hay gửi về máy chủ của nhà phát triển hoặc bên thứ ba.'
        ]
      },
      {
        heading: '2. Nghiêm cấm gửi thông tin mật & cá nhân',
        items: [
          'Không sử dụng tiện ích này cho hình ảnh hoặc trang web chứa dữ liệu cá nhân (tên, ảnh chân dung, địa chỉ, số giấy tờ), bí mật công ty hoặc dự án chưa công bố.'
        ]
      },
      {
        heading: '3. Việc sử dụng dữ liệu để huấn luyện AI',
        items: [
          'Nếu sử dụng API Key gói miễn phí (Free Tier), dữ liệu gửi lên có thể được Google sử dụng để cải thiện mô hình.',
          'Với công việc nội bộ hoặc cần bảo mật, vui lòng sử dụng API Key gói trả phí (Pay-as-you-go) để dữ liệu không bị dùng cho huấn luyện AI.'
        ]
      },
      {
        heading: '4. Lưu trữ cục bộ',
        items: [
          'API Key, prompt bổ sung và lịch sử tạo alt chỉ được lưu cục bộ trong trình duyệt (chrome.storage.local). Hãy xóa dữ liệu sau khi dùng trên máy tính dùng chung.'
        ]
      }
    ],
    logSaved: 'Đã lưu cài đặt (API Key, prompt bổ sung và ngôn ngữ).',
    logClearedKey: 'Ô API Key đang trống; đã xóa API Key đã lưu.',
    logNoApiKey: 'Lỗi: Chưa nhập Gemini API Key. Vui lòng nhập và lưu API Key trước.',
    logPickerStarted: 'Đã bật chế độ chọn ảnh. Hãy nhấp vào ảnh muốn tạo alt trên trang web (nhấn Esc để thoát).',
    logPickerStopped: 'Đã tắt chế độ chọn ảnh.',
    logNoTab: 'Lỗi: Không tìm thấy tab trình duyệt đang hoạt động.',
    logRestrictedPage: 'Lỗi: Không thể chạy trên trang nội bộ của trình duyệt (chrome://). Vui lòng thử trên trang web thông thường hoặc http://localhost.',
    logBgError: 'Lỗi: Không thể kết nối với tiến trình nền.',
    logNoResultsToCopy: 'Chưa có kết quả nào để sao chép.',
    logCopyFailed: 'Sao chép vào khay nhớ tạm thất bại.'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // DOM要素の取得
  const appTitleEl = document.getElementById('app-title');
  const uiLangSelect = document.getElementById('ui-lang-select');
  const statusBadge = document.getElementById('status-badge');

  const labelApiKey = document.getElementById('label-api-key');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const noteApiKey = document.getElementById('note-api-key');

  const labelAltLang = document.getElementById('label-alt-lang');
  const altLangSelect = document.getElementById('alt-lang-select');

  const labelCustomPrompt = document.getElementById('label-custom-prompt');
  const customPromptInput = document.getElementById('custom-prompt-input');
  const overwriteCheckbox = document.getElementById('overwrite-checkbox');
  const labelOverwrite = document.getElementById('label-overwrite');

  const cautionBox = document.getElementById('caution-box');
  const pickerBtn = document.getElementById('picker-btn');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');

  const titleResults = document.getElementById('title-results');
  const copyAllBtn = document.getElementById('copy-all-btn');
  const clearResultsBtn = document.getElementById('clear-results-btn');
  const resultList = document.getElementById('result-list');

  const logAccordion = document.getElementById('log-accordion');
  const titleLogs = document.getElementById('title-logs');
  const logCountBadge = document.getElementById('log-count-badge');
  const clearLogBtn = document.getElementById('clear-log-btn');
  const logList = document.getElementById('log-list');

  const titlePrivacy = document.getElementById('title-privacy');
  const privacyBody = document.getElementById('privacy-body');

  let currentUiLang = 'ja';
  let isPickerActive = false;
  let isBatchRunning = false;

  // --------------------------------------------------------------------------
  // 現在のUI言語に対応する辞書テキストを取得するヘルパー
  // --------------------------------------------------------------------------
  function getDict() {
    return I18N_DICT[currentUiLang] || I18N_DICT.ja;
  }

  // --------------------------------------------------------------------------
  // UI全体のテキストを選択中の表示言語で更新する関数
  // --------------------------------------------------------------------------
  function applyUiLanguage(lang) {
    currentUiLang = I18N_DICT[lang] ? lang : 'ja';
    document.documentElement.lang = currentUiLang;
    const d = getDict();

    appTitleEl.textContent = d.appTitle;
    document.title = d.appTitle;
    labelApiKey.textContent = d.labelApiKey;
    saveKeyBtn.textContent = d.saveBtn;
    noteApiKey.textContent = d.noteApiKey;
    labelAltLang.textContent = d.labelAltLang;
    labelCustomPrompt.textContent = d.labelCustomPrompt;
    customPromptInput.placeholder = d.customPromptPlaceholder;
    labelOverwrite.textContent = d.labelOverwrite;

    // 機密情報注意バナーを再構築（安全なDOM操作）
    cautionBox.textContent = '';
    const strongTitle = document.createElement('strong');
    strongTitle.textContent = d.cautionTitle;
    cautionBox.appendChild(strongTitle);
    cautionBox.appendChild(document.createElement('br'));
    cautionBox.appendChild(document.createTextNode(d.cautionDesc));

    startBtn.textContent = d.startBtn;
    stopBtn.textContent = d.stopBtn;
    titleResults.textContent = d.titleResults;
    copyAllBtn.textContent = d.copyAllBtn;
    clearResultsBtn.textContent = d.clearResultsBtn;
    titleLogs.textContent = d.titleLogs;
    clearLogBtn.textContent = d.clearLogBtn;
    titlePrivacy.textContent = d.titlePrivacy;

    // プライバシーポリシー本文を再構築（安全なDOM操作）
    privacyBody.textContent = '';
    d.privacySections.forEach((sec) => {
      const h2 = document.createElement('h2');
      h2.textContent = sec.heading;
      privacyBody.appendChild(h2);

      const ul = document.createElement('ul');
      sec.items.forEach((itemText) => {
        const li = document.createElement('li');
        li.textContent = itemText;
        ul.appendChild(li);
      });
      privacyBody.appendChild(ul);
    });

    updatePickerButtonUI(isPickerActive);
    updateUIState(isBatchRunning);
  }

  // --------------------------------------------------------------------------
  // 現在アクティブなタブを取得するヘルパー関数
  // --------------------------------------------------------------------------
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  // --------------------------------------------------------------------------
  // タブの content.js にメッセージを送るヘルパー（未注入時は自動注入）
  // --------------------------------------------------------------------------
  async function sendToActiveTab(message) {
    const d = getDict();
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error(d.logNoTab);
    }
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      throw new Error(d.logRestrictedPage);
    }
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      return await chrome.tabs.sendMessage(tab.id, message);
    }
  }

  // --------------------------------------------------------------------------
  // UI状態の更新関数（一括処理中かどうか）
  // --------------------------------------------------------------------------
  function updateUIState(isRunning) {
    isBatchRunning = Boolean(isRunning);
    const d = getDict();
    if (isBatchRunning) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      statusBadge.textContent = d.statusRunning;
      statusBadge.classList.add('running');
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      statusBadge.textContent = isPickerActive ? d.statusPicker : d.statusIdle;
      statusBadge.classList.toggle('running', isPickerActive);
    }
  }

  // --------------------------------------------------------------------------
  // カーソル画像選択ボタンのUI表示更新
  // --------------------------------------------------------------------------
  function updatePickerButtonUI(active) {
    isPickerActive = Boolean(active);
    const d = getDict();
    if (isPickerActive) {
      pickerBtn.classList.add('active');
      pickerBtn.textContent = d.pickerBtnStop;
      if (!isBatchRunning) {
        statusBadge.textContent = d.statusPicker;
        statusBadge.classList.add('running');
      }
    } else {
      pickerBtn.classList.remove('active');
      pickerBtn.textContent = d.pickerBtnStart;
      if (!isBatchRunning) {
        statusBadge.textContent = d.statusIdle;
        statusBadge.classList.remove('running');
      }
    }
  }

  // --------------------------------------------------------------------------
  // クリップボードへコピーしてボタン表示を一時変更するヘルパー
  // --------------------------------------------------------------------------
  async function copyWithFeedback(text, btnElement, getDefaultLabelFn) {
    const d = getDict();
    try {
      await navigator.clipboard.writeText(text);
      btnElement.textContent = d.copiedFeedback;
      setTimeout(() => {
        btnElement.textContent = getDefaultLabelFn();
      }, 1400);
    } catch {
      await addLocalLog(d.logCopyFailed, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // 生成結果カード1件のDOM要素を生成する関数
  // --------------------------------------------------------------------------
  function createResultCardElement(item) {
    const d = getDict();
    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.resultId = item.id;

    const topRow = document.createElement('div');
    topRow.className = 'result-top';

    // サムネイル画像（クリックでページ内の該当画像へスクロール）
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';
    thumbWrap.title = d.thumbTitle;

    const thumbImg = document.createElement('img');
    thumbImg.src = item.imageUrl;
    thumbImg.alt = item.fileName || '';
    thumbWrap.appendChild(thumbImg);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'thumb-meta';

    const fileNameDiv = document.createElement('div');
    fileNameDiv.className = 'file-name';
    fileNameDiv.textContent = item.fileName || item.imageUrl;
    fileNameDiv.title = item.imageUrl;

    const scrollLink = document.createElement('span');
    scrollLink.className = 'scroll-hint';
    scrollLink.textContent = d.scrollHint;

    const handleScrollToImg = () => {
      sendToActiveTab({
        type: 'SCROLL_TO_IMAGE',
        targetId: item.targetId,
        imageUrl: item.imageUrl
      }).catch(() => {});
    };
    thumbWrap.addEventListener('click', handleScrollToImg);
    scrollLink.addEventListener('click', handleScrollToImg);

    metaDiv.appendChild(fileNameDiv);
    metaDiv.appendChild(scrollLink);

    topRow.appendChild(thumbWrap);
    topRow.appendChild(metaDiv);

    // 編集可能な alt テキストエリア
    const textarea = document.createElement('textarea');
    textarea.className = 'alt-textarea';
    textarea.value = item.altText || '';
    textarea.placeholder = d.altPlaceholder;

    // ユーザーがテキストエリアを手動編集した際はストレージにも反映します
    textarea.addEventListener('input', async () => {
      const data = await chrome.storage.local.get({ altGenResults: [] });
      const updated = data.altGenResults.map((r) =>
        r.id === item.id ? { ...r, altText: textarea.value } : r
      );
      await chrome.storage.local.set({ altGenResults: updated });
    });

    // コピーボタン行
    const copyRow = document.createElement('div');
    copyRow.className = 'copy-row';

    const copyAltBtn = document.createElement('button');
    copyAltBtn.type = 'button';
    copyAltBtn.className = 'btn-copy-alt';
    copyAltBtn.textContent = d.copyAltBtn;
    copyAltBtn.addEventListener('click', () => {
      copyWithFeedback(textarea.value, copyAltBtn, () => getDict().copyAltBtn);
    });

    const copyAttrBtn = document.createElement('button');
    copyAttrBtn.type = 'button';
    copyAttrBtn.className = 'btn-copy-attr';
    copyAttrBtn.textContent = d.copyAttrBtn;
    copyAttrBtn.addEventListener('click', () => {
      const escaped = textarea.value.replace(/"/g, '&quot;');
      copyWithFeedback(`alt="${escaped}"`, copyAttrBtn, () => getDict().copyAttrBtn);
    });

    copyRow.appendChild(copyAltBtn);
    copyRow.appendChild(copyAttrBtn);

    card.appendChild(topRow);
    card.appendChild(textarea);
    card.appendChild(copyRow);

    return card;
  }

  // --------------------------------------------------------------------------
  // 生成結果一覧を描画する関数
  // --------------------------------------------------------------------------
  function renderResults(results = []) {
    const d = getDict();
    resultList.replaceChildren();
    if (!results || results.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.appendChild(document.createTextNode(d.emptyStateLine1));
      emptyDiv.appendChild(document.createElement('br'));
      emptyDiv.appendChild(document.createTextNode(d.emptyStateLine2));
      resultList.appendChild(emptyDiv);
      return;
    }

    results.forEach((item) => {
      resultList.appendChild(createResultCardElement(item));
    });
  }

  // --------------------------------------------------------------------------
  // ログ件数バッジを更新する関数
  // --------------------------------------------------------------------------
  function updateLogCountBadge() {
    if (logCountBadge) {
      logCountBadge.textContent = String(logList.children.length);
    }
  }

  // --------------------------------------------------------------------------
  // ログ1件を画面リストに追加する関数
  // --------------------------------------------------------------------------
  function appendLogElement(logEntry) {
    const li = document.createElement('li');
    const levelClass = logEntry.level === 'error' ? 'error' : 'info';
    li.className = `log-item ${levelClass}`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = logEntry.time ? `[${logEntry.time}]` : '';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = logEntry.message;

    li.appendChild(timeSpan);
    li.appendChild(msgSpan);
    logList.appendChild(li);

    updateLogCountBadge();

    // エラー発生時はユーザーがすぐ気づけるようアコーディオンを自動で開きます
    if (logEntry.level === 'error' && logAccordion) {
      logAccordion.open = true;
    }

    logList.scrollTop = logList.scrollHeight;
  }

  function renderLogs(logs = []) {
    logList.replaceChildren();
    logs.forEach((entry) => appendLogElement(entry));
    updateLogCountBadge();
  }

  async function addLocalLog(message, level = 'info') {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const newEntry = { time, message, level };

    const data = await chrome.storage.local.get({ altGenLogs: [] });
    const updatedLogs = [...data.altGenLogs, newEntry].slice(-200);
    await chrome.storage.local.set({ altGenLogs: updatedLogs });
    appendLogElement(newEntry);
  }

  // --------------------------------------------------------------------------
  // 初期化：保存済みのUI言語・alt言語・APIキー・追加プロンプト・結果・ログを読み込みます
  // --------------------------------------------------------------------------
  const stored = await chrome.storage.local.get({
    uiLang: 'ja',
    altLang: 'ja',
    geminiApiKey: '',
    customPrompt: '',
    overwriteExisting: true,
    isGenerating: false,
    altGenResults: [],
    altGenLogs: []
  });

  uiLangSelect.value = I18N_DICT[stored.uiLang] ? stored.uiLang : 'ja';
  altLangSelect.value = stored.altLang || 'ja';

  if (stored.geminiApiKey) {
    apiKeyInput.value = stored.geminiApiKey;
  }
  if (customPromptInput) {
    customPromptInput.value = stored.customPrompt || '';
    customPromptInput.addEventListener('input', async () => {
      await chrome.storage.local.set({ customPrompt: customPromptInput.value });
    });
  }
  if (overwriteCheckbox) {
    overwriteCheckbox.checked = Boolean(stored.overwriteExisting);
    overwriteCheckbox.addEventListener('change', async () => {
      await chrome.storage.local.set({ overwriteExisting: overwriteCheckbox.checked });
    });
  }

  // UI言語を適用し、結果リストとログを描画します
  applyUiLanguage(uiLangSelect.value);
  updateUIState(Boolean(stored.isGenerating));
  renderResults(stored.altGenResults);
  renderLogs(stored.altGenLogs);

  // --------------------------------------------------------------------------
  // UI表示言語の切り替えイベント
  // --------------------------------------------------------------------------
  uiLangSelect.addEventListener('change', async () => {
    const newUiLang = uiLangSelect.value;
    await chrome.storage.local.set({ uiLang: newUiLang });
    applyUiLanguage(newUiLang);

    // 結果一覧のボタン表示も選択言語に合わせて更新します
    const data = await chrome.storage.local.get({ altGenResults: [] });
    renderResults(data.altGenResults);

    // ページ上のピッカーバナーが開いている場合はバナーの言語も即時更新します
    if (isPickerActive) {
      sendToActiveTab({ type: 'SET_PICKER_LANG', uiLang: newUiLang }).catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // 生成するalt言語の切り替えイベント
  // --------------------------------------------------------------------------
  altLangSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ altLang: altLangSelect.value });
  });

  // アクティブタブの選択モード状態を同期する関数（タブ切り替え時にも再同期します）
  async function syncPickerModeFromActiveTab() {
    try {
      const res = await sendToActiveTab({ type: 'GET_PICKER_MODE' });
      if (res && typeof res.active === 'boolean') {
        updatePickerButtonUI(res.active);
      }
    } catch {
      updatePickerButtonUI(false);
    }
  }

  syncPickerModeFromActiveTab();

  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      syncPickerModeFromActiveTab();
    });
  }

  // background の稼働状態を同期します
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && typeof response.isGenerating === 'boolean') {
      updateUIState(response.isGenerating);
    }
  });

  // --------------------------------------------------------------------------
  // 「保存」ボタン押下時：APIキー・追加プロンプト・言語設定を保存します
  // --------------------------------------------------------------------------
  saveKeyBtn.addEventListener('click', async () => {
    const d = getDict();
    const apiKey = apiKeyInput.value.trim();
    const customPrompt = customPromptInput ? customPromptInput.value.trim() : '';
    const altLang = altLangSelect.value || 'ja';
    await chrome.storage.local.set({ geminiApiKey: apiKey, customPrompt, altLang });

    if (apiKey) {
      await addLocalLog(d.logSaved, 'info');
    } else {
      await addLocalLog(d.logClearedKey, 'info');
    }
  });

  // --------------------------------------------------------------------------
  // 「🎯 カーソルで画像を選択してaltを作成」ボタン押下時
  // --------------------------------------------------------------------------
  pickerBtn.addEventListener('click', async () => {
    const d = getDict();
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      await addLocalLog(d.logNoApiKey, 'error');
      apiKeyInput.focus();
      return;
    }
    const customPrompt = customPromptInput ? customPromptInput.value.trim() : '';
    const altLang = altLangSelect.value || 'ja';
    await chrome.storage.local.set({ geminiApiKey: apiKey, customPrompt, altLang });

    const nextActive = !isPickerActive;
    try {
      const res = await sendToActiveTab({
        type: 'SET_PICKER_MODE',
        active: nextActive,
        uiLang: currentUiLang
      });
      updatePickerButtonUI(res ? res.active : nextActive);
      if (nextActive) {
        await addLocalLog(d.logPickerStarted, 'info');
      } else {
        await addLocalLog(d.logPickerStopped, 'info');
      }
    } catch (error) {
      await addLocalLog(error.message, 'error');
    }
  });

  // --------------------------------------------------------------------------
  // 「ページ内の画像を一括生成」ボタン押下時
  // --------------------------------------------------------------------------
  startBtn.addEventListener('click', async () => {
    const d = getDict();
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      await addLocalLog(d.logNoApiKey, 'error');
      apiKeyInput.focus();
      return;
    }

    const customPrompt = customPromptInput ? customPromptInput.value.trim() : '';
    const overwriteExisting = overwriteCheckbox ? overwriteCheckbox.checked : true;
    const altLang = altLangSelect.value || 'ja';
    await chrome.storage.local.set({
      geminiApiKey: apiKey,
      customPrompt,
      overwriteExisting,
      altLang
    });

    const activeTab = await getActiveTab();
    if (!activeTab || !activeTab.id) {
      await addLocalLog(d.logNoTab, 'error');
      return;
    }

    if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://'))) {
      await addLocalLog(d.logRestrictedPage, 'error');
      return;
    }

    updateUIState(true);

    chrome.runtime.sendMessage(
      {
        type: 'START_GENERATION',
        tabId: activeTab.id,
        overwriteExisting,
        altLang
      },
      (response) => {
        if (chrome.runtime.lastError) {
          addLocalLog(`${d.logBgError} (${chrome.runtime.lastError.message})`, 'error');
          updateUIState(false);
          return;
        }
        if (response && response.ok === false) {
          updateUIState(false);
        }
      }
    );
  });

  // --------------------------------------------------------------------------
  // 「停止」ボタン押下時
  // --------------------------------------------------------------------------
  stopBtn.addEventListener('click', () => {
    stopBtn.disabled = true;
    chrome.runtime.sendMessage({ type: 'STOP_GENERATION' }, () => {
      if (chrome.runtime.lastError) {
        // 無視します
      }
    });
  });

  // --------------------------------------------------------------------------
  // 「全件コピー」ボタン押下時：ファイル名と生成されたalt属性の一覧をコピーします
  // --------------------------------------------------------------------------
  copyAllBtn.addEventListener('click', async () => {
    const d = getDict();
    const data = await chrome.storage.local.get({ altGenResults: [] });
    if (!data.altGenResults || data.altGenResults.length === 0) {
      await addLocalLog(d.logNoResultsToCopy, 'info');
      return;
    }
    const lines = data.altGenResults.map(
      (r) => `${r.fileName}\talt="${(r.altText || '').replace(/"/g, '&quot;')}"`
    );
    await copyWithFeedback(lines.join('\n'), copyAllBtn, () => getDict().copyAllBtn);
  });

  // --------------------------------------------------------------------------
  // 「クリア」ボタン押下時：生成結果カードをクリアします
  // --------------------------------------------------------------------------
  clearResultsBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ altGenResults: [] });
    renderResults([]);
  });

  // --------------------------------------------------------------------------
  // 「ログを消去」ボタン押下時（アコーディオンの開閉と干渉しないよう stopPropagation）
  // --------------------------------------------------------------------------
  clearLogBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await chrome.storage.local.set({ altGenLogs: [] });
    logList.replaceChildren();
    updateLogCountBadge();
  });

  // --------------------------------------------------------------------------
  // background / content からのリアルタイム通知を受信します
  // --------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener(async (message) => {
    if (!message || !message.type) return;

    if (message.type === 'LOG_ADDED' && message.entry) {
      appendLogElement(message.entry);
    } else if (message.type === 'STATE_CHANGED') {
      updateUIState(Boolean(message.isGenerating));
    } else if (message.type === 'RESULT_ADDED') {
      const data = await chrome.storage.local.get({ altGenResults: [] });
      renderResults(data.altGenResults);
    } else if (message.type === 'PICKER_MODE_CHANGED') {
      updatePickerButtonUI(Boolean(message.active));
    }
  });
});
