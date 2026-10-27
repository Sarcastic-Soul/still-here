// Creates the FGA store (local OpenFGA only; on Auth0 FGA the store is made in the dashboard)
// and uploads the authorization model. Writes FGA_STORE_ID / FGA_MODEL_ID into ../.env.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { maybe } from "../lib/env";
import { fga, MODEL } from "../lib/fga";

let storeId = maybe("FGA_STORE_ID");
if (!storeId) {
  const store = await fga({ storeId: "" }).createStore({ name: "still-here" });
  storeId = store.id;
  console.log("created store", storeId);
}
const { authorization_model_id: modelId } = await fga({ storeId }).writeAuthorizationModel(MODEL as never);
console.log("model", modelId);

const envPath = resolve(process.cwd(), "../.env");
let env = readFileSync(envPath, "utf8");
env = env.replace(/^FGA_STORE_ID=.*$/m, `FGA_STORE_ID=${storeId}`).replace(/^FGA_MODEL_ID=.*$/m, `FGA_MODEL_ID=${modelId}`);
writeFileSync(envPath, env);
console.log("saved to ../.env");
