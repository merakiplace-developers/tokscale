# Tokscale 팀 전용 리더보드 셀프호스팅 가이드

Vercel + Supabase 를 사용하여 팀 전용 tokscale 리더보드를 구성하는 가이드입니다.

---

## 아키텍처 개요

```
팀원 PC                        Vercel                    Supabase
┌──────────────┐          ┌──────────────────┐     ┌──────────────┐
│ tokscale CLI │──submit──▶│ Next.js Frontend │────▶│  PostgreSQL  │
│              │          │ (API + UI)       │     │              │
│ TOKSCALE_API │          │                  │◀────│              │
│ _URL 설정    │          └──────────────────┘     └──────────────┘
└──────────────┘                 │
                                 │ OAuth
                                 ▼
                          ┌──────────────┐
                          │ GitHub OAuth  │
                          │ Google OAuth  │
                          └──────────────┘
```

---

## 사전 준비

- GitHub 계정
- Vercel 계정 (https://vercel.com — Hobby 플랜 무료)
- Supabase 계정 (https://supabase.com — Free 플랜 무료)

---

## Step 1: Supabase 프로젝트 생성

1. https://supabase.com/dashboard 에서 **New Project** 클릭
2. 프로젝트 설정:
   - **Name**: `tokscale-team` (원하는 이름)
   - **Database Password**: 강력한 비밀번호 설정 (기록해 둘 것)
   - **Region**: 팀원에게 가까운 리전 선택 (예: `Northeast Asia (Tokyo)`)
3. 프로젝트 생성 완료 후 **Connection URI** 확인:
   - Supabase Dashboard → 좌측 사이드바 **Connect** (플러그 아이콘) 클릭
   - 또는 **Project Settings → Database → Connection string** 섹션 이동
   - **Connection Pooler** 탭 선택 → **Mode**를 `Transaction` 으로 변경
   - **URI** 탭에서 connection string 복사:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```
   - 포트가 `6543` (Pooler)인지 확인 — `5432` (Direct)가 아님

> **중요**: `[YOUR-PASSWORD]` 부분을 Step 2에서 설정한 DB 비밀번호로 교체하세요.

### 왜 Transaction Mode Pooler인가?

Vercel Serverless 함수는 요청마다 새 커넥션을 열 수 있습니다. Direct 연결(`5432`)을 사용하면 동시 접속 수가 Supabase Free 플랜 한도를 빠르게 초과합니다. Transaction Mode Pooler(`6543`)는 커넥션을 재사용하여 이 문제를 방지합니다.

---

## Step 2: OAuth 설정 (GitHub + Google)

로그인은 GitHub과 Google Workspace 중 하나 또는 둘 다 지원합니다. 같은 이메일이면 자동으로 동일 계정으로 연결됩니다.

### 2-1. GitHub OAuth App

1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**
2. 설정:
   - **Application name**: `Tokscale Team Leaderboard`
   - **Homepage URL**: `https://your-project.vercel.app` (나중에 수정 가능)
   - **Authorization callback URL**: `https://your-project.vercel.app/api/auth/github/callback`
3. **Client ID** 및 **Client Secret** 복사

### 2-2. Google OAuth (선택사항)

1. https://console.cloud.google.com → **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID** (Web application)
3. **Authorized redirect URI**: `https://your-project.vercel.app/api/auth/google/callback`
4. **Client ID** 및 **Client Secret** 복사
5. **OAuth consent screen**: Workspace 조직 내부 전용이면 `Internal`로 설정

> 배포 후 Vercel 도메인이 확정되면 callback URL을 업데이트하세요.

---

## Step 3: Vercel에 배포

### 3-1. GitHub에 Fork 또는 Private Repo 생성

tokscale 레포를 팀 조직의 GitHub에 fork하거나, `packages/frontend` 디렉토리만 별도 repo로 구성합니다.

**옵션 A — 전체 레포 Fork (간단)**:
```bash
# GitHub에서 fork 후
git clone https://github.com/your-org/tokscale.git
```

**옵션 B — Frontend만 별도 레포 (경량)**:
```bash
mkdir tokscale-leaderboard && cd tokscale-leaderboard
cp -r /path/to/tokscale/packages/frontend/* .
git init && git add . && git commit -m "init: tokscale team leaderboard"
# GitHub에 새 repo 생성 후 push
```

### 3-2. Vercel 프로젝트 설정

1. https://vercel.com/new 에서 **Import Git Repository**
2. 위에서 준비한 repo 선택

3. **Build & Development Settings**:

   | 설정 | 옵션 A (전체 레포) | 옵션 B (Frontend만) |
   |------|-------------------|---------------------|
   | **Framework Preset** | Next.js | Next.js |
   | **Root Directory** | `packages/frontend` | `.` (기본값) |
   | **Build Command** | (기본값) | (기본값) |

4. **Environment Variables** 추가:

   | Key | Value | 비고 |
   |-----|-------|------|
   | `DATABASE_URL` | `postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres` | Supabase Pooler URI |
   | `GITHUB_CLIENT_ID` | Step 2-1에서 복사한 Client ID | |
   | `GITHUB_CLIENT_SECRET` | Step 2-1에서 복사한 Client Secret | |
   | `GITHUB_ALLOWED_ORG` | `your-org-name` | 선택: 특정 GitHub 조직 멤버만 허용 |
   | `GOOGLE_CLIENT_ID` | Step 2-2에서 복사한 Client ID | 선택: Google 로그인 사용 시 |
   | `GOOGLE_CLIENT_SECRET` | Step 2-2에서 복사한 Client Secret | 선택: Google 로그인 사용 시 |
   | `GOOGLE_ALLOWED_DOMAIN` | `your-company.com` | 선택: 특정 Workspace 도메인만 허용 |
   | `NEXT_PUBLIC_URL` | `https://your-project.vercel.app` | 배포 후 확정되면 수정 |
   | `AUTH_SECRET` | 랜덤 문자열 (32자 이상) | `openssl rand -hex 32` 로 생성 |

5. **아직 Deploy 클릭하지 마세요!** — 먼저 DB 테이블을 생성해야 합니다.

### 3-3. DB 마이그레이션 실행 (배포 전 필수!)

> **반드시 Vercel 첫 배포 전에 실행하세요.** Next.js 빌드 시 정적 페이지를 prerender하면서 DB를 조회합니다. 테이블이 없으면 `relation "submissions" does not exist` 오류로 빌드가 실패합니다.

로컬에서 실행:

```bash
cd packages/frontend  # 또는 옵션 B의 경우 프로젝트 루트

# Supabase DB URL을 환경변수로 설정
export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres"

# drizzle-kit으로 스키마를 DB에 push
npx drizzle-kit push
```

> `push`는 현재 schema.ts 정의를 DB에 직접 적용합니다. 프로덕션에서는 `migrate`를 사용하지만, 초기 셋업에서는 `push`가 간편합니다.

테이블 생성 확인:
```bash
# Supabase Dashboard → SQL Editor 에서 실행하여 테이블 존재 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

`users`, `submissions`, `daily_breakdown`, `sessions`, `api_tokens` 테이블이 모두 보여야 합니다.

### 3-4. Vercel 배포 실행

테이블 생성을 확인했으면 Vercel Dashboard로 돌아가서 **Deploy** 클릭합니다.

### 3-5. 배포 확인 및 URL 업데이트

1. Vercel 배포 완료 후 할당된 URL 확인 (예: `tokscale-team.vercel.app`)
2. **Vercel**: Environment Variables에서 `NEXT_PUBLIC_URL` 업데이트 → Redeploy
3. **OAuth App callback URL 업데이트**:
   - GitHub: `https://tokscale-team.vercel.app/api/auth/github/callback`
   - Google: `https://tokscale-team.vercel.app/api/auth/google/callback`

---

## Step 4: 팀원 CLI 설정

각 팀원이 자신의 환경에 전용 리더보드 URL을 설정합니다.

### 4-1. 환경변수 설정

쉘 설정 파일(`~/.zshrc` 또는 `~/.bashrc`)에 추가:

```bash
export TOKSCALE_API_URL=https://tokscale-team.vercel.app
```

설정 적용:
```bash
source ~/.zshrc
```

### 4-2. 팀 전용 인스턴스에 로그인

```bash
tokscale login
```

브라우저가 열리면 GitHub 또는 Google 중 원하는 방법으로 로그인합니다.

> **주의**: 기존 공개 리더보드(`tokscale.ai`)와 별개의 인증입니다. `TOKSCALE_API_URL`이 설정된 동안에는 팀 인스턴스로만 로그인/제출됩니다.

### 4-3. 데이터 제출

```bash
tokscale submit
```

팀 전용 리더보드에 데이터가 제출됩니다.

### 4-4. 공개 리더보드와 동시 사용 (선택사항)

두 리더보드에 모두 제출하고 싶다면 alias를 활용합니다:

```bash
# ~/.zshrc 에 추가
alias tokscale-team="TOKSCALE_API_URL=https://tokscale-team.vercel.app tokscale"

# 사용법
tokscale submit          # 공개 리더보드 (tokscale.ai)
tokscale-team submit     # 팀 전용 리더보드
```

---

## Step 5: 커스텀 도메인 설정 (선택사항)

1. Vercel Dashboard → **Settings → Domains**
2. 커스텀 도메인 추가 (예: `leaderboard.yourteam.com`)
3. DNS 레코드 설정 (Vercel이 안내하는 CNAME 레코드 추가)
4. `NEXT_PUBLIC_URL`과 OAuth callback URL들을 커스텀 도메인으로 업데이트

---

## 비용 참고

| 서비스 | Free 플랜 한도 | 유료 전환 시점 |
|--------|---------------|--------------|
| **Vercel** (Hobby) | 100GB bandwidth/월, Serverless 실행 시간 100GB-Hrs | 팀 규모 커지면 Pro $20/월 |
| **Supabase** (Free) | 500MB DB, 1GB file storage, 50K MAU | DB 500MB 초과 시 Pro $25/월 |

소규모 팀(~20명)이라면 Free 플랜으로 충분합니다.

---

## 트러블슈팅

### 빌드 실패: `relation "submissions" does not exist`

```
Error occurred prerendering page "/"
d: relation "submissions" does not exist
Export encountered an error on /(main)/page: /, exiting the build.
```

**원인**: Vercel 빌드 시 Next.js가 정적 페이지를 prerender하면서 DB의 `submissions` 테이블을 조회하는데, 아직 테이블이 생성되지 않은 상태입니다.

**해결**:

1. 로컬에서 DB 마이그레이션을 먼저 실행합니다 (Step 3-3 참고):
   ```bash
   cd packages/frontend
   export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres"
   npx drizzle-kit push
   ```

2. 테이블이 정상 생성되었는지 확인합니다:
   - Supabase Dashboard → **SQL Editor** 에서 실행:
     ```sql
     SELECT tablename FROM pg_tables WHERE schemaname = 'public';
     ```
   - `users`, `submissions`, `daily_breakdown`, `sessions`, `api_tokens` 가 모두 보여야 합니다.

3. Vercel Dashboard에서 **Redeploy** (또는 이미 실패한 첫 배포를 다시 트리거):
   - 해당 배포의 **⋮** 메뉴 → **Redeploy** 클릭

### 빌드 실패: 페이지 prerender 60초 타임아웃

```
Failed to build /(main)/page: / (attempt 1 of 3) because it took more than 60 seconds.
Failed to build /(main)/page: / after 3 attempts.
Export encountered an error on /(main)/page: /, exiting the build.
```

**원인**: Next.js 빌드 시 홈페이지를 정적으로 prerender하면서 DB에 연결을 시도하지만, Vercel 빌드 서버에서 Supabase DB로의 연결이 차단되어 타임아웃됩니다. 리전 간 지연(100~200ms)으로는 60초 타임아웃이 발생하지 않으므로, 연결 자체가 막히고 있는 것이 원인입니다.

**해결 방법 (순서대로 시도)**:

**방법 1 — Supabase 네트워크 제한 해제 (권장)**

1. Supabase Dashboard → **Project Settings → Network**
2. **Network Restrictions** 또는 **Allowed IP addresses** 섹션 확인
3. 제한이 활성화되어 있다면:
   - **모든 IP 허용**으로 변경 (`0.0.0.0/0`)
   - 또는 Vercel의 빌드 서버 IP 대역을 추가 (단, Vercel 빌드 IP는 고정되지 않아 권장하지 않음)
4. Vercel Dashboard에서 **Redeploy**

**방법 2 — Connection Pooler URI 및 타임아웃 확인**

1. Supabase Dashboard → **Connect** → **Connection Pooler** 탭
2. URI가 `pooler.supabase.com` 포트 `6543`을 사용하는지 확인 (Direct 연결 `5432`가 아님)
3. `DATABASE_URL` 끝에 `?connect_timeout=30` 파라미터 추가:
   ```
   postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?connect_timeout=30
   ```

**로컬에서 DB 연결 확인하기**

Vercel에 배포하기 전에, 로컬 환경에서 Pooler URI로 정상 접속되는지 먼저 확인합니다.

```bash
# 1. psql로 직접 연결 테스트 (PostgreSQL 클라이언트 필요)
psql "postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?sslmode=require"
```

접속 성공 시 `postgres=>` 프롬프트가 나타납니다. 간단한 쿼리로 테이블 확인:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
\q
```

psql이 설치되어 있지 않다면 Node.js로 확인할 수 있습니다:

```bash
# 2. Node.js one-liner로 연결 테스트
node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10 });
  sql\`SELECT 1 as ok\`.then(r => { console.log('연결 성공:', r); process.exit(0); })
    .catch(e => { console.error('연결 실패:', e.message); process.exit(1); });
"
```

