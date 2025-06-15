import React, { useState, useEffect } from "react";





const Cluster = () => {
  const [clusterData, setClusterData] = useState(null);

  useEffect(() => {
    fetch("/api/cluster")
      .then((res) => res.json())
      .then((data) => setClusterData(data));
  }, []);

  return (
    <section className="cluster-container">
      <h2 className="section-title">0. クラスタリング</h2>


    </section>
  );
}
