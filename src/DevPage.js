import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

function DevPage() {
  const { id } = useParams();
  const [circles, setCircles] = useState([]);
  const [connections, setConnections] = useState([]);
  const ws = useRef(null);
  const isDragging = useRef(false);
  const dragStartCircleId = useRef(null);
  const earDragStartPos = useRef({ x: 0, y: 0 });
  const isDraggingEarLeft = useRef(false);
  const isDraggingEarRight = useRef(false);
  const DRAG_THRESHOLD = 20;
  const [tempLine, setTempLine] = useState(null);

  
  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8080/orange/${id}`);
    ws.current.onopen = () => console.log('Connected to WebSocket server for canvas:', id);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'initial-circles') {
        setCircles(data.circles);
        setConnections(data.connections || []);
      } else if (data.type === 'new-circle' || data.type === 'update-circle') {
        setCircles(prevCircles => {
          const existingIndex = prevCircles.findIndex(c => c.id === data.circle.id);
          if (existingIndex > -1) {
            return prevCircles.map(c => c.id === data.circle.id ? data.circle : c);
          } else {
            return [...prevCircles, data.circle];
          }
        });
      } else if (data.type === 'new-connection' || data.type === 'update-connection') {
        setConnections(prevConnections => {
          const existingIndex = prevConnections.findIndex(c => c.id === data.connection.id);
          if (existingIndex > -1) {
            return prevConnections.map(c => c.id === data.connection.id ? data.connection : c);
          } else {
            return [...prevConnections, data.connection];
          }
        });
      }
    };
    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [id]);

  const handleCircleMouseDown = (e, circleId) => {
    // Prevent interaction with ears when moving circles
    if (isDraggingEarLeft.current || isDraggingEarRight.current) return;
    isDragging.current = false;
    dragStartCircleId.current = circleId;
    const startX = e.clientX;
    const startY = e.clientY;
    const moveHandler = (moveEvent) => {
      const moveX = moveEvent.clientX - startX;
      const moveY = moveEvent.clientY - startY;
      if (Math.abs(moveX) > DRAG_THRESHOLD || Math.abs(moveY) > DRAG_THRESHOLD) {
        isDragging.current = true;
        const updatedCircles = circles.map(circle => circle.id === circleId ? { ...circle, x: circle.x + moveX, y: circle.y + moveY } : circle);
        setCircles(updatedCircles);
        ws.current.send(JSON.stringify({ type: 'update-circle', circle: updatedCircles.find(c => c.id === circleId) }));
      }
    };
    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  };

  const handleEarMouseDownLeft = (e, circleId) => {
    // Prevent default event and bubbling to avoid triggering circle drag
    e.preventDefault();
    e.stopPropagation();
    isDraggingEarLeft.current = true;
    dragStartCircleId.current = circleId;
    earDragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleEarMouseDownRight = (e, circleId) => {
    // Prevent default event and bubbling to avoid triggering circle drag
    e.preventDefault();
    e.stopPropagation();
    isDraggingEarRight.current = true;
    dragStartCircleId.current = circleId;
    earDragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingEarRight.current && !isDraggingEarLeft.current) return;
  
    const svg = document.querySelector("svg");
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
  
    const startCircle = circles.find(c => c.id === dragStartCircleId.current);
    if (!startCircle) return;
  
    // Choose the start point based on the ear being dragged
    const startEarX = isDraggingEarLeft.current ? startCircle.x - 35 : startCircle.x + 35;
    const endEarX = mouseX;
  
    // Calculate control points for a sigmoid-like curve
    const cp1x = isDraggingEarLeft.current ? startEarX - Math.abs(startEarX - endEarX) / 3 : startEarX + Math.abs(startEarX - endEarX) / 3;
    const cp2x = isDraggingEarLeft.current ? endEarX + Math.abs(startEarX - endEarX) / 3 : endEarX - Math.abs(startEarX - endEarX) / 3;
  
    setTempLine({
      x1: startEarX, // Start point X
      y1: startCircle.y, // Start point Y
      x2: endEarX, // End point X (mouse X)
      y2: mouseY, // End point Y (mouse Y)
      cp1x: cp1x, // Control point 1 X
      cp1y: startCircle.y, // Control point 1 Y
      cp2x: cp2x, // Control point 2 X
      cp2y: mouseY // Control point 2 Y
    });
  };
  
  

const handleMouseUp = (e) => {
  if (!isDraggingEarRight.current && !isDraggingEarLeft.current) return;

  const svg = document.querySelector("svg");
  const rect = svg.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const targetCircle = circles.find(circle => {
    // We calculate distance to both ears and see if any is within a clickable range
    const leftEarX = circle.x - 35;
    const rightEarX = circle.x + 35;
    const distanceToLeftEar = Math.sqrt((leftEarX - mouseX) ** 2 + (circle.y - mouseY) ** 2);
    const distanceToRightEar = Math.sqrt((rightEarX - mouseX) ** 2 + (circle.y - mouseY) ** 2);
    return (distanceToLeftEar < 10 || distanceToRightEar < 10) && circle.id !== dragStartCircleId.current;
  });

  if (targetCircle) {
    const lr = isDraggingEarLeft.current ? 0 : 1; // Determine the direction based on which ear was dragged
    const newConnection = {
      id: uuidv4(),
      startId: dragStartCircleId.current,
      endId: targetCircle.id,
      lr: lr
    };
    setConnections([...connections, newConnection]);
    ws.current.send(JSON.stringify({ type: 'new-connection', connection: newConnection }));
  }

  isDraggingEarRight.current = false;
  isDraggingEarLeft.current = false;
  dragStartCircleId.current = null;
  setTempLine(null);
};


  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [circles, connections]);

  const renderRightEars = (circle) => {
    // Adjust these values to position the ears correctly relative to your circles
    const earOffset = 35;
    const earRadius = 5;
    return (
      <circle
        cx={circle.x + earOffset}
        cy={circle.y}
        r={earRadius}
        fill="grey"
        onMouseDown={(e) => handleEarMouseDownRight(e, circle.id)}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  const renderLeftEars = (circle) => {
    // Adjust these values to position the ears correctly relative to your circles
    const earOffset = 35;
    const earRadius = 5;
    return (
      <circle
        cx={circle.x - earOffset}
        cy={circle.y}
        r={earRadius}
        fill="grey"
        onMouseDown={(e) => handleEarMouseDownLeft(e, circle.id)}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  const renderConnections = () => connections.map(conn => {
    const startCircle = circles.find(c => c.id === conn.startId);
    const endCircle = circles.find(c => c.id === conn.endId);
    if (!startCircle || !endCircle) return null;
  
    // Correctly calculate starting and ending X coordinates based on the connection direction
    const startEarX = conn.lr === 0 ? startCircle.x - 35 : startCircle.x + 35;
    const endEarX = conn.lr === 0 ? endCircle.x + 35 : endCircle.x - 35;
  
    // Adjust control points to make the curve aesthetically pleasing
    const cp1x = conn.lr === 0 ? startEarX - 40 : startEarX + 40;
    const cp2x = conn.lr === 0 ? endEarX + 40 : endEarX - 40;
  
    const d = `M${startEarX},${startCircle.y} C${cp1x},${startCircle.y} ${cp2x},${endCircle.y} ${endEarX},${endCircle.y}`;
  
    return <path key={conn.id} d={d} stroke="grey" fill="none" />;
  });
  

  const handleDoubleClick = (e, circleId) => {
    if (isDragging.current) {
      return;
    }
    e.stopPropagation(); 
    const updatedCircles = circles.map(circle => {
      if (circle.id === circleId) {
        const newColor = circle.color === 'orange' ? 'blue' : 'orange';
        const updatedCircle = { ...circle, color: newColor };
        ws.current.send(JSON.stringify({ type: 'update-circle-color', circle: updatedCircle }));
        return updatedCircle;
      }
      return circle;
    });
    setCircles(updatedCircles);
  };

  const handleSvgClick = (e) => {
      if (isDraggingEarLeft.current) {
          // Early return if we're dragging an ear, to avoid creating a new circle
          return;
      }

      if (isDraggingEarRight.current) {
        // Early return if we're dragging an ear, to avoid creating a new circle
        return;
    }

      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const clickIsInsideACircle = circles.some(circle => {
          const distance = Math.sqrt((x - circle.x) ** 2 + (y - circle.y) ** 2);
          return distance < circle.r + 10; // Adding a margin to ensure clicks near the edge are recognized
      });
      if (!clickIsInsideACircle) {
          const newCircle = { id: uuidv4(), x, y, r: 28, color: "orange" };
          setCircles([...circles, newCircle]);
          ws.current.send(JSON.stringify({ type: 'new-circle', circle: newCircle }));
      }
  };

  return (
    <svg style={{ width: '100%', height: '100vh' }} onClick={handleSvgClick}>
    {circles.map(circle => (
      <React.Fragment key={circle.id}>
        <circle
          cx={circle.x}
          cy={circle.y}
          r="28"
          fill={circle.color || "orange"} 
          onMouseDown={(e) => handleCircleMouseDown(e, circle.id)}
          onDoubleClick={(e) => handleDoubleClick(e, circle.id)}
          style={{ cursor: 'pointer' }}
        />
        {renderRightEars(circle)}
        {renderLeftEars(circle)}
      </React.Fragment>
      ))}
      {renderConnections()}
      {tempLine && (
        <path
          d={`M${tempLine.x1},${tempLine.y1} C${tempLine.cp1x},${tempLine.cp1y} ${tempLine.cp2x},${tempLine.cp2y} ${tempLine.x2},${tempLine.y2}`}
          stroke="grey"
          strokeWidth="1"
          fill="none"
        />
      )}
    </svg>
  );
  
}

export default DevPage;
