# cfr_prompts.json 仕様（管理者・開発者向け）

このドキュメントは、`mode=2` CFR診断の設定を `cfr_prompts.json` で管理するための仕様メモです。  
実装に追従して更新していますが、環境差分があり得る箇所は **要確認** と明記します。

## 1. 運用前提

- 現在の運用では **`mode=2` を標準** として扱います。
- 実装上は URL 未指定時に `mode=1` 判定になる箇所があるため、運用では `?mode=2` を明示する方針が安全です（要確認）。
- 診断設定は `cfr_prompts.json` の `byTestId` で `testid` ごとに切り替えます。

例:

- `xnative_cfr_r050.html?testid=gadget02&mode=2`
- `xnative_cfr_r050.html?testid=jimbocho03&mode=2`
- `xnative_cfr_r050.html?testid=akihabara02&mode=2`

## 2. 全体構造

```json
{
  "byTestId": {
    "<testid>": {
      "filePath": "timeline_xxx.json",
      "...": "testid専用設定"
    }
  },
  "default": {
    "...": "フォールバック設定"
  }
}
```

### 記入済みサンプル（抜粋）: `akihabara02`

> 実運用の全量ではなく、テンプレ適用イメージを示す抜粋です。

```json
{
  "byTestId": {
    "akihabara02": {
      "filePath": "timeline_akihabara_02.json",
      "candidateDisplay": { "languageMode": "primaryOnly" },
      "topTitle": "Xnative/Timeline\\n秋葉原回遊感性診断\\nあなたの中の“アキバ”はどこにある？",
      "topTitle_en": "Xnative/Timeline\\nAkihabara Circulation Sensibility Diagnosis\\nWhere is \"Akiba\" inside you?",
      "topDescription": "電子部品、ジャンク、家電、PC、ゲーム、同人、メイド、再開発、観光地化まで、秋葉原の年表から自分に引っかかる出来事を選び、あなたがどのような秋葉原の感性を持っているかを診断します。",
      "topDescription_en": "From electronic parts, junk, home appliances, PCs, games, doujin, and maid culture to redevelopment and touristification, pick Akihabara timeline events that catch you and diagnose your sensibility.",
      "step1Texts": {
        "privacyNotice": "※入力した内容や選択内容は、秋葉原診断結果の表示や集計に使わせていただきます。",
        "privacyNotice_en": "Your inputs and selections are used to show and aggregate Akihabara diagnosis results.",
        "selectionGuide": "秋葉原の年表で、引っかかった出来事をチェックしてください。",
        "selectionGuide_en": "Check timeline events that resonate with your Akihabara memory.",
        "minimumSelectionNotice": "※リアルタイムで触れていなくても...（省略）",
        "minimumSelectionNotice_en": "Check events you liked or were influenced by... (omitted)",
        "startButton": "秋葉原診断スタート",
        "startButton_en": "Start Akihabara Diagnosis"
      },
      "mode2Profile": {
        "shareHashtag": "#秋葉原診断",
        "shareHashtag_en": "#AkihabaraDiagnosis",
        "meaningChoices": [
          {
            "code": "dug",
            "label": "掘り出した",
            "label_en": "Dug out finds",
            "description": "ジャンク、部品、レア物、古い機材、情報を探した。",
            "description_en": "I searched for junk, parts, rare gear, old devices, and niche information.",
            "scoreKey": "admiration",
            "weight": 2.4
          },
          {
            "code": "build_fix",
            "label": "組んだ／直した",
            "label_en": "Built / fixed",
            "description": "自作、改造、修理、配線、設定、環境構築をした。",
            "description_en": "I built, modded, repaired, wired, configured, and assembled environments.",
            "scoreKey": "discovery",
            "weight": 2.8
          }
        ],
        "attributes": [
          {
            "key": "world",
            "ja": "電気街工作",
            "en": "Electric-Town Tinkering",
            "short": "電工",
            "code": "EL",
            "family": "hardware",
            "desc": "部品や道具を前に手を動かしたくなる資質です。",
            "descEn": "You are moved to work hands-on when facing parts and tools."
          },
          {
            "key": "aberration",
            "ja": "再開発観測",
            "en": "Redevelopment Observer",
            "short": "再開",
            "code": "RD",
            "family": "redevelopment",
            "desc": "駅前や通りの再編を定点観測する資質です。",
            "descEn": "You closely observe restructuring around stations and streets."
          }
        ],
        "deepModules": [
          { "key": "electronic_parts", "ja": "電子部品", "en": "Electronic Parts" },
          { "key": "junk", "ja": "ジャンク", "en": "Junk" }
        ],
        "generalModules": [
          { "key": "craft", "ja": "ものづくり", "en": "Making" },
          { "key": "city_shift", "ja": "都市変化", "en": "Urban Change" }
        ],
        "practiceModes": [
          { "key": "search", "ja": "探す", "en": "Search" },
          { "key": "build", "ja": "組む", "en": "Build" },
          { "key": "record", "ja": "記録する", "en": "Record" }
        ],
        "roleLabels": {
          "mainJa": "主属性",
          "mainEn": "Main Trait",
          "subJa": "副属性",
          "subEn": "Sub Trait",
          "hiddenJa": "裏属性",
          "hiddenEn": "Hidden Trait"
        },
        "lowerModuleLabels": {
          "deepJa": "濃いアキバ圏",
          "deepEn": "Deep Akiba Modules",
          "generalJa": "惹かれやすい領域",
          "generalEn": "Areas You Naturally Gravitate Toward"
        },
        "epithetLabel": { "ja": "あなたのアキバ異名", "en": "Your Akiba Epithet" },
        "epithetInstructions": {
          "ja": "商品名・店名をそのまま並べるのではなく、秋葉原の手触りに変換してください。",
          "en": "Do not list product/store names literally; translate them into Akihabara texture."
        },
        "epithetVocabularyHints": {
          "ja": ["ラジオ会館", "中央通り", "裏通り", "ジャンク箱", "基板", "再開発"],
          "en": ["Radio Kaikan", "Chuo-dori", "backstreet", "junk bin", "circuit board", "redevelopment"]
        },
        "scoring": {
          "attributeWeights": {
            "crossing": 0.94,
            "future": 0.93
          },
          "attributeBias": {
            "world": 0.15,
            "mechanism": 0.12
          },
          "meaningWeights": {
            "dug": { "mechanism": 1.2, "world": 1.14 },
            "build_fix": { "boyhood": 1.24, "world": 1.14 },
            "city_change": { "aberration": 1.15, "future": 1.15 }
          },
          "diversityPenalty": 0.4,
          "dominanceCap": { "maxRatio": 1.85, "strength": 0.28 }
        }
      }
    }
  }
}
```

