# MacKuro

macOS 전용 AI 개발 워크스페이스입니다. 검은 고양이와 해골 투구를 콘셉트로 하며, Claude가 코딩을 담당하고 Codex가 리뷰와 리서치를 담당합니다.

## 실제 기능 화면

최근 MacKuro 실행 화면입니다. 왼쪽 프로젝트 바에서 여러 프로젝트를 오가며,
Claude 터미널, Codex Review, Worktree 변경사항, Dev Server 터미널과 콘솔을 한 화면에서 확인할 수 있습니다.

![MacKuro 프로젝트 바·Claude·Codex 화면](docs/mackuro-workspace.png)

툴바 왼쪽 버튼이나 `⌘B`로 프로젝트 바를 닫으면 패널이 전체 폭으로 넓어집니다.

![프로젝트 바를 닫은 화면](docs/mackuro-sidebar-hidden.png)

프로젝트 바 아래의 `일괄` 버튼이나 `⌘⇧↵`로 일괄 전송 패널을 엽니다. 체크한 프로젝트의 Claude에 같은 프롬프트를 한 번에 보내고,
자주 쓰는 프롬프트는 프리셋으로 저장해 클릭 한 번으로 불러옵니다(✎로 이름·내용 수정, 삭제).
아래 전송 기록에는 언제 어떤 프롬프트를 어느 프로젝트에 보냈고 결과가 어땠는지 최근 30건이 남으며, 클릭하면 다시 불러오거나 프리셋으로 저장할 수 있습니다.

![일괄 전송 패널 — 프리셋과 전송 기록](docs/mackuro-broadcast.png)

## 구성

- 프로젝트 바: 여러 프로젝트를 동시에 열고 전환 (각 프로젝트의 Claude·터미널은 계속 실행)
- 일괄 전송: 여러 프로젝트의 Claude에 같은 프롬프트 전송, 프롬프트 프리셋과 전송 기록
- Claude Code: macOS zsh 기반 인터랙티브 터미널
- Codex: `codex exec` 기반 Review / Research 패널
- Dev Server: 여러 개의 독립적인 zsh 터미널 탭
- 공유 브라우저: Chrome 또는 Edge CDP 연결
- Agy IDE 확장: 코드와 진단 정보를 MacKuro로 전송
- Playwright MCP: MacKuro가 띄운 Claude에만 `--mcp-config`로 전달 (전역 `~/.claude.json`은 건드리지 않음)

## 단축키

| 단축키 | 동작 |
|---|---|
| `⌘1` … `⌘9` | 프로젝트 전환 |
| `⌘O` | 프로젝트 열기 |
| `⌘⇧W` | 현재 프로젝트 닫기 |
| `⌘B` | 프로젝트 바 열기 / 닫기 |
| `⌘⇧↵` | 일괄 전송 패널 열기 / 닫기 |

## 요구사항

- macOS
- Node.js 18 이상
- Claude Code CLI (`claude`)
- Codex CLI 또는 ChatGPT macOS 앱
- Git
- 선택: Google Chrome, Antigravity IDE

## 실행

```bash
npm install
npm run dev
```

Codex는 `/Applications/ChatGPT.app/Contents/Resources/codex`, `~/.local/bin/codex`, PATH의 `codex` 순서로 탐색합니다.

## 패키징

```bash
npm run package
```

DMG와 ZIP이 `kuro-dist/`에 생성됩니다.

## Agy IDE 확장

```bash
cd agy-extension
npm install
npm run build
npx @vscode/vsce package --no-dependencies
```

MacKuro 앱이 실행되면 확장이 `127.0.0.1:7890`으로 선택 코드와 진단 정보를 전송합니다. 요청은 `~/.kuro/token` 세션 토큰으로 인증됩니다.

## 주요 흐름

프로젝트를 열면 `package.json`의 `dev`, `start`, `serve`, `preview` 스크립트를 감지하고, MacKuro 전용 Playwright MCP 설정으로 Claude와 첫 번째 Dev Server 터미널을 실행합니다. Codex 패널에서는 변경사항 리뷰, 기술 리서치, 터미널 선택 영역 전송을 사용할 수 있습니다.
