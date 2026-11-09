module.exports = function fcfsScheduler(roads) {
    const sorted = roads
      .slice()
      .sort((a, b) => b.waitTime - a.waitTime);
  
    let cumulativeWait = 0;
    const schedule = sorted.map((road, index) => {
      const greenTime = road.vehicleCount > 0
        ? Math.max(5, Math.min(30, road.vehicleCount * 2))
        : 5;
      const startWait = cumulativeWait;
      cumulativeWait += greenTime;
      return {
        roadId: road.id,
        roadName: road.name,
        greenTime,
        waitTime: startWait,   
        order: index + 1
      };
    });
    return schedule;
  };