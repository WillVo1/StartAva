require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const app = express();

app.use(express.json());
app.use(express.static('.'));

const mcpServer = spawn('node', ['/Users/vo/Documents/Nurse Ava/ai-health/dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
});

function sendMcpRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
        const request = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) + '\n';
        mcpServer.stdout.once('data', (data) => {
            try { resolve(JSON.parse(data.toString())); } catch (e) { reject(e); }
        });
        mcpServer.stdin.write(request);
    });
}

(async () => {
    await sendMcpRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nurse-ava-client', version: '1.0.0' }
    });
})();

app.get('/api/key', (req, res) => res.json({ key: process.env.OPENAI_API_KEY }));

app.get('/api/mcp-tools', async (req, res) => {
    const toolsResponse = await sendMcpRequest('tools/list');
    const tools = toolsResponse.result.tools.map(tool => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
    }));
    res.json(tools);
});

app.post('/api/mcp-call', async (req, res) => {
    const { name, arguments: args } = req.body;
    const result = await sendMcpRequest('tools/call', { name, arguments: args });
    res.json(result.result.content[0].text);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));

process.on('exit', () => mcpServer.kill());
