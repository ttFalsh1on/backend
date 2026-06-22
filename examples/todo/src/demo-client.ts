import { createClient } from "@flex/client";

const client = createClient({ url: "http://localhost:3210" });

console.log("Listing projects (requires auth token)...");

await new Promise((r) => setTimeout(r, 500));
client.close();
process.exit(0);
