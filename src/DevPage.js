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

  // useEffect is a React hook for managing side effects in function components
  useEffect(() => {
    // Initialize WebSocket connection
    ws.current = new WebSocket(`ws://localhost:8080/orange/${id}`);
    ws.current.onopen = () => console.log(`Connected to WebSocket server for canvas: ${id}`);
  
    // Handle incoming WebSocket messages
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
  
      // Handle initial setup of circles and connections
      if (data.type === 'initial-circles') {
        setCircles(data.circles);
        setConnections(data.connections || []);
      } 
      // Handle new or updated circle
      else if (['new-circle', 'update-circle'].includes(data.type)) {
        setCircles(prev => updateOrAddItem(prev, data.circle));
      } 
      // Handle name updates
      else if (data.type === 'update-circle-name') {
        updateCircleName(data);
      } 
      // Handle new or updated connection
      else if (['new-connection', 'update-connection'].includes(data.type)) {
        setConnections(prev => updateOrAddItem(prev, data.connection));
      }
    };
  
    // Clean up WebSocket connection on component unmount
    return () => ws.current.readyState === WebSocket.OPEN && ws.current.close();
  }, [id]); // Depend on id to recreate effect if it changes

  useEffect(() => {
    // Register mouse move and mouse up event listeners to handle dragging and dropping actions.
    const handleMouseMoveEvent = (e) => handleMouseMove(e);
    const handleMouseUpEvent = (e) => handleMouseUp(e);
  
    document.addEventListener('mousemove', handleMouseMoveEvent);
    document.addEventListener('mouseup', handleMouseUpEvent);
  
    // Cleanup function: Removes the event listeners to prevent memory leaks.
    return () => {
      document.removeEventListener('mousemove', handleMouseMoveEvent);
      document.removeEventListener('mouseup', handleMouseUpEvent);
    };
  }, [circles, connections]); 



  
  // Helper function to update or add an item (circle or connection)
  function updateOrAddItem(items, newItem) {
    const index = items.findIndex(item => item.id === newItem.id);
    return index > -1
      ? items.map(item => item.id === newItem.id ? newItem : item)
      : [...items, newItem];
  }
  
  // Update circle name if the incoming message is newer
  function updateCircleName(data) {
    const existingCircle = circles.find(c => c.id === data.circleId);
    if (existingCircle && data.timestamp > existingCircle.lastUpdated) {
      setCircles(prev => 
        prev.map(circle => 
          circle.id === data.circleId ? { ...circle, name: data.newName, lastUpdated: data.timestamp } : circle
        )
      );
    }
  }
  
  const handleCircleMouseDown = (e, circleId) => {
    // Early return if dragging an ear to prevent multiple drag operations
    if (isDraggingEarLeft.current || isDraggingEarRight.current) return;
  
    // Initialize drag operation
    isDragging.current = false;
    dragStartCircleId.current = circleId;
    const startPos = { x: e.clientX, y: e.clientY };
  
    // Function to handle mouse movement
    const moveHandler = (moveEvent) => {
      const moveDist = {
        x: moveEvent.clientX - startPos.x,
        y: moveEvent.clientY - startPos.y
      };
  
      // Check if movement exceeds the drag threshold to start dragging
      if (Math.abs(moveDist.x) > DRAG_THRESHOLD || Math.abs(moveDist.y) > DRAG_THRESHOLD) {
        isDragging.current = true;
        // Update circle position and send update to server
        updateCirclePosition(circleId, moveDist);
      }
    };
  
    // Clean up function to stop drag operation
    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };
  
    // Register event listeners for mouse move and mouse up
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  };
  
  // Helper function to update circle position and send update to server
  function updateCirclePosition(circleId, moveDist) {
    const updatedCircles = circles.map(circle =>
      circle.id === circleId ? { ...circle, x: circle.x + moveDist.x, y: circle.y + moveDist.y } : circle
    );
  
    setCircles(updatedCircles);
    ws.current.send(JSON.stringify({ type: 'update-circle', circle: updatedCircles.find(c => c.id === circleId) }));
  }
  
  const handleEarMouseDown = (e, circleId, isLeftEar) => {
    // Log which ear was pressed based on the isLeftEar flag
    console.log(`${isLeftEar ? 'Left' : 'Right'} ear mouse down: ${circleId}`);
  
    // Prevent default event and stop propagation to avoid triggering circle drag
    e.preventDefault();
    e.stopPropagation();
  
    // Set the dragging state and initial position for the correct ear
    if (isLeftEar) {
      isDraggingEarLeft.current = true;
    } else {
      isDraggingEarRight.current = true;
    }
    dragStartCircleId.current = circleId;
    earDragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e) => {
    console.log('Mouse up');
    // Exit early if not dragging
    if (!isDraggingEarRight.current && !isDraggingEarLeft.current) return;
  
    // Calculate mouse position relative to the SVG canvas
    const {left: svgX, top: svgY} = document.querySelector("svg").getBoundingClientRect();
    const mouseX = e.clientX - svgX;
    const mouseY = e.clientY - svgY;
  
    // Check if drag ended on the same circle it started
    if (circles.some(circle => Math.hypot(mouseX - circle.x, mouseY - circle.y) < circle.r + 5 && circle.id === dragStartCircleId.current)) {
      resetDragState();
      return;
    }
  
    // Find a target circle or create a new circle/connection as needed
    const targetCircle = findTargetCircle(mouseX, mouseY);
    targetCircle ? createConnection(targetCircle) : createCircleAndConnection(mouseX, mouseY);
  
    resetDragState();
  };
  
  // Resets drag state and temporary line
  function resetDragState() {
    isDraggingEarRight.current = false;
    isDraggingEarLeft.current = false;
    dragStartCircleId.current = null;
    setTempLine(null);
  }
  
  // Finds a target circle based on mouse position
  function findTargetCircle(mouseX, mouseY) {
    return circles.find(({x, y}) => {
      const distanceToLeftEar = Math.hypot(mouseX - (x - 35), mouseY - y);
      const distanceToRightEar = Math.hypot(mouseX - (x + 35), mouseY - y);
      return (distanceToLeftEar < 50 || distanceToRightEar < 50) && dragStartCircleId.current !== x.id;
    });
  }
  
  // Creates a new connection to an existing circle
  function createConnection(targetCircle) {
    const lr = isDraggingEarLeft.current ? 0 : 1;
    const newConnection = {id: uuidv4(), startId: dragStartCircleId.current, endId: targetCircle.id, lr};
    setConnections(prev => [...prev, newConnection]);
    ws.current.send(JSON.stringify({type: 'new-connection', connection: newConnection}));
  }
  
  // Creates a new circle and connection
  function createCircleAndConnection(mouseX, mouseY) {
    const currentNames = circles.map(c => c.name);
    const newCircle = {id: uuidv4(), x: mouseX, y: mouseY, r: 28, color: "orange", name: getRandomWord(currentNames)};
    const newConnection = {id: uuidv4(), startId: dragStartCircleId.current, endId: newCircle.id, lr: isDraggingEarLeft.current ? 0 : 1};
  
    setCircles(prev => [...prev, newCircle]);
    setConnections(prev => [...prev, newConnection]);
  
    ws.current.send(JSON.stringify({type: 'new-circle', circle: newCircle}));
    ws.current.send(JSON.stringify({type: 'new-connection', connection: newConnection}));
  }

   const renderEars = (circle, isLeftEar) => {
    // Check various conditions: dragging, connection status, and hover state
    const isDraggingThisEar = (isLeftEar ? isDraggingEarLeft.current : isDraggingEarRight.current) && dragStartCircleId.current === circle.id;
    const isConnected = connections.some(conn => (isLeftEar ? conn.endId : conn.startId) === circle.id && conn.lr === 1) || connections.some(conn => (isLeftEar ? conn.startId : conn.endId) === circle.id && conn.lr === 0);
    const isSameCircleDrag = dragStartCircleId.current === circle.id && (isLeftEar ? isDraggingEarRight.current : isDraggingEarLeft.current);
    const isPotentialConnection = (isLeftEar ? hoverTargetRefLeft.current : hoverTargetRefRight.current) === circle.id && (isLeftEar ? isDraggingEarRight.current : isDraggingEarLeft.current) && dragStartCircleId.current !== circle.id;

    const strokeDasharray = isConnected || isDraggingThisEar || isPotentialConnection ? "none" : "3,8";
    const earRadius = circle.r + 8;
    const earStrokeWidth = 3;
    const transparentStrokeWidth = earStrokeWidth * 5;
    const startAngleOffset = 9;
    const tiltOffset = 5;
    const d = `M ${circle.x + (isLeftEar ? -23 : 23)} ,${circle.y - 22 - tiltOffset} a ${earRadius},${earRadius} 0 0,${(isLeftEar ? 0.5 : 1.5)} ${earRadius*2 - (startAngleOffset * 2)},0`;
    const isHovered = hoveredEar === (isLeftEar ? `left-${circle.id}` : `right-${circle.id}`) && !isSameCircleDrag;
    const transitionStyle = { transition: 'stroke 0.1s ease-in-out' };
    const disableHover = (isLeftEar ? isDraggingEarLeft.current : isDraggingEarRight.current);
  
    return (
      <>
        <path
          d={d}
          fill="none"
          stroke={(isHovered || isConnected || isDraggingThisEar || isPotentialConnection) ? "#9cacb4" : "#cdd5d9"}
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
          onMouseDown={(e) => handleEarMouseDown(e, circle.id, false)}
          onMouseEnter={() => !disableHover && (isLeftEar ? setHoveredEar(`left-${circle.id}`) : setHoveredEar(`right-${circle.id}`))}
          onMouseLeave={() => setHoveredEar(null)}
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
        {renderEars(circle, false)}
        {renderEars(circle, true)}
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