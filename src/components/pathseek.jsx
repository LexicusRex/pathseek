import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from './button';

// Define classes for Graph, Node, and Edge
class GraphNode {
  constructor(id, x, y, text) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.text = text;
  }
}

class GraphEdge {
  constructor(source, target) {
    this.source = source;
    this.target = target;
  }
}

class Graph {
  constructor() {
    this.nodes = {}; // Object with node ID as key
    this.edges = []; // Array of edges
    this.nextNodeId = 1;
  }

  addNode(x, y, text) {
    const node = new GraphNode(this.nextNodeId, x, y, text);
    this.nodes[node.id] = node;
    this.nextNodeId++;
    return node;
  }

  updateNode(id, text) {
    if (this.nodes[id]) {
      this.nodes[id].text = text;
    }
  }

  moveNode(id, x, y) {
    if (this.nodes[id]) {
      this.nodes[id].x = x;
      this.nodes[id].y = y;
    }
  }

  removeNode(id) {
    // Delete node
    delete this.nodes[id];
    
    // Remove all edges connected to this node
    this.edges = this.edges.filter(edge => 
      edge.source !== id && edge.target !== id
    );
  }

  addEdge(sourceId, targetId) {
    const edge = new GraphEdge(sourceId, targetId);
    this.edges.push(edge);
    return edge;
  }

  removeEdge(sourceId, targetId) {
    this.edges = this.edges.filter(edge => 
      !(edge.source === sourceId && edge.target === targetId)
    );
  }

  getNodeById(id) {
    return this.nodes[id];
  }

  getAllNodes() {
    return Object.values(this.nodes);
  }

  toJSON() {
    return {
      nodes: this.nodes,
      edges: this.edges,
      nextNodeId: this.nextNodeId
    };
  }

  static fromJSON(json) {
    const graph = new Graph();
    graph.nodes = json.nodes;
    graph.edges = json.edges;
    graph.nextNodeId = json.nextNodeId;
    return graph;
  }
}

