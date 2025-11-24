// This is a server-side function.
// It will be executed in a Node.js environment.

// In a real project, you would use a library like 'cheerio' for robust HTML parsing.
// For this environment, we'll use a simpler regex-based approach.

interface CrawlRequest {
    url: string;
}

interface CrawlResponse {
    content: string;
}

export default async function(req: Request): Promise<Response> {
    try {
        const { url } = (await req.json()) as CrawlRequest;

        if (!url || !url.startsWith('http')) {
            return new Response(JSON.stringify({ error: 'Invalid URL provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Fetch the content of the URL.
        // The server-side environment does not have CORS restrictions.
        const response = await fetch(url, {
             headers: {
                // Some websites block requests without a user-agent
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();

        // Simple regex to strip HTML tags and get text content.
        // This is a basic implementation and might not work for all sites.
        // It primarily targets content within p, h1-h6, and li tags.
        const bodyContentMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
        if (!bodyContentMatch) {
            return new Response(JSON.stringify({ content: '' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let textContent = bodyContentMatch[1];
        
        // Remove script and style tags completely
        textContent = textContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        textContent = textContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Get content from meaningful tags
        const meaningfulContent = Array.from(
            textContent.matchAll(/<(p|h[1-6]|li)[^>]*>([\s\S]*?)<\/\1>/gi)
        ).map(match => match[2]);

        let extractedText = meaningfulContent.join('\n');

        // General cleanup
        extractedText = extractedText.replace(/<[^>]+>/g, ''); // Remove remaining tags
        extractedText = extractedText.replace(/(\s\n)+/g, '\n'); // Collapse multiple newlines
        extractedText = extractedText.replace(/\s+/g, ' ').trim(); // Collapse whitespace

        const crawlResponse: CrawlResponse = {
            content: extractedText,
        };

        return new Response(JSON.stringify(crawlResponse), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Crawling error:', error);
        return new Response(JSON.stringify({ error: 'Failed to process URL' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}