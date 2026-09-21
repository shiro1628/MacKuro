# MacKuro 실행 가이드

## 요구사항

- macOS
- Node.js 18+
- `claude` CLI
- Codex CLI 또는 ChatGPT macOS 앱
- Git
- 선택: Antigravity IDE, Chrome

## 설치와 실행

```bash
npm install
npm run dev
```

프로젝트 폴더를 열면 Claude 터미널과 감지된 Dev Server가 macOS zsh로 실행됩니다.

## Codex

Codex 패널은 현재 프로젝트를 작업 디렉터리로 사용해 `codex exec`를 실행합니다. Review와 Research 요청은 읽기 전용 샌드박스에서 처리하며, 응답은 실시간으로 표시됩니다.

## Antigravity IDE

툴바의 `Agy IDE` 버튼은 `/Applications/Antigravity.app` 또는 `/Applications/Antigravity IDE.app`으로 현재 프로젝트를 엽니다.

## 확장 설치

```bash
cd agy-extension
npm install
npm run build
npx @vscode/vsce package --no-dependencies
```

Antigravity IDE가 VS Code 호환 확장을 지원하는 경우 생성된 VSIX를 설치하면 에러와 선택 코드를 MacKuro로 전송할 수 있습니다.

## 패키징

```bash
npm run package
```

DMG와 ZIP이 `kuro-dist/`에 생성됩니다.
