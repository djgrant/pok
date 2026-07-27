import { Section } from "@notation/docs/ui/layout";
import { Heading } from "@notation/docs/ui/element";

const features = [
  {
    title: "File-based Routing",
    description:
      "Commands are discovered from the filesystem. Just create a file and it becomes a command. Supports nested commands with dot notation.",
  },
  {
    title: "Type-safe",
    description:
      "Full TypeScript support with Zod schema validation for arguments, flags, and context. Get autocompletion and type checking.",
  },
  {
    title: "Interactive Prompts",
    description:
      "Automatically prompts for missing values with beautiful terminal UI. Supports text, select, multiselect, confirm, and more.",
  },
  {
    title: "Composable Tasks",
    description:
      "Define reusable tasks with environment management. Compose complex workflows from simple building blocks.",
  },
  {
    title: "Pre-flight Checks",
    description:
      "Validate requirements before running commands. Check dependencies, environment variables, or custom conditions.",
  },
  {
    title: "Modular Architecture",
    description:
      "Choose only the adapters you need. Swap prompters, reporters, and UI components to match your requirements.",
  },
];

export const Features = () => (
  <Section>
    <div className="bleed-full">
      <div className="page-wrap py-8 md:py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="border border-line rounded-lg p-4">
              <Heading className="mb-2">{feature.title}</Heading>
              <div className="opacity-70">{feature.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Section>
);
