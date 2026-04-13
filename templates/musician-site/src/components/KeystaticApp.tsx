import { Keystatic } from "@keystatic/core/ui";
import config from "../../keystatic.config";

export default function KeystaticApp() {
  // @ts-expect-error — Keystatic's generic Config type doesn't match the specific config shape
  return <Keystatic config={config} />;
}
