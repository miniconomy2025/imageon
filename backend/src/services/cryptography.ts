import { exportJwk, generateCryptoKeyPair, importJwk } from '@fedify/fedify';
import { db } from './database.js';
import forge from 'node-forge';

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
            publicKey
        });
    }

    /**
     * Generate PEM format public key for ActivityPub
     */
    async generatePemPublicKey(identifier: string): Promise<string> {
        const keyPairs = await this.getOrGenerateKeyPairs(identifier);
        const publicKey = keyPairs[0].publicKey;

        // Convert JWK to PEM format
        const jwk = await exportJwk(publicKey);

        // For RSA keys, we can construct PEM from JWK components
        if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
            // Convert base64url to base64
            const n = jwk.n.replace(/-/g, '+').replace(/_/g, '/');
            const e = jwk.e.replace(/-/g, '+').replace(/_/g, '/');

            // Create forge RSA public key
            const modulus = forge.util.decode64(n);
            const exponent = forge.util.decode64(e);

            const rsaPublicKey = forge.pki.setRsaPublicKey(
                new forge.jsbn.BigInteger(forge.util.bytesToHex(modulus), 16),
                new forge.jsbn.BigInteger(forge.util.bytesToHex(exponent), 16)
            );

            // Convert to PEM format
            const pem = forge.pki.publicKeyToPem(rsaPublicKey);
            return pem;
        }

        throw new Error('Unsupported key type for PEM generation');
    }

    /**
     * Generate private key JWK for database storage
     */
    async generatePrivateKeyJwk(identifier: string): Promise<JsonWebKey> {
        const keyPairs = await this.getOrGenerateKeyPairs(identifier);
        const privateKey = keyPairs[0].privateKey;

        // Export private key as JWK
        const privateKeyJwk = await exportJwk(privateKey);
        return privateKeyJwk;
    }

    /**
     * Get or generate key pairs for an actor
     */
    async getOrGenerateKeyPairs(identifier: string) {
        const entry = await this.getKeyPair(identifier);

        if (!entry?.privateKey || !entry?.publicKey) {
            // Generate a new key pair at the first time:
            const { privateKey, publicKey } = await generateCryptoKeyPair('RSASSA-PKCS1-v1_5');

            // Store the generated key pair to DynamoDB in JWK format:
            const privateKeyJwk = await exportJwk(privateKey);
            const publicKeyJwk = await exportJwk(publicKey);

            await this.saveKeyPair(identifier, privateKeyJwk, publicKeyJwk);
            return [{ privateKey, publicKey }];
        }

        // Load the key pair from DynamoDB:
        const privateKey = await importJwk(entry.privateKey, 'private');
        const publicKey = await importJwk(entry.publicKey, 'public');
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
