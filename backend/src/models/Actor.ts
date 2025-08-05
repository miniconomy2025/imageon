import { Person, CryptographicKey } from "@fedify/fedify";
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
  // Add cryptographic key fields
  privateKeyJwk?: JsonWebKey;
  publicKeyJwk?: JsonWebKey;
}

export class ActorModel {
  /**
   * Get actor data from cache or database with cryptographic keys
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

    // Get cryptographic keys for the actor
    const keyPair = await db.getItem(`ACTOR#${identifier}`, 'KEYPAIR');
    
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
      // Include cryptographic keys if available
      privateKeyJwk: keyPair?.privateKey,
      publicKeyJwk: keyPair?.publicKey,
    };

    // Cache the result for future requests
    await redis.cacheActor(identifier, actorData, 3600); // Cache for 1 hour
    console.log(`💾 Cached actor: ${identifier}`);

    return actorData;
  }

  /**
   * Convert actor data to Fedify Person object with public key
   */
  static async createPersonObject(ctx: any, identifier: string, actorData: ActorData, publicKeys: any[]) {
    // Get the public key if available
    let cryptographicKey = null;
    if (publicKeys && publicKeys.length > 0 && publicKeys[0].publicKey) {
      try {
        // Create a CryptographicKey object with the CryptoKey
        cryptographicKey = new CryptographicKey({
          id: new URL(`${ctx.getActorUri(identifier)}#main-key`),
          owner: new URL(ctx.getActorUri(identifier)),
          publicKey: publicKeys[0].publicKey, // Use the CryptoKey directly
        });
        
        console.log(`🔑 Created CryptographicKey for: ${identifier}`);
      } catch (error) {
        console.error(`❌ Error creating CryptographicKey for ${identifier}:`, error);
      }
    }

    // Create Person object with public key if available
    const personData: any = {
      id: new URL(ctx.getActorUri(identifier)),
      name: actorData.name,
      summary: actorData.summary,
      preferredUsername: actorData.preferredUsername,
      url: new URL(`/users/${identifier}`, `${config.federation.protocol}://${config.federation.domain}`),
      inbox: new URL(ctx.getInboxUri(identifier)),
      outbox: new URL(`/users/${identifier}/outbox`, `${config.federation.protocol}://${config.federation.domain}`),
      followers: new URL(`/users/${identifier}/followers`, `${config.federation.protocol}://${config.federation.domain}`),
      following: new URL(`/users/${identifier}/following`, `${config.federation.protocol}://${config.federation.domain}`),
      icon: actorData.icon ? new URL(actorData.icon.url) : undefined,
    };

    // Add public key to the constructor data
    if (cryptographicKey) {
      personData.publicKey = cryptographicKey;
      console.log(`🔑 Added CryptographicKey to Person constructor data for: ${identifier}`);
    }

    const person = new Person(personData);
    console.log(`👤 Person object created with public key for: ${identifier}`);

    return person;
  }

  /**
   * Get all local actors with their cryptographic keys
   */
  static async getLocalActors(): Promise<ActorData[]> {
    const actors = await db.getLocalActors();
    const actorsWithKeys = await Promise.all(
      actors.map(async (actor) => {
        // Get cryptographic keys for each actor
        const keyPair = await db.getItem(`ACTOR#${actor.preferredUsername}`, 'KEYPAIR');
        
        return {
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
          // Include cryptographic keys if available
          privateKeyJwk: keyPair?.privateKey,
          publicKeyJwk: keyPair?.publicKey,
        };
      })
    );
    return actorsWithKeys;
  }

  /**
   * Check if actor exists
   */
  static async exists(identifier: string): Promise<boolean> {
    const actor = await db.getActor(identifier);
    return !!actor;
  }

  /**
   * Create a new actor with cryptographic keys
   */
  static async createActor(actorData: Omit<ActorData, 'privateKeyJwk' | 'publicKeyJwk'>): Promise<boolean> {
    try {
      // First, create the actor profile
      const success = await db.putItem({
        PK: `ACTOR#${actorData.preferredUsername}`,
        SK: 'PROFILE',
        GSI1PK: `ACTOR#${actorData.preferredUsername}`,
        GSI1SK: 'PROFILE',
        GSI2PK: 'LOCAL_ACTORS',
        GSI2SK: actorData.preferredUsername,
        ...actorData,
      });

      if (!success) {
        console.error(`Failed to create actor profile for: ${actorData.preferredUsername}`);
        return false;
      }

      console.log(`✅ Created actor profile for: ${actorData.preferredUsername}`);
      
      // Note: Cryptographic keys will be generated automatically by the 
      // cryptography service when first needed via getOrGenerateKeyPairs()
      
      return true;
    } catch (error) {
      console.error(`Error creating actor ${actorData.preferredUsername}:`, error);
      return false;
    }
  }

  /**
   * Get actor's public key in PEM format for ActivityPub
   */
  static async getPublicKeyPem(identifier: string): Promise<string | null> {
    try {
      const keyPair = await db.getItem(`ACTOR#${identifier}`, 'KEYPAIR');
      if (!keyPair?.publicKey) {
        return null;
      }

      // Convert JWK to PEM format if needed
      // This would require additional crypto utilities
      // For now, return the JWK as a string representation
      return JSON.stringify(keyPair.publicKey);
    } catch (error) {
      console.error(`Error getting public key for ${identifier}:`, error);
      return null;
    }
  }
}
