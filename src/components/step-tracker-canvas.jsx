import React, { useState, useRef, useEffect } from 'react';

const VisualStepTracker = () => {
  // Main state
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedPath, setHighlightedPath] = useState([]);
  const [error, setError] = useState('');
  
  // UI interaction state
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [creatingEdge, setCreatingEdge] = useState(false);
  const [edgeStart, setEdgeStart] = useState(null);
  const [, setNewNodeText] = useState('');
  const [editingNode, setEditingNode] = useState(null);
  const [editText, setEditText] = useState('');
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Load from localStorage on initial render
  useEffect(() => {
    const savedNodes = localStorage.getItem('visualStepTrackerNodes');
    const savedEdges = localStorage.getItem('visualStepTrackerEdges');
    const savedCounter = localStorage.getItem('visualStepTrackerCounter');
    
    if (savedNodes) setNodes(JSON.parse(savedNodes));
    if (savedEdges) setEdges(JSON.parse(savedEdges));
    if (savedCounter) setNodeIdCounter(parseInt(JSON.parse(savedCounter)));
  }, []);
  
  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem('visualStepTrackerNodes', JSON.stringify(nodes));
    localStorage.setItem('visualStepTrackerEdges', JSON.stringify(edges));
    localStorage.setItem('visualStepTrackerCounter', JSON.stringify(nodeIdCounter));
  }, [nodes, edges, nodeIdCounter]);
  
  // Helper to find an edge near a given position
  const findEdgeAtPosition = (x, y) => {
    const threshold = 5; // Distance threshold for edge selection (in pixels)
    
    for (const edge of edges) {
      const sourceNode = getNodeById(edge.source);
      const targetNode = getNodeById(edge.target);
      
      if (!sourceNode || !targetNode) continue;
      
      // Calculate direction vector
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Normalize
      const ndx = dx / length;
      const ndy = dy / length;
      
      // Start and end points (offset from center by radius)
      const radius = 40;
      const startX = sourceNode.x + ndx * radius;
      const startY = sourceNode.y + ndy * radius;
      const endX = targetNode.x - ndx * radius;
      const endY = targetNode.y - ndy * radius;
      
      // Calculate distance from point to line segment
      const distToEdge = distanceToLineSegment(x, y, startX, startY, endX, endY);
      
      if (distToEdge <= threshold) {
        return edge;
      }
    }
    
    return null;
  };

  // Helper to calculate distance from a point to a line segment
  const distanceToLineSegment = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a node
    const clickedNode = findNodeAtPosition(x, y);
    
    if (clickedNode) {
      // Handle node selection/dragging
      if (creatingEdge) {
        // We're in edge creation mode and clicked a second node
        if (edgeStart && edgeStart.id !== clickedNode.id) {
          addEdge(edgeStart.id, clickedNode.id);
          setCreatingEdge(false);
          setEdgeStart(null);
        }
      } else {
        setSelectedNode(clickedNode);
        setSelectedEdge(null); // Deselect edge when selecting a node
        setDraggedNode(clickedNode);
        setDragOffset({
          x: x - clickedNode.x,
          y: y - clickedNode.y
        });
      }
    } else {
      // Check if clicking on an edge
      const clickedEdge = findEdgeAtPosition(x, y);
      
      if (clickedEdge) {
        setSelectedEdge(clickedEdge);
        setSelectedNode(null);
      } else {
        // Clicked on empty canvas
        setSelectedNode(null);
        setSelectedEdge(null);
        
        if (creatingEdge) {
          // Cancel edge creation
          setCreatingEdge(false);
          setEdgeStart(null);
        }
      }
    }
  };
  
  const handleMouseMove = (e) => {
    if (!draggedNode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    
    // Update node position
    setNodes(nodes.map(node => 
      node.id === draggedNode.id ? { ...node, x, y } : node
    ));
  };
  
  const handleMouseUp = () => {
    setDraggedNode(null);
  };
  
  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedNode = findNodeAtPosition(x, y);
    
    if (clickedNode) {
      // Edit existing node
      setEditingNode(clickedNode);
      setEditText(clickedNode.text);
    } else {
      // Position for a new node
      setNewNodeText('');
      setEditingNode({
        id: 'new',
        x,
        y,
        text: ''
      });
    }
  };

  // Add a context menu handler
  const handleContextMenu = (e) => {
    e.preventDefault(); // Prevent default context menu

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if right-clicking on a node
    const clickedNode = findNodeAtPosition(x, y);
    
    if (clickedNode) {
      // Start edge creation from this node
      setSelectedNode(clickedNode);
      setCreatingEdge(true);
      setEdgeStart(clickedNode);
    }
  };

  
  // Helper to find a node at a given position
  const findNodeAtPosition = (x, y) => {
    const nodeWidth = 120;
    const nodeHeight = 80;
    
    // Check in reverse order to select nodes drawn on top
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const nodeLeft = node.x - nodeWidth / 2;
      const nodeRight = node.x + nodeWidth / 2;
      const nodeTop = node.y - nodeHeight / 2;
      const nodeBottom = node.y + nodeHeight / 2;
      
      if (x >= nodeLeft && x <= nodeRight && y >= nodeTop && y <= nodeBottom) {
        return node;
      }
    }
    return null;
  };
  
  // Node and edge management
  const addNode = (x, y, text) => {
    const newNode = {
      id: nodeIdCounter,
      x,
      y,
      text
    };
    
    setNodes([...nodes, newNode]);
    setNodeIdCounter(nodeIdCounter + 1);
    return newNode;
  };
  
  const updateNode = (id, text) => {
    setNodes(nodes.map(node => 
      node.id === id ? { ...node, text } : node
    ));
  };
  
  const deleteNode = () => {
    if (!selectedNode) return;
    
    // Remove the node
    setNodes(nodes.filter(node => node.id !== selectedNode.id));
    
    // Remove all connected edges
    setEdges(edges.filter(edge => 
      edge.source !== selectedNode.id && edge.target !== selectedNode.id
    ));
    
    setSelectedNode(null);
    
    // Reset highlight if it included this node
    if (highlightedPath.includes(selectedNode.id)) {
      setHighlightedPath([]);
    }
  };
  
  const addEdge = (sourceId, targetId) => {
    // Prevent self-loops
    if (sourceId === targetId) {
      setError("Cannot connect a step to itself");
      return;
    }
    
    // Check if edge already exists
    const edgeExists = edges.some(
      edge => edge.source === sourceId && edge.target === targetId
    );
    
    if (edgeExists) {
      setError("This connection already exists");
      return;
    }
    
    // Check for cycles
    const newEdges = [...edges, { source: sourceId, target: targetId }];
    if (wouldCreateCycle(newEdges, sourceId, targetId)) {
      setError("This connection would create a cycle, which is not allowed");
      return;
    }
    
    // Add the edge
    setEdges(newEdges);
    setError('');
  };
  
  const startEdgeCreation = () => {
    if (!selectedNode) return;
    
    setCreatingEdge(true);
    setEdgeStart(selectedNode);
  };
  
  const deleteEdge = () => {
    if (!selectedNode) return;
    
    // We'll delete all edges connected to this node
    setEdges(edges.filter(edge => 
      !(edge.source === selectedNode.id || edge.target === selectedNode.id)
    ));
  };
  
  // Cycle detection
  const wouldCreateCycle = (edgeList, source, target) => {
    const visited = new Set();
    
    const dfs = (currentId) => {
      if (currentId === source) return true;
      visited.add(currentId);
      
      for (const edge of edgeList) {
        if (edge.source === currentId && !visited.has(edge.target)) {
          if (dfs(edge.target)) return true;
        }
      }
      
      return false;
    };
    
    return dfs(target);
  };
  
  // Search and path finding
  const handleSearch = () => {
    setError('');
    
    if (!searchTerm.trim()) {
      setHighlightedPath([]);
      return;
    }
    
    // Find matching nodes
    const matchingNodes = nodes.filter(node => 
      node.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (matchingNodes.length === 0) {
      setError("No matching steps found");
      setHighlightedPath([]);
      return;
    }
    
    // Use the first match as destination
    const destination = matchingNodes[0];
    
    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(edge => edge.target));
    const rootNodes = nodes.filter(node => !hasIncoming.has(node.id));
    
    if (rootNodes.length === 0) {
      setError("No starting points found. Create a step with no incoming connections.");
      setHighlightedPath([]);
      return;
    }
    
    // Try to find a path from each root
    for (const root of rootNodes) {
      const path = findPath(root.id, destination.id);
      if (path.length > 0) {
        setHighlightedPath(path);
        setError('');
        return;
      }
    }
    
    setError(`No path found to "${destination.text}"`);
    setHighlightedPath([]);
  };
  
  const findPath = (startId, endId) => {
    // BFS to find shortest path
    const queue = [[startId]];
    const visited = new Set([startId]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const currentId = path[path.length - 1];
      
      if (currentId === endId) {
        return path;
      }
      
      // Find all outgoing edges from current node
      const outgoingEdges = edges.filter(edge => edge.source === currentId);
      
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push([...path, edge.target]);
        }
      }
    }
    
    return [];
  };

  // Add this new function near the other path finding functions
  const findPathToSelectedNode = () => {
    if (!selectedNode) return;
    
    setError('');
    
    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(edges.map(edge => edge.target));
    const rootNodes = nodes.filter(node => !hasIncoming.has(node.id));
    
    if (rootNodes.length === 0) {
      setError("No starting points found. Create a step with no incoming connections.");
      setHighlightedPath([]);
      return;
    }
    
    // Try to find a path from each root to the selected node
    for (const root of rootNodes) {
      const path = findPath(root.id, selectedNode.id);
      if (path.length > 0) {
        setHighlightedPath(path);
        return;
      }
    }
    
    setError(`No path found to "${selectedNode.text}"`);
    setHighlightedPath([]);
  };

  // Get node by ID
  const getNodeById = (id) => {
    return nodes.find(node => node.id === id);
  };
  
  // Get formatted path
  const getFormattedPath = () => {
    if (highlightedPath.length === 0) return '';
    return highlightedPath.map(id => {
      const node = getNodeById(id);
      return node ? node.text : `Unknown (${id})`;
    }).join(' > ');
  };
  
  // Handle node text editing
  const handleSaveNodeText = () => {
    if (editingNode) {
      if (editingNode.id === 'new') {
        // Create new node
        if (editText.trim()) {
          addNode(editingNode.x, editingNode.y, editText.trim());
        }
      } else {
        // Update existing node
        updateNode(editingNode.id, editText.trim());
      }
    }
    
    setEditingNode(null);
    setEditText('');
  };
  
  const handleCancelNodeEdit = () => {
    setEditingNode(null);
    setEditText('');
  };
  

  // Track mouse position for edge creation
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMoveGlobal = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, []);
  
  // Drawing functions
  const drawNode = (ctx, node, isHighlighted, isSelected) => {
     // Node dimensions
    const width = 120;
    const height = 50;
    const cornerRadius = 10;
    
    // Calculate the top-left corner of the rectangle
    const x = node.x - width / 2;
    const y = node.y - height / 2;
    
    // Draw rounded rectangle
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
    ctx.closePath();
    
    // Fill with color
    if (isHighlighted) {
      ctx.fillStyle = '#a855f7'; // Purple for highlighted path
    } else {
      ctx.fillStyle = '#f9fafb'; // Light gray
    }
    
    ctx.fill();
    
    // Stroke (outline)
    if (isSelected) {
      ctx.strokeStyle = '#2563eb'; // Blue for selected
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = '#9ca3af'; // Gray
      ctx.lineWidth = 2;
    }
    
    ctx.stroke();
    
    // Node text
    ctx.font = '12px Arial';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text wrapping and truncation
    const maxWidth = width - 20; // 10px padding on each side
    const maxLines = 3;
    const lineHeight = 16;
    
    const words = node.text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';
    
    // Create wrapped lines based on width
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    // Limit the number of lines and add ellipsis if truncated
    const displayLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let lastLine = displayLines[maxLines - 1];
      
      // Add ellipsis by truncating the last visible line if needed
      while (ctx.measureText(lastLine + '...').width > maxWidth) {
        lastLine = lastLine.slice(0, -1);
        if (lastLine.length <= 3) break;
      }
      displayLines[maxLines - 1] = lastLine + '...';
    }
    
    // Calculate vertical alignment for text block
    const totalTextHeight = displayLines.length * lineHeight;
    let startY = node.y - (totalTextHeight / 2) + (lineHeight / 2);
    
    // Draw each line
    displayLines.forEach((line, i) => {
      ctx.fillText(line, node.x, startY + (i * lineHeight));
    });
  };
  
  const drawEdge = (ctx, source, target, isHighlighted, isSelected = false) => {
    // Node dimensions
    const nodeWidth = 120;
    const nodeHeight = 80;
    
    // Calculate direction vector
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    
    // Calculate the angle of the line
    const angle = Math.atan2(dy, dx);
    
    // Calculate the edge points where the line intersects the rectangles
    let startX, startY, endX, endY;
    
    // For source node (where the line starts)
    const halfSourceWidth = nodeWidth / 2;
    const halfSourceHeight = nodeHeight / 2;
    
    // For target node (where the line ends)
    const halfTargetWidth = nodeWidth / 2;
    const halfTargetHeight = nodeHeight / 2;
    
    // Calculate the intersection points based on the angle
    if (Math.abs(Math.cos(angle)) * halfSourceHeight > Math.abs(Math.sin(angle)) * halfSourceWidth) {
      // Intersects with left or right side of source
      const sign = Math.cos(angle) >= 0 ? 1 : -1;
      startX = source.x + sign * halfSourceWidth;
      startY = source.y + Math.tan(angle) * sign * halfSourceWidth;
    } else {
      // Intersects with top or bottom side of source
      const sign = Math.sin(angle) >= 0 ? 1 : -1;
      startX = source.x + Math.tan(Math.PI/2 - angle) * sign * halfSourceHeight;
      startY = source.y + sign * halfSourceHeight;
    }
    
    // Similar for target node
    if (Math.abs(Math.cos(angle)) * halfTargetHeight > Math.abs(Math.sin(angle)) * halfTargetWidth) {
      // Intersects with left or right side of target
      const sign = Math.cos(angle) >= 0 ? -1 : 1;
      endX = target.x + sign * halfTargetWidth;
      endY = target.y + Math.tan(angle) * sign * halfTargetWidth;
    } else {
      // Intersects with top or bottom side of target
      const sign = Math.sin(angle) >= 0 ? -1 : 1;
      endX = target.x + Math.tan(Math.PI/2 - angle) * sign * halfTargetHeight;
      endY = target.y + sign * halfTargetHeight;
    }
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    
    if (isSelected) {
      ctx.strokeStyle = '#f59e0b'; // Amber color for selected edge
      ctx.lineWidth = 4;
    } else if (isHighlighted) {
      ctx.strokeStyle = '#a855f7'; // Purple
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = '#9ca3af'; // Gray
      ctx.lineWidth = 2;
    }
    
    ctx.stroke();
    
    // Arrow head
    const arrowSize = 10;
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    
    if (isSelected) {
      ctx.fillStyle = '#f59e0b'; // Amber
    } else if (isHighlighted) {
      ctx.fillStyle = '#a855f7'; // Purple
    } else {
      ctx.fillStyle = '#9ca3af'; // Gray
    }
    
    ctx.fill();
  };

  // Add this function with the other edge management functions
  const deleteSelectedEdge = () => {
    if (!selectedEdge) return;
    
    setEdges(edges.filter(edge => 
      !(edge.source === selectedEdge.source && edge.target === selectedEdge.target)
    ));
    
    setSelectedEdge(null);
  };
  
  // Animation loop
  useEffect(() => {
    // Rendering
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw edges
      edges.forEach(edge => {
        const sourceNode = getNodeById(edge.source);
        const targetNode = getNodeById(edge.target);
        
        if (sourceNode && targetNode) {
          const isHighlighted = highlightedPath.length >= 2 && 
                              highlightedPath.includes(edge.source) && 
                              highlightedPath.includes(edge.target) &&
                              highlightedPath.indexOf(edge.source) + 1 === highlightedPath.indexOf(edge.target);
          
          const isSelected = selectedEdge && 
                            selectedEdge.source === edge.source && 
                            selectedEdge.target === edge.target;
          
          drawEdge(ctx, sourceNode, targetNode, isHighlighted, isSelected);
        }
      });
      
      // Draw edge being created
      if (creatingEdge && edgeStart) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = mousePos.x - rect.left;
        const mouseY = mousePos.y - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(edgeStart.x, edgeStart.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Draw nodes
      nodes.forEach(node => {
        const isHighlighted = highlightedPath.includes(node.id);
        const isSelected = selectedNode && selectedNode.id === node.id;
        drawNode(ctx, node, isHighlighted, isSelected);
      });
    };
    
    const animate = () => {
      renderCanvas();
      requestAnimationFrame(animate);
    };
    
    if (canvasRef.current) {
      // Set canvas size
      if (containerRef.current) {
        const container = containerRef.current;
        canvasRef.current.width = container.clientWidth;
        canvasRef.current.height = container.clientHeight;
      }
      
      animate();
    }
  }, [nodes, edges, selectedNode, creatingEdge, edgeStart, mousePos, highlightedPath, getNodeById, selectedEdge]);
  
  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold mb-2">Visual Step Tracker</h1>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 flex items-center min-w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a step..."
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={handleSearch}
              className="ml-2 bg-purple-500 text-white px-4 py-2 rounded"
            >
              Find
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={startEdgeCreation}
              disabled={!selectedNode}
              className={`px-4 py-2 rounded ${
                selectedNode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              Connect
            </button>
            
            <button
              onClick={deleteNode}
              disabled={!selectedNode}
              className={`px-4 py-2 rounded ${
                selectedNode 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              Delete Node
            </button>
            
            <button
              onClick={deleteEdge}
              disabled={!selectedNode}
              className={`px-4 py-2 rounded ${
                selectedNode 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              Delete All Connections
            </button>
            
            <button
              onClick={deleteSelectedEdge}
              disabled={!selectedEdge}
              className={`px-4 py-2 rounded ${
                selectedEdge 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              Delete Selected Connection
            </button>
            <button
              onClick={findPathToSelectedNode}
              disabled={!selectedNode}
              className={`px-4 py-2 rounded ${
                selectedNode 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              Show Path To This
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {highlightedPath.length > 0 && (
          <div className="mt-2 p-2 bg-purple-100 text-purple-800 rounded">
            <strong>Path: </strong>{getFormattedPath()}
          </div>
        )}
        
        <div className="mt-2 text-sm text-gray-500">
          <p>Double-click on canvas to create a new step. Double-click on a step to edit. Drag to move.</p>
          <p>Select a step and click "Connect" to draw a connection. Select a step and click "Delete" to remove it.</p>
        </div>
      </div>
      
      <div className="flex-1 relative" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="inset-0 border h-[200px] border-red-400"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        ></canvas>
        
        {editingNode && (
          <div 
            className="absolute p-4 border rounded shadow-lg"
            style={{
              left: `${editingNode.x + 20}px`,
              top: `${editingNode.y + 20}px`,
              zIndex: 100
            }}
          >
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Step description..."
              className="w-full p-2 border rounded mb-2"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelNodeEdit}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNodeText}
                className="px-3 py-1 bg-blue-500 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualStepTracker;