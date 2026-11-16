# Christmas Tree Village 인수인계

업데이트: 2026-11-16 (한국 시간). 먼저 `git status`, `git log`, 원격 main을 확인한다.
이 문서의 완료 기록과 현재 운영 배포 커밋은 별개다.

## 프로젝트와 사용자 의도

- 저장소: https://github.com/rbgks8617-w/Christmas-Tree-Ascii-Art
- 운영: https://christmas-tree-ascii-art-server.onrender.com/
- 관리자: 운영 주소의 `/admin`
- Supabase 프로젝트: `ygswuhugtryamouynyja`
- Render 서비스 ID: `srv-dbs02vjbc2fs73a6se3g`
- 로컬: `C:/Users/rb778/Documents/ChatGPT/2학년 2학기 기말/christmas-tree`

기존 회전 ASCII 트리는 절대 보존하고, 그 뒤를 유럽풍 크리스마스 마을로
꾸미는 프로젝트다. 가장 최근 요청은 모바일에서 잘 보이도록 배경 색감을
더 선명하게 만드는 것과 모든 작업의 커밋·푸시 및 인수인계 문서 작성이다.
푸시 요청은 이번 변경의 푸시에 대한 승인이다. 미래 작업의 배포까지 자동 승인된 것은 아니다.

## 완료된 작업

- `bbbc419`: PostgreSQL 전환 준비, 자동 삭제 제거, SQLite 이관 도구.
- `ccd9101`: 초기 마을·산타 추가. 트리 보존 비교의 고정 기준 커밋.
- `09041a8`: 목조 건물 6채, 가랜드·리스·눈·창문·연기, 환경 조명, 캐싱.
- `cc81b96`: 모바일 채팅 높이·키보드 대응, 안전 여백, 테스트와 보고서.
- 현재 후속 변경: 목재·빨강·초록·금색 채도를 강화하고 모바일 배경 중간
  밝기를 더 올림. 모바일 벽 문자를 `=`로 바꾸어 작은 글자의 면적 손실을 보완.
  트리 모델·애니메이션·색상은 변경하지 않음.

2026-11-16 작업 시작 시 GitHub main은 `cc81b96`이었다. 이후 커밋/푸시는
Git 이력과 원격 조회 결과를 기준으로 판단한다. 과거 이 환경에서는 Windows
Git credential-manager 실행 오류로 push가 실패했으며 사용자가 터미널에서
직접 푸시했다. 성공 확인 없이 원격 반영이나 배포 완료를 보고하지 않는다.

## 파일 지도

| 파일 | 역할 / 주의점 |
| --- | --- |
| `geometry.js` | 65,632개 트리 모델 점. 수정 금지 |
| `christmas_tree_3d.py` | 원본 트리 생성 및 터미널 버전. 수정 금지 |
| `scene.js` | Canvas 2D 문자·RGB·깊이·불투명도·Bloom 버퍼, 30FPS 스케줄러 |
| `village.js` | 환경 전용 팔레트, 건물 캐시, 창문·연기 애니메이션 |
| `santa.js` | 기존 산타와 순록 3마리, 30초 주기 중 8초 비행 |
| `styles.css`, `index.html` | 데스크톱 우측 채팅 / 모바일 하단 채팅 |
| `chat-layout.js` | visualViewport 및 키보드 대응. 트리 Canvas 크기는 유지 |
| `chat.js` | 같은 출처 `/api/chat`, 익명 메시지, 중복 재전송 보호 |
| `music.js`, `assets/christmas.mp3` | 로컬 MP3 반복, 자동 재생 시도/사용자 터치 fallback, 볼륨 |
| `server.py` | HTTP 서버, 정적 파일 허용 목록, 채팅, 범위 요청 오디오 |
| `admin.py`, `admin.*` | 백엔드 비밀번호 검증·세션·관리자 UI와 삭제 |
| `storage.py` | SQLite / psycopg PostgreSQL 어댑터 |
| `schema.sql`, `migrate_sqlite.py` | 테이블/RLS 및 이전용 도구. 재실행은 별도 판단 |

