# SilentEdit

Silently edit a message without showing the (edited) tag, bypassing message loggers.

## How it works

Sends a new message using the original message's ID as the nonce, which causes Discord's client to visually replace the original without triggering the edit system.

## Installation

Paste the plugin URL into Revenge's plugin installer:
```
https://vd-plugins.github.io/proxy/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/SilentEdit
```

## Building

```sh
pnpm install
pnpm build
```

The built files will be in `dist/`.

## Usage

Long-press any message you sent → tap **Silent Edit** → edit normally and confirm.