> `packages/frontend` 디렉토리에서 실행해야 `postgres` 패키지를 찾을 수 있습니다.

```bash
# 3. drizzle-kit으로 연결 + 스키마 확인 동시 테스트
cd packages/frontend
export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?sslmode=require"
npx drizzle-kit studio
```

브라우저에서 Drizzle Studio(`https://local.drizzle.studio`)가 열리고 테이블 데이터를 조회할 수 있으면 연결이 정상입니다.

**연결 실패 시 확인 사항**:
- `timeout`/`ETIMEDOUT` → Supabase 네트워크 제한 확인 (방법 1)
- `password authentication failed` → DB 비밀번호가 URI에 올바르게 인코딩되었는지 확인 (특수문자는 URL 인코딩 필요, 예: `@` → `%40`)
- `SSL` 관련 오류 → URI 끝에 `?sslmode=require` 추가

**로컬 psql은 성공하지만 Vercel 빌드에서 타임아웃이 발생하는 경우**

psql로 접속은 되지만 Vercel 배포 시 여전히 60초 타임아웃이 발생한다면, 아래 순서로 원인을 좁혀갑니다.

**Step A — 로컬에서 Vercel 빌드를 재현하여 문제 격리**

로컬에서 Vercel과 동일하게 `next build`를 실행하면, 문제가 DB 연결인지 빌드 환경인지 구분할 수 있습니다:

