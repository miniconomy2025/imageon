import { Person } from "@fedify/fedify";
import { db } from "../services/database.js";
import { redis } from "../services/redis.js";
import { config } from "../config/index.js";

export interface ActorData {
  id: string;
  type: string;
  preferredUsername: string;
  name: string;
  summary: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  url: string;
  icon?: {
    type: string;
    url: string;
  };
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  published: string;
  followers_count: number;
  following_count: number;
}

export class ActorModel {
  /**
   * Get actor data from cache or database
   */
  static async getActor(identifier: string): Promise<ActorData | null> {
    // Try to get from cache first
    const cached = await redis.getCachedActor(identifier);
    if (cached) {
      console.log(`🟢 Cache hit for actor: ${identifier}`);
      return cached;
    }

    // Cache miss - get from database
    console.log(`🔍 Cache miss for actor: ${identifier}, fetching from database`);
    const actor = await db.getActor(identifier);
    if (!actor) return null;

    const actorData: ActorData = {
      id: actor.id,
      type: actor.type,
      preferredUsername: actor.preferredUsername,
      name: actor.name,
      summary: actor.summary,
      inbox: actor.inbox,
      outbox: actor.outbox,
      followers: actor.followers,
      following: actor.following,
      url: actor.url,
      icon: actor.icon,
      publicKey: actor.publicKey,
      published: actor.published,
      followers_count: actor.followers_count,
      following_count: actor.following_count,
    };

    // Cache the result for future requests
    await redis.cacheActor(identifier, actorData, 3600); // Cache for 1 hour
    console.log(`💾 Cached actor: ${identifier}`);

    return actorData;
  }

  /**
   * Convert actor data to Fedify Person object
   */
  static createPersonObject(ctx: any, identifier: string, actorData: ActorData, publicKeys: any[]) {
    return new Person({
      id: new URL(ctx.getActorUri(identifier)),
      name: actorData.name,
      summary: actorData.summary,
      preferredUsername: actorData.preferredUsername,
      url: new URL(`/users/${identifier}`, `${config.federation.protocol}://${config.federation.domain}`),
      inbox: new URL(ctx.getInboxUri(identifier)),
      outbox: new URL(`/users/${identifier}/outbox`, `${config.federation.protocol}://${config.federation.domain}`),
      followers: new URL(`/users/${identifier}/followers`, `${config.federation.protocol}://${config.federation.domain}`),
      following: new URL(`/users/${identifier}/following`, `${config.federation.protocol}://${config.federation.domain}`),
      // Note: publicKeys should be handled by Fedify's key pairs dispatcher
      // We'll let Fedify handle the public key automatically
      icon: actorData.icon ? new URL(actorData.icon.url) : undefined,
    });
  }

  /**
   * Get all local actors
   */
  static async getLocalActors(): Promise<ActorData[]> {
    const actors = await db.getLocalActors();
    return actors.map(actor => ({
      id: actor.id,
      type: actor.type,
      preferredUsername: actor.preferredUsername,
      name: actor.name,
      summary: actor.summary,
      inbox: actor.inbox,
      outbox: actor.outbox,
      followers: actor.followers,
      following: actor.following,
      url: actor.url,
      icon: actor.icon,
      publicKey: actor.publicKey,
      published: actor.published,
      followers_count: actor.followers_count,
      following_count: actor.following_count,
    }));
  }

  /**
   * Check if actor exists
   */
  static async exists(identifier: string): Promise<boolean> {
    const actor = await db.getActor(identifier);
    return !!actor;
  }
}
