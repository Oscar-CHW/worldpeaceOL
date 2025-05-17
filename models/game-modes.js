/**
 * Game Mode Configurations
 * Defines different game modes with their properties and unit statistics
 */

/**
 * Game mode configurations
 * @type {Object.<string, Object>}
 */
const gameModes = {
  classic: {
    name: "Classic",
    description: "Standard game mode with balanced gameplay.",
    initialGold: 500,
    miningRate: 50,
    unitStats: {
      miner: { health: 100, speed: 1.0, cost: 100 },
      soldier: { health: 200, damage: 10, speed: 1.0, cost: 200 },
      barrier: { health: 300, cost: 50 }
    }
  },
  insane: {
    name: "Insane",
    description: "Fast-paced chaos with powerful units and rapid resource generation.",
    initialGold: 1000,
    miningRate: 100,
    unitStats: {
      miner: { health: 80, speed: 1.5, cost: 100 },
      soldier: { health: 250, damage: 20, speed: 1.3, cost: 250 },
      barrier: { health: 500, cost: 75 },
      berserker: { health: 180, damage: 40, speed: 1.8, cost: 400 }
    }
  },
  beta: {
    name: "Beta",
    description: "Experimental features and unique gameplay elements.",
    initialGold: 700,
    miningRate: 65,
    unitStats: {
      miner: { health: 120, speed: 1.0, cost: 120 },
      soldier: { health: 180, damage: 15, speed: 1.0, cost: 220 },
      barrier: { health: 350, cost: 60 },
      scout: { health: 90, damage: 5, speed: 2.0, cost: 150 }
    }
  }
};

/**
 * Get the configuration for a specific game mode
 * @param {string} mode - The game mode to retrieve
 * @returns {Object} The game mode configuration or classic mode as default
 */
function getGameMode(mode) {
  return gameModes[mode] || gameModes.classic;
}

/**
 * Get a list of all available game modes
 * @returns {Array<{id: string, name: string, description: string}>} Array of game mode objects
 */
function getAvailableGameModes() {
  return Object.entries(gameModes).map(([id, mode]) => ({
    id,
    name: mode.name,
    description: mode.description
  }));
}

module.exports = {
  gameModes,
  getGameMode,
  getAvailableGameModes
}; 