## 트리 보존과 렌더링

트리 위치·크기·빛 계산을 건드리지 않는다. 환경 depth는 -6보다 작고
산타는 -5, 트리가 앞에서 그려진다. 환경 Glow는 `bloom=4`이며 셀 내부로
클리핑한다. 트리 쓰기가 해당 플래그를 대체한다. 기존 트리 Bloom 1/2/3
계산은 유지한다. 전체 Canvas filter는 금지한다.

건물은 dimensions/detail tier 기준 단일 캐시로 관리하며 창문 밝기와 연기만
시간에 따라 바뀐다. 캐시를 프레임별로 쌓거나 새 외부 이미지/API를 추가하지 않는다.
사용자의 참고 사진은 Tudor 목조 가게, 따뜻한 창문, 가랜드가 중앙 트리를 감싸는 구도다.

## 채팅 UI와 모바일 문제

삭제한 제목/소개/빈 목록 안내문을 다시 추가하지 않는다. 공개 UI는
`익명 : 메시지`, 입력창과 보내기 버튼 중심이다.
기존 잘림 원인: 320px 최소 높이 + 하단 여백이 화면을 초과하고 키보드 높이를
반영하지 않음. 현재는 visualViewport 높이와 safe area로 패널을 계산하고
폼은 shrink되지 않는다. 입력 중 가려질 때만 스크롤하고 pinch zoom은 막지 않는다.
실제 iPhone 키보드와 가로 회전 검증은 아직 필요하다.

## 운영 DB 현황

사용자가 Supabase 스키마를 생성하고 Session pooler 연결을 설정했다.
로컬 메시지 저장/재시작 유지 및 운영 Render 메시지가 Supabase 테이블에
생기는 것을 사용자 확인으로 검증했다. 이전 시점 관리자 목록은 0개였다.
원본 SQLite 전체 백업 또는 과거 삭제 메시지 복구를 완료했다고 주장하면 안 된다.

- 운영은 `CHAT_STORAGE=postgres`, `DATABASE_URL` 사용. SQLite는 로컬 기본값.
- 연결 호스트: `aws-1-ap-northeast-2.pooler.supabase.com:5432`.
- 인증은 DB 비밀번호 기반. Supabase HTTP API Secret Key를 쓰지 않는다.
- `CHAT_SECRET`, `CHAT_ADMIN_PASSWORD`는 기존 Render 값 유지.
- 최신 100개를 일반 채팅에 표시, 관리자 조회는 최신 500개까지.
  저장된 메시지는 나이나 개수 때문에 자동 삭제되지 않는다.
- 관리자 전체 삭제는 확인 당시의 throughId 이하를 삭제한다. 새 메시지는 보존.
- RLS 활성화, anon/authenticated 직접 접근 권한 없음. 브라우저 DB 연결 금지.
- DB 오류는 503이며 저장 성공으로 표시하지 않는다.

`DEPLOYMENT.md`는 최초 이전 절차 기록이다. 이미 연결된 운영 환경에서
그 절차를 무조건 다시 실행하거나 SQLite로 되돌리지 않는다.

## 실행 / 테스트

```powershell
cd "C:/Users/rb778/Documents/ChatGPT/2학년 2학기 기말/christmas-tree"
python -m pip install -r requirements.txt
python server.py
```

http://localhost:8000 에서 Ctrl+Shift+R. 기본 로컬 SQLite는 운영 DB와 별개다.
운영 환경변수가 설정된 터미널에서 테스트 메시지를 보내면 운영 DB에 저장될 수 있다.
비밀번호를 소스나 셸 명령 기록에 직접 쓰지 않는다.

```text
python -m unittest -v test_server.py
node test_scene.cjs
node test_ui.cjs
node test_admin.cjs
node test_chat_layout.cjs
```

