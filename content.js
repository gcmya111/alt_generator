// ============================================================================
// content.js - ページ内の画像選択（ピッカー）・周辺テキスト抽出・スクロール連携
// ----------------------------------------------------------------------------
// 1. カーソルで特定の画像をクリックして alt を生成する「画像選択モード」
// 2. ページ内の全対象画像を一括収集する機能
// 3. サイドパネルのサムネイルをクリックした際に該当画像へスクロール＆ハイライトする機能
// ============================================================================

(() => {
  // 二重読み込み防止ガード
  if (window.__geminiAltGeneratorContentLoaded) {
    return;
  }
  window.__geminiAltGeneratorContentLoaded = true;

  // スキップ対象の拡張子（ロゴ・アイコン・装飾用途が多い形式）
  const IGNORE_EXTENSIONS = ['.svg', '.ico', '.gif'];

  // カーソル画像選択モードの状態
  let isPickerActive = false;
  let hoveredImg = null;
  let bannerEl = null;
  let currentUiLang = 'ja';

  // ピッカーモード用バナーおよびメッセージの4言語辞書
  const CONTENT_I18N = {
    ja: {
      banner: '🎯 画像選択モード中：altを作成したい画像をクリックしてください（Escキーで終了）',
      emptySrc: '画像の src 属性が空のため取得できませんでした。',
      invalidUrl: (url) => `画像URLの形式が不正です（${url}）。`,
      ignoredFormat: (name) => `対象外形式（SVG/ICO/GIF）のためスキップいたしました: ${name}`,
      collectError: (msg) => `画像の収集処理中にエラーが発生いたしました: ${msg}`
    },
    en: {
      banner: '🎯 Picker Mode: Click any image to generate alt text (Press Esc to exit)',
      emptySrc: 'Skipped image because src attribute is empty.',
      invalidUrl: (url) => `Invalid image URL format (${url}).`,
      ignoredFormat: (name) => `Skipped unsupported format (SVG/ICO/GIF): ${name}`,
      collectError: (msg) => `Error while collecting images: ${msg}`
    },
    ko: {
      banner: '🎯 이미지 선택 모드: alt를 생성할 이미지를 클릭하세요 (Esc 키로 종료)',
      emptySrc: 'src 속성이 비어 있어 이미지를 가져올 수 없습니다.',
      invalidUrl: (url) => `잘못된 이미지 URL 형식입니다 (${url}).`,
      ignoredFormat: (name) => `지원하지 않는 형식(SVG/ICO/GIF)이므로 건너뛰었습니다: ${name}`,
      collectError: (msg) => `이미지 수집 중 오류가 발생했습니다: ${msg}`
    },
    vi: {
      banner: '🎯 Chế độ chọn ảnh: Nhấp vào ảnh để tạo alt (Nhấn Esc để thoát)',
      emptySrc: 'Không thể lấy ảnh vì thuộc tính src bị trống.',
      invalidUrl: (url) => `Định dạng URL ảnh không hợp lệ (${url}).`,
      ignoredFormat: (name) => `Đã bỏ qua định dạng không hỗ trợ (SVG/ICO/GIF): ${name}`,
      collectError: (msg) => `Đã xảy ra lỗi khi thu thập hình ảnh: ${msg}`
    }
  };

  function getContentMsg() {
    return CONTENT_I18N[currentUiLang] || CONTENT_I18N.ja;
  }

  // --------------------------------------------------------------------------
  // 文字列内の余分な空白・改行を整形するヘルパー関数
  // --------------------------------------------------------------------------
  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // --------------------------------------------------------------------------
  // 画像の周辺テキスト（約500文字以内）を収集する関数
  // - figcaption
  // - 親要素のテキスト
  // - 前後の見出し（h1〜h6）や段落（p）
  // --------------------------------------------------------------------------
  function extractSurroundingText(img) {
    const collectedParts = [];

    // 1. figure 内の figcaption テキストを取得
    const figure = img.closest('figure');
    if (figure) {
      const figcaption = figure.querySelector('figcaption');
      if (figcaption) {
        const capText = cleanText(figcaption.innerText || figcaption.textContent);
        if (capText) {
          collectedParts.push(`【キャプション】: ${capText}`);
        }
      }
    }

    // 2. 親要素（セクション・カード・リスト項目・ブロック等）のテキストを取得
    const container =
      img.closest('figure, article, section, li, td, dd, a, div') || img.parentElement;
    if (container) {
      const parentText = cleanText(container.innerText || container.textContent);
      if (parentText) {
        collectedParts.push(`【親要素テキスト】: ${parentText.substring(0, 300)}`);
      }
    }

    // 3. 前後の見出し（h1〜h6）や段落（p）を取得
    const blockElements = Array.from(
      document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, img')
    );
    const imgIndex = blockElements.indexOf(img);
    if (imgIndex !== -1) {
      // 直前の見出し・段落（最大3要素まで遡る）
      const prevTexts = [];
      for (let i = imgIndex - 1; i >= 0 && prevTexts.length < 3; i--) {
        const el = blockElements[i];
        if (el.tagName.toLowerCase() === 'img') continue;
        const txt = cleanText(el.innerText || el.textContent);
        if (txt) {
          prevTexts.unshift(txt);
        }
      }
      if (prevTexts.length > 0) {
        collectedParts.push(`【直前の見出し・段落】: ${prevTexts.join(' / ')}`);
      }

      // 直後の見出し・段落（最大2要素まで辿る）
      const nextTexts = [];
      for (let i = imgIndex + 1; i < blockElements.length && nextTexts.length < 2; i++) {
        const el = blockElements[i];
        if (el.tagName.toLowerCase() === 'img') continue;
        const txt = cleanText(el.innerText || el.textContent);
        if (txt) {
          nextTexts.push(txt);
        }
      }
      if (nextTexts.length > 0) {
        collectedParts.push(`【直後の見出し・段落】: ${nextTexts.join(' / ')}`);
      }
    }

    const combined = collectedParts.join('\n').trim();
    return combined.substring(0, 500);
  }

  // --------------------------------------------------------------------------
  // 画像URLから除外対象の拡張子（.svg, .ico, .gif 等）かどうかを判定する関数
  // --------------------------------------------------------------------------
  function isIgnoredImageFormat(absUrl) {
    const lowerUrl = absUrl.toLowerCase();
    if (
      lowerUrl.startsWith('data:image/svg') ||
      lowerUrl.startsWith('data:image/gif') ||
      lowerUrl.startsWith('data:image/x-icon')
    ) {
      return true;
    }
    try {
      const parsedUrl = new URL(absUrl);
      const pathname = parsedUrl.pathname.toLowerCase();
      return IGNORE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 単一の <img> 要素から画像情報オブジェクトを作成する関数
  // --------------------------------------------------------------------------
  function buildImageItem(img, indexHint = 0) {
    const cmsg = getContentMsg();
    const rawSrc =
      img.currentSrc ||
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      '';
    if (!rawSrc || rawSrc.trim() === '') {
      return { error: cmsg.emptySrc };
    }

    let absoluteUrl = '';
    try {
      absoluteUrl = new URL(rawSrc, window.location.href).href;
    } catch {
      return { error: cmsg.invalidUrl(rawSrc) };
    }

    if (isIgnoredImageFormat(absoluteUrl)) {
      return {
        ignored: true,
        error: cmsg.ignoredFormat(absoluteUrl.split('/').pop())
      };
    }

    let targetId = img.dataset.altTargetId;
    if (!targetId) {
      targetId = `alt-gen-img-${Date.now()}-${indexHint}-${Math.random().toString(36).slice(2, 6)}`;
      img.dataset.altTargetId = targetId;
    }

    const currentAlt = img.getAttribute('alt');
    const existingAlt = currentAlt !== null ? currentAlt.trim() : '';
    const pageTitle = cleanText(document.title) || '（タイトル未設定）';
    const surroundingText = extractSurroundingText(img);

    return {
      item: {
        targetId,
        imageUrl: absoluteUrl,
        existingAlt,
        pageTitle,
        surroundingText
      }
    };
  }

  // --------------------------------------------------------------------------
  // ページ内の対象 <img> 要素を一括収集する関数
  // --------------------------------------------------------------------------
  function collectTargetImages(overwriteExisting = true) {
    const allImages = Array.from(document.querySelectorAll('img'));
    const targets = [];
    const skippedLogs = [];

    // 全画像がすでに生成済みで、かつ上書きモードの場合は再実行できるようにリセットします
    if (
      overwriteExisting &&
      allImages.length > 0 &&
      allImages.every(
        (img) =>
          img.dataset.altGenerated === 'true' ||
          isIgnoredImageFormat(img.currentSrc || img.src || '')
      )
    ) {
      allImages.forEach((img) => {
        delete img.dataset.altGenerated;
      });
    }

    allImages.forEach((img, index) => {
      if (img.dataset.altGenerated === 'true') {
        return;
      }

      const currentAlt = img.getAttribute('alt');
      const hasExistingAlt = currentAlt !== null && currentAlt.trim() !== '';
      if (!overwriteExisting && hasExistingAlt) {
        return;
      }

      const built = buildImageItem(img, index);
      if (built.error) {
        skippedLogs.push(built.error);
        return;
      }

      targets.push(built.item);
    });

    return {
      totalImgCount: allImages.length,
      targets,
      skippedLogs
    };
  }

  // ==========================================================================
  // 🎯 カーソルで特定の画像を選択する「画像選択モード（ピッカー）」
  // ==========================================================================

  // ページ上部に選択モード中であることを示すバナーを表示します
  function updatePickerBannerText() {
    if (bannerEl) {
      bannerEl.textContent = getContentMsg().banner;
    }
  }

  function showPickerBanner() {
    if (bannerEl) {
      updatePickerBannerText();
      return;
    }
    bannerEl = document.createElement('div');
    bannerEl.id = 'gemini-alt-picker-banner';
    bannerEl.style.cssText = [
      'position: fixed',
      'top: 12px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 2147483647',
      'background: rgba(17, 24, 39, 0.92)',
      'color: #ffffff',
      'padding: 8px 16px',
      'border-radius: 9999px',
      'font-size: 13px',
      'font-weight: 600',
      'font-family: sans-serif',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.25)',
      'pointer-events: none',
      'white-space: nowrap'
    ].join(';');
    updatePickerBannerText();
    document.body.appendChild(bannerEl);
  }

  function hidePickerBanner() {
    if (bannerEl && bannerEl.parentNode) {
      bannerEl.parentNode.removeChild(bannerEl);
    }
    bannerEl = null;
  }

  function clearHoveredHighlight() {
    if (hoveredImg) {
      hoveredImg.style.outline = hoveredImg.dataset.prevOutline || '';
      hoveredImg.style.outlineOffset = hoveredImg.dataset.prevOutlineOffset || '';
      hoveredImg.style.cursor = hoveredImg.dataset.prevCursor || '';
      delete hoveredImg.dataset.prevOutline;
      delete hoveredImg.dataset.prevOutlineOffset;
      delete hoveredImg.dataset.prevCursor;
      hoveredImg = null;
    }
  }

  // カーソル位置から最も近い <img> 要素を探すヘルパー（親要素やオーバーレイ越しでも検出可能にします）
  function findImgFromEvent(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
      return e.target;
    }
    // 透明なオーバーレイ要素が画像の上に重なっている場合でも座標から <img> を取得します
    const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
    return elementsAtPoint.find((el) => el.tagName && el.tagName.toLowerCase() === 'img') || null;
  }

  function onPickerMouseMove(e) {
    if (!isPickerActive) return;
    const img = findImgFromEvent(e);
    if (img === hoveredImg) return;

    clearHoveredHighlight();

    if (img) {
      hoveredImg = img;
      hoveredImg.dataset.prevOutline = hoveredImg.style.outline || '';
      hoveredImg.dataset.prevOutlineOffset = hoveredImg.style.outlineOffset || '';
      hoveredImg.dataset.prevCursor = hoveredImg.style.cursor || '';
      hoveredImg.style.outline = '4px solid #2563eb';
      hoveredImg.style.outlineOffset = '2px';
      hoveredImg.style.cursor = 'crosshair';
    }
  }

  function onPickerClick(e) {
    if (!isPickerActive) return;
    const img = findImgFromEvent(e);
    if (!img) return;

    // リンク遷移などのページ動作をキャンセルします
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // クリックされた視覚的フィードバック（緑色の枠線を一瞬表示）
    img.style.outline = '4px solid #10b981';

    const built = buildImageItem(img, 0);
    if (built.error) {
      chrome.runtime.sendMessage({
        type: 'PICKED_IMAGE_ERROR',
        error: built.error
      }).catch(() => {});
      return;
    }

    // 選択された画像のalt生成を background.js に依頼します
    chrome.runtime.sendMessage({
      type: 'GENERATE_SINGLE_IMAGE',
      item: built.item
    }).catch(() => {});
  }

  function onPickerKeyDown(e) {
    if (!isPickerActive) return;
    if (e.key === 'Escape') {
      setPickerMode(false);
      chrome.runtime.sendMessage({
        type: 'PICKER_MODE_CHANGED',
        active: false
      }).catch(() => {});
    }
  }

  function setPickerMode(active, uiLang) {
    if (uiLang && CONTENT_I18N[uiLang]) {
      currentUiLang = uiLang;
    }
    isPickerActive = Boolean(active);
    if (isPickerActive) {
      showPickerBanner();
      document.addEventListener('mousemove', onPickerMouseMove, true);
      document.addEventListener('click', onPickerClick, true);
      document.addEventListener('keydown', onPickerKeyDown, true);
    } else {
      hidePickerBanner();
      clearHoveredHighlight();
      document.removeEventListener('mousemove', onPickerMouseMove, true);
      document.removeEventListener('click', onPickerClick, true);
      document.removeEventListener('keydown', onPickerKeyDown, true);
    }
  }

  // --------------------------------------------------------------------------
  // 特定の画像へスクロールしてハイライトする関数（サイドパネルからの確認用）
  // --------------------------------------------------------------------------
  function scrollToAndHighlightImage(targetId, imageUrl) {
    let img = null;
    if (targetId) {
      img = document.querySelector(`img[data-alt-target-id="${CSS.escape(targetId)}"]`);
    }
    if (!img && imageUrl) {
      img = Array.from(document.querySelectorAll('img')).find(
        (el) => el.currentSrc === imageUrl || el.src === imageUrl
      );
    }
    if (!img) return false;

    img.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prevOutline = img.style.outline;
    const prevTransition = img.style.transition;
    img.style.transition = 'outline 0.2s ease';
    img.style.outline = '5px solid #f59e0b';
    setTimeout(() => {
      img.style.outline = prevOutline || '';
      img.style.transition = prevTransition || '';
    }, 2000);
    return true;
  }

  // --------------------------------------------------------------------------
  // background.js / popup.js からのメッセージ受信リスナー
  // --------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    // ① カーソル画像選択モードの切り替え
    if (message.type === 'SET_PICKER_MODE') {
      setPickerMode(Boolean(message.active), message.uiLang);
      sendResponse({ ok: true, active: isPickerActive });
      return true;
    }

    // ①-b ピッカーバナーの表示言語のみ即時更新
    if (message.type === 'SET_PICKER_LANG') {
      if (message.uiLang && CONTENT_I18N[message.uiLang]) {
        currentUiLang = message.uiLang;
        updatePickerBannerText();
      }
      sendResponse({ ok: true });
      return true;
    }

    // ② カーソル画像選択モードの状態取得
    if (message.type === 'GET_PICKER_MODE') {
      sendResponse({ ok: true, active: isPickerActive });
      return true;
    }

    // ③ 該当画像へのスクロール＆ハイライト
    if (message.type === 'SCROLL_TO_IMAGE') {
      const found = scrollToAndHighlightImage(message.targetId, message.imageUrl);
      sendResponse({ ok: found });
      return true;
    }

    // ④ 対象画像の一括収集リクエスト
    if (message.type === 'COLLECT_IMAGES') {
      if (message.uiLang && CONTENT_I18N[message.uiLang]) {
        currentUiLang = message.uiLang;
      }
      try {
        const overwriteExisting =
          typeof message.overwriteExisting === 'boolean' ? message.overwriteExisting : true;
        const result = collectTargetImages(overwriteExisting);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: getContentMsg().collectError(error.message)
        });
      }
      return true;
    }

    // ⑤ 生成された alt 文の DOM 反映リクエスト
    if (message.type === 'APPLY_ALT') {
      const { targetId, altText } = message;
      const img = document.querySelector(`img[data-alt-target-id="${CSS.escape(targetId)}"]`);

      if (img) {
        img.alt = altText ?? '';
        img.dataset.altGenerated = 'true';
      }
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
})();
