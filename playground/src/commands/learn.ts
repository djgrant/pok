/**
 * Learn command for the pok playground
 *
 * This file runs INSIDE WebContainer (Node.js environment), not in the browser.
 * It uses console.log with ANSI codes for rich terminal output.
 *
 * The reporter utilities are inlined here because we can't import from browser modules.
 */

const { defineCommand } = require("@pokjs/core");
const { writeFileSync, mkdirSync, existsSync } = require("fs");
const { execSync } = require("child_process");

// ============================================================================
// Utilities
// ============================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// ANSI Escape Codes (Tokyo Night theme compatible)
// ============================================================================

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  brightBlue: "\x1b[94m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightMagenta: "\x1b[95m",
};

// Box drawing characters
const BOX = {
  topLeft: "\u256d",
  topRight: "\u256e",
  bottomLeft: "\u2570",
  bottomRight: "\u256f",
  horizontal: "\u2500",
  vertical: "\u2502",
  leftT: "\u251c",
  rightT: "\u2524",
  heavyHorizontal: "\u2501",
};

// Icons
const ICONS = {
  info: "\u2139",
  tip: "\u2728",
  warning: "\u26a0",
  success: "\u2714",
  error: "\u2718",
  bullet: "\u25cf",
  file: "\u{1F4C4}",
};

// ============================================================================
// File Event Emitter
// ============================================================================

/**
 * Emit a file event that the Terminal component will intercept.
 * Uses OSC (Operating System Command) escape sequence format.
 *
 * Format: \x1b]pok:file:<type>:<path>\x07
 * - \x1b] starts OSC
 * - \x07 (BEL) ends OSC
 */
function emitFileEvent(type, path) {
  console.log(`\x1b]pok:file:${type}:${path}\x07`);
}

/**
 * Set the terminal title using OSC escape sequence.
 * Format: \x1b]0;title\x07
 * 
 * Note: We use console.log instead of process.stdout.write because
 * WebContainer captures console.log more reliably. The newline is
 * stripped by the Terminal component's title extraction.
 */
function setTitle(title) {
  // Use console.log to ensure the escape sequence reaches the terminal output stream
  // The Terminal component will extract and strip this from the visible output
  console.log(`\x1b]0;${title}\x07`);
}

// ============================================================================
// Reporter Utilities (inlined for WebContainer)
// ============================================================================

const WIDTH = 60;

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function padRight(str, width) {
  const visibleLength = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLength);
  return str + " ".repeat(padding);
}

