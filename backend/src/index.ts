/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	DB: D1Database;
	MY_BUCKET: R2Bucket;
	ENVIRONMENT: string;
	API_URL: string;
	SECRET_KEY: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		switch (url.pathname) {
			case '/info':
				return new Response(
					JSON.stringify({
						environment: env.ENVIRONMENT,
						apiUrl: env.API_URL,
						hasSecret: !!env.SECRET_KEY
					}),
					{ headers: { 'Content-Type': 'application/json' } }
				);
			case '/d1-test':
				try {
					// Example of querying D1
					const result = await env.DB.prepare('SELECT 1 as value').first();
					return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
				} catch (error) {
					return new Response(String(error), { status: 500 });
				}
			case '/r2-test':
				// Example of storing and retrieving from R2
				await env.MY_BUCKET.put('test-file.txt', 'Hello R2!');
				const file = await env.MY_BUCKET.get('test-file.txt');
				if (file === null) return new Response('File not found', { status: 404 });
				return new Response(await file.text());
			case '/message':
				return new Response('Hello, World!');
			case '/random':
				return new Response(crypto.randomUUID());
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
