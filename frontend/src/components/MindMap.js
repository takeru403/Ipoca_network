// src/MindMap.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ノードIDとエッジのsource/targetの一貫性を担保し、必ずカード同士が線で繋がるように修正
function mindmapToFlowElements(
  mindmap,
  expandedMap,
  parentId = null,
  idPrefix = "root",
  depth = 0,
  yStart = 0,
  yStep = 120
) {
  const nodes = [];
  const edges = [];
  const childCount = mindmap.children && Array.isArray(mindmap.children) ? mindmap.children.length : 0;
  let myY = yStart;
  if (childCount > 0) {
    myY = yStart + ((childCount * yStep) - yStep) / 2;
  }
  nodes.push({
    id: idPrefix,
    type: "mindmapNode",
    data: { label: mindmap.title, hasChildren: childCount > 0, nodeId: idPrefix, expanded: expandedMap[idPrefix] !== false },
    position: { x: depth * 240, y: myY },
    style: {
      padding: 0,
      border: "none",
      background: "none"
    }
  });
  if (parentId !== null) {
    edges.push({ id: `${parentId}->${idPrefix}`, source: parentId, target: idPrefix, type: "smoothstep" });
  }
  if (childCount > 0 && expandedMap[idPrefix] !== false) {
    mindmap.children.forEach((child, idx) => {
      const childId = `${idPrefix}-${idx}`;
      const childY = yStart + idx * yStep;
      const { nodes: childNodes, edges: childEdges } = mindmapToFlowElements(
        child,
        expandedMap,
        idPrefix,
        childId,
        depth + 1,
        childY,
        yStep
      );
      nodes.push(...childNodes);
      edges.push(...childEdges);
    });
  }
  return { nodes, edges };
}

// カード風ノード（＋/−ボタン付き）
function MindmapNode({ data }) {
  const { label, hasChildren, expanded, onToggle } = data;
  return (
    <div style={{
      minWidth: 120,
      minHeight: 48,
      background: "#fff",
      border: "2px solid #7dafff",
      borderRadius: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      padding: "1em",
      fontWeight: "bold",
      fontSize: "1.1em",
      color: "#2a3b4d",
      textAlign: "center",
      position: "relative"
    }}>
      {hasChildren && (
        <button
          onClick={onToggle}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            background: expanded ? "#e3f2fd" : "#bbdefb",
            color: "#007bff",
            fontWeight: "bold",
            fontSize: "1.2em",
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
          }}
          title={expanded ? "折りたたむ" : "展開する"}
        >
          {expanded ? "−" : "+"}
        </button>
      )}
      {label}
    </div>
  );
}

// 全ノードを折りたたみ（rootのみ展開、root直下の子も折りたたみ）
function collapseAll(mindmap, idPrefix = "root", isRoot = true) {
  let map = { [idPrefix]: isRoot }; // ルートのみtrue、それ以外はfalse
  if (mindmap.children && Array.isArray(mindmap.children)) {
    mindmap.children.forEach((child, idx) => {
      Object.assign(map, collapseAll(child, `${idPrefix}-${idx}`, false));
    });
  }
  return map;
}

const MindMap = React.memo(() => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedMap, setExpandedMap] = useState({ root: true }); // 初期値はrootのみ展開
  const [rawMindmap, setRawMindmap] = useState(null);

  // ノードの展開/折りたたみ切り替え
  const handleToggle = useCallback((nodeId) => {
    setExpandedMap((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  // ノード・エッジ生成時にonToggleを渡す
  const buildElements = useCallback((mindmap, expandedMap) => {
    function injectOnToggle(nodes) {
      return nodes.map((node) => {
        if (node.type === "mindmapNode") {
          return {
            ...node,
            data: {
              ...node.data,
              onToggle: () => handleToggle(node.id)
            }
          };
        }
        return node;
      });
    }
    const { nodes, edges } = mindmapToFlowElements(mindmap, expandedMap);
    return { nodes: injectOnToggle(nodes), edges };
  }, [handleToggle]);

  // 初回取得時は全ノード折りたたみ＋rootのみ展開（root直下の子も折りたたみ）
  const fetchMindMap = useCallback(() => {
    setLoading(true);
    fetch("/api/mindmap")
      .then((res) => res.json())
      .then((data) => {
        setRawMindmap(data);
        if (data && !data.error) {
          // 全ノード折りたたみ＋rootのみ展開
          const collapsed = collapseAll(data, "root", true);
          setExpandedMap(collapsed);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMindMap();
    // eslint-disable-next-line
  }, []);

  // ノード・エッジ生成はuseMemoで最適化
  const elements = useMemo(() => {
    if (rawMindmap && !rawMindmap.error) {
      return buildElements(rawMindmap, expandedMap);
    }
    return { nodes: [], edges: [] };
  }, [rawMindmap, expandedMap, buildElements]);

  const handleGenerate = async () => {
    setGenerating(true);
    await fetch("/api/mindmap/generate", { method: "POST" });
    // 再生成直後に新しいマインドマップを取得し、expandedMapも初期化
    setLoading(true);
    fetch("/api/mindmap")
      .then((res) => res.json())
      .then((data) => {
        setRawMindmap(data);
        if (data && !data.error) {
          const collapsed = collapseAll(data, "root", true);
          setExpandedMap(collapsed);
        }
      })
      .finally(() => {
        setLoading(false);
        setGenerating(false);
      });
  };

  if (loading || generating) return <div>マインドマップをロード中...</div>;
  if (!elements.nodes.length) return <div>データがありません</div>;

  return (
    <div style={{ width: "100%", height: "70vh", background: "#f8fafd", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      <button
        onClick={handleGenerate}
        style={{ marginBottom: "1em", padding: "0.6em 1.2em", borderRadius: "8px", background: "#7dafff", color: "#fff", fontWeight: "bold", border: "none", cursor: "pointer" }}
        disabled={generating}
      >
        🧠 マインドマップを作成（再生成）
      </button>
      <div style={{ width: "100%", height: "calc(100% - 3em)" }}>
        <ReactFlow
          nodes={elements.nodes}
          edges={elements.edges}
          nodeTypes={{ mindmapNode: MindmapNode }}
          fitView={false} // fitViewは自動で呼ばない
          panOnDrag
          zoomOnScroll
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#e3f2fd" gap={24} />
          <MiniMap nodeColor={() => "#7dafff"} nodeStrokeWidth={3} />
          <Controls showFitView={true} />
        </ReactFlow>
      </div>
    </div>
  );
});

export default MindMap;
