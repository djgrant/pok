# Playground Fresh Investigation

**Date:** 2024-12-29
**Approach:** Experienced the playground as a complete beginner, documented raw observations

---

## 1. The Actual User Journey (Step by Step)

### Landing
1. Page loads, shows "pok" logo with spinner
2. "Booting envi..." message (environment loading)
3. After ~5s, terminal appears with `pok learn` already running

### First Screen
4. See "Welcome to pok!" and description
5. Menu appears: 5 options to choose from
6. Arrow keys navigate, Enter selects

### Lesson 1: Your First Command
7. Text explains commands are TypeScript files in `commands/`
8. Shows code example
9. Asks "Would you like me to create this command for you?"
10. If yes: "Created commands/hello.ts"
11. **Critical moment:** "Now try running it! Exit this tutorial and type: `pok hello`"
12. Asked "Exit tutorial to try it now?"
13. If yes: Drops to shell prompt
14. User types `pok hello`
15. Output: "Hello, world!"
16. User types `pok learn` to continue

### Subsequent lessons
17. Similar pattern: explain concept, show code, offer to create file, exit to try

---

## 2. Where I Actually Got Confused

### Confusion #1: The Weird Path
- Immediately noticed `~/k03e2io1v3fx9wvj0vr8qd5q58o56n-fkdo` 
- This looks like a hash/temp directory
- **No context** about what this is or why it exists
- Creates immediate feeling of "I'm not in a real place"

### Confusion #2: What is "pok"?
- The very first screen says "Welcome to pok!" and "a modern CLI framework for building developer tools"
- This is AFTER I already saw the menu
- **I don't know what problem pok solves before I'm asked to choose what to learn**
- The header says "interactive tutorial" but I don't have context yet

### Confusion #3: "Exit this tutorial" - Exit to WHERE?
- When it says "Exit this tutorial and type: pok hello"
- I'm in a BROWSER. There's no "outside" to exit to.
- The language implies I need to leave and go somewhere else
- **Actually, I just drop to a shell prompt in the same terminal**
- This is a simulation, not a real terminal

### Confusion #4: "Created commands/hello.ts" - Where?
- It says it created a file
- But where? On my machine? In this browser simulation?
- **There's no visibility into the filesystem**
- I have no way to verify this happened

### Confusion #5: The Tab at the Top
- There's a tab labeled "pok interactive tutorial"
- This implies tabs are a thing
- But when I saw "Tabs (multi-process)" in the menu, I thought it was about THOSE tabs
- **The UI tabs and the pok tabs feature are conflated visually**

### Confusion #6: What Actually Happened vs What I Think Happened
- After going through the tutorial, I created `hello.ts` and ran it
- But I don't understand the relationship between:
  - The code I saw
  - The file that was "created"
  - The command that ran
  - Where any of this lives

---

## 3. The Core Conceptual Gap

**The feedback mentioned "confusion about creating commands in the CLI and running the CLI"**

Here's what I think this means:

### The Tutorial Teaches TWO Things At Once:
1. **How to CREATE pok commands** (writing TypeScript files)
2. **How to RUN pok commands** (typing `pok <command>` in terminal)

### The Confusion:
- When the tutorial says "create a command," it means "write a TypeScript file"
- When it says "run the command," it means "type `pok hello` in the terminal"
- But the tutorial ITSELF is a command (`pok learn`)
- And the tutorial CREATES commands by writing files
- And then you RUN those commands...

**The user doesn't know which layer they're on:**
- Am I using pok?
- Am I building with pok?
- Am I learning about pok?
- All three at once, and the boundaries are blurry

### The Simulated Environment Makes This Worse:
- In a REAL terminal, the mental model is clear:
  - I have a project directory
  - I create files
  - I run commands
- In this SIMULATED terminal:
  - There's no visible file explorer
  - The "files" aren't on my machine
  - The commands only exist in this sandbox
  - When I leave, it all disappears

---

## 4. Is There Too Much Text?

### Yes, but specifically:

**Lesson intro text is frontloaded:**
```
Commands in pok are TypeScript files in the commands/ directory.
Each file exports a command using defineCommand().

A command has two main parts:
  - label: A description shown in help
  - run: The function that executes when the command runs
```

- This is explanation BEFORE experience
- The user hasn't done anything yet
- They're reading documentation in a terminal

**The code examples are verbose:**
```javascript
const { defineCommand } = require('@pokjs/core');

exports.command = defineCommand({
  label: 'Say hello to the world',
  run: async (r) => {
    r.reporter.success('Hello, world!');
  },
});
```

- 8 lines of code before I've typed anything
- I'm reading, not doing

**Contrast with what would be simpler:**
1. "Type `pok hello`" [I type it]
2. "See? That ran a command. Let's look at how it works."
3. [Show the file]

---

## 5. What's the Simplest Possible Version?

### Remove:
1. **The menu** - Don't give 5 choices. Start with ONE path.
2. **The explanations before experience** - Show after doing
3. **The "would you like me to create" prompts** - Just create it
4. **The exit/re-enter pattern** - Keep user in one flow

### The Minimal Experience:

```
$ pok learn

Welcome to pok!

Let's create your first command.
[creates hello.ts automatically]

Done! Now run it:
$ pok hello
> Hello, world!

That command came from commands/hello.ts.
Type `cat commands/hello.ts` to see it.

[shows file contents]

That's pok. Commands are just TypeScript files.

Run `pok` to see what else is here.
```

**Key differences:**
- No choices
- No reading before doing
- Actions first, explanations after
- User sees cause and effect immediately

---

## 6. Hypothesis: The REAL Problem

**The playground is teaching pok like documentation, not like a tool.**

Traditional documentation approach:
1. Here's what pok is
2. Here's the concepts
3. Here's how commands work
4. Here's an example
5. Now try it yourself

Tool-learning approach:
1. Do this thing
2. See what happened
3. Here's why that worked
4. Do this other thing
5. Now you understand

**The current playground is #1 dressed up as #2.**

It LOOKS interactive (terminal, menus, typing commands) but it FEELS like reading docs (frontloaded explanations, step-by-step lessons, "Ready to see an example?" prompts).

---

## 7. Other Observations

### Things That Worked:
- The terminal itself is responsive and feels real
- Typing commands and seeing output is satisfying
- The `pok --help` output is clean and useful
- The "How was this made?" self-reference is clever

### Things That Felt Off:
- The 🎉 emoji after creating a file feels forced ("twee")
- "Progress: 1/4 lessons completed" gamifies something that shouldn't be gamified
- The Reset button requires confirmation but doesn't actually feel important
- The header takes up space without adding value

### The Fundamental Mismatch:
- The SPEC says "Terminal is king" and "Show, don't tell"
- But the implementation TELLS a lot before it SHOWS
- The terminal IS king visually, but the content is documentation

---

## Summary

**What users mean by "confused about creating commands vs running the CLI":**

They don't understand the relationship between:
1. The tutorial they're going through (which is a pok command)
2. The commands they're creating (TypeScript files)
3. The commands they're running (typing `pok <name>`)

**The fix isn't more explanation. It's less explanation and more doing.**

The playground needs to:
1. Get the user to DO something immediately
2. Show them what happened
3. THEN explain why

Not:
1. Explain what pok is
2. Explain what commands are
3. Show an example
4. Ask if they want to try
5. Wait for them to type
