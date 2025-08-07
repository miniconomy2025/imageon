import { auth } from "../config/firebase.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  };
}

export async function verifyToken(request: Request): Promise<AuthenticatedRequest> {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No valid authorization header");
  }

  const token = authHeader.substring(7);
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      displayName: decodedToken.name || undefined,
      photoURL: decodedToken.picture || undefined,
    };
    
    return authenticatedRequest;
  } catch (error) {
    throw new Error("Invalid token");
  }
}

export function requireAuth(handler: (request: AuthenticatedRequest) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      const authenticatedRequest = await verifyToken(request);
      return await handler(authenticatedRequest);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  };
} 