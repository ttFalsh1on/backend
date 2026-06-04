import { createClient } from "@flex/client";

const client = createClient({ url: "http://localhost:3210" });

console.log("Subscribing to functions:list...");

const unsub = client.subscribe<unknown[]>(
  "functions:list",
  {},
  (todos) => {
    console.log("Todos updated:", todos);
  },
  (err) => console.error(err)
);

await new Promise((r) => setTimeout(r, 500));

const id = await client.mutation<string>("functions:add", {
  text: `Task at ${new Date().toLocaleTimeString()}`,
});
console.log("Added todo:", id);

await new Promise((r) => setTimeout(r, 1000));
unsub();
client.close();
process.exit(0);
