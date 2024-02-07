import React, { useEffect, useState } from 'react';

function DevPage() {
  const [circles, setCircles] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const webSocket = new WebSocket('ws://localhost:8080');
    setWs(webSocket);
  
    webSocket.onopen = () => console.log('Connected to WebSocket server');
  
    webSocket.onmessage = (event) => {
      console.log('Message from server:', event.data);
      const message = JSON.parse(event.data);
      if (message.type === 'new-circle') {
        setCircles((prevCircles) => [...prevCircles, message.circle]);
      }
    };
  
    return () => {
      webSocket.close();
    };
  }, []); // Note: Removed circles from the dependency array
  

  const addCircle = (e) => {
    const newCircle = { x: e.clientX, y: e.clientY };
    setCircles([...circles, newCircle]);

    // Send new circle to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'new-circle', circle: newCircle }));
    }
  };

  return (
    <div onClick={addCircle} style={{ height: '100vh', position: 'relative' }}>
      {circles.map((circle, index) => (
        <div
        key={index}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '28px', // Half of width/height to make it circle
          backgroundColor: 'orange',
          position: 'absolute',
          left: circle.x - 28, // Adjust for cursor position and circle centering
          top: circle.y - 28,
        }}
      ></div>
      ))}
    </div>
  );
}

export default DevPage;

