# Development

See [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md) for additional guidelines.

## Setup

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
npm install
npm run build
```

Run from source:

```bash
/path/to/pi-mono/pi-test.sh
```

The script can be run from any directory. Pi keeps the caller's current working directory.

## Forking / Rebranding

This repository is already rebranded as **my-pi**:

```json
{
  "piConfig": {
    "name": "my-pi",
    "configDir": ".my-pi"
  },
  "bin": {
    "my-pi": "dist/cli.js"
  }
}
```

`name`, `configDir`, and `bin` affect CLI banner, config paths, and environment variable names. Non-alphanumeric characters in `name` are sanitized to underscores for env prefixes (`my-pi` → `MY_PI_CODING_AGENT_DIR`).

## Path Resolution

Three execution modes: npm install, standalone binary, tsx from source.

**Always use `src/config.ts`** for package assets:

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

Never use `__dirname` directly for package assets.

## Debug Command

`/debug` (hidden) writes to `~/.pi/agent/pi-debug.log`:
- Rendered TUI lines with ANSI codes
- Last messages sent to the LLM

## Testing

```bash
./test.sh                         # Run non-LLM tests (no API keys needed)
npm test                          # Run all tests
npm test -- test/specific.test.ts # Run specific test
```

## Project Structure

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```
