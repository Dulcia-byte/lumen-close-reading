# Lumen DeepSeek proxy

Deploy this directory as a Vercel project and configure these server-side variables:

- `DEEPSEEK_API_KEY`: official DeepSeek API key
- `LUMEN_PROXY_TOKEN`: a long random shared secret used only between the Lumen server and this function
- `DEEPSEEK_MODEL`: optional; defaults to `deepseek-chat`

The Lumen Site must receive `DEEPSEEK_PROXY_URL` (the deployed `/api/chat` URL) and the same secret as `DEEPSEEK_PROXY_TOKEN`. None of these values belong in browser code.