```bash
cd packages/frontend

# Vercel에 설정한 것과 동일한 환경변수를 사용
export DATABASE_URL="postgresql://postgres.[ref]:[pw]@...pooler.supabase.com:6543/postgres?sslmode=require"
export GITHUB_CLIENT_ID="your_client_id"
export GITHUB_CLIENT_SECRET="your_client_secret"
export NEXT_PUBLIC_URL="http://localhost:3000"

# 프로덕션 빌드 실행 (Vercel이 하는 것과 동일)
DB_POOL_MAX=5 npx next build
```

결과에 따라:
- **로컬 빌드도 타임아웃** → Step B로
- **로컬 빌드는 성공** → Vercel 빌드 서버에서 Supabase로의 네트워크가 차단됨 (Step C로)

**Step B — Vercel 빌드 서버의 아웃바운드 연결 확인**

로컬 빌드는 성공하지만 Vercel에서만 실패한다면, Vercel 빌드 서버에서 Supabase Pooler 포트(`6543`)로의 TCP 연결이 막힌 것입니다.

확인할 사항:
1. **Supabase SSL 강제 모드**: Supabase Dashboard → **Settings → Database → SSL Configuration**
   - `Enforce SSL` 이 활성화되어 있는지 확인. 활성화 상태가 정상이며, `DATABASE_URL`에 `?sslmode=require`가 있어야 합니다.

