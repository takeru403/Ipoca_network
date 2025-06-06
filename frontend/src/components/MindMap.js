// src/MindMap.js
import React, { useEffect, useState } from "react";
import Tree from "react-d3-tree";

const MindMap = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/mindmap")
      .then((res) => res.json())
      .then(setData)
      .catch((err) => setData({ error: err.message }));
  }, []);

  if (!data) return <div>マインドマップをロード中...</div>;
  if (data.error) return <div>エラー: {data.error}</div>;

  // react-d3-tree形式に変換
  const convertToTree = (node) => ({
    name: node.title,
    children: node.children ? node.children.map(convertToTree) : [],
  });

  return (
    <div style={{ width: "100%", height: "70vh", background: "#f8fafd" }}>
      <Tree
        data={convertToTree(data)}
        orientation="horizontal"
        translate={{ x: 350, y: 300 }}
        collapsible={true}
        separation={{ siblings: 2, nonSiblings: 2 }}
        pathFunc="elbow"
        styles={{
          nodes: {
            node: {
              circle: { fill: "#7dafff", r: 12 },
              name: { fontSize: "1.1em", fontWeight: "bold" },
              attributes: { fontSize: "0.9em" }
            },
            leafNode: {
              circle: { fill: "#aee9ff", r: 12 },
              name: { fontSize: "1em" }
            }
          }
        }}
      />
    </div>
  );
};

export default MindMap;