function wrapText(text, maxWidth) {
  const lines = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function horizontalLine(width) {
  return BOX.horizontal.repeat(width);
}

// ============================================================================
// Box Rendering
// ============================================================================

function renderBox(title, content, options) {
  const { borderColor, titleColor, icon, iconColor } = options;
  const innerWidth = WIDTH - 4;

  // Top border
  if (title) {
    const iconPart = icon ? `${iconColor || titleColor}${icon}${ANSI.reset}  ` : "";
    const titlePart = `${titleColor}${ANSI.bold}${title}${ANSI.reset}`;
    const headerContent = `  ${iconPart}${titlePart}`;
    const headerVisibleLen = stripAnsi(headerContent).length;
    const remainingWidth = Math.max(0, WIDTH - 2 - headerVisibleLen);

    console.log(
      `${borderColor}${BOX.topLeft}${horizontalLine(WIDTH - 2)}${BOX.topRight}${ANSI.reset}`
    );
    console.log(
      `${borderColor}${BOX.vertical}${ANSI.reset}${headerContent}${" ".repeat(remainingWidth)}${borderColor}${BOX.vertical}${ANSI.reset}`
    );
    console.log(
      `${borderColor}${BOX.leftT}${horizontalLine(WIDTH - 2)}${BOX.rightT}${ANSI.reset}`
    );
  } else {
    console.log(
      `${borderColor}${BOX.topLeft}${horizontalLine(WIDTH - 2)}${BOX.topRight}${ANSI.reset}`
    );
  }

  // Content
  const wrappedContent = wrapText(content, innerWidth);
  for (const line of wrappedContent) {
    const paddedLine = padRight(`  ${line}`, WIDTH - 2);
    console.log(
      `${borderColor}${BOX.vertical}${ANSI.reset}${paddedLine}${borderColor}${BOX.vertical}${ANSI.reset}`
    );
  }

  // Bottom border
  console.log(
    `${borderColor}${BOX.bottomLeft}${horizontalLine(WIDTH - 2)}${BOX.bottomRight}${ANSI.reset}`
  );
}

function infoBox(title, content) {
  renderBox(title, content, {
    borderColor: ANSI.blue,
    titleColor: ANSI.brightBlue,
    icon: ICONS.info,
    iconColor: ANSI.blue,
  });
}

function tipBox(content) {
  renderBox("Tip", content, {
    borderColor: ANSI.green,
    titleColor: ANSI.brightGreen,
    icon: ICONS.tip,
    iconColor: ANSI.yellow,
  });
}

function warningBox(content) {
  renderBox("Warning", content, {
    borderColor: ANSI.yellow,
    titleColor: ANSI.brightYellow,
    icon: ICONS.warning,
    iconColor: ANSI.yellow,
  });
}

// ============================================================================
// Code Block Rendering
// ============================================================================

function codeBlock(filename, code) {
  const codeLines = code.split("\n");
  const lineNumWidth = String(codeLines.length).length;
  const contentWidth = WIDTH - 4 - lineNumWidth - 3;

  // Top border with filename
  const fileLabel = ` ${filename} `;
  const topLineLen = WIDTH - 2 - fileLabel.length;
  const leftPad = 1;

  console.log(
    `${ANSI.dim}${BOX.topLeft}${horizontalLine(leftPad)}${ANSI.reset}${ANSI.cyan}${fileLabel}${ANSI.reset}${ANSI.dim}${horizontalLine(topLineLen - leftPad)}${BOX.topRight}${ANSI.reset}`
  );

  // Code lines with line numbers
  for (let i = 0; i < codeLines.length; i++) {
    const lineNum = String(i + 1).padStart(lineNumWidth, " ");
    let codeLine = codeLines[i];

    if (codeLine.length > contentWidth) {
      codeLine = codeLine.substring(0, contentWidth - 1) + "\u2026";
    }

    const paddedCode = padRight(codeLine, contentWidth);
    console.log(
      `${ANSI.dim}${BOX.vertical}${ANSI.reset} ${ANSI.dim}${lineNum}${ANSI.reset} ${ANSI.dim}\u2502${ANSI.reset} ${paddedCode}${ANSI.dim}${BOX.vertical}${ANSI.reset}`
    );
  }

  // Bottom border
  console.log(
    `${ANSI.dim}${BOX.bottomLeft}${horizontalLine(WIDTH - 2)}${BOX.bottomRight}${ANSI.reset}`
  );
}

// ============================================================================
// Step Indicator
// ============================================================================

function stepIndicator(current, total, title) {
  const line = BOX.heavyHorizontal.repeat(WIDTH);
  const stepText = `  Step ${current} of ${total}: ${title}`;

  console.log(`${ANSI.magenta}${line}${ANSI.reset}`);
  console.log(`${ANSI.magenta}${ANSI.bold}${stepText}${ANSI.reset}`);
  console.log(`${ANSI.magenta}${line}${ANSI.reset}`);
}

// ============================================================================
// Code Templates
// ============================================================================

const HELLO_CODE = `const { defineCommand } = require('@pokjs/core');

exports.command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.success('Hello from pok!');
  },
});
`;

const GREET_CODE = `const { z } = require('zod');
const { defineCommand } = require('@pokjs/core');

exports.command = defineCommand({
  label: 'Greet someone',
  context: {
    name: {
      from: 'flag',
      schema: z.string().describe('Name to greet'),
    },
  },
  run: async (r, { context }) => {
    r.reporter.success(\`Hello, \${context.name}!\`);
  },
});
`;

const DEV_CODE = `const { defineCommand } = require('@pokjs/core');

exports.command = defineCommand({
  label: 'Development servers',
  run: async (r) => {
    // Open multiple processes in tabs
    await r.tabs([
      r.exec('npm run server'),
      r.exec('npm run watch'),
    ]);
  },
});
`;

const TASK_CODE = `const { defineCommand, defineTask } = require('@pokjs/core');

// Define a reusable task
const greetTask = defineTask({
  input: { name: z.string() },
  run: async (r, { input }) => {
    r.reporter.info(\`Processing: \${input.name}\`);
    return { greeted: true };
  },
});

exports.command = defineCommand({
  label: 'Use tasks',
  run: async (r) => {
    // Run the task
    const result = await r.run(greetTask, { name: 'World' });
    r.reporter.success(\`Task completed: \${result.greeted}\`);
  },
});
`;

// ============================================================================
// Command Definition
// ============================================================================

exports.command = defineCommand({
  label: "Learn pok interactively",
  run: async (r) => {
    // Set initial title
    setTitle("pok learn");
    
    // Ensure commands directory exists
    if (!existsSync("commands")) {
      mkdirSync("commands");
      emitFileEvent("created", "commands");
    }

    // Welcome message
    console.log("");
    infoBox(
      "Welcome to pok",
      "pok is a framework for building beautiful CLI tools. It handles routing, validation, prompts, and multi-process terminals.\n\nThis tutorial will show you the basics."
    );
    console.log("");

    await sleep(500);

    while (true) {
      const choice = await r.prompter.select({
        message: "What would you like to learn?",
        options: [
          { value: "create", label: "Create your first command" },
          { value: "args", label: "Add flags and validation" },
          { value: "tabs", label: "Learn about tabs" },
          { value: "tasks", label: "Understand tasks" },
          { value: "exit", label: "Explore on your own" },
        ],
      });

      console.log("");

      if (choice === "exit") {
        setTitle("pok learn - Complete");
        stepIndicator(5, 5, "Explore freely");
        console.log("");

        infoBox(
          "You're ready!",
          "Your commands are in ./commands\n\nTry these:\n  pok         - see all commands\n  pok hello   - run hello command\n  pok --help  - see options"
        );

        console.log("");
        tipBox(
          "Edit files in the sidebar and watch them update. The shell tab is a full terminal."
        );
        console.log("");
        
        // Exit the process so the Terminal component can detect completion
        // and disable input. The shell tab remains available for exploration.
        process.exit(0);
      }

      if (choice === "create") {
        setTitle("pok learn - Commands");
        stepIndicator(1, 5, "Create your first command");
        console.log("");

        infoBox(
          "Commands",
          "Commands are the entry points to your CLI. Each file in commands/ becomes a command. The filename becomes the command name."
        );
        console.log("");

        console.log(`${ANSI.cyan}Creating${ANSI.reset} commands/hello.ts`);
        console.log("");

        writeFileSync("commands/hello.ts", HELLO_CODE);
        emitFileEvent("created", "commands/hello.ts");

        await sleep(300);

        codeBlock("commands/hello.ts", HELLO_CODE);
        console.log("");

        tipBox('The file is now visible in the sidebar. Click it to view the code.');
        console.log("");

        console.log(`${ANSI.dim}Running:${ANSI.reset} pok hello`);
        console.log("");

        await sleep(300);

        try {
          execSync("node_modules/.bin/pok hello", {
            stdio: "inherit",
            cwd: process.cwd(),
          });
        } catch (_e) {
          // Output already shown
        }

        console.log("");
        console.log(
          `${ANSI.green}${ICONS.success}${ANSI.reset}  Command created and executed!`
        );
        console.log("");
      }

      if (choice === "args") {
        setTitle("pok learn - Context");
        stepIndicator(2, 5, "Add flags and validation");
        console.log("");

        infoBox(
          "Context",
          "Context defines the inputs your command needs. Use 'from: flag' for CLI flags, or 'from: prompt' for interactive input. Zod schemas handle validation automatically."
        );
        console.log("");

        console.log(`${ANSI.cyan}Creating${ANSI.reset} commands/greet.ts`);
        console.log("");

        writeFileSync("commands/greet.ts", GREET_CODE);
        emitFileEvent("created", "commands/greet.ts");

        await sleep(300);

        codeBlock("commands/greet.ts", GREET_CODE);
        console.log("");

        console.log(`${ANSI.dim}Running:${ANSI.reset} pok greet --name World`);
        console.log("");

        await sleep(300);

        try {
          execSync("node_modules/.bin/pok greet --name World", {
            stdio: "inherit",
            cwd: process.cwd(),
          });
        } catch (_e) {
          // Output already shown
        }

        console.log("");
        tipBox(
          "Try running 'pok greet' without --name. It will prompt you!"
        );
        console.log("");
      }

      if (choice === "tabs") {
        setTitle("pok learn - Tabs");
        stepIndicator(3, 5, "Learn about tabs");
        console.log("");

        infoBox(
          "Tabs",
          "Tabs let you run multiple processes side by side. Perfect for dev servers, watchers, or any concurrent workflows."
        );
        console.log("");

        codeBlock("commands/dev.ts", DEV_CODE);
        console.log("");

        warningBox(
          "Tabs require a real terminal with PTY support. They won't work in this browser-based playground, but they're powerful in a real environment!"
        );
        console.log("");

        tipBox(
          "In a real terminal, use arrow keys to switch tabs and 'q' to quit."
        );
        console.log("");
      }

      if (choice === "tasks") {
        setTitle("pok learn - Tasks");
        stepIndicator(4, 5, "Understand tasks");
        console.log("");

        infoBox(
          "Tasks",
          "Tasks are reusable units of work. They have typed inputs and outputs, can be composed together, and are perfect for complex workflows."
        );
        console.log("");

        codeBlock("commands/use-task.ts", TASK_CODE);
        console.log("");

        tipBox(
          "Tasks can call other tasks, enabling powerful composition patterns."
        );
        console.log("");
      }

      await sleep(300);
    }
  },
});