2. **Supabase Network Restrictions 재확인**: Supabase Dashboard → **Settings → Network**
   - "Restrictions applied"가 표시되면 제한이 활성화된 것. **Remove restrictions**를 눌러 해제
   - Supabase Free 플랜은 IPv4 제한이 기본 비활성이지만, 프로젝트 생성 시 설정에 따라 달라질 수 있음

3. **Vercel 환경변수 값 확인**: Vercel Dashboard → **Project Settings → Environment Variables**
   - `DATABASE_URL` 값이 로컬에서 테스트한 것과 정확히 동일한지 확인
   - 복사 과정에서 앞뒤 공백이나 줄바꿈이 포함되지 않았는지 확인
   - Vercel UI에서 값을 복사한 뒤 로컬에서 그 값으로 psql 접속 테스트:
     ```bash
     # Vercel에서 복사한 값을 그대로 붙여넣기
     psql "여기에_Vercel에서_복사한_DATABASE_URL_값"
     ```

**Step C — 정적 prerender 건너뛰기**

위 방법으로도 해결되지 않거나, 빠르게 배포를 진행해야 할 경우 홈페이지를 빌드 시점이 아닌 런타임에 렌더링하도록 변경합니다.

`packages/frontend/src/app/(main)/page.tsx` 파일 상단에 추가:
```typescript
export const dynamic = "force-dynamic";
```