- `byTestId.<testid>`: 診断ごとの設定
- `default`: 未設定キーのフォールバック
- `filePath`: 読み込む年表JSONへの参照（`timeline_*.json`）

## 3. byTestId の主要キー

### 3.1 画面テキスト

- `topTitle` / `topTitle_en`
- `topDescription` / `topDescription_en`
- `eventChecklistDescription` / `eventChecklistDescription_en`

### 3.2 step1Texts

- `step1Texts.privacyNotice` / `_en`
- `step1Texts.selectionGuide` / `_en`
- `step1Texts.minimumSelectionNotice` / `_en`
- `step1Texts.startButton` / `_en`

### 3.3 candidateDisplay.languageMode

- `both`: UI言語 + 反対言語を表示
- `primaryOnly`: UI言語のみ表示
- 未指定時: `both`

## 4. meaningChoices

`mode2Profile.meaningChoices[]` で意味付けを定義します。

主なキー:

- `code`
- `label` / `label_en`
- `description` / `description_en`
- `scoreKey`
- `weight`

重要:

- `description` / `description_en` は **UIには表示しない**（内部情報）
- 同説明は AI診断プロンプト側の意味解釈に利用されます

## 5. mode2Profile

`byTestId.<id>.mode2Profile` で mode=2 診断語彙を切り替えます。

### 5.1 基本キー

- `attributes[]`
- `roleLabels`
- `lowerModuleLabels`
- `deepModules[]`
- `generalModules[]`
- `practiceModes[]`
- `shareHashtag` / `shareHashtag_en`
- `epithetInstructions`
- `epithetVocabularyHints`

### 5.2 attributes の推奨項目

- `key`, `ja`, `en`, `short`, `code`, `desc`, `descEn`
- `family`（後述 `diversityPenalty` の補正単位）

### 5.3 標準フォールバック属性（HTML側）

