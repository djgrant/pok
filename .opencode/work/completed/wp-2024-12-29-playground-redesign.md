# Playground Redesign: First Principles

## Problem
The playground teaches pok like documentation, not like a tool. Users experience:
- Explanation before experience
- Layer confusion (using vs building vs learning)
- No visibility into what's happening
- Broken flow (exit/re-enter pattern)
- Choices before understanding

## Goal
Demonstrate power through purity and simplicity. Showcase pok with pok.

## Constraints
- Every element must earn its place
- No cargo-culting IDE patterns
- No copying tutorial patterns
- Build from first principles

---

## First Principles Analysis

### 1. What is the user's actual goal?

**Not "learn pok."** That's our goal projected onto them.

The user arrives with one of these actual goals:
- **"I have CLI spaghetti."** They have scripts scattered everywhere. npm scripts calling other scripts. Makefiles nobody understands. "How do I run the thing again?"
- **"I need to onboard developers."** New team member asks "how do I set up the project?" and the answer is a 47-step wiki page.
- **"I want my CLI to feel polished."** They want `vercel`-quality UX but don't want to spend months building it.
- **"I'm curious."** Someone mentioned pok, they want to understand what it is in 60 seconds.

The common thread: **They want to see if pok solves a problem they already feel.**

They don't want to "learn" - they want to **evaluate**. Is this for me? Does this solve my problem?

### 2. What is the atomic unit of understanding?

The smallest experience that conveys pok's value is:

**See a command. Run it. See what happens.**

Not "read about commands, then create one, then run it" - that's three steps when one would do.

The atomic unit is: `pok <something>` produces a result.

But there's something even more fundamental: **the existence of structure where there was chaos.** When you type `pok` and see a menu of organized commands instead of grepping through package.json scripts - that's the moment.

### 3. What creates the "aha" moment?

The "aha" happens when the user **recognizes their own pain, resolved.**

Current tutorial: "Here's how to define a command..." - Teaching mechanics.

The aha comes from recognition, not education:
- "Oh, I could replace our 15 npm scripts with this"
- "Oh, my teammates could actually find commands without asking me"
- "Oh, this prompts for missing flags instead of failing silently"

**The aha is: "This is what I wish I had."**

It requires showing a *relatable* scenario, not an abstract hello-world. The user needs to see themselves in it.

### 4. What do they need to SEE?

The problem isn't "no visibility." The problem is the current design shows the wrong things.

What they need to see:
1. **The command structure** - Not a file tree (too abstract). The menu that pok generates. "Here are your commands, organized."
2. **The instant feedback loop** - Run command, see output, done. No compilation step, no waiting.
3. **The code/behavior relationship** - "This 8-line file gives me all this?" The density of what you get vs what you write.

What they don't need to see:
- A filesystem sidebar (implementation detail)
- Code before they understand why it matters
- "Step 1 of 5" progress indicators (tutorial pattern)

### 5. What do they need to DO?

**Almost nothing.**

The best demo is one you watch, not one you operate. The user's first action shouldn't be "choose a lesson" - it should be "press enter" or even just "observe."

After they understand *what* pok does, they might want to:
- Poke around (`pok --help`, explore the menu)
- See how a command is built (view source of what they just ran)
- Try modifying something

But these are second-order actions. The first action should be automatic or trivial.

### 6. What can be removed entirely?

**Current elements:**
- Header with "pok" branding and reset button
- Loading screen
- Terminal
- `pok learn` command
- 5-lesson menu structure  
- Progress tracking (completed lessons)
- File creation ("create commands/hello.ts")
- Exit/re-enter pattern

**Can be removed:**
- **The menu of 5 lessons** - Choices before context. Cut.
- **Progress tracking** - Gamification that feels patronizing. Cut.
- **Exit/re-enter pattern** - Broken flow. The demo should be continuous.
- **"Create file" interactions** - We're teaching with pok, not about pok. The files should exist.
- **The "How was this made" lesson** - Meta-explanation. Interesting but not essential for first experience.
- **The header subtitle "interactive tutorial"** - Labels the experience instead of letting it speak.

