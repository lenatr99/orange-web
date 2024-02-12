const WebSocket = require('ws');
const url = require('url');
const http = require('http');
const canvasStates = {};

const broadcastMessage = (id, message, sender) => {
  const clients = canvasStates[id] ? canvasStates[id].clients : new Set();
  clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  if (pathname.startsWith('/orange/')) {
    const id = pathname.split('/').pop(); 
    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request, id);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', function connection(ws, request, id) {
  console.log(`Connected to canvas: ${id}`);
  if (!canvasStates[id]) {
    canvasStates[id] = {
      clients: new Set(),
      circles: []
    };
  }
  const state = canvasStates[id];
  state.clients.add(ws);
  ws.send(JSON.stringify({ type: 'initial-circles', circles: state.circles }));
  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);

    switch (data.type) {
        case 'new-circle':
            const newCircle = { ...data.circle, id: data.circle.id || Date.now().toString() };
            state.circles.push(newCircle);
            broadcastMessage(id, JSON.stringify({ type: 'new-circle', circle: newCircle }), ws);
            break;
        case 'update-circle':
            const index = state.circles.findIndex(circle => circle.id === data.circle.id);
            if (index !== -1) {
                state.circles[index] = data.circle;
                broadcastMessage(id, JSON.stringify({ type: 'update-circle', circle: data.circle }), ws);
            }
            break;
        case 'update-circle-color':
            const circleIndex = state.circles.findIndex(c => c.id === data.circle.id);
            if (circleIndex !== -1) {
              state.circles[circleIndex].color = data.circle.color;
              broadcastMessage(id, JSON.stringify({ type: 'update-circle-color', circle: data.circle }), ws);
            }
            break;
    }
  });

  ws.on('close', () => {
    state.clients.delete(ws); // Remove the client from the canvas on disconnect
    // if (state.clients.size === 0) {
    //   delete canvasStates[id]; // Optionally clean up state if no clients are connected to the canvas
    // }
  });
});

server.listen(8080, () => {
  console.log('WebSocket server started on ws://localhost:8080');
});
