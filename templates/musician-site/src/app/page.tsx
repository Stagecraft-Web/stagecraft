import { Render } from "@measured/puck";
import "@measured/puck/puck.css";

import { puckConfig } from "@/puck/config";
import { readPage } from "@/lib/content";

export default async function Home() {
  const data = await readPage("home");
  return <Render config={puckConfig} data={data} />;
}
