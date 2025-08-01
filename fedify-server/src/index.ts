import "./logging.ts";

// app.listen(8001, () => {
//   console.log("Server started at http://localhost:8001");
// });
import { serve } from "@hono/node-server";

import { behindProxy } from "x-forwarded-fetch";

import {
  createFederation,
  Follow,
  Person,
  MemoryKvStore,
  InProcessMessageQueue,
} from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
//import { MemoryKvStore, InProcessMessageQueue } from "@fedify/fedify";
import { postsService } from "./services/posts.js";

const logger = getLogger("imageON");

const federation = createFederation({
  kv: new MemoryKvStore(),
  //queue: new InProcessMessageQueue(),
});

//tshepo's code
// federation.setActorDispatcher(
//   "/users/{identifier}",
//   async (ctx, identifier) => {
//     if (identifier !== "me") return null; // Other than "me" is not found.
//     return new Person({
//       id: ctx.getActorUri(identifier),
//       preferredUsername: identifier,
//       name: identifier,
//       inbox: ctx.getInboxUri(identifier),
//       outbox: ctx.getOutboxUri(identifier),
//       followers: ctx.getFollowersUri(identifier),
//       following: ctx.getFollowingUri(identifier),
//     });
//   }
// );

federation.setActorDispatcher(
  "/users/{identifier}",
  async (ctx, identifier) => {
    if (identifier !== "tshepobbd") return null; // Other than "me" is not found.
    return new Person({
      id: ctx.getActorUri(identifier),
      name: "Tshepobbd", // Display name
      summary: "Hey there, I'm a software engineer", // Bio
      preferredUsername: identifier, // Bare handle
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(identifier), // Inbox URI
    });
  }
);

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
    if (parsed?.type !== "actor" || parsed.identifier !== "tshepobbd") return;
    const follower = await follow.getActor(ctx);
    console.debug(follower);
  });

serve({
  port: 8005,
  fetch: behindProxy((request) =>
    federation.fetch(request, { contextData: undefined })
  ),
});

// federation
//   .setInboxListeners("/users/{identifier}/inbox", "/inbox")
//   .on(Follow, async (ctx, follow) => {
//     if (
//       follow.id == null ||
//       follow.actorId == null ||
//       follow.objectId == null
//     ) {
//       return;
//     }
//     const parsed = ctx.parseUri(follow.objectId);
//     if (parsed?.type !== "actor" || parsed.identifier !== "me") return;
//     const follower = await follow.getActor(ctx);
//     console.debug(follower);
//   });

// serve({
//   port: 8001,
//   fetch(request) {
//     return federation.fetch(request, { contextData: undefined });
//   },
// });
