import {
  createFederation,
  Follow,
  Person,
  MemoryKvStore,
  InProcessMessageQueue,
  generateCryptoKeyPair,
  Accept,
  exportJwk,
  importJwk,
} from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
import { postsService } from "./services/posts.js";
import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";
import { openKv } from "@deno/kv";
import "./logging.ts";

const kv = await openKv("kv.db"); // Open the key–value store

const logger = getLogger("imageON");

const federation = createFederation({
  kv: new MemoryKvStore(),
  //queue: new InProcessMessageQueue(),
});

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    if (identifier !== "keith") return null; // Other than "tshepobbd" is not found.
    return new Person({
      id: ctx.getActorUri(identifier),
      name: "keith", // Display name
      summary: "Hey there, I'm a software engineer", // Bio
      preferredUsername: identifier, // Bare handle
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(identifier), // Inbox URI
      publicKeys: (await ctx.getActorKeyPairs(identifier)).map(
        (keyPair) => keyPair.cryptographicKey
      ),
    });
  })
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    if (identifier != "keith") return []; // Other than "tshepobbd" is not found.
    const entry = await kv.get<{
      privateKey: JsonWebKey;
      publicKey: JsonWebKey;
    }>(["key"]);
    if (entry == null || entry.value == null) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } = await generateCryptoKeyPair(
        "RSASSA-PKCS1-v1_5"
      );
      // Store the generated key pair to the Deno KV database in JWK format:
      await kv.set(["key"], {
        privateKey: await exportJwk(privateKey),
        publicKey: await exportJwk(publicKey),
      });
      return [{ privateKey, publicKey }];
    }
    // Load the key pair from the Deno KV database:
    const privateKey = await importJwk(entry.value.privateKey, "private");
    const publicKey = await importJwk(entry.value.publicKey, "public");
    return [{ privateKey, publicKey }];
  });

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.identifier !== "keith") return;
    const follower = await follow.getActor(ctx);
    console.debug(follower);

    if (follower == null) return;
    // Note that if a server receives a `Follow` activity, it should reply
    // with either an `Accept` or a `Reject` activity.  In this case, the
    // server automatically accepts the follow request:
    await ctx.sendActivity(
      { identifier: parsed.identifier },
      follower,
      new Accept({ actor: follow.objectId, object: follow })
    );
  });

console.log("Server started at http://localhost:8005");
serve({
  port: 8005,
  fetch: behindProxy((request) =>
    federation.fetch(request, { contextData: undefined })
  ),
});
