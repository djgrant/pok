import { Terminal } from "@notation/docs/ui/icon";

export default function Logo() {
  return (
    <div className="flex items-center gap-1.5">
      <Terminal className="mt-1" />
      <span className="text-xl font-black">pok</span>
    </div>
  );
}
