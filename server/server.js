const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const clients = new Set();

wss.on('connection', function connection(ws) {
  clients.add(ws);

  ws.on('message', function incoming(message) {
    // Broadcast incoming message to all clients except the sender
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

console.log('WebSocket server started on ws://localhost:8080');