const PathSeeker = () => {
  // Main state - now using the Graph class
  const [graph, setGraph] = useState(new Graph());
  // const [searchTerm, setSearchTerm] = useState('');
  const [highlightedPath, setHighlightedPath] = useState([]);
  const [error, setError] = useState('');
  
  // UI interaction state
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [creatingEdge, setCreatingEdge] = useState(false);
  const [edgeStart, setEdgeStart] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [editText, setEditText] = useState('');

  const [selectingPath, setSelectingPath] = useState(false);
  const [pathSource, setPathSource] = useState(null);

  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPoint, setStartPanPoint] = useState({ x: 0, y: 0 });
  // Track mouse position for edge creation
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [startPanOffset, setStartPanOffset] = useState({ x: 0, y: 0 });
  const [showHelp, setShowHelp] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);

  // Add zoom state after your other state declarations
  const [zoomLevel, setZoomLevel] = useState(1);
  const [minZoom] = useState(0.1);
  const [maxZoom] = useState(3);
  const zoomStep = 0.1; // Each zoom step will adjust by this amount
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectionBox, setSelectionBox] = useState(null);
  const [isMultiSelecting, setIsMultiSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });

  
  // Load from localStorage on initial render
  useEffect(() => {
    const savedGraph = localStorage.getItem('visualStepTrackerGraph');
    
    if (savedGraph) {
      try {
        const parsedGraph = JSON.parse(savedGraph);
        setGraph(Graph.fromJSON(parsedGraph));
      } catch (err) {
        console.error("Failed to load saved graph:", err);
      }
    }
  }, []);
  
  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem('visualStepTrackerGraph', JSON.stringify(graph));
  }, [graph]);
  
  // Helper to find an edge near a given position
  const findEdgeAtPosition = (x, y) => {
    const threshold = 5; // Distance threshold for edge selection (in pixels)
    
    for (const edge of graph.edges) {
      const sourceNode = graph.getNodeById(edge.source);
      const targetNode = graph.getNodeById(edge.target);
      
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

  // Add a button to start path selection
  const startPathSelection = () => {
    if (!selectedNode) return;
    
    setSelectingPath(true);
    setPathSource(selectedNode);
    setCreatingEdge(false); // Ensure edge creation is off
    setEdgeStart(null);
  };

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate the actual position in the canvas coordinate system
    const canvasX = x / zoomLevel + canvasOffset.x / zoomLevel;
    const canvasY = y / zoomLevel + canvasOffset.y / zoomLevel;
    
    // If middle mouse button is pressed or Ctrl+click, start panning
    // if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
    //   setIsPanning(true);
    //   setStartPanPoint({ x: e.clientX, y: e.clientY });
    //   // Store the starting canvas offset when panning begins
    //   setStartPanOffset({ ...canvasOffset });
    //   return;
    // }
  
    // Check if shift key is pressed for multi-selection
    if (e.shiftKey) {
      setIsMultiSelecting(true);
      setSelectionStart({ x: canvasX, y: canvasY });
      setSelectionBox({
        startX: canvasX,
        startY: canvasY,
        width: 0,
        height: 0
      });
      return;
    }
    
    // Check if clicking on a node
    const clickedNode = findNodeAtPosition(canvasX, canvasY);
    
    if (clickedNode) {
      // Handle node selection/dragging
      if (selectingPath) {
        // Path selection code remains the same
        if (pathSource && pathSource.id !== clickedNode.id) {
          // Find path between source and target nodes
          const path = findPath(pathSource.id, clickedNode.id);
          
          if (path.length > 0) {
            setHighlightedPath(path);
            setError('');
          } else {
            setError(`No path found from "${pathSource.text}" to "${clickedNode.text}"`);
            setHighlightedPath([]);
          }
          
          // Exit path selection mode
          setSelectingPath(false);
          setPathSource(null);
        }
      } else if (creatingEdge) {
        // Existing edge creation code
        if (edgeStart && edgeStart.id !== clickedNode.id) {
          addEdge(edgeStart.id, clickedNode.id);
          setCreatingEdge(false);
          setEdgeStart(null);
        }
      } else {
        // Check if this node is already in the selection
        const isAlreadySelected = selectedNodes.has(clickedNode.id);
        
        // If Ctrl key is pressed, toggle this node in the selection
        if (e.ctrlKey) {
          const newSelectedNodes = new Set(selectedNodes);
          if (isAlreadySelected) {
            newSelectedNodes.delete(clickedNode.id);
          } else {
            newSelectedNodes.add(clickedNode.id);
          }
          setSelectedNodes(newSelectedNodes);
        } 
        // If not Ctrl key and the node isn't already selected, select just this node
        else if (!isAlreadySelected) {
          setSelectedNodes(new Set([clickedNode.id]));
        }
        
        setSelectedNode(clickedNode);
        setSelectedEdge(null); // Deselect edge when selecting a node
        setDraggedNode(clickedNode);
        
        // Store the offset in screen pixels - we'll convert in handleMouseMove
        setDragOffset({
          x: canvasX - clickedNode.x,
          y: canvasY - clickedNode.y
        });
      }
    } else {
      // Check if clicking on an edge
      const clickedEdge = findEdgeAtPosition(canvasX, canvasY);
      
      if (clickedEdge) {
        setSelectedEdge(clickedEdge);
        setSelectedNode(null);
        // Clear multi-selection when selecting an edge
        setSelectedNodes(new Set());
      } else {
        // Clicked on empty canvas
        setSelectedNode(null);
        setSelectedEdge(null);
        // Clear multi-selection when clicking empty canvas (unless using Shift for multi-select)
        if (!e.shiftKey) {
          setSelectedNodes(new Set());
        }
        
        // Cancel any active modes
        if (creatingEdge) {
          setCreatingEdge(false);
          setEdgeStart(null);
        }
        
        if (selectingPath) {
          setSelectingPath(false);
          setPathSource(null);
        }
      }
  
      // If a node isn't clicked and after all edge stuff is resolved, it's panning time!
      setIsPanning(true);
      setStartPanPoint({ x: e.clientX, y: e.clientY });
      // Store the starting canvas offset when panning begins
      setStartPanOffset({ ...canvasOffset });
    }
  };
  
  // Add wheel event handler to the canvas
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Get mouse position relative to canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get current canvas coordinates under the mouse
    const canvasMouseX = mouseX / zoomLevel + canvasOffset.x / zoomLevel;
    const canvasMouseY = mouseY / zoomLevel + canvasOffset.y / zoomLevel;
    
    // Determine zoom direction based on wheel delta
    const zoomDirection = e.deltaY < 0 ? 1 : -1;
    
    // Calculate new zoom level
    const newZoom = Math.max(
      minZoom, 
      Math.min(maxZoom, zoomLevel + zoomDirection * zoomStep)
    );
    
    if (newZoom !== zoomLevel) {
      // Calculate new offsets to keep the point under the mouse fixed
      const newOffsetX = (canvasMouseX * newZoom) - mouseX;
      const newOffsetY = (canvasMouseY * newZoom) - mouseY;
      
      setZoomLevel(newZoom);
      setCanvasOffset({
        x: newOffsetX,
        y: newOffsetY
      });
    }
  }, [zoomLevel, canvasOffset, minZoom, maxZoom, zoomStep]);
  
  const renderCanvas = useCallback((ctx, width, height) => {
      // Drawing functions (keep existing)
    const drawNode = (ctx, node, isHighlighted, isSelected) => {
      // Node dimensions
      const width = 200;
      const height = 75;
      const cornerRadius = 10;
      
      // Text padding
      const horizontalPadding = 12; // Horizontal padding (left and right)
      const verticalPadding = 10;   // Vertical padding (top and bottom)
      
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
        ctx.fillStyle = '#ff8874'; // Orange for highlighted path
      } else {
        ctx.fillStyle = '#f9fafb'; // Light gray
      }
      
      ctx.fill();
      
      // Stroke (outline)
      const isMultiSelected = selectedNodes.has(node.id);
    
      if (isSelected || isMultiSelected) {
        ctx.strokeStyle = '#2563eb'; // Blue for selected
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = '#656262'; // Gray
        ctx.lineWidth = 2;
      }
      
      ctx.stroke();
      
      // Node text
      ctx.font = '16px Arial';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Text wrapping and truncation - apply padding to maxWidth
      const maxWidth = width - (horizontalPadding * 2); // Apply horizontal padding
      const maxLines = 2;  // Reduce to 2 lines if needed for better vertical padding
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
      
      // Calculate vertical alignment for text block with vertical padding
      const totalTextHeight = displayLines.length * lineHeight;
      let startY = node.y - (totalTextHeight / 2) + (lineHeight / 2);
      
      // Ensure text stays within the vertical padding
      const topBoundary = y + verticalPadding;
      const bottomBoundary = y + height - verticalPadding;
      
      // Adjust startY if it would cause text to exceed padding
      if (startY - (lineHeight / 2) < topBoundary) {
        startY = topBoundary + (lineHeight / 2);
      } else if (startY + totalTextHeight - (lineHeight / 2) > bottomBoundary) {
        startY = bottomBoundary - totalTextHeight + (lineHeight / 2);
      }
      
      // Draw each line
      displayLines.forEach((line, i) => {
        ctx.fillText(line, node.x, startY + (i * lineHeight));
      });
    };
  
    
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Apply transformation to account for panning
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel); // Add this line for zoom
    ctx.translate(-canvasOffset.x / zoomLevel, -canvasOffset.y / zoomLevel); // Adjust for zoom
    
    // Draw grid first (background)
    const baseGridSize = 50;
    const gridSize = baseGridSize * (zoomLevel >= 0.5 ? 1 : (zoomLevel >= 0.3 ? 2 : 5)); // Adjust grid density based on zoom
    // const gridColor = '#f0f0f0';
    const gridColor = '#e1e1e1';

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5 / zoomLevel; // Adjust line width based on zoom

    // Determine visible area based on offset and zoom
    const visibleLeft = canvasOffset.x / zoomLevel;
    const visibleTop = canvasOffset.y / zoomLevel;
    const visibleRight = visibleLeft + width / zoomLevel;
    const visibleBottom = visibleTop + height / zoomLevel;

    // Align grid to multiples of gridSize
    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize;

    // Draw vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  
    // Calculate the visible area in canvas coordinates
    const visibleMinX = canvasOffset.x / zoomLevel;
    const visibleMinY = canvasOffset.y / zoomLevel;
    const visibleMaxX = visibleMinX + width / zoomLevel;
    const visibleMaxY = visibleMinY + height / zoomLevel;
    
    // Define a buffer zone around the visible area (to avoid pop-in)
    // Increase buffer based on zoom level to prevent culling when zoomed out
    const buffer = 200 / zoomLevel;
    
    // Draw edges
    graph.edges.forEach(edge => {
      const sourceNode = graph.getNodeById(edge.source);
      const targetNode = graph.getNodeById(edge.target);
      
      if (sourceNode && targetNode) {
        // Check if either node is in visible area (with buffer)
        if ((sourceNode.x >= visibleMinX - buffer && sourceNode.x <= visibleMaxX + buffer &&
             sourceNode.y >= visibleMinY - buffer && sourceNode.y <= visibleMaxY + buffer) ||
            (targetNode.x >= visibleMinX - buffer && targetNode.x <= visibleMaxX + buffer &&
             targetNode.y >= visibleMinY - buffer && targetNode.y <= visibleMaxY + buffer)) {
          
          const isHighlighted = highlightedPath.length >= 2 && 
                              highlightedPath.includes(edge.source) && 
                              highlightedPath.includes(edge.target) &&
                              highlightedPath.indexOf(edge.source) + 1 === highlightedPath.indexOf(edge.target);
          
          const isSelected = selectedEdge && 
                            selectedEdge.source === edge.source && 
                            selectedEdge.target === edge.target;
          
          drawEdge(ctx, sourceNode, targetNode, isHighlighted, isSelected);
        }
      }
    });
    
    // Draw edge being created
    if (creatingEdge && edgeStart) {
      // Get up-to-date rect in each render
      const rect = canvasRef.current.getBoundingClientRect();
      
      // Convert screen coordinates to canvas coordinates, accounting for zoom
      const mouseCanvasX = (mousePos.x - rect.left) / zoomLevel + canvasOffset.x / zoomLevel;
      const mouseCanvasY = (mousePos.y - rect.top) / zoomLevel + canvasOffset.y / zoomLevel;
      
      // Draw the line
      ctx.beginPath();
      ctx.moveTo(edgeStart.x, edgeStart.y);
      ctx.lineTo(mouseCanvasX, mouseCanvasY);
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // For debugging - mark the calculated endpoint with a circle
      ctx.beginPath();
      ctx.arc(mouseCanvasX, mouseCanvasY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8874';
      ctx.fill();
    }

    // Draw selection box if active
    if (selectionBox) {
      ctx.fillStyle = 'rgba(65, 105, 225, 0.2)'; // Semi-transparent blue
      ctx.fillRect(
        selectionBox.startX,
        selectionBox.startY,
        selectionBox.width,
        selectionBox.height
      );
      
      ctx.strokeStyle = 'rgb(65, 105, 225)';
      ctx.lineWidth = 1.5 / zoomLevel;
      ctx.strokeRect(
        selectionBox.startX,
        selectionBox.startY,
        selectionBox.width,
        selectionBox.height
      );
    }
    
    // Draw path selection line
    if (selectingPath && pathSource) {
      const rect = canvasRef.current.getBoundingClientRect();
      // Convert screen coordinates to canvas coordinates
      const mouseCanvasX = (mousePos.x - rect.left) / zoomLevel + canvasOffset.x / zoomLevel;
      const mouseCanvasY = (mousePos.y - rect.top) / zoomLevel + canvasOffset.y / zoomLevel;
      
      ctx.beginPath();
      ctx.moveTo(pathSource.x, pathSource.y);
      ctx.lineTo(mouseCanvasX, mouseCanvasY);
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Only draw nodes that are in or near the visible area
    const allNodes = graph.getAllNodes();
    allNodes.forEach(node => {
      // Check if the node is visible or in buffer area
      if (node.x + 60 >= visibleMinX - buffer && 
          node.x - 60 <= visibleMaxX + buffer && 
          node.y + 40 >= visibleMinY - buffer && 
          node.y - 40 <= visibleMaxY + buffer) {
        
        const isHighlighted = highlightedPath.includes(node.id);
        const isSelected = selectedNode && selectedNode.id === node.id;
        drawNode(ctx, node, isHighlighted, isSelected);
      }
    });
    
    // Reset transformation
    ctx.restore();
  }, [zoomLevel, canvasOffset.x, canvasOffset.y, graph, creatingEdge, edgeStart, selectionBox, selectingPath, pathSource, selectedNodes, highlightedPath, selectedEdge, mousePos.x, mousePos.y, selectedNode]);
  

  // Keep a ref for animation frame ID for cleanup
  const animationFrameIdRef = useRef(null);
  // Add a ref to store the animation frame ID for panning
  const panningRafIdRef = useRef(null);


  const handleMouseMove = (e) => {
    // Handle panning first
    if (isPanning) {
      const deltaX = e.clientX - startPanPoint.x;
      const deltaY = e.clientY - startPanPoint.y;
      
      const panSpeedFactor = 0.65; // Adjust this to control panning speed
      
      if (!panningRafIdRef.current) {
        panningRafIdRef.current = requestAnimationFrame(() => {
          setCanvasOffset({
            x: startPanOffset.x - deltaX * panSpeedFactor,
            y: startPanOffset.y - deltaY * panSpeedFactor
          });
          
          panningRafIdRef.current = null;
        });
      }
      return;
    }
  
    // Get the canvas rect for coordinate conversion
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate the mouse position in canvas space, accounting for zoom
    const mouseX = (e.clientX - rect.left) / zoomLevel;
    const mouseY = (e.clientY - rect.top) / zoomLevel;
    
    // Convert to canvas coordinates
    const canvasX = mouseX + canvasOffset.x / zoomLevel;
    const canvasY = mouseY + canvasOffset.y / zoomLevel;
    
    // Handle selection box
    if (isMultiSelecting) {
      setSelectionBox({
        startX: Math.min(selectionStart.x, canvasX),
        startY: Math.min(selectionStart.y, canvasY),
        width: Math.abs(canvasX - selectionStart.x),
        height: Math.abs(canvasY - selectionStart.y)
      });
      return;
    }
    
    // If not dragging a node, just return
    if (!draggedNode) return;
    
    // Calculate the new node position, accounting for the drag offset
    // and canvas offset (divided by zoom level to convert to canvas coordinates)
    const nodeX = mouseX + canvasOffset.x / zoomLevel - dragOffset.x / zoomLevel;
    const nodeY = mouseY + canvasOffset.y / zoomLevel - dragOffset.y / zoomLevel;
    
    // Calculate the movement delta
    const deltaX = nodeX - draggedNode.x;
    const deltaY = nodeY - draggedNode.y;
  
    // Update dragged node position
    if (graph.nodes[draggedNode.id]) {
      graph.nodes[draggedNode.id].x = nodeX;
      graph.nodes[draggedNode.id].y = nodeY;
      
      // Move all other selected nodes by the same delta
      if (selectedNodes.size > 1) {
        selectedNodes.forEach(id => {
          if (id !== draggedNode.id && graph.nodes[id]) {
            graph.nodes[id].x += deltaX;
            graph.nodes[id].y += deltaY;
          }
        });
      }
      
      // Force a canvas redraw without state update
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        renderCanvas(ctx, canvas.width, canvas.height);
      }
    }
  };
  
  // Modify the handleMouseUp function
  const handleMouseUp = () => {
    if (draggedNode) {
      // Your existing code for updating the graph
      setGraph(prevGraph => {
        const newGraph = new Graph();
        Object.assign(newGraph, prevGraph);
        return newGraph;
      });
    }
    
    // Handle finishing a selection box
    if (isMultiSelecting && selectionBox) {
      // Find all nodes within the selection box
      const nodesInSelection = graph.getAllNodes().filter(node => {
        return node.x >= selectionBox.startX && 
               node.x <= selectionBox.startX + selectionBox.width &&
               node.y >= selectionBox.startY && 
               node.y <= selectionBox.startY + selectionBox.height;
      });
      
      // Create a new set of selected node IDs
      const newSelectedNodes = new Set(
        nodesInSelection.map(node => node.id)
      );
      
      setSelectedNodes(newSelectedNodes);
      
      // If at least one node is selected, set the first as the active node
      if (nodesInSelection.length > 0) {
        setSelectedNode(nodesInSelection[0]);
        setSelectedEdge(null);
      }
      
      // Clear selection box
      setSelectionBox(null);
      setIsMultiSelecting(false);
    }
    
    // Clean up panning animation frame if it exists
    if (panningRafIdRef.current) {
      cancelAnimationFrame(panningRafIdRef.current);
      panningRafIdRef.current = null;
    }
    
    setDraggedNode(null);
    setIsPanning(false);
  };
  
  // Modify the handleDoubleClick function
  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Calculate canvas coordinates properly accounting for zoom
    const x = (e.clientX - rect.left) / zoomLevel + canvasOffset.x / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel + canvasOffset.y / zoomLevel;
    
    const clickedNode = findNodeAtPosition(x, y);
    
    if (clickedNode) {
      // Edit existing node
      setEditingNode(clickedNode);
      setEditText(clickedNode.text);
    } else {
      // Position for a new node
      setEditingNode({
        id: 'new',
        x,
        y,
        text: ''
      });
    }
  };
  
  // Modify the handleContextMenu function
  const handleContextMenu = (e) => {
    e.preventDefault(); // Prevent default context menu
  
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate the actual position in the canvas coordinate system
    const canvasX = x / zoomLevel + canvasOffset.x / zoomLevel;
    const canvasY = y / zoomLevel + canvasOffset.y / zoomLevel;
    
    // Check if right-clicking on a node
    const clickedNode = findNodeAtPosition(canvasX, canvasY);
    // First check if right-clicking on an edge
    const clickedEdge = findEdgeAtPosition(canvasX, canvasY);
    
    if (clickedNode) {
      // Start edge creation from this node
      setSelectedNode(clickedNode);
      setCreatingEdge(true);
      setEdgeStart(clickedNode);
    }
    if (clickedEdge) {
      // Delete the edge immediately
      setGraph(prevGraph => {
        const newGraph = new Graph();
        Object.assign(newGraph, prevGraph);
        newGraph.removeEdge(clickedEdge.source, clickedEdge.target);
        return newGraph;
      });
      
      // Deselect the edge if it was selected
      if (selectedEdge && 
          selectedEdge.source === clickedEdge.source && 
          selectedEdge.target === clickedEdge.target) {
        setSelectedEdge(null);
      }
      
      // Show a brief message that the edge was deleted
      setError("Connection deleted");
      setTimeout(() => setError(''), 2000);
      
      return;
    }
  };
  
  // Helper to find a node at a given position
  const findNodeAtPosition = (x, y) => {
    const nodeWidth = 120;
    const nodeHeight = 80;
    const allNodes = graph.getAllNodes();
    
    // Check in reverse order to select nodes drawn on top
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const node = allNodes[i];
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
    setGraph(prevGraph => {
      const newGraph = new Graph();
      Object.assign(newGraph, prevGraph);
      //   const node = newGraph.addNode(x, y, text);
      newGraph.addNode(x, y, text);
      return newGraph;
    });
  };
  
  const updateNode = (id, text) => {
    setGraph(prevGraph => {
      const newGraph = new Graph();
      Object.assign(newGraph, prevGraph);
      newGraph.updateNode(id, text);
      return newGraph;
    });
  };
  
  const deleteNode = () => {
    if (selectedNodes.size > 0) {
      setGraph(prevGraph => {
        const newGraph = new Graph();
        Object.assign(newGraph, prevGraph);
        
        // Delete all selected nodes
        selectedNodes.forEach(id => {
          newGraph.removeNode(id);
        });
        
        return newGraph;
      });
      
      // Reset selection states
      setSelectedNode(null);
      setSelectedNodes(new Set());
      
      // Reset highlight if it included any selected node
      const shouldResetHighlight = [...selectedNodes].some(id => 
        highlightedPath.includes(id)
      );
      
      if (shouldResetHighlight) {
        setHighlightedPath([]);
      }
    }
  };
  
  const addEdge = (sourceId, targetId) => {
    // Prevent self-loops
    if (sourceId === targetId) {
      setError("Cannot connect a step to itself");
      return;
    }
    
    // Check if edge already exists
    const edgeExists = graph.edges.some(
      edge => edge.source === sourceId && edge.target === targetId
    );
    
    if (edgeExists) {
      setError("This connection already exists");
      return;
    }
    
    const tempEdges = [...graph.edges, { source: sourceId, target: targetId }];
    if (wouldCreateCycle(tempEdges, sourceId, targetId)) {
      setError("This connection would create a cycle, which is not allowed");
      return;
    }
    
    // Add the edge
    setGraph(prevGraph => {
      const newGraph = new Graph();
      Object.assign(newGraph, prevGraph);
      newGraph.addEdge(sourceId, targetId);
      return newGraph;
    });
    
    setError('');
  };
  
  // const startEdgeCreation = () => {
  //   if (!selectedNode) return;
    
  //   setCreatingEdge(true);
  //   setEdgeStart(selectedNode);
  // };
  
  // const deleteEdge = () => {
  //   if (!selectedNode) return;
    
  //   // We'll delete all edges connected to this node
  //   setGraph(prevGraph => {
  //     const newGraph = new Graph();
  //     Object.assign(newGraph, prevGraph);
      
  //     // Filter out any edge connected to the selected node
  //     newGraph.edges = prevGraph.edges.filter(edge => 
  //       !(edge.source === selectedNode.id || edge.target === selectedNode.id)
  //     );
      
  //     return newGraph;
  //   });
  // };
  
  // Delete a specific edge
  const deleteSelectedEdge = () => {
    if (!selectedEdge) return;
    
    setGraph(prevGraph => {
      const newGraph = new Graph();
      Object.assign(newGraph, prevGraph);
      newGraph.removeEdge(selectedEdge.source, selectedEdge.target);
      return newGraph;
    });
    
    setSelectedEdge(null);
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
  // const handleSearch = () => {
  //   setError('');
    
  //   if (!searchTerm.trim()) {
  //     setHighlightedPath([]);
  //     return;
  //   }
    
  //   // Find matching nodes
  //   const allNodes = graph.getAllNodes();
  //   const matchingNodes = allNodes.filter(node => 
  //     node.text.toLowerCase().includes(searchTerm.toLowerCase())
  //   );
    
  //   if (matchingNodes.length === 0) {
  //     setError("No matching steps found");
  //     setHighlightedPath([]);
  //     return;
  //   }
    
  //   // Use the first match as destination
  //   const destination = matchingNodes[0];
    
  //   // Find root nodes (no incoming edges)
  //   const hasIncoming = new Set(graph.edges.map(edge => edge.target));
  //   const rootNodes = allNodes.filter(node => !hasIncoming.has(node.id));
    
  //   if (rootNodes.length === 0) {
  //     setError("No starting points found. Create a step with no incoming connections.");
  //     setHighlightedPath([]);
  //     return;
  //   }
    
  //   // Try to find a path from each root
  //   for (const root of rootNodes) {
  //     const path = findPath(root.id, destination.id);
  //     if (path.length > 0) {
  //       setHighlightedPath(path);
  //       setError('');
  //       return;
  //     }
  //   }
    
  //   setError(`No path found to "${destination.text}"`);
  //   setHighlightedPath([]);
  // };
  
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
      const outgoingEdges = graph.edges.filter(edge => edge.source === currentId);
      
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push([...path, edge.target]);
        }
      }
    }
    
    return [];
  };

  // Path finding to selected node
  const findPathToSelectedNode = () => {
    if (!selectedNode) return;
    
    setError('');
    
    // Find root nodes (no incoming edges)
    const hasIncoming = new Set(graph.edges.map(edge => edge.target));
    const rootNodes = graph.getAllNodes().filter(node => !hasIncoming.has(node.id));
    
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
  
  // Get formatted path
  const getFormattedPath = () => {
    if (highlightedPath.length === 0) return '';
    return highlightedPath.map(id => {
      const node = graph.getNodeById(id);
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
  
  // Add export/import functionality
  const exportToJson = () => {
    const dataStr = JSON.stringify(graph, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileName = 'path-tracker-data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  const importFromJson = (event) => {
    const file = event.target.files[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setGraph(Graph.fromJSON(data));
          setError('');
        } catch (error) {
          console.error(error);
          setError('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    const handleMouseMoveGlobal = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        renderCanvas(ctx, canvas.width, canvas.height);
      }
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };
    
    if (canvasRef.current) {
      // Set canvas size
      if (containerRef.current) {
        const container = containerRef.current;
        canvasRef.current.width = container.clientWidth;
        canvasRef.current.height = container.clientHeight;
      }
      
      // Add wheel event listener for zooming
      canvasRef.current.addEventListener('wheel', handleWheel, { passive: false });
      
      // Start animation loop
      animationFrameIdRef.current = requestAnimationFrame(animate);
    }
    
    // Clean up function
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      
      // Remove wheel event listener on cleanup
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('wheel', handleWheel);
      }
    };
  }, [renderCanvas, handleWheel]);
  

  const drawEdge = (ctx, source, target, isHighlighted, isSelected = false) => {
    // Node dimensions
    const nodeWidth = 200;
    const nodeHeight = 75;
    
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
    
    // Define line style based on state
    let lineWidth = 4;
    let arrowSize = 14;
    
    if (isSelected) {
      ctx.strokeStyle = '#f5bf64'; // Amber color for selected edge
      // lineWidth = 6;
      // arrowSize = 16; // Slightly larger arrow for selected state
    } else if (isHighlighted) {
      ctx.strokeStyle = '#ff8874'; // Orange
      // lineWidth = 5;
      // arrowSize = 15; // Slightly larger arrow for highlighted state
    } else {
      ctx.strokeStyle = '#9ca3af'; // Gray
      // lineWidth = 4;
    }
    
    ctx.lineWidth = lineWidth;
    
    // Calculate a slightly shortened end point for the line
    // This prevents the line from jutting out past the arrowhead
    const arrowBackOff = lineWidth / 2; // Adjust this value as needed
    const endXAdjusted = endX - arrowBackOff * Math.cos(angle);
    const endYAdjusted = endY - arrowBackOff * Math.sin(angle);
    
    // Draw line with adjusted endpoint
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endXAdjusted, endYAdjusted);
    ctx.stroke();
    
    // Draw arrow head (larger and cover the line end)
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
      ctx.fillStyle = '#f5bf64'; // Amber
    } else if (isHighlighted) {
      ctx.fillStyle = '#ff8874'; // Orange
    } else {
      ctx.fillStyle = '#9ca3af'; // Gray
    }
    
    ctx.fill();
  };

  const centerCanvas = () => {
    const nodes = graph.getAllNodes();
    
    // If no nodes, do nothing
    if (nodes.length === 0) return;
    
    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.x - 60); // Half node width
      minY = Math.min(minY, node.y - 40); // Half node height
      maxX = Math.max(maxX, node.x + 60);
      maxY = Math.max(maxY, node.y + 40);
    });
    
    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Calculate center of the bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Set the offset to center the content
    setCanvasOffset({
      x: centerX - containerWidth / 2,
      y: centerY - containerHeight / 2
    });
  };

  // Animation loop
  useEffect(() => {
    
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
  }, [graph, selectedNode, creatingEdge, edgeStart, mousePos, highlightedPath, selectedEdge, canvasOffset, selectingPath, pathSource, renderCanvas]);
  // Keep your existing drawNode and drawEdge functions

  useEffect(() => {
    if (history.length === 0) {
      // Initialize history with the current graph
      setHistory([JSON.stringify(graph)]);
      setHistoryIndex(0);
    }
  }, [graph, history.length]);
  
  // Track graph changes and update history
  useEffect(() => {
    // Don't update history if the change was caused by undo/redo
    if (isUndoRedo) {
      setIsUndoRedo(false);
      return;
    }
    
    // Serialize the current graph state
    const currentGraph = JSON.stringify(graph);
    
    // Avoid recording duplicate states or recording during undo/redo
    if (history.length > 0 && history[historyIndex] === currentGraph) {
      return;
    }
    
    // If we're in the middle of the history, truncate the future states
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Add the new graph state to history
    setHistory([...newHistory, currentGraph]);
    setHistoryIndex(historyIndex + 1);
    
    // Limit history size to prevent memory issues (optional)
    if (newHistory.length > 50) {
      setHistory(newHistory.slice(newHistory.length - 50));
      setHistoryIndex(49); // Adjust the index accordingly
    }
  }, [graph, history, historyIndex, isUndoRedo]);
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    setIsUndoRedo(true);
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    
    // Restore the previous graph state
    const prevGraph = JSON.parse(history[newIndex]);
    setGraph(Graph.fromJSON(prevGraph));
  }, [history, historyIndex]);
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    setIsUndoRedo(true);
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    
    // Restore the next graph state
    const nextGraph = JSON.parse(history[newIndex]);
    setGraph(Graph.fromJSON(nextGraph));
  }, [history, historyIndex]);
  
  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if Ctrl key is pressed
      if (e.ctrlKey) {
        // Handle Ctrl+Z for undo
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        }
        // Handle Ctrl+Y for redo
        else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    
    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);
  
  const handleTextareaKeyDown = (e) => {
    // Check if the Enter key was pressed without the Shift key
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent the default newline behavior
      handleSaveNodeText(); // Save the node text
    }
  };

  // Render
  return (
    <div className="flex flex-col">
      <div>
        <div className="flex gap-2 items-end mb-2 fixed bottom-0 z-20 px-4 w-full">
          <h1 className="text-2xl font-bold text-[var(--primary)] leading-0 tracking-tight">PathSeek</h1>
          <div className="ml-auto flex gap-2 mb-1.5">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setZoomLevel(1); // Reset to default zoom
                centerCanvas(); // Optional: center the canvas as well
              }}
              title="Reset View"
              startIcon={
                // <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                //   <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                // </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="10" cy="10" r="7" strokeWidth="1.5" />
                  <circle cx="10" cy="10" r="2" fill="currentColor" />
                  <path d="M10 3v3" />
                  <path d="M10 14v3" />
                  <path d="M3 10h3" />
                  <path d="M14 10h3" />
                </svg>
              }
            >
              {/* Reset View */}
            </Button>

            <label
              className="font-semibold cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 px-4 py-2 bg-[var(--accent1)] text-[var(--accent1-foreground)] hover:bg-[var(--accent1)]/90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <input
                type="file"
                accept=".json"
                onChange={importFromJson}
                className="hidden"
              />
              {/* Import */}
            </label>
            <Button
              onClick={exportToJson}
              variant="accent2"
              startIcon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L10 11.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v8.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              }
            >
              {/* Export */}
            </Button>
            {/* <label className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer">
              Import
              <input
                type="file"
                accept=".json"
                onChange={importFromJson}
                className="hidden"
              />
            </label> */}
          </div>
          <div className="flex flex-wrap gap-2 items-center mb-1.5">
            {/* <div className="flex-1 flex items-center min-w-64">
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
            </div> */}
            
            <div className="flex gap-2">
                {/* <button
                onClick={startEdgeCreation}
                disabled={!selectedNode}
                className={`px-4 py-2 rounded ${
                    selectedNode 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-[#404040] text-gray-500'
                }`}
                >
                Connect
                </button> */}
                
                <Button
                    onClick={deleteNode}
                    disabled={!selectedNode}
                    variant={selectedNode ? "destructive" : "secondary"}
                    startIcon={
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    }
                >
                    {/* Delete Node */}
                </Button>
                
                {/* <Button
                    onClick={deleteEdge}
                    disabled={!selectedNode}
                    variant={selectedNode ? "destructive" : "secondary"}
                    // className={selectedNode ? "text-gray-700" : ""}
                >
                    Delete All Connections
                </Button> */}
                
                <Button
                  onClick={deleteSelectedEdge}
                  disabled={!selectedEdge}
                  variant={selectedEdge ? "destructive" : "secondary"}
                  // className={selectedEdge ? "bg-yellow-500 text-white hover:bg-yellow-600" : ""}
                  startIcon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  }
                >
                  Connection
                </Button>
                
                <Button
                    onClick={startPathSelection}
                    disabled={!selectedNode}
                    variant="secondary"
                    startIcon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-from-dot"><path d="m5 9 7-7 7 7"/><path d="M12 16V2"/><circle cx="12" cy="21" r="2"/></svg>
                    }
                    // className={selectedNode ? "bg-purple-600 text-white hover:bg-purple-700" : ""}
                >
                    Path From
                </Button>
                
                <Button
                    onClick={findPathToSelectedNode}
                    disabled={!selectedNode}
                    variant="secondary"
                    startIcon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-dot"><path d="M12 2v14"/><path d="m19 9-7 7-7-7"/><circle cx="12" cy="21" r="2" /></svg>
                    }
                >
                    Path To
                </Button>
               
            </div>
          </div>
          
          {error && (
            <div className="mt-2 p-4 bg-red-100 text-red-700 border-red-600 border rounded fixed top-4 left-1/2 transform -translate-x-1/2">
              {error}
            </div>
          )}

          {!error && highlightedPath.length > 0 && (
            <div className="mt-2 p-4 bg-[#ff8874] border-2 border-[#656262] text-black rounded fixed top-4 left-1/2 transform -translate-x-1/2">
              <strong>Path: </strong>{getFormattedPath()}
            </div>
          )}

          {!error && selectedNode && (
            <div className="p-4 bg-white border-2 border-[var(--secondary)] text-black rounded fixed top-6 left-6 shadow-md max-w-lg">
              <div className="flex items-start">
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-md leading-none text-[var(--primary)]">Selected Node</h3>
                  <p className="mt-1">{selectedNode.text}</p>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)} 
                  className="ml-4 text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
            
          <div className="relative ml-auto mb-1.5">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 focus:outline-none"
              aria-label="Help"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
      
            {/* Help popover */}
            {showHelp && (
              <div className="absolute right-0 -top-[590px] mt-2 w-80 bg-white rounded-md shadow-lg p-4 z-50">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium">How to Use PathSeek</h3>
                  <button 
                    onClick={() => setShowHelp(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="text-sm text-gray-600 space-y-6 text-left">
                <div>
                  <p className="font-bold mb-2">Creating & Editing</p>
                  <ul className="list-disc pl-5">
                    <li>
                      <span><span className="font-semibold">Double-click</span> on canvas to create a new step</span>
                    </li>
                    <li>
                      <span><span className="font-semibold">Double-click</span> on a step to edit its text</span>
                    </li>
                    <li>
                      <span><span className="font-semibold">Drag</span> to move steps around</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-bold mb-2">Connections</p>
                  <ul className="list-disc pl-5">
                    <li>
                      <span>Select a step and click <span className="font-semibold">"Connect"</span> to draw a connection</span>
                    </li>
                    <li>
                      <span><span className="font-semibold">Right-click</span> on a node to start a connection</span>
                    </li>
                    <li>
                      <span><span className="font-semibold">Right-click</span> on a connection to delete it</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-bold mb-2">Navigation</p>
                  <ul className="list-disc pl-5">
                    <li>
                      <span>Hold <span className="font-semibold">Ctrl</span> while dragging to pan the canvas</span>
                    </li>
                    <li>
                      <span>Use <span className="font-semibold">middle mouse button</span> to pan</span>
                    </li>
                    <li>
                      <span>Click <span className="font-semibold">"Center View"</span> to fit all steps on screen</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-bold mb-2">Finding Paths</p>
                  <ul className="list-disc pl-5">
                    <li>
                      <span>Use <span className="font-semibold">"Find Paths From This"</span> to show possible paths</span>
                    </li>
                    <li>
                      <span>Use <span className="font-semibold">"Show Path To This"</span> to see how to reach a step</span>
                    </li>
                  </ul>
                </div>
                </div>
                
                {/* Add a small triangle/arrow at the bottom */}
                <div className="absolute bottom-[-8px] right-3 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-white border-r-[8px] border-r-transparent"></div>
              </div>
            )}
          </div>
        </div>
        
        {/* Rest of your UI */}
        
        {/* Fix the canvas */}
        <div className="flex-1 relative" ref={containerRef}>
            <canvas
            ref={canvasRef}
            className="inset-0 w-screen h-screen"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            ></canvas>
          
          {/* Rest of your canvas code */}
          {editingNode && (
            <div 
              className="absolute p-4 rounded-lg bg-white shadow-lg"
              style={{
                left: `${(editingNode.x - canvasOffset.x / zoomLevel) * zoomLevel}px`,
                top: `${(editingNode.y - canvasOffset.y / zoomLevel) * zoomLevel}px`,
                zIndex: 100
              }}
            >
              <textarea
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Step description..."
                className="w-full p-2 border min-w-xs border-[var(--secondary)] rounded mb-2"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                {/* <button
                  onClick={handleCancelNodeEdit}
                  className="px-3 py-1 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNodeText}
                  className="px-3 py-1 bg-[var(--acent2)] text-white rounded"
                  >
                  Save
                </button> */}
                <Button
                  onClick={handleCancelNodeEdit}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNodeText}
                  variant="accent2"
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PathSeeker;