**Must keep:**
- Terminal (the medium is the message)
- Reset capability (escape hatch)
- Some way to see source code (but on demand, not as a lesson)

### 7. What would "showcase pok with pok" actually mean?

Current interpretation: "Run a pok command that teaches you pok."

Better interpretation: **"Experience a real pok project that happens to be about itself."**

The playground shouldn't simulate a project - it should BE a project. A small, complete, purposeful pok project that demonstrates what using pok feels like.

What if the playground WAS the pok monorepo's own CLI, miniaturized? Commands that do real things (even if those real things are just for demo purposes).

**Examples of "real" commands that showcase features:**
- `pok check` - Runs validation (shows pre-flight checks)
- `pok build` - Compiles something (shows task execution)
- `pok deploy` - Simulates deploy flow (shows prompts, confirmations)
- `pok dev` - Parent command with children (shows menu navigation)

The user experiences pok as a user would - not as a student.

---

## Design Direction

### The Inversion

**Current model:** Learn, then do.  
**New model:** Do, then understand.

The user should land on a running pok project. Not a tutorial. Not a lesson. A working project with commands that do things.

### The Experience

1. **Arrival**: Terminal boots. A brief welcome appears. `pok` runs automatically.
2. **Discovery**: User sees a menu of commands. Real commands. Not lessons.
3. **Action**: User picks one. It runs. They see output.
4. **Curiosity**: User wonders "how did that work?" - They can inspect source (keyboard shortcut? command?).
5. **Exploration**: User pokes around freely. No rails.

### What Should It Feel Like?

- **Confident, not clever.** No emoji, no "fun" framing. Professional.
- **Dense, not minimal.** The demo should feel substantial - like there's real power here.
- **Discoverable, not instructed.** The user explores, they aren't led.
- **Fast.** Every interaction should feel instant.

It should feel like SSH-ing into a well-organized codebase for the first time and thinking "oh, these people know what they're doing."

---

## Elements Needed (Justified)

### 1. Terminal (full viewport)
**Justification:** The terminal IS the product. pok is a CLI framework. Anything that isn't terminal is chrome that distances the user from the experience.

### 2. Auto-running entry point
**Justification:** Zero-friction entry. User sees pok working immediately. No instructions to read first.

### 3. A real (miniature) project structure
**Justification:** "Showcase pok with pok" means showing an actual project, not a tutorial simulation. The commands should feel purposeful.

### 4. Source inspection capability
**Justification:** After experiencing a command, users will want to see how it's built. This is the "how is this so simple?" reveal. Should be on-demand, not forced.

### 5. Reset mechanism
**Justification:** Escape hatch. Hidden until needed (keyboard shortcut or command, not a button taking up header space).

### What's NOT needed:
- Header (branding in terminal welcome is sufficient)
- Sidebar/file tree
- Progress tracking
- Lesson structure
- Step-by-step guidance
- Emoji/celebration

---

## Open Questions

1. **What "real" commands should the mini-project have?** They need to be:
   - Instantly understandable (user grasps purpose immediately)
   - Demonstrative of pok features (flags, prompts, checks, parent/child, etc.)
   - Completable in seconds (no long-running processes)

2. **How does source inspection work?** Options:
   - A command: `pok source <command-name>`
   - A keyboard shortcut while viewing output
   - A `--source` flag on any command

3. **What's the welcome message?** It needs to:
   - Orient without instructing
   - Create curiosity, not obligation
   - Be brief (3-4 lines max)

4. **How do we handle the WebContainer boot time?** The ~5-10 second wait is unavoidable. What does the user see?

---

## Results
(To be filled out after implementation)

## Evaluation
(To be filled out after implementation)
