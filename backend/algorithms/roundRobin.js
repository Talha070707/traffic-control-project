module.exports = function roundRobinScheduler(roads, baseQuantum = 10) {
    const totalVehicles = roads.reduce((sum, r) => sum + r.vehicleCount, 0);
  
    let cumulativeWait = 0;
    return roads.map((road, index) => {
      let greenTime;
  
      if (totalVehicles === 0) {
        // Sab roads ka equal time jab koi vehicle nahi
        greenTime = baseQuantum;
      } else {
        // Proportional time based on vehicle count
        // Road ka share = (uske vehicles / total vehicles) * totalTime
        const totalTime = baseQuantum * roads.length; // e.g. 10*4 = 40s total
        greenTime = Math.round((road.vehicleCount / totalVehicles) * totalTime);
        // Minimum 3s, maximum 30s
        greenTime = Math.max(3, Math.min(30, greenTime));
      }
  
      const waitTime = cumulativeWait;
      cumulativeWait += greenTime;
  
      return {
        roadId: road.id,
        roadName: road.name,
        greenTime,
        waitTime,
        order: index + 1,
        quantum: greenTime
      };
    });
  };