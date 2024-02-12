import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

function DevPage() {
  const { id } = useParams();
  const [circles, setCircles] = useState([]);
  const ws = useRef(null);
  const isDragging = useRef(false);
  const DRAG_THRESHOLD = 20;
  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8080/orange/${id}`);
    ws.current.onopen = () => console.log('Connected to WebSocket server for canvas:', id);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'initial-circles' || data.type === 'new-circle' || data.type === 'update-circle') {
        setCircles(prevCircles => {
          if (data.type === 'initial-circles') {
            return data.circles;
          } else {
            const existingIndex = prevCircles.findIndex(c => c.id === data.circle.id);
            if (existingIndex > -1) {
              return prevCircles.map(c => c.id === data.circle.id ? data.circle : c);
            } else {
              return [...prevCircles, data.circle];
            }
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
  
  const handleSvgClick = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickIsInsideACircle = circles.some(circle => {
      const distance = Math.sqrt((x - circle.x) ** 2 + (y - circle.y) ** 2);
      return distance < circle.r;
    });
    if (clickIsInsideACircle) {
      return;
    }

    const newCircle = { id: uuidv4(), x, y, r: 28, color: "orange" };
    setCircles([...circles, newCircle]);
    ws.current.send(JSON.stringify({ type: 'new-circle', circle: newCircle }));
  };

  const handleMouseDown = (e, circleId) => {
    e.stopPropagation();
    isDragging.current = false; 
    const startX = e.clientX;
    const startY = e.clientY;
    const handleMouseMove = (moveEvent) => {
        const moveX = moveEvent.clientX - startX;
        const moveY = moveEvent.clientY - startY;
        if (Math.abs(moveX) > DRAG_THRESHOLD || Math.abs(moveY) > DRAG_THRESHOLD) {
            isDragging.current = true; 
            const updatedCircles = circles.map(circle => {
              if (circle.id === circleId && isDragging.current) {
                return { ...circle, x: circle.x + moveX, y: circle.y + moveY };
              }
              return circle;
            });
            setCircles(updatedCircles);
            ws.current.send(JSON.stringify({ type: 'update-circle', circle: updatedCircles.find(c => c.id === circleId) 
          }));
        }
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (!isDragging.current) {
        }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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

  return (
    <svg style={{ width: '100%', height: '100vh' }} onClick={handleSvgClick}>
      {circles.map(circle => (
        <circle
          key={circle.id}
          cx={circle.x}
          cy={circle.y}
          r="28"
          fill={circle.color || "orange"} 
          onMouseDown={(e) => handleMouseDown(e, circle.id)}
          onDoubleClick={(e) => handleDoubleClick(e, circle.id)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </svg>
  );
}

export default DevPage;