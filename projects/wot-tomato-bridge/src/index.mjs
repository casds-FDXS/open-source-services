import process from "node:process";
import { startBridge } from "./server.mjs";

const bridge = await startBridge();
const stop = async () => {
  await bridge.close();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
