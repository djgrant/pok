pok is designed for modern terminal emulators with Unicode and color support.

## Recommended Terminals

These terminals are fully supported:

| Terminal         | Platform       | Notes       |
| ---------------- | -------------- | ----------- |
| iTerm2           | macOS          | Recommended |
| Warp             | macOS          | Recommended |
| Terminal.app     | macOS          | Built-in    |
| Windows Terminal | Windows        | Recommended |
| Alacritty        | Cross-platform |             |
| Kitty            | Cross-platform |             |
| Hyper            | Cross-platform |             |

## Feature Requirements

### Unicode Support

pok uses Unicode symbols for visual feedback:

| Symbol | Meaning       | Fallback |
| ------ | ------------- | -------- |
| ◇      | Success       | [OK]     |
| ■      | Error         | [ERR]    |
| ▲      | Warning       | [WARN]   |
| ●      | Info          | [INFO]   |
| ┌└│    | Group borders | []       |
| ✔      | Done          | Done     |
| ✘      | Failed        | Failed   |

If your terminal doesn't display these correctly, use `--no-unicode` mode.

### Color Support

pok uses ANSI colors for status indication:

- Green: Success
- Red: Error/Failure
- Yellow: Warning
- Blue: Info
- Cyan: Step

Disable with `--no-color` or set `NO_COLOR=1`.

### Minimum Terminal Size

For the best experience:

- Width: 80 columns minimum (120 recommended)
- Height: 24 rows minimum

The tabs TUI requires:

- Width: 100 columns recommended
- Height: 30 rows recommended

## Fallback Modes

### No Unicode Mode (`--no-unicode`)

Disables Unicode symbols and uses ASCII fallbacks:

```
[Build]
  [OK] Compile
  [OK] Bundle
[Done]
```

Enable with:

```bash
mycli build --no-unicode
```

### No-Color Mode (`--no-color`)

Disables colors but keeps Unicode symbols:

```bash
mycli build --no-color
# or
NO_COLOR=1 mycli build
```

### No-TTY Mode (`--no-tty`)

Disables interactive menus and spinners for non-interactive environments:

```bash
mycli build --no-tty
# or
NO_TTY=1 mycli build
```

### CI Environments

Setting `CI=true` enables `--no-tty` behavior by default.

## Troubleshooting

### Garbled Output

If you see escape codes like `[32m◇[39m`:

1. Ensure your terminal supports ANSI colors
2. Try `--no-color` mode
3. Check `TERM` environment variable is set correctly

### Missing Symbols

If you see boxes (□) instead of symbols:

1. Install a font with Unicode support (e.g., Fira Code, JetBrains Mono)
2. Use `--no-unicode` mode as fallback

### Spinner Not Animating

1. Ensure stdout is a TTY (`node -e "console.log(process.stdout.isTTY)"`)
2. Some CI environments disable TTY mode

## Environment Variables

| Variable       | Effect                          |
| -------------- | ------------------------------- |
| `NO_COLOR`     | Disables color output           |
| `NO_UNICODE`   | Disables Unicode symbols        |
| `NO_TTY`       | Disables interactive UI         |
| `CI`           | Enables `--no-tty` behavior     |
| `FORCE_COLOR`  | Forces color even in non-TTY    |
| `TERM`         | Terminal type detection         |
| `TERM_PROGRAM` | Terminal program detection      |
