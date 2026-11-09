# 로컬 PC를 게임 서버로 쓰기 (개발·비공개 데모 단계)

개발 단계에서는 게임 서버(`apps/game`)만 내 PC에서 돌리고, 나머지는 무료 티어 클라우드를 씁니다.

| 구성 요소        | 위치                                     |
| ---------------- | ---------------------------------------- |
| web, studio      | Vercel (Hobby)                           |
| DB·인증·스토리지 | Supabase (Free, 서울 리전)               |
| 음성             | LiveKit Cloud (무료 플랜)                |
| 게임 서버        | **내 PC** + Tailscale Funnel로 외부 공개 |

Vercel에 올린 web은 HTTPS라서 게임 서버도 `wss://` 주소가 필요합니다. 공유기 포트 포워딩 대신 터널을 씁니다.

## 1. 게임 서버 실행

```bash
cp apps/game/.env.example apps/game/.env   # Supabase·LiveKit 값 입력, 외부 공개 시 DEV_AUTH는 비움
pnpm install
pnpm game:serve                             # 빌드 후 실행, ws://localhost:2567
curl http://localhost:2567/health           # {"ok":true}
```

개발 중에는 `pnpm --filter @mm/game dev`로 코드 변경 시 자동 재시작할 수 있습니다.

## 2. 외부 공개: Tailscale Funnel (권장, 무료·고정 주소)

1. https://tailscale.com 에 가입하고 PC에 Tailscale을 설치해 로그인합니다.
2. 관리 콘솔에서 MagicDNS와 HTTPS Certificates를 켭니다 (DNS 설정 화면).
3. 터미널에서 실행합니다.

   ```bash
   tailscale funnel --bg 2567
   ```

   처음 실행하면 Funnel 사용 허용 링크가 나오니 열어서 승인합니다.
4. 출력된 주소(예: `https://my-pc.tail1234.ts.net`)를 web의 환경 변수에 넣습니다.
   `NEXT_PUBLIC_GAME_SERVER_URL=wss://my-pc.tail1234.ts.net`

주소가 PC 이름에 고정되므로 Vercel 환경 변수는 한 번만 넣으면 됩니다. 끌 때는 `tailscale funnel --bg 2567 off`(또는 `tailscale funnel reset`).

## 대안: Cloudflare Quick Tunnel (가입 불필요, 주소가 매번 바뀜)

```bash
cloudflared tunnel --url http://localhost:2567
```

`https://<무작위>.trycloudflare.com` 주소가 나옵니다. 실행할 때마다 주소가 바뀌어서 그때마다
Vercel의 `NEXT_PUBLIC_GAME_SERVER_URL`을 바꾸고 재배포해야 하므로, 잠깐 테스트할 때만 씁니다.

## 주의

- 플레이하는 동안 PC가 켜져 있고 절전 모드에 들어가지 않아야 합니다.
- 외부에 공개할 때는 `DEV_AUTH`를 비워서 Supabase 로그인 사용자만 접속하게 합니다.
- 진행 중인 방은 메모리에 있어서, 게임 서버를 재시작하면 진행 중인 게임이 끊깁니다.
- 공개 출시 단계에서는 같은 Docker 이미지(`infra/game.Dockerfile`)로 Fly.io 같은 관리형 서비스나 VM으로 옮깁니다.
