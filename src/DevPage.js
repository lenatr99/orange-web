import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import "./DevPage.css";

const randomWords = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
  "India",
  "Juliett",
  "Kilo",
  "Lima",
  "Mike",
  "November",
  "Oscar",
  "Papa",
  "Quebec",
  "Romeo",
  "Sierra",
  "Tango",
  "Uniform",
  "Victor",
  "Whiskey",
  "X-ray",
  "Yankee",
  "Zulu",
];

function getRandomWord(exclude = []) {
  const availableWords = randomWords.filter((word) => !exclude.includes(word));
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
    ws.current.onopen = () =>
      console.log(`Connected to WebSocket server for canvas: ${id}`);

    // Handle incoming WebSocket messages
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        // Handle initial setup of circles and connections
        case "initial-circles":
          setCircles(data.circles);
          setConnections(data.connections || []);
          break;
        case "new-circle":
          setCircles((prev) => updateOrAddItem(prev, data.circle));
          break;
        case "update-circle":
          setCircles((prev) => updateOrAddItem(prev, data.circle));
          break;
        case "update-circle-name":
          setCircles((circles) =>
            circles.map((circle) => {
              return circle.id === data.circleId
                ? { ...circle, name: data.newName }
                : circle;
            })
          );
          break;
        case "new-connection" || "update-connection":
          setConnections((prev) => updateOrAddItem(prev, data.connection));
          break;
        case "update-circle-name":
          setCircles((circles) =>
            circles.map((circle) => {
              return circle.id === data.circleId
                ? { ...circle, name: data.newName }
                : circle;
            })
          );
          break;
        case "update-circle-color":
          setCircles((circles) =>
            circles.map((circle) => {
              return circle.id === data.circle.id
                ? { ...circle, color: data.circle.color }
                : circle;
            })
          );
          break;
      }
    };

    // Clean up WebSocket connection on component unmount
    return () => ws.current.readyState === WebSocket.OPEN && ws.current.close();
  }, [id]); // Depend on id to recreate effect if it changes

  useEffect(() => {
    // Register mouse move and mouse up event listeners to handle dragging and dropping actions.
    const handleMouseMoveEvent = (e) => handleMouseMove(e);
    const handleMouseUpEvent = (e) => handleMouseUp(e);

    document.addEventListener("mousemove", handleMouseMoveEvent);
    document.addEventListener("mouseup", handleMouseUpEvent);

    // Cleanup function: Removes the event listeners to prevent memory leaks.
    return () => {
      document.removeEventListener("mousemove", handleMouseMoveEvent);
      document.removeEventListener("mouseup", handleMouseUpEvent);
    };
  }, [circles, connections]);

  // Helper function to update or add an item (circle or connection)
  function updateOrAddItem(items, newItem) {
    const index = items.findIndex((item) => item.id === newItem.id);
    return index > -1
      ? items.map((item) => (item.id === newItem.id ? newItem : item))
      : [...items, newItem];
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
        y: moveEvent.clientY - startPos.y,
      };

      // Check if movement exceeds the drag threshold to start dragging
      if (
        Math.abs(moveDist.x) > DRAG_THRESHOLD ||
        Math.abs(moveDist.y) > DRAG_THRESHOLD
      ) {
        isDragging.current = true;
        // Update circle position and send update to server
        updateCirclePosition(circleId, moveDist);
      }
    };

    // Clean up function to stop drag operation
    const upHandler = () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
    };

    // Register event listeners for mouse move and mouse up
    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  };

  // Helper function to update circle position and send update to server
  function updateCirclePosition(circleId, moveDist) {
    const updatedCircles = circles.map((circle) =>
      circle.id === circleId
        ? { ...circle, x: circle.x + moveDist.x, y: circle.y + moveDist.y }
        : circle
    );

    setCircles(updatedCircles);
    ws.current.send(
      JSON.stringify({
        type: "update-circle",
        circle: updatedCircles.find((c) => c.id === circleId),
      })
    );
  }

  const handleEarMouseDown = (e, circleId, isLeftEar) => {
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
    // Exit early if not dragging
    if (!isDraggingEarRight.current && !isDraggingEarLeft.current) return;

    // Calculate mouse position relative to the SVG canvas
    const { left: svgX, top: svgY } = document
      .querySelector("svg")
      .getBoundingClientRect();
    const mouseX = e.clientX - svgX;
    const mouseY = e.clientY - svgY;

    // Check if drag ended on the same circle it started
    if (
      circles.some(
        (circle) =>
          Math.hypot(mouseX - circle.x, mouseY - circle.y) < circle.r + 5 &&
          circle.id === dragStartCircleId.current
      )
    ) {
      resetDragState();
      return;
    }

    // Find a target circle or create a new circle/connection as needed
    const targetCircle = findTargetCircle(mouseX, mouseY);
    if (targetCircle) {
      // Prevent creating a connection if the target circle is the same as the starting circle
      if (targetCircle.id !== dragStartCircleId.current) {
        createConnection(targetCircle);
      }
    } else {
      createCircleAndConnection(mouseX, mouseY);
    }

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
    return circles.find((circle) => {
      const distanceToLeftEar = Math.hypot(
        mouseX - (circle.x - 35),
        mouseY - circle.y
      );
      const distanceToRightEar = Math.hypot(
        mouseX - (circle.x + 35),
        mouseY - circle.y
      );
      return (
        (distanceToLeftEar < 50 || distanceToRightEar < 50) &&
        circle.id !== dragStartCircleId.current
      );
    });
  }

  // Creates a new connection to an existing circle
  function createConnection(targetCircle) {
    const lr = isDraggingEarLeft.current ? 0 : 1;
    const newConnection = {
      id: uuidv4(),
      startId: dragStartCircleId.current,
      endId: targetCircle.id,
      lr,
    };
    setConnections((prev) => [...prev, newConnection]);
    ws.current.send(
      JSON.stringify({ type: "new-connection", connection: newConnection })
    );
  }

  // Creates a new circle and connection
  function createCircleAndConnection(mouseX, mouseY) {
    const currentNames = circles.map((c) => c.name);
    const newCircle = {
      id: uuidv4(),
      x: mouseX,
      y: mouseY,
      r: 28,
      color: "orange",
      name: getRandomWord(currentNames),
    };
    const newConnection = {
      id: uuidv4(),
      startId: dragStartCircleId.current,
      endId: newCircle.id,
      lr: isDraggingEarLeft.current ? 0 : 1,
    };

    setCircles((prev) => [...prev, newCircle]);
    setConnections((prev) => [...prev, newConnection]);

    ws.current.send(JSON.stringify({ type: "new-circle", circle: newCircle }));
    ws.current.send(
      JSON.stringify({ type: "new-connection", connection: newConnection })
    );
  }

  // Renders ear components for a circle, differentiating between left and right ears.
  const renderEars = (circle, isLeftEar) => {
    const earRadius = circle.r + 8;
    const transitionStyle = { transition: "stroke 0.1s ease-in-out" };

    // Determine state: is dragging, is connected, hover state, potential connection
    const isDraggingThisEar =
      (isLeftEar ? isDraggingEarLeft : isDraggingEarRight).current &&
      dragStartCircleId.current === circle.id;
    const isConnected = connections.some(
      (conn) =>
        ((isLeftEar ? conn.endId : conn.startId) === circle.id &&
          conn.lr === 1) ||
        ((isLeftEar ? conn.startId : conn.endId) === circle.id && conn.lr === 0)
    );
    const isSameCircleDrag =
      dragStartCircleId.current === circle.id &&
      (isLeftEar ? isDraggingEarRight : isDraggingEarLeft).current;
    const isPotentialConnection =
      (isLeftEar ? hoverTargetRefLeft : hoverTargetRefRight).current ===
        circle.id &&
      !isSameCircleDrag &&
      dragStartCircleId.current !== circle.id;

    // Style adjustments based on state
    const strokeDasharray =
      isConnected || isDraggingThisEar || isPotentialConnection
        ? "none"
        : "3,8";
    const d = `M ${circle.x + (isLeftEar ? -23 : 23)} ,${
      circle.y - 27
    } a ${earRadius},${earRadius} 0 0,${isLeftEar ? 0.5 : 1.5} ${
      earRadius * 2 - 18
    },0`;

    // Hover effects and interaction handling
    const isHovered =
      hoveredEar === `${isLeftEar ? "left" : "right"}-${circle.id}`;
    const disableHover = isDraggingThisEar || isSameCircleDrag;

    return (
      <>
        {/* Visual representation of the ear */}
        <path
          d={d}
          fill="none"
          stroke={
            isHovered || isConnected || isDraggingThisEar
              ? "#9cacb4"
              : "#cdd5d9"
          }
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{
            cursor: disableHover ? "default" : "pointer",
            ...transitionStyle,
          }}
        />
        {/* Invisible area to enhance interaction */}
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth="15"
          strokeLinecap="round"
          onMouseDown={(e) => handleEarMouseDown(e, circle.id, isLeftEar)}
          onMouseEnter={() =>
            !disableHover &&
            setHoveredEar(`${isLeftEar ? "left" : "right"}-${circle.id}`)
          }
          onMouseLeave={() => setHoveredEar(null)}
          style={{ cursor: disableHover ? "default" : "pointer" }}
        />
      </>
    );
  };

  const handleMouseMove = (e) => {
    // Skip if not dragging
    if (!isDraggingEarRight.current && !isDraggingEarLeft.current) return;

    // Calculate mouse position relative to the SVG
    const svg = document.querySelector("svg");
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find the circle being dragged
    const startCircle = circles.find((c) => c.id === dragStartCircleId.current);
    if (!startCircle) return; // Exit if no start circle found

    // Determine starting ear X based on dragging ear
    const startEarX = isDraggingEarLeft.current
      ? startCircle.x - 35
      : startCircle.x + 35;

    // Calculate control points for curve
    const cp1x = isDraggingEarLeft.current
      ? startEarX - Math.abs(startEarX - mouseX) / 3
      : startEarX + Math.abs(startEarX - mouseX) / 3;
    const cp2x = isDraggingEarLeft.current
      ? mouseX + Math.abs(startEarX - mouseX) / 3
      : mouseX - Math.abs(startEarX - mouseX) / 3;

    // Adjust tempLine for direct connection to hovered target or follow mouse
    const hoverTargetCurrent = isDraggingEarLeft.current
      ? hoverTargetRefLeft.current
      : hoverTargetRefRight.current;
    if (hoverTargetCurrent && startCircle.id !== hoverTargetCurrent) {
      const targetCircle = circles.find((c) => c.id === hoverTargetCurrent);
      if (targetCircle) {
        setTempLine({
          x1: startEarX,
          y1: startCircle.y,
          x2: targetCircle.x - (isDraggingEarLeft.current ? 35 : -35), // Adjust target X based on ear side
          y2: targetCircle.y,
          cp1x: cp1x,
          cp1y: startCircle.y,
          cp2x: cp2x,
          cp2y: targetCircle.y,
        });
      }
    } else {
      setTempLine({
        // Update temporary line based on mouse movement
        x1: startEarX,
        y1: startCircle.y,
        x2: mouseX,
        y2: mouseY,
        cp1x: cp1x,
        cp1y: startCircle.y,
        cp2x: cp2x,
        cp2y: mouseY,
      });
    }
  };

  const renderConnections = () =>
    connections.map((conn) => {
      const startCircle = circles.find((c) => c.id === conn.startId);
      const endCircle = circles.find((c) => c.id === conn.endId);
      if (!startCircle || !endCircle) return null;

      // Correctly calculate starting and ending X coordinates based on the connection direction
      const startEarX = conn.lr === 0 ? startCircle.x - 35 : startCircle.x + 35;
      const endEarX = conn.lr === 0 ? endCircle.x + 35 : endCircle.x - 35;

      // Adjust control points to make the curve aesthetically pleasing
      const cp1x =
        conn.lr === 0
          ? startEarX - Math.abs(startEarX - endEarX) / 3
          : startEarX + Math.abs(startEarX - endEarX) / 3;
      const cp2x =
        conn.lr === 0
          ? endEarX + Math.abs(startEarX - endEarX) / 3
          : endEarX - Math.abs(startEarX - endEarX) / 3;

      const d = `M${startEarX},${startCircle.y} C${cp1x},${startCircle.y} ${cp2x},${endCircle.y} ${endEarX},${endCircle.y}`;

      return (
        <path
          key={conn.id}
          d={d}
          stroke="#9cacb4"
          strokeWidth="2"
          fill="none"
        />
      );
    });

  const handleDoubleClick = (e, circleId) => {
    if (isDragging.current) {
      return;
    }
    e.stopPropagation();
    const updatedCircles = circles.map((circle) => {
      if (circle.id === circleId) {
        const newColor = circle.color === "orange" ? "blue" : "orange";
        const updatedCircle = { ...circle, color: newColor };
        ws.current.send(
          JSON.stringify({ type: "update-circle-color", circle: updatedCircle })
        );
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
    const clickIsInsideACircle = circles.some((circle) => {
      const distance = Math.sqrt((x - circle.x) ** 2 + (y - circle.y) ** 2);
      return distance < circle.r + 10; // Adding a margin to ensure clicks near the edge are recognized
    });
    if (!clickIsInsideACircle) {
      const currentNames = circles.map((c) => c.name);
      const newCircle = {
        id: uuidv4(),
        x,
        y,
        r: 28,
        color: "orange",
        name: getRandomWord(currentNames), // Assign a random unique name
      };
      setCircles([...circles, newCircle]);
      ws.current.send(
        JSON.stringify({ type: "new-circle", circle: newCircle })
      );
    }
  };

  const handleChangeName = (e, circleId) => {
    e.preventDefault();
    e.stopPropagation();

    // Immediate call to update the name to ensure UI responsiveness.
    const currentCircle = circles.find((c) => c.id === circleId);
    if (!currentCircle) return; // Guard clause if circle not found

    const currentNames = circles
      .map((c) => c.name)
      .filter((name) => name !== currentCircle.name);
    const newName = getRandomWord(currentNames);

    // Ensure the newName is different and valid
    if (newName && currentCircle.name !== newName) {
      // Optimistically update the local state to reflect the change
      setCircles((prevCircles) =>
        prevCircles.map((circle) =>
          circle.id === circleId
            ? { ...circle, name: newName, lastUpdated: Date.now() }
            : circle
        )
      );

      // Send the update to the server
      ws.current.send(
        JSON.stringify({ type: "update-circle-name", circleId, newName })
      );
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
          style={{ cursor: "pointer", userSelect: "none" }}
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
          style={{ cursor: "pointer" }}
        />
      </>
    );
  };

  return (
    <svg style={{ width: "100%", height: "100vh" }} onClick={handleSvgClick}>
      {circles.map((circle) => (
        <React.Fragment key={circle.id}>
          <circle
            cx={circle.x}
            cy={circle.y}
            r="28"
            fill={circle.color || "orange"}
            onMouseDown={(e) => handleCircleMouseDown(e, circle.id)}
            onDoubleClick={(e) => handleDoubleClick(e, circle.id)}
            onMouseEnter={() => {
              if (
                isDraggingEarLeft.current &&
                dragStartCircleId.current !== circle.id
              ) {
                hoverTargetRefRight.current = circle.id;
              } else if (
                isDraggingEarRight.current &&
                dragStartCircleId.current !== circle.id
              ) {
                hoverTargetRefLeft.current = circle.id;
              }
            }}
            onMouseLeave={() => {
              hoverTargetRefRight.current = null;
              hoverTargetRefLeft.current = circle.null;
            }}
            style={{ cursor: "pointer" }}
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
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}

export default DevPage;
