
# AI 퀀트 시그널 (AI Quant Signal)

> EmDash CMS 기반 AI 반도체 ETF 리서치 & 자동화 블로그 시스템 — Astro + EmDash + GPT-4o + SQLite

뉴스 수집 → ETF 영향 분석 → 퀀트 시그널 점수 → 한국어 SEO 리서치 블로그 자동 생성까지의 파이프라인을 모두 한 Astro 앱 안에서 운영합니다.

<img width="973" height="796" alt="quent2" src="https://github.com/user-attachments/assets/7381c286-54ef-46c3-b3ec-0e82b611e29f" />


## 프로젝트 소개 (MVP · 바이브코딩)

이 저장소는 **MVP·바이브코딩** 성격의 데모입니다. 실서비스 수준의 보안·운영·규제 검증까지를 목표로 하지 않고, EmDash와 Astro로 **뉴스 → 분석 → 시그널 → 블로그** 흐름을 빠르게 붙여 보는 데 초점을 둡니다.

- 로컬에서 `pnpm bootstrap` 후 `pnpm dev` 로 바로 띄워 볼 수 있습니다.
- **관리자 자동화** 페이지(`/admin/automation`)와 홈의 **자동화** 링크는 **EmDash 관리자 권한(role ≥ 50, 또는 `admin` 역할)** 으로 로그인했을 때만 보입니다. URL로 직접 들어온 경우: 미로그인이면 EmDash 로그인으로, 관리자가 아니면 메인으로 리다이렉트됩니다.
- 파이프라인 API는 세션·시크릿 헤더로 제한되어 있습니다. 자세한 환경 변수는 아래 표를 참고하세요.

## 빠른 시작 (로컬)

```bash
corepack pnpm install
corepack pnpm bootstrap     # SQLite 초기화 + 시드(컬렉션/메뉴/태그) 적용
corepack pnpm dev           # http://localhost:4321
```

처음 시작 시 EmDash가 셋업 마법사를 띄울 수도 있습니다. 마법사를 끝내면 (또는 dev-bypass 모드에서 바로) 다음 URL이 열립니다.

- 사이트: <http://localhost:4321/>
- 시그널 대시보드: <http://localhost:4321/signals>
- 리서치 블로그: <http://localhost:4321/blog>
- 수집 뉴스 피드: <http://localhost:4321/news>
- EmDash 어드민: <http://localhost:4321/_emdash/admin>
- 관리자 자동화(뉴스·시그널·블로그, **관리자 로그인 후에만** 접근): <http://localhost:4321/admin/automation>

<img width="1230" height="1300" alt="quent1" src="https://github.com/user-attachments/assets/2d3802f6-108a-4bae-85dc-6dcbce2258a1" />


## 환경 변수

`.env.example` 을 `.env` 로 복사 후 채웁니다.

| 변수                  | 설명                                                                                          | 필수            |
| --------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| `OPENAI_API_KEY`      | GPT-4o 호출용 OpenAI 키.                                                                      | 분석/생성 시 필수 |
| `OPENAI_MODEL`        | 기본 `gpt-4o-mini`. 비용/품질 따라 `gpt-4o` 등으로 교체.                                      | 옵션            |
| `NEWS_API_KEY`        | <https://newsapi.org> 키.                                                                     | 둘 중 하나      |
| `FINNHUB_API_KEY`     | <https://finnhub.io> 키.                                                                      | 둘 중 하나      |
| `ALPHA_VANTAGE_KEY`   | 추후 가격 모멘텀/변동성 보강용 슬롯.                                                          | 옵션            |
| `EMDASH_BASE_URL`     | 기본 `http://localhost:4321`.                                                                 | 옵션            |
| `EMDASH_DEV_BYPASS`   | localhost 한정 토큰 없이 EmDash REST에 쓰기 허용 (`true`/`false`).                            | 로컬 시 권장    |
| `EMDASH_API_TOKEN`    | 운영에서는 Admin → API Tokens 에서 발급한 PAT(`ec_pat_…`).                                    | 배포 시 필수    |
| `YOUTUBE_API_KEY`     | YouTube Data API v3 키 (블로그 하단 추천 영상). 없어도 mock 영상으로 폴백.                    | 권장            |
| `YOUTUBE_CACHE_TTL_SEC` | 동일 키워드 묶음 캐시 시간(초). 기본 900 (15분).                                            | 옵션            |
| `CRON_SECRET`         | 설정하면 `/api/*` 호출 시 헤더 `X-Cron-Secret` 일치를 강제. 외부 cron 보호용.                 | 옵션            |
| `ADMIN_PIPELINE_SECRET` | 설정 시 `POST /api/admin/run-news-pipeline` 에 `X-Admin-Pipeline-Secret` 으로 호출 가능 (세션 없이). | 옵션        |

> 보안 원칙. 모든 외부 API 키는 **서버사이드(`src/pages/api/*`, `src/services/*`)에서만** 사용합니다. 클라이언트 번들로 흘러갈 수 있는 코드(`*.astro` 의 `<script>`)에서 절대 import 하지 마세요.

## 데이터 모델 (EmDash 컬렉션)

`seed/seed.json` 에 정의되어 있고, `corepack pnpm emdash seed` 로 적용됩니다.

- `news_items` — 수집된 뉴스 + GPT 분석 결과 (target_etf, sentiment, score, importance, reason …)
- `signals` — ETF 별 종합 시그널 (score, label, sentiment_score, frequency_score, momentum_score, volatility_score)
- `blog_posts` — GPT 가 자동 생성한 한국어 리서치 블로그 (title/summary/content/seo_description/target_etf/signal_score…)
- `youtube_videos` — 블로그 하단 추천 영상 캐시 (video_id/title/channel/thumbnail/summary/sentiment/relevance/score/related_ticker/keywords)
- 기존 `posts`, `pages` 도 유지 (블로그 템플릿 호환).

<img width="931" height="717" alt="quent3" src="https://github.com/user-attachments/assets/7692fadb-2f0b-4051-b821-2fddf57c9060" />


## 자동화 파이프라인

관리자는 브라우저에서 **`/admin/automation`** 으로 들어가 한 번에 실행할 수 있습니다. (EmDash 관리자 로그인 세션 필요)

### 1) 뉴스 수집

```bash
curl http://localhost:4321/api/fetch-news?max=20
```

NewsAPI(우선) → Finnhub 순으로 시도하고, 키가 모두 없으면 `mockNews` (데모 6건) 가 들어갑니다. 같은 URL은 자동 dedup.

### 2) GPT 분석 + 시그널 재계산

```bash
curl -X POST http://localhost:4321/api/analyze-news \
  -H "Content-Type: application/json" -d '{"limit":15}'
```

`news_items.analyzed=false` 인 항목을 GPT-4o 로 분석해 `target_etf/sentiment/score/importance/reason` 을 채우고, 그 결과를 ETF 단위로 집계해 `signals` 컬렉션에 새 시그널을 생성합니다.

<img width="607" height="820" alt="quent4" src="https://github.com/user-attachments/assets/af1a4a7a-44dd-4928-af5d-d50d473691cd" />

### 3) 블로그 자동 생성

```bash
curl -X POST http://localhost:4321/api/generate-blog \
  -H "Content-Type: application/json" -d '{"publish":false}'
```

분석된 뉴스 묶음 + 최신 시그널을 컨텍스트로 GPT-4o 가 `{title, summary, seoDescription, tags, markdown}` JSON 을 반환하고, 마크다운을 Portable Text 로 변환해 `blog_posts` 에 저장합니다. 기본은 draft. `publish:true` 면 즉시 발행.

`{"etf":"SOXX"}` 처럼 특정 ETF 만 지정해서 1편만 생성할 수도 있습니다.

### 4) 발행 토글

```bash
curl -X POST http://localhost:4321/api/publish-post \
  -H "Content-Type: application/json" -d '{"id":"<entry-id>","publish":true}'
```

### 5) YouTube 추천 영상 (블로그 하단 자동 삽입)

블로그 상세 페이지 (`/blog/[slug]`) 하단에 React island `<RelatedVideosSection client:visible>` 가 자동으로 들어가 있어, 사용자가 스크롤로 시야에 들어올 때 다음 흐름이 일어납니다.

```
키워드 추출 (GPT or rule-based)
  → YouTube Data API v3 검색 (최근 30일 / 영어 / 조회수 정렬 / 5건)
  → GPT 영상 요약 + 감성 + 관련도
  → Video Score = 0.5·KeywordMatch + 0.3·Views + 0.2·Recency
  → skeleton → 카드 그리드 렌더 (다크모드/라이트모드 자동 대응)
```

수동 호출 / 백필 용도의 API:

```bash
# 키워드만 직접 넘겨 추천만 받기
curl 'http://localhost:4321/api/fetch-youtube?keywords=SOXX%20ETF,NVIDIA%20earnings'

# 블로그 컨텍스트로 추출+검색+분석+점수+(선택)EmDash 저장
curl -X POST http://localhost:4321/api/fetch-youtube \
  -H "Content-Type: application/json" \
  -d '{"title":"NVIDIA 실적 호조가 SOXX ETF에 미치는 영향","etf":"SOXX","tickers":["NVDA","TSM"],"persist":true}'

# youtube_videos 컬렉션에서 summary 비어 있는 항목만 GPT 재분석
curl -X POST http://localhost:4321/api/analyze-youtube \
  -H "Content-Type: application/json" -d '{"limit":10}'
```

캐시: 동일 키워드 묶음에 대해 `YOUTUBE_CACHE_TTL_SEC` (기본 15분) 동안 in-memory + single-flight 로 한 번만 호출하므로 quota 가 빠르게 소모되지 않습니다.

키 없을 때: `YOUTUBE_API_KEY` / `OPENAI_API_KEY` 둘 중 어느 것이 비어 있어도 컴포넌트는 죽지 않고 **mock 영상 / rule-based 요약** 으로 폴백합니다.

## 체크리스트 (PHASE 1 → 9)

- [x] PHASE 1 — EmDash + Astro 설치 (`pnpm bootstrap`)
- [x] PHASE 2 — 뉴스 수집 시스템 (`/api/fetch-news`)
- [x] PHASE 3 — GPT ETF 분석 (`/api/analyze-news`)
- [x] PHASE 4 — 퀀트 점수 생성 (`signalService` + `signals` 컬렉션)
- [x] PHASE 5 — 블로그 자동 생성 (`/api/generate-blog`)
- [x] PHASE 6 — EmDash 저장 (`emdashService.ts` + `EmDashClient`)
- [x] PHASE 7 — SEO 페이지 (`/blog/[slug]` + `getSeoMeta`)
- [x] PHASE 8 — 자동 발행 (`/api/publish-post`, `generate-blog?publish=true`)
- [x] **PHASE 8.5 — YouTube 추천 영상 자동 연동** (`/api/fetch-youtube`, `<RelatedVideosSection client:visible>`)
- [ ] PHASE 9 — 백테스트 시스템 (확장 예정 — `signals` 시계열 + 가격 데이터 연동)

## 운영 (배포)

1. EmDash Admin 에 로그인 → **Settings → API Tokens** 에서 토큰을 발급하고 `EMDASH_API_TOKEN` 환경변수에 넣습니다.
2. `EMDASH_DEV_BYPASS=false` 로 운영 모드 강제.
3. `CRON_SECRET` 을 설정하고 외부 스케줄러 (Vercel Cron / Cloudflare Cron / GitHub Actions) 가 `X-Cron-Secret` 헤더와 함께 다음을 호출하게 합니다.
   ```
   GET  /api/fetch-news       (예: 30분마다)
   POST /api/analyze-news     (예: 1시간마다)
   POST /api/generate-blog    (예: 하루 1~2회, publish:true)
   ```

## 디렉토리

```
src/
├── lib/
│   ├── config.ts        # env 단일 진입점, ETF/티커/키워드 상수
│   ├── prompts.ts       # GPT 시스템 + 사용자 프롬프트
│   ├── scoring.ts       # 시그널 스코어 공식 + 라벨링
│   └── utils.ts         # slugify, JSON 추출, 마크다운 → Portable Text
├── services/
│   ├── emdashService.ts # EmDashClient 래퍼 (news/signals/blog_posts CRUD)
│   ├── newsService.ts   # NewsAPI / Finnhub / mock fallback
│   ├── openaiService.ts # OpenAI chat.completions JSON helper
│   └── signalService.ts # ETF 별 시그널 재계산
├── pages/
│   ├── index.astro      # 대시보드 홈
│   ├── signals/         # 시그널 히스토리
│   ├── blog/            # 자동 생성 리서치 블로그
│   ├── news/            # 수집 + 분석 뉴스 피드
│   ├── posts/           # 기존 EmDash 블로그 (옵션)
│   └── api/
│       ├── fetch-news.ts
│       ├── analyze-news.ts
│       ├── generate-blog.ts
│       └── publish-post.ts
└── layouts, components, styles, utils  # EmDash blog 템플릿 그대로
```


