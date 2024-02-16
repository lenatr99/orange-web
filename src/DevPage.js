import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import './DevPage.css'; 

const randomWords = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];

function getRandomWord(exclude = []) {
  const availableWords = randomWords.filter(word => !exclude.includes(word));
  return availableWords[Math.floor(Math.random() * availableWords.length)];
}

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
  const [hoveredEar, setHoveredEar] = useState(null);
  const hoverTargetRefRight = useRef(null);
  const hoverTargetRefLeft = useRef(null);


  
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
      } else if (data.type === 'update-circle-name') {
        // Assume each message has a timestamp or sequence number
        const existingCircle = circles.find(c => c.id === data.circleId);
        if (existingCircle) {
          // Only update if the incoming message is newer than the current state
          if (data.timestamp > existingCircle.lastUpdated) {
            setCircles(prevCircles =>
              prevCircles.map(circle =>
                circle.id === data.circleId ? { ...circle, name: data.newName, lastUpdated: data.timestamp } : circle
              )
            );
          }
        }
      }
       else if (data.type === 'new-connection' || data.type === 'update-connection') {
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
    console.log(`Circle mouse down: ${circleId}`);
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
    console.log(`Left ear mouse down: ${circleId}`);
    // Prevent default event and bubbling to avoid triggering circle drag
    e.preventDefault();
    e.stopPropagation();
    isDraggingEarLeft.current = true;
    dragStartCircleId.current = circleId;
    earDragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleEarMouseDownRight = (e, circleId) => {
    console.log(`Right ear mouse down: ${circleId}`);
    // Prevent default event and bubbling to avoid triggering circle drag
    e.preventDefault();
    e.stopPropagation();
    isDraggingEarRight.current = true;
    dragStartCircleId.current = circleId;
    earDragStartPos.current = { x: e.clientX, y: e.clientY };
  };


const handleMouseUp = (e) => {
  console.log('Mouse up');
  if (!isDraggingEarRight.current && !isDraggingEarLeft.current) return;

  const svg = document.querySelector("svg");
  const rect = svg.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const isEndingOnSameCircle = circles.some(circle => {
    const distance = Math.sqrt((mouseX - circle.x) ** 2 + (mouseY - circle.y) ** 2);
    return distance < circle.r + 5 && circle.id === dragStartCircleId.current;
  });

  if (isEndingOnSameCircle) {
    // If dragging ends on the same circle, do nothing
    isDraggingEarRight.current = false;
    isDraggingEarLeft.current = false;
    dragStartCircleId.current = null;
    setTempLine(null);
    return; // Exit the function to prevent any further action
  }

  const targetCircle = circles.find(circle => {
    // We calculate distance to both ears and see if any is within a clickable range
    const leftEarX = circle.x - 35;
    const rightEarX = circle.x + 35;
    const distanceToLeftEar = Math.sqrt((leftEarX - mouseX) ** 2 + (circle.y - mouseY) ** 2);
    const distanceToRightEar = Math.sqrt((rightEarX - mouseX) ** 2 + (circle.y - mouseY) ** 2);
    return (distanceToLeftEar < 50 || distanceToRightEar < 50) && circle.id !== dragStartCircleId.current;
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

  if (!targetCircle) {
    const currentNames = circles.map(c => c.name);
    const newCircle = {
      id: uuidv4(),
      x: mouseX,
      y: mouseY,
      r: 28,
      color: "orange",
      name: getRandomWord(currentNames),
    };

    // Add the new circle to the state
    setCircles([...circles, newCircle]);

    // Create a new connection from the ear being dragged to the new circle
    const lr = isDraggingEarLeft.current ? 0 : 1;
    const newConnection = {
      id: uuidv4(),
      startId: dragStartCircleId.current,
      endId: newCircle.id,
      lr: lr
    };

    // Add the new connection to the state
    setConnections([...connections, newConnection]);

    // Send the new circle and connection to the server
    ws.current.send(JSON.stringify({ type: 'new-circle', circle: newCircle }));
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
    const isDraggingThisRightEar = isDraggingEarRight.current && dragStartCircleId.current === circle.id;
    const isConnectedRight = connections.some(conn => conn.startId === circle.id && conn.lr === 1) || connections.some(conn => conn.endId === circle.id && conn.lr === 0);
    const isSameCircleDrag = dragStartCircleId.current === circle.id && isDraggingEarLeft.current;
    const isPotentialConnectionRight = hoverTargetRefRight.current === circle.id && isDraggingEarLeft.current && dragStartCircleId.current !== circle.id;
    const strokeDasharray = isConnectedRight || isDraggingThisRightEar || isPotentialConnectionRight ? "none" : "3,8";
    const earRadius = circle.r + 8; 
    const earStrokeWidth = 3;
    const transparentStrokeWidth = earStrokeWidth * 5; 
    const startAngleOffset = 9;
    const tiltOffset = 5;
    const d = `
      M ${circle.x + 23} ,${circle.y - 22 - tiltOffset} 
      a ${earRadius},${earRadius} 0 0,1.5 ${earRadius*2 - (startAngleOffset * 2)},${tiltOffset * 2}
    `;
    const isHovered = hoveredEar === `right-${circle.id}` && !isSameCircleDrag;
    const transitionStyle = {
      transition: 'stroke 0.1s ease-in-out',
    };
    const disableHover = isDraggingEarRight.current;
  

    return (
      <>
        <path
          d={d}
          fill="none"
          stroke={(isHovered || isConnectedRight || isDraggingThisRightEar || isPotentialConnectionRight) ? "#9cacb4" : "#cdd5d9"}
          strokeWidth={earStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{ cursor: !disableHover ? 'pointer' : 'default', ...transitionStyle }}
        />
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={transparentStrokeWidth}
          strokeLinecap="round"
          onMouseDown={(e) => handleEarMouseDownRight(e, circle.id)}
          onMouseEnter={() => {
            if (!disableHover) {
              console.log(`Mouse enter right ear: ${circle.id}`);
              setHoveredEar(`right-${circle.id}`);
              console.log('Setting right hover target:', circle.id);
              hoverTargetRefRight.current = circle.id;
            }
          }}
          onMouseLeave={() => {
            console.log(`Mouse leave right ear: ${circle.id}`);
            setHoveredEar(null);
            hoverTargetRefRight.current = null;
          }}
          style={{ cursor: !disableHover ? 'pointer' : 'default', ...transitionStyle }}
        />
      </>
    );
  };
  

  const renderLeftEars = (circle) => {
    const isDraggingThisLeftEar = isDraggingEarLeft.current && dragStartCircleId.current === circle.id;
    const isConnectedLeft = connections.some(conn => conn.endId === circle.id && conn.lr === 1) || connections.some(conn => conn.startId === circle.id && conn.lr === 0);
    const isSameCircleDrag = dragStartCircleId.current === circle.id && isDraggingEarRight.current
    const isPotentialConnection = hoverTargetRefLeft.current === circle.id && isDraggingEarRight.current && dragStartCircleId.current !== circle.id;
    const strokeDasharray = isConnectedLeft || isDraggingThisLeftEar || isPotentialConnection ? "none" : "3,8";
    const earRadius = circle.r + 8;
    const earStrokeWidth = 3;
    const transparentStrokeWidth = earStrokeWidth * 5; 
    const startAngleOffset = 9;
    const tiltOffset = -5;
    const d = `
      M ${circle.x - 23} ,${circle.y - 22 + tiltOffset}  
      a ${earRadius},${earRadius} 0 0,0.5 ${earRadius*2 - (startAngleOffset * 2)},${tiltOffset * 2}
    `;
    const isHovered = hoveredEar === `left-${circle.id}` && !isSameCircleDrag;
    const transitionStyle = {
      transition: 'stroke 0.1s ease-in-out',
    };
    const disableHover = isDraggingEarLeft.current;
    
  
    return (
      <>
        <path
          d={d}
          fill="none"
          stroke={(isHovered || isConnectedLeft || isDraggingThisLeftEar ||  isPotentialConnection)  ? "#9cacb4" : "#cdd5d9"}
          strokeWidth={earStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{ cursor: !disableHover ? 'pointer' : 'default', ...transitionStyle }}
        />
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={transparentStrokeWidth}
          strokeLinecap="round"
          onMouseDown={(e) => handleEarMouseDownLeft(e, circle.id)}
          onMouseEnter={() => {
            if (!disableHover) {
              console.log(`Mouse enter left ear: ${circle.id}`);
              setHoveredEar(`left-${circle.id}`);
              console.log('Setting left hover target:', circle.id);
              hoverTargetRefLeft.current = circle.id;
              
            }
          }}
          onMouseLeave={() => {
            console.log(`Mouse leave left ear: ${circle.id}`);
            setHoveredEar(null);
            hoverTargetRefLeft.current = null;
          }}
          style={{ cursor: !disableHover ? 'pointer' : 'default', ...transitionStyle }}
        />
      </>
    );
  };


  const handleMouseMove = (e) => {
    console.log('Mouse move');
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

    if (hoverTargetRefLeft.current && startCircle.id !== hoverTargetRefLeft.current) {
      console.log('Hover left target:', hoverTargetRefLeft.current);
      // Adjust tempLine to directly connect to hoverTarget's left ear
      const targetCircle = circles.find(c => c.id === hoverTargetRefLeft.current);
      if (targetCircle) {
        setTempLine({
          x1: startEarX,
          y1: startCircle.y,
          x2: targetCircle.x - 35, // Target circle's left ear position
          y2: targetCircle.y,
          cp1x: startEarX + Math.abs(startEarX - endEarX) / 3, // Control point 1 X
          cp1y: startCircle.y, // Control point 1 Y
          cp2x: (targetCircle.x - 35) - Math.abs(startEarX - (targetCircle.x - 35)) / 3, // Control point 2 X
          cp2y: targetCircle.y
        });
      }
    } else if (hoverTargetRefRight.current && startCircle.id !== hoverTargetRefRight.current) {
      console.log('Hover right target:', hoverTargetRefRight.current);
      // Adjust tempLine to directly connect to hoverTarget's rigth ear
      const targetCircle = circles.find(c => c.id === hoverTargetRefRight.current);
      if (targetCircle) {
        setTempLine({
          x1: startEarX,
          y1: startCircle.y,
          x2: targetCircle.x + 35, // Target circle's left ear position
          y2: targetCircle.y,
          cp1x: startEarX - Math.abs(startEarX - endEarX) / 3, // Control point 1 X
          cp1y: startCircle.y, // Control point 1 Y
          cp2x: (targetCircle.x + 35) + Math.abs(startEarX - (targetCircle.x + 35)) / 3, // Control point 2 X
          cp2y: targetCircle.y
        });
      }
    } else {
  

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
    }
  };
  
  

  const renderConnections = () => connections.map(conn => {
    const startCircle = circles.find(c => c.id === conn.startId);
    const endCircle = circles.find(c => c.id === conn.endId);
    if (!startCircle || !endCircle) return null;
  
    // Correctly calculate starting and ending X coordinates based on the connection direction
    const startEarX = conn.lr === 0 ? startCircle.x - 35 : startCircle.x + 35;
    const endEarX = conn.lr === 0 ? endCircle.x + 35 : endCircle.x - 35;
  
    // Adjust control points to make the curve aesthetically pleasing
    const cp1x = conn.lr === 0 ? startEarX - Math.abs(startEarX - endEarX) / 3 : startEarX + Math.abs(startEarX - endEarX) / 3;
    const cp2x = conn.lr === 0 ? endEarX + Math.abs(startEarX - endEarX) / 3 : endEarX - Math.abs(startEarX - endEarX) / 3;
  
    const d = `M${startEarX},${startCircle.y} C${cp1x},${startCircle.y} ${cp2x},${endCircle.y} ${endEarX},${endCircle.y}`;
  
    return <path key={conn.id} d={d} stroke="#9cacb4" strokeWidth="2" fill="none" />;
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
          return;
      }

      if (isDraggingEarRight.current) {
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
        const currentNames = circles.map(c => c.name);
        const newCircle = {
          id: uuidv4(),
          x,
          y,
          r: 28,
          color: "orange",
          name: getRandomWord(currentNames), // Assign a random unique name
        };
        setCircles([...circles, newCircle]);
        ws.current.send(JSON.stringify({ type: 'new-circle', circle: newCircle }));
      }
  };

const handleChangeName = (e, circleId) => {
  e.preventDefault();
  e.stopPropagation();

  // Immediate call to update the name to ensure UI responsiveness.
  const currentCircle = circles.find(c => c.id === circleId);
  if (!currentCircle) return; // Guard clause if circle not found

  const currentNames = circles.map(c => c.name).filter(name => name !== currentCircle.name);
  const newName = getRandomWord(currentNames);

  // Ensure the newName is different and valid
  if (newName && currentCircle.name !== newName) {
    // Optimistically update the local state to reflect the change
    setCircles(prevCircles =>
      prevCircles.map(circle =>
        circle.id === circleId ? { ...circle, name: newName, lastUpdated: Date.now() } : circle
      )
    );

    console.log('Sending update to server:', { circleId, newName });

    // Send the update to the server
    ws.current.send(JSON.stringify({ type: 'update-circle-name', circleId, newName }));
  }
};


  

  const renderCircleNames = (circle) => {
    const name = circle.name || "";
    // Measure text size (approximation)
    const padding = 4; // Add some padding around the text
    const rectHeight = 20; // Approximate height of the text
    const rectWidth = name.length * 8; // Approximate width of the text
    
    return (
      <>
        <text
          x={circle.x}
          y={circle.y + circle.r + 15} // Adjusted to align with the bottom of the rectangle
          fontSize="12"
          textAnchor="middle"
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {circle.name}
        </text>
        <rect
          x={circle.x - rectWidth / 2 - padding / 2}
          y={circle.y + circle.r + 2} 
          width={rectWidth + padding}
          height={rectHeight}
          fill="transparent" 
          onClick={(e) => handleChangeName(e, circle.id)}
          style={{ cursor: 'pointer' }}
        />
      </>
    );
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
          onMouseEnter={() => {
            console.log('isdraggingearright', isDraggingEarRight.current, 'isdraggingearleft', isDraggingEarLeft.current)
            if (isDraggingEarLeft.current && dragStartCircleId.current !== circle.id) {
              console.log(`hovered left circle: ${circle.id}`);
              hoverTargetRefRight.current = circle.id;
            }
            else if (isDraggingEarRight.current && dragStartCircleId.current !== circle.id) {
              console.log(`hovered right circle: ${circle.id}`);
              hoverTargetRefLeft.current = circle.id;
            }
          }}
          onMouseLeave={() => {
              hoverTargetRefRight.current = null;
              hoverTargetRefLeft.current = circle.null;
          }}
          style={{ cursor: 'pointer' }}
        />
        {renderCircleNames(circle)}
        {renderRightEars(circle)}
        {renderLeftEars(circle)}
      </React.Fragment>
      ))}
      {renderConnections()}
      {tempLine && (
        <path
          d={`M${tempLine.x1},${tempLine.y1} C${tempLine.cp1x},${tempLine.cp1y} ${tempLine.cp2x},${tempLine.cp2y} ${tempLine.x2},${tempLine.y2}`}
          stroke="#9cacb4"
          strokeWidth="2"
          fill="none"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
  
}

export default DevPage;