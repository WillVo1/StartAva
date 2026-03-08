import OpenAI from 'openai';
import 'dotenv/config';
import { spawn } from 'child_process';

const client = new OpenAI();

// Start MCP server as subprocess using stdio
const mcpServer = spawn('node', ['/Users/vo/Documents/Nurse Ava/ai-health/dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
});

// Helper to send JSON-RPC request
function sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
        const request = JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        }) + '\n';
        
        mcpServer.stdout.once('data', (data) => {
            try {
                const response = JSON.parse(data.toString());
                resolve(response);
            } catch (e) {
                reject(e);
            }
        });
        
        mcpServer.stdin.write(request);
    });
}

// Initialize
await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'nurse-ava-client', version: '1.0.0' }
});

// Get tools
const toolsResponse = await sendRequest('tools/list');
const tools = toolsResponse.result.tools;

// Convert to OpenAI format
const openaiTools = tools.map(tool => ({
    type: 'function',
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
    }
}));

const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Here is my number +18047297894 send me a message of leg pain emergency' }],
    tools: openaiTools
});

const message = completion.choices[0].message;

if (message.tool_calls) {
    for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await sendRequest('tools/call', {
            name: toolCall.function.name,
            arguments: args
        });
        console.log('Tool result:', result.result.content[0].text);
    }
} else {
    console.log(message.content);
}

mcpServer.kill();