픽셀 테스트: 별도 테스트 디렉터리에 `@napi-rs/canvas`를 설치하고 환경변수
`CANVAS_MODULE`에 패키지 절대 경로를 지정한 뒤 `node test_visual.cjs` 실행.
현재 PC 테스트 패키지 위치:
`../village-reference-v2/node_modules/@napi-rs/canvas`.
`VISUAL_OUTPUT`에 기존 디렉터리를 지정하면 비교 PNG를 생성한다.
이 패키지는 개발 검증용이며 운영 의존성에 추가하지 않는다.

기준 `ccd9101`과 3개 해상도, 10개 시점에서 분리된 트리+눈 RGBA 픽셀 및
glyph/RGB/depth/opacity/bloom을 비교한다. 합성 장면의 트리 셀도 비교한다.
`docs/visual-v2/REVIEW.md`에 비교 결과와 Native Canvas 측정 조건이 있다.

## 남은 검증 / 배포 주의

- 실제 Chrome / iPhone Safari, 소프트 키보드, 주소창 접힘, 큰 글씨,
  가로 회전, 장시간 메모리와 실제 FPS를 확인해야 한다.
- Node VM / Native Canvas는 브라우저가 아니다. 목표 30FPS 달성은 미검증.
  기준선도 테스트 환경에서 33.3ms를 초과했다. 성능 수치는 조건과 함께 보고한다.
- Render build: `pip install -r requirements.txt && python -m compileall -q server.py admin.py storage.py`
- Start: `python server.py`.
- `render.yaml`은 기존 서비스 설정을 자동으로 업데이트하는 보장이 없다.
  운영 서비스는 과거 Node 런타임으로 만들어졌지만 Python 명령으로 동작했다.
- 자동 배포 설정이 켜져 있어도 과거 새 커밋 배포가 시작되지 않은 경우가 있었다.
  푸시 후 반드시 Render 배포 커밋과 Live 상태를 확인한다. 중복 배포하지 않는다.
- 운영 접속 확인은 `/healthz`, `/api/chat`, 변경한 정적 파일로 한다.
  키·쿠키·사용자 채팅 전문을 로그로 출력하지 않는다.


## Chat snowfall and tree collision (2026-11-16)

- `chat-snow.js` reuses the latest public chat snapshot from `chat.js`; no new API, database writes or storage.
- A random short excerpt falls across the scene, including above the tree. Initial delay 4-7 seconds; subsequent spawn opportunities every 7-12 seconds, subject to the active limit.
- Mobile: one active message, up to 12 graphemes, 18 burst particles. Desktop: two messages, up to 22 graphemes, 28 particles. Width fitting may shorten excerpts further.
- Swept collision against the current visible tree depth/opacity buffer breaks the message into letter fragments and snow sparks; fragments disperse and fade over 1.6 seconds.
- Shares scene time, pause, replay, reduced-motion default and hidden-tab scheduling. Tree buffers are read-only.
- Visibility fix: render chat snow after the scene and bloom, without foreground erasure masks. User requested visible messages/fragments around the tree and village; only actual tree contact triggers a burst. Particles can temporarily overlay tree pixels; isolated tree pixels and underlying buffers remain unchanged.
- Removed messages disappear when the next successful chat snapshot arrives. Decorative excerpts are Canvas text, never HTML.
- `server.py` only adds the new JS file to its static asset allowlist. Restart an existing local server to serve it.
- Run `node test_chat_snow.cjs`, existing Node/server tests and `test_visual.cjs` with CANVAS_MODULE as above. Real phone/browser appearance still needs review.
- User authorized committing and pushing this feature. Verify GitHub main for publication and Render separately for deployment status.
- Integrity checks passed: Git objects, JS/Python syntax, existing Node and Python tests, collision particles, and tree preservation at 3 resolutions / 10 times. Actual browser/phone performance remains unverified.

- Visibility follow-up: falling excerpts and impact fragments now have a dark outline so bright snow/windows do not wash out their letters. Overlay ordering and tree collision behavior are preserved. Not yet published; real phone appearance still needs review.
