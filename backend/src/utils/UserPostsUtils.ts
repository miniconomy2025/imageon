import axios from 'axios';

// Types for better type safety
interface Note {
    id: string;
    content: string;
}

interface PaginationResult {
    next: string | null;
    current: string;
    notes: Note[];
}

interface UserData {
    outbox: string;
}

interface OutboxData {
    first: string;
}

interface FirstPageData {
    orderedItems: any[];
    next?: string;
}

// Step 1: Fetch user profile data
async function fetchUserProfile(userUrl: string): Promise<UserData> {
    console.log('Step 1: Fetching user profile from Mastodon...');
    const userResponse = await axios.get(userUrl, {
        headers: {
            Accept: 'application/activity+json'
        }
    });

    return userResponse.data;
}

// Step 2: Extract outbox URL from user data here
function extractOutboxUrl(userData: UserData): string {
    const outboxUrl = userData.outbox;
    console.log('Step 2: Outbox URL found:', outboxUrl);

    if (!outboxUrl) {
        throw new Error('No outbox URL found in user data');
    }

    return outboxUrl;
}

// Step 3: Fetch outbox data
async function fetchOutboxData(outboxUrl: string): Promise<OutboxData> {
    console.log('Step 3: Fetching outbox data...');
    const outboxResponse = await axios.get(outboxUrl, {
        headers: {
            Accept: 'application/activity+json'
        }
    });

    return outboxResponse.data;
}

// Step 4: Extract first page URL from outbox data
function extractFirstPageUrl(outboxData: OutboxData): string {
    const firstUrl = outboxData.first;

    if (!firstUrl) {
        throw new Error('No first URL found in outbox data');
    }

    return firstUrl;
}

// Step 5: Fetch first page data
async function fetchFirstPageData(firstUrl: string): Promise<FirstPageData> {
    console.log('Step 5: Fetching first page data...');
    const firstResponse = await axios.get(firstUrl, {
        headers: {
            Accept: 'application/activity+json'
        }
    });

    return firstResponse.data;
}

// Step 6: Extract and process notes from ordered items
function extractNotesFromOrderedItems(orderedItems: any[]): Note[] {
    console.log('Number of posts:', orderedItems ? orderedItems.length : 0);

    return orderedItems
        .filter((item: any) => item.type === 'Create' && item.object && item.object.type === 'Note')
        .map((item: any) => ({
            id: item.object.id,
            content: item.object.content
        }));
}

// Step 7: Create final result object
function createResultObject(firstData: FirstPageData, firstUrl: string, notes: Note[]): PaginationResult {
    return {
        next: firstData.next || null,
        current: firstUrl,
        notes: notes
    };
}

// Main function that orchestrates the entire flow
async function fetchUserPosts(userUrl: string): Promise<PaginationResult> {
    try {
        // Step 1: Get user profile
        const userData = await fetchUserProfile(userUrl);

        // Step 2: Extract outbox URL
        const outboxUrl = extractOutboxUrl(userData);

        // Step 3: Fetch outbox data
        const outboxData = await fetchOutboxData(outboxUrl);

        // Step 4: Extract first page URL
        const firstUrl = extractFirstPageUrl(outboxData);

        // Step 5: Fetch first page data
        const firstData = await fetchFirstPageData(firstUrl);

        // Step 6: Extract notes from ordered items
        const notes = extractNotesFromOrderedItems(firstData.orderedItems);

        // Step 7: Create and return result
        const result = createResultObject(firstData, firstUrl, notes);

        console.log('\n=== RESULT OBJECT ===');
        console.log(result);

        return result;
    } catch (error) {
        console.error('Error fetching user posts:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response status:', error.response?.status);
            console.error('Response data:', error.response?.data);
        }
        throw error;
    }
}

// Execute the function with the user URL
const userUrl = 'https://mastodon.social/users/Gargron';
fetchUserPosts(userUrl)
    .then(result => {
        console.log('Successfully fetched posts!');
    })
    .catch(error => {
        console.error('Failed to fetch posts:', error.message);
    });
