import { activityPub } from "../services/activitypub.js";
import { ActorModel } from "../models/Actor.js";

export class WebHandlers {
  /**
   * Home page - shows followers for a specific actor or server stats
   */
  static async handleHomePage(url: URL): Promise<Response> {
    try {
      // Extract actor from query params or default to showing server info
      const actorParam = url.searchParams.get('actor');
      
      if (actorParam) {
        // Show followers for specific actor
        const followers = await activityPub.getFollowers(actorParam);
        const uniqueFollowers = [...new Set(followers)];
        const followerList = uniqueFollowers.map((f) => `<li>${f}</li>`).join('');
        
        return new Response(
          `
          <html>
            <head><title>ImageOn - ${actorParam} Followers</title></head>
            <body>
              <h1>${actorParam}'s Followers</h1>
              <ul>${followerList}</ul>
              <a href="/">← Back to server info</a>
            </body>
          </html>
          `,
          {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      } else {
        // Show server overview with all actors
        const actors = await ActorModel.getLocalActors();
        const actorList = actors.map(actor => 
          `<li>
            <strong>${actor.name}</strong> (@${actor.preferredUsername})
            <br>${actor.summary}
            <br>Followers: ${actor.followers_count} | Following: ${actor.following_count}
            <br><a href="/users/${actor.preferredUsername}">View Profile</a>
            | <a href="/?actor=${actor.preferredUsername}">View Followers</a>
          </li>`
        ).join('');

        return new Response(
          `
          <html>
            <head><title>ImageOn Federation Server</title></head>
            <body>
              <h1>🖼️ ImageOn Federation Server</h1>
              <p>An ActivityPub-enabled social media server</p>
              
              <h2>Local Actors (${actors.length})</h2>
              <ul style="list-style: none; padding: 0;">
                ${actorList}
              </ul>
              
              <h2>API Endpoints</h2>
              <ul>
                <li><code>GET /users/{identifier}</code> - Actor profile (ActivityPub)</li>
                <li><code>POST /users/{identifier}/inbox</code> - Actor inbox</li>
                <li><code>POST /inbox</code> - Server inbox</li>
              </ul>
              
              <p><em>Powered by Fedify & DynamoDB</em></p>
            </body>
          </html>
          `,
          {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      }
    } catch (error) {
      console.error('Error handling home page:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Health check endpoint
   */
  static async handleHealthCheck(): Promise<Response> {
    try {
      const actors = await ActorModel.getLocalActors();
      
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          actors: actors.length,
          version: '1.0.0',
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error('Health check failed:', error);
      return new Response(
        JSON.stringify({
          status: 'unhealthy',
          error: 'Database connection failed',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }
}