`mode2Profile.attributes` が無い testid（例: `zut2026s` / ポップカルチャー標準）では、`xnative_cfr_r050.html` の `MODE2_ATTRS` が使われます。

| key | ja | en | short | code | 画像 |
|-----|----|----|-------|------|------|
| world | 世界観軸 | World Immersion | 世界 | WI | `assets/attrs/IMG_sekaikanjiku.webp` / `.png` |
| mechanism | 機構偏愛 | Mechanism Love | 機構 | ME | `assets/attrs/IMG_kiko.webp` / `.png` |
| future | 未来感受 | Future Sense | 未来 | FU | `assets/attrs/IMG_mirai.webp` / `.png` |
| aberration | 異形親和 | Aberration Affinity | 異形 | AB | `assets/attrs/IMG_ikei.webp` / `.png` |
| daily | 日常浸透 | Daily Affinity | 日常 | DY | `assets/attrs/IMG_nichijyo.webp` / `.png` |
| crossing | 越境回遊 | Crossing | 越境 | CR | `assets/attrs/IMG_ekkyo.webp` / `.png` |
| boyhood | 少年回路 | Boyhood Circuit | 少年 | BH | `assets/attrs/IMG_boy.webp` / `.png` |
| girlhood | 少女回路 | Girlhood Circuit | 少女 | GH | `assets/attrs/IMG_girl.webp` / `.png` |
| repeat | 反復愛着 | Repeat Attachment | 反復 | RP | `assets/attrs/IMG_hanpuku.webp` / `.png` |
| author | 作者偏信 | Author Bias | 作者 | AU | `assets/attrs/IMG_sakusha.webp` / `.png` |
| archive | 記録蒐集 | Archive Impulse | 蒐集 | AR | `assets/attrs/IMG_kiroku.webp` / `.png` |

補足:

- 日本語名「世界観軸」は旧称「世界観没入」からの名称変更です。英語名 `World Immersion` と説明文は変更していません。
- 診断プロンプトが返す属性名も日本語の正式名（世界観軸）です。旧称が返った場合は互換エイリアスで正規化します。
- 英語UIでも属性カード画像は日本語焼き込みカードを使います。
- `gadget02` / `akihabara02` / `jimbocho03` など、`mode2Profile.attributes` がある testid では上表ではなく各プロファイルの語彙が優先されます。

## 6. mode2Profile.scoring

`mode2Profile.scoring` で出やすさ補正を制御します。

- `attributeWeights`
  - 属性ごとの倍率（未指定 `1.0`）
- `attributeBias`
  - 属性ごとの加減点（未指定 `0`）
- `meaningWeights`
  - `meaningChoices.code` ごとに属性倍率を指定
- `diversityPenalty`
  - 主/副/裏の選出時、同 `family` 偏りを弱く抑制
- `dominanceCap`
  - 1位属性の突出を弱く圧縮

## 7. デバッグ・ローカル確認

### 7.1 debug=score

- `?debug=score` で属性スコア内訳をコンソール確認
- 通常画面には表示しません

### 7.2 localAssets=1

- `?localAssets=1` を付けると、ホスト名に関係なくローカルJSONを優先

### 7.3 localhost / LANスマホ確認

ローカル優先対象（開発環境扱い）:

- `localhost`
- `127.0.0.1`
- `192.168.*.*`
- `10.*.*.*`
- `172.16.*.*`〜`172.31.*.*`

挙動:

- `/cfr_prompts.json` を優先取得
- `filePath` が `timeline_*.json` の場合は `/<filePath>` を優先取得
- 失敗時は GitHub Raw へフォールバック

## 8. 診断チューニング値の前提（重要）

以下は、`mode2Profile.scoring` を調整するときの実務前提です。

### 8.1 基本方針

- 既存ロジックは「ベーススコア + 補正」の構造です。
- まずは **小さい値で段階調整** し、1回で大きく動かさないでください。
- 1つの項目だけを変え、`debug=score` で差分確認してから次を触るのが安全です。

### 8.2 推奨レンジ（目安）

- `attributeWeights`: `0.90`〜`1.15`  
  - 強くしたい場合でも最初は `1.03`〜`1.08` 程度
- `attributeBias`: `-0.4`〜`+0.4`  
  - 初期は `±0.1`〜`±0.2` 推奨
