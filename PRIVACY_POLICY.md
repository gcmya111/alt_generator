# プライバシーポリシー（alt自動生成（Gemini使用））

最終更新日：2026年11月13日

本プライバシーポリシーは、Chrome拡張機能「**alt自動生成（Gemini使用）**」（以下「本拡張機能」といいます）における情報の取り扱いについて定めるものです。

---

## 1. 取得・送信される情報と利用目的

本拡張機能は、ユーザーが明示的に「画像を選択してaltを作成」または「ページ内の画像を一括生成」を実行した際に限り、代替テキスト（alt属性）を自動生成する目的で以下の情報を取得し、Google社の **Gemini API**（`https://generativelanguage.googleapis.com`）へ直接送信いたします。

- 選択または検出された画像データ（Base64エンコード形式）
- 対象Webページのタイトル（`document.title`）
- 対象画像の周辺テキスト（`figcaption`、親要素、前後の見出しや段落から最大500文字）
- ユーザーが入力した追加プロンプト（トーン＆マナー指定等）

**開発者によるデータ収集の不実施**：
上記のデータは、ユーザーのブラウザから Google Gemini API へ直接送信されます。本拡張機能の開発者が管理するサーバーや第三者へ送信・保存・収集されることは一切ございません。

---

## 2. 機密情報・個人情報の取り扱いに関する注意事項（禁止事項）

本拡張機能は外部のAIサービス（Google Gemini API）へ画像および周辺テキストを送信するため、以下の情報が含まれる画像やWebページには**使用しないでください**。

- **個人情報**（氏名、顔写真、住所、電話番号、メールアドレス、マイナンバー、クレジットカード情報等）
- **社外秘・機密情報**（未公開の製品・サービス情報、社内限定ドキュメント、取引先や顧客の非公開情報等）
- **認証情報や管理画面内の情報**

---

## 3. Google Gemini API におけるデータの学習利用について

本拡張機能は、ユーザー自身が取得・設定した Gemini API キーを使用して通信を行います。送信されたデータの Google 側での取り扱いは、ご使用の API キーのプラン（[Google Gemini API 利用規約](https://ai.google.dev/gemini-api/terms)）に準拠いたします。

- **無料枠（Unpaid / Free Tier）のAPIキーをご利用の場合**：送信された画像やテキストが Google のモデル改善（学習）に利用される場合があります。
- **有料枠（Paid / Pay-as-you-go）のAPIキーをご利用の場合**：送信されたデータは Google のモデル学習には利用されません。業務用途でご利用の際は、有料プランのAPIキーのご利用を推奨いたします。

---

## 4. ローカルストレージへの保存について

本拡張機能は、利便性向上のため以下の情報をお使いのブラウザ内（`chrome.storage.local`）にのみ保存いたします。

- ユーザーが入力した Gemini API キー（平文で保存されます）
- UI表示言語および生成alt文の出力言語設定
- 追加プロンプト設定およびチェックボックス設定
- 生成された alt テキストの一覧および処理ログ

これらの情報はブラウザのローカル環境内にのみ保持され、外部へ送信されることはありません。共用PC等でご利用の際は、使用後に拡張機能画面からAPIキーおよび履歴を消去してください。

---

# Privacy Policy (English Summary)

Last Updated: November 13, 2026

This Privacy Policy explains how the Chrome extension **"alt自動生成（Gemini使用）"** (hereinafter "the Extension") handles user data.

1. **Data Processed and Destination**
   - Only when explicitly triggered by the user ("Pick an Image" or "Generate All on Page"), the Extension sends the selected/detected image data (Base64), the current webpage title (`document.title`), surrounding text context (up to 500 characters), and user-provided custom prompt instructions directly to the **Google Gemini API** (`https://generativelanguage.googleapis.com`) using the user's own API key.
   - **No Developer Data Collection**: The developer does not collect, store, transmit, or sell any user data, browsing history, API keys, or image data to any developer-owned server or third party.
2. **Prohibited Content**
   - Users must not use the Extension on pages or images containing personally identifiable information (PII), confidential company data, or unreleased client materials.
3. **AI Training Policy**
   - Data handling by Google is governed by the Google Gemini API Terms of Service corresponding to the user's API key tier (Free Tier vs. Paid Pay-as-you-go).
4. **Local Storage**
   - Your Gemini API key (stored in plain text), UI/output language preferences, custom prompt settings, generated alt history, and logs are stored strictly locally in your browser via `chrome.storage.local`.


