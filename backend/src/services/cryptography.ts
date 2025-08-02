import { exportJwk, generateCryptoKeyPair, importJwk } from "@fedify/fedify";
import { db } from "./database.js";

export class CryptographyService {
  /**
   * Get key pair for an actor
   */
  async getKeyPair(identifier: string) {
    return await db.getItem(`ACTOR#${identifier}`, 'KEYPAIR');
  }

  /**
   * Save key pair for an actor
   */
  async saveKeyPair(identifier: string, privateKey: JsonWebKey, publicKey: JsonWebKey) {
    return await db.putItem({
      PK: `ACTOR#${identifier}`,
      SK: 'KEYPAIR',
      privateKey,
      publicKey,
    });
  }

  /**
   * Get or generate key pairs for an actor
   */
  async getOrGenerateKeyPairs(identifier: string) {
    const entry = await this.getKeyPair(identifier);
    
    if (!entry?.privateKey || !entry?.publicKey) {
      // Generate a new key pair at the first time:
      const { privateKey, publicKey } = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      
      // Store the generated key pair to DynamoDB in JWK format:
      const privateKeyJwk = await exportJwk(privateKey);
      const publicKeyJwk = await exportJwk(publicKey);
      
      await this.saveKeyPair(identifier, privateKeyJwk, publicKeyJwk);
      return [{ privateKey, publicKey }];
    }
    
    // Load the key pair from DynamoDB:
    const privateKey = await importJwk(entry.privateKey, "private");
    const publicKey = await importJwk(entry.publicKey, "public");
    return [{ privateKey, publicKey }];
  }

  /**
   * Check if actor exists in our system
   */
  async actorExists(identifier: string): Promise<boolean> {
    const actor = await db.getActor(identifier);
    return !!actor;
  }
}

// Export a singleton instance
export const crypto = new CryptographyService();