- `meaningWeights`: `1.00`〜`1.25`  
  - 1.30 を超えると過増幅しやすい（要注意）
- `diversityPenalty`: `0.2`〜`0.6`  
  - 高すぎると本来強い属性が不自然に落ちる
- `dominanceCap.maxRatio`: `1.6`〜`2.2`
- `dominanceCap.strength`: `0.15`〜`0.40`

> 上記は実装上の制約ではなく運用目安です。  
> 年表特性によって最適値は変わるため、最終値は実データで要確認。

### 8.3 調整順序（推奨）

1. `meaningWeights` で「意味付け→属性」の方向性を作る
2. `attributeWeights` で全体の出やすさを微調整
3. `attributeBias` で残る偏りを補正
4. `diversityPenalty` で top3 の family 偏りを軽く抑える
5. `dominanceCap` で1位突出を穏やかに圧縮

### 8.4 よくある失敗パターン

- `meaningWeights` を複数箇所で強くかけすぎて、同じ属性が固定化する
- `attributeBias` を大きく入れすぎて、年表差よりバイアスが勝つ
- `diversityPenalty` を強くしすぎて、根拠の弱い属性が top3 に入る
- `dominanceCap.strength` を高くしすぎて、1位の説明力が失われる

### 8.5 変更単位の目安

- `attributeWeights`: 1回あたり `±0.02`〜`±0.05`
- `attributeBias`: 1回あたり `±0.05`〜`±0.10`
- `meaningWeights`: 1回あたり `±0.03`〜`±0.08`
- `diversityPenalty`: 1回あたり `±0.05`〜`±0.10`
- `dominanceCap.maxRatio`: 1回あたり `±0.1`
- `dominanceCap.strength`: 1回あたり `±0.05`

### 8.6 確認観点チェックリスト

- [ ] 主属性が毎回ほぼ同じになっていない
- [ ] 副属性・裏属性が不自然に弱くない
- [ ] family が単調に固定化していない
- [ ] `meaningChoices` の違いが結果に反映される
- [ ] `gadget02` / `jimbocho03` / `akihabara02` で語彙の差が出る
- [ ] `zutest01`（fallback系）の挙動を壊していない

### 8.7 debug=score の見方

- `base`: 補正前の属性スコア
- `afterMeaningWeights`: meaning補正後
- `attributeWeight`: 属性倍率
- `attributeBias`: 属性加減点
- `final`: 最終スコア

この順番で見れば、どの補正が効きすぎているか切り分けやすくなります。

## 9. 保存データ方針（サーバー）

`/api/diagnostic-result` への保存は、従来どおり **集計用データのみ**です。

保存対象:

- `timestamp`, `testid`, `filePath`, `mode`, `birthYear`, `gender`, `nickname`
- `selections`（項目・タグの集計用情報）

保存しない:

- AI診断本文
- 異名
- 主属性/副属性/裏属性本文
- `summary` / `shareText`

## 10. リポジトリ役割分担

- `xnative_cfr`: アプリ本体（`xnative_cfr_r050.html`, `server.js` など）
- `xnative`: 設定・年表データの配布元として参照（`cfr_prompts.json`, `timeline_*.json`）

注:

- 実際の運用構成・公開先ブランチは環境によって異なるため、最終運用時は要確認です。

## 11. 新規 testid 追加チェックリスト（コピペ用テンプレ）

以下をそのままコピーして、作業チェックに使ってください。