이렇게 하면 빌드 시 DB 연결을 하지 않고, 요청 시점에 서버에서 렌더링합니다. 첫 방문 시 약간 느릴 수 있지만 빌드는 성공합니다.

### DB 커넥션 풀 경합으로 인한 쿼리 멈춤

**증상**: `getLeaderboardData(tokens)`는 정상 완료되지만 `getLeaderboardData(cost)`가 응답 없이 멈추거나, 여러 DB 쿼리를 동시에 실행할 때 일부만 완료되고 나머지가 타임아웃됨.

**원인**: 앱의 DB 커넥션 풀이 `max: 1`로 설정되어 있어, 동시에 발행된 여러 쿼리가 단일 커넥션을 순차 대기합니다. Supabase Transaction Mode Pooler와 결합되면, 한 배치의 쿼리가 완료된 후 서버 측 커넥션이 즉시 재할당되지 않아 다음 쿼리가 무한 대기에 빠질 수 있습니다.

**배경 — 왜 `max: 1`인가?**

Vercel Serverless 환경에서는 각 함수 인스턴스가 자체 커넥션 풀을 생성합니다. 동시 cold-start가 수십 개 발생하면 `max: 5`로도 Supabase Free 플랜의 최대 연결 수(직접 연결 60개, Pooler 클라이언트 200개)를 빠르게 초과합니다. 그래서 런타임에서는 `max: 1`이 안전합니다.

하지만 **빌드 시점**에는 단일 프로세스에서 여러 페이지를 prerender하므로 동시 쿼리가 필요하고, `max: 1`이 병목이 됩니다.

| Supabase 플랜 | 최대 직접 연결 | 최대 Pooler 클라이언트 |
|--------------|-------------|-------------------|
| Free (Nano/Micro) | 60 | 200 |
| Pro (Small) | 90 | 400 |
| Pro (Medium) | 120 | 600 |

**해결 — `DB_POOL_MAX` 환경변수로 상황별 커넥션 수 제어**

`src/lib/db/index.ts`는 `DB_POOL_MAX` 환경변수로 풀 크기를 오버라이드할 수 있습니다:

```typescript
max: parseInt(process.env.DB_POOL_MAX || "1", 10),
```

환경별 권장 값:

| 환경 | `DB_POOL_MAX` | 이유 |
|------|-------------|------|
| **Vercel 런타임** (기본) | 설정하지 않음 (기본값 `1`) | 인스턴스 수 × max가 Pooler 한도를 초과하지 않도록 |
| **Vercel 빌드** | `5` | 빌드는 단일 프로세스, 동시 prerender에 충분 |
| **로컬 개발/빌드** | `5` | 로컬은 단일 프로세스이므로 여유롭게 설정 |

**Vercel에서 빌드 전용으로 설정하는 방법**:

Vercel의 Build Command를 오버라이드하여 빌드 시에만 풀 크기를 높입니다:

1. Vercel Dashboard → **Project Settings → Build & Development Settings**
2. **Build Command** Override 활성화
3. 다음 값 입력:
   ```bash
   DB_POOL_MAX=5 next build
   ```

이렇게 하면:
- **빌드 시**: `max: 5` — prerender의 동시 쿼리가 정상 처리
- **런타임**: `max: 1` — serverless 인스턴스가 Pooler 한도를 초과하지 않음

**로컬에서 빌드할 때**:

```bash
cd packages/frontend
DB_POOL_MAX=5 npx next build
```

**Supabase 측 풀 사이즈 확인**:

Supabase의 서버 측 풀 사이즈도 너무 작으면 클라이언트의 `max` 값과 무관하게 대기가 발생합니다:

1. Supabase Dashboard → **Project Settings → Database → Connection Pooling**
2. **Pool Size** 확인 — Free 플랜 기본값은 15
3. Vercel 인스턴스 수 × `DB_POOL_MAX` < Pool Size를 유지

### DB 연결 오류

```
Error: connect ECONNREFUSED
```
- Supabase에서 **Transaction Mode Pooler** URI(포트 `6543`)를 사용하고 있는지 확인
- `?sslmode=require`가 URI 끝에 있는지 확인 (없으면 추가)

### OAuth 콜백 실패

```
Error: redirect_uri_mismatch
```
- 각 OAuth App의 callback URL이 정확한지 확인:
  - GitHub: `https://[your-domain]/api/auth/github/callback`
  - Google: `https://[your-domain]/api/auth/google/callback`
- `NEXT_PUBLIC_URL` 환경변수와 일치하는지 확인

### CLI 로그인 시 기존 인스턴스로 연결됨

- `echo $TOKSCALE_API_URL`로 환경변수가 올바르게 설정되었는지 확인
- `~/.config/tokscale/credentials.json`을 삭제하고 다시 `tokscale login` 실행
  - **주의**: 이렇게 하면 기존 공개 리더보드 인증도 삭제됩니다. 동시 사용하려면 Step 4-4의 alias 방식을 사용하세요.

### Drizzle push 시 SSL 오류

```bash
# SSL 인증서 검증 문제 시
export NODE_TLS_REJECT_UNAUTHORIZED=0  # 개발 시에만 사용
npx drizzle-kit push
```
또는 DATABASE_URL에 `?sslmode=require` 파라미터 추가.