```md
# 新規 testid 追加チェックリスト: <testid>

## A. 事前確認
- [ ] `byTestId.<testid>` が未作成であることを確認した
- [ ] 参照する `filePath`（`timeline_*.json`）を確定した
- [ ] URL確認方針を決めた（例: `?testid=<testid>&mode=2`）

## B. cfr_prompts.json 追加
- [ ] `byTestId.<testid>.filePath` を設定した
- [ ] `topTitle` / `topTitle_en` を設定した
- [ ] `topDescription` / `topDescription_en` を設定した
- [ ] `eventChecklistDescription` / `_en` を設定した
- [ ] `step1Texts`（privacyNotice / selectionGuide / minimumSelectionNotice / startButton）を設定した
- [ ] `candidateDisplay.languageMode` を設定した（`both` or `primaryOnly`）

## C. mode2Profile 追加
- [ ] `mode2Profile.shareHashtag` / `shareHashtag_en` を設定した
- [ ] `mode2Profile.roleLabels` を設定した（main/sub/hidden）
- [ ] `mode2Profile.lowerModuleLabels` を設定した（deep/general）
- [ ] `mode2Profile.epithetLabel` を設定した
- [ ] `mode2Profile.attributes[]` を設定した（key/ja/en/short/code/desc/descEn/family）
- [ ] `mode2Profile.deepModules[]` を設定した
- [ ] `mode2Profile.generalModules[]` を設定した
- [ ] `mode2Profile.practiceModes[]` を設定した
- [ ] `mode2Profile.epithetInstructions` を設定した
- [ ] `mode2Profile.epithetVocabularyHints` を設定した

## D. meaningChoices 追加
- [ ] `mode2Profile.meaningChoices[]` を8項目前後で設定した
- [ ] 各項目に `code` / `label` / `label_en` / `description` / `description_en` を設定した
- [ ] 必要に応じて `scoreKey` / `weight` を設定した
- [ ] `description` はUI非表示・内部情報用途であることを確認した

## E. scoring（任意・推奨）
- [ ] `mode2Profile.scoring.attributeWeights` を設定した（未指定=1.0）
- [ ] `mode2Profile.scoring.attributeBias` を設定した（未指定=0）
- [ ] `mode2Profile.scoring.meaningWeights` を設定した（meaning code -> attribute補正）
- [ ] `mode2Profile.scoring.diversityPenalty` を設定した（弱め推奨）
- [ ] `mode2Profile.scoring.dominanceCap` を設定した（弱め推奨）

## F. 互換性確認
- [ ] 既存 `testid`（例: `zutest01`, `gadget02`, `jimbocho03`）が壊れていない
- [ ] `timeline_*.json` 本体を変更していない
- [ ] AI本文・異名・属性本文をサーバー保存していない

## G. 動作確認
- [ ] `?testid=<testid>&mode=2` で初期画面文言が切り替わる
- [ ] 意味付け項目が想定どおり表示される（説明文はUI非表示）
- [ ] 診断結果の属性・異名・共有文が想定どおり
- [ ] `?debug=score` で補正内訳が確認できる
- [ ] `?localAssets=1` でローカルJSON優先が確認できる

## H. 記録
- [ ] 追加/変更した `cfr_prompts.json` キーを記録した
- [ ] 確認URLを記録した
- [ ] 既知の制約・要確認事項を記録した
```

### JSON ひな形（最小）

```json
{
  "byTestId": {
    "<testid>": {
      "filePath": "timeline_<name>.json",
      "candidateDisplay": { "languageMode": "primaryOnly" },
      "step1Texts": {
        "privacyNotice": "",
        "privacyNotice_en": "",
        "selectionGuide": "",
        "selectionGuide_en": "",
        "minimumSelectionNotice": "",
        "minimumSelectionNotice_en": "",
        "startButton": "",
        "startButton_en": ""
      },
      "topTitle": "",
      "topTitle_en": "",
      "topDescription": "",
      "topDescription_en": "",
      "eventChecklistDescription": "",
      "eventChecklistDescription_en": "",
      "mode2Profile": {
        "shareHashtag": "",
        "shareHashtag_en": "",
        "meaningChoices": [],
        "attributes": [],
        "deepModules": [],
        "generalModules": [],
        "practiceModes": [],
        "roleLabels": {
          "mainJa": "主属性",
          "mainEn": "Main Trait",
          "subJa": "副属性",
          "subEn": "Sub Trait",
          "hiddenJa": "裏属性",
          "hiddenEn": "Hidden Trait"
        },
        "lowerModuleLabels": {
          "deepJa": "濃い文化圏",
          "deepEn": "Strong Cultural Modules",
          "generalJa": "惹かれやすい領域",
          "generalEn": "Areas You Naturally Gravitate Toward"
        },
        "epithetLabel": { "ja": "あなたの異名", "en": "Your Epithet" },
        "epithetInstructions": { "ja": "", "en": "" },
        "epithetVocabularyHints": { "ja": [], "en": [] },
        "scoring": {
          "attributeWeights": {},
          "attributeBias": {},
          "meaningWeights": {},
          "diversityPenalty": 0.4,
          "dominanceCap": { "maxRatio": 1.8, "strength": 0.3 }
        }
      }
    }
  }
}
```
