# World Peace Online - Optimized Codebase

This document describes the optimized and modularized structure of the World Peace Online game server codebase.

## Project Structure

The codebase has been reorganized into a modular structure to improve maintainability and readability:

```
worldpeaceOL/
├── config/                 # Configuration files
│   ├── config.js           # Application configuration
│   └── logging.js          # Logging utilities
├── models/                 # Data models
│   ├── game-modes.js       # Game mode definitions
│   ├── rooms.js            # Room management
│   └── users.js            # User management
├── prisma/                 # Database ORM
│   ├── client.js           # Prisma client instance
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── routes/                 # Express routes
│   ├── auth.js             # Authentication routes
│   ├── room.js             # Room management routes
│   └── user.js             # User-related routes
├── socket/                 # Socket.io handlers
│   ├── connection.js       # Socket connection handling
│   ├── game.js             # Game-related socket events
│   └── matchmaking.js      # Matchmaking system
├── utils/                  # Utility functions
│   ├── elo.js              # ELO rating calculations
│   ├── test.js             # Test utilities
│   └── debug.js            # Debug utilities
├── public/                 # Static files
│   ├── js/                 # Client-side JavaScript
│   ├── css/                # Stylesheets
│   └── images/             # Image assets
├── server.js               # Main server entry point
└── update-server.js        # Server update script
```

## Key Improvements

1. **Modular Architecture**: Code has been split into logical modules with clear responsibilities.
2. **Reduced Redundancy**: Duplicate code has been eliminated and common functions centralized.
3. **Improved Error Handling**: Consistent error handling and logging throughout the codebase.
4. **Better Organization**: Files organized by function rather than mixed together.
5. **Cleaner Client Code**: Client-side JavaScript separated from HTML files.

## Module Descriptions

### Config

- **config.js**: Central configuration for the application, using environment variables.
- **logging.js**: Unified logging system with categories and levels.

### Models

- **game-modes.js**: Defines different game modes and their properties.
- **rooms.js**: Manages game rooms, players, and game state.
- **users.js**: Handles connected users and authentication state.

### Socket

- **connection.js**: Manages socket connections and basic events.
- **matchmaking.js**: Implements the matchmaking queue and player pairing.

### Utils

- **elo.js**: ELO rating calculation and leaderboard utilities.

## How to Update

To update from the old monolithic server to the new modular version:

```bash
node update-server.js
```

This will:
1. Back up the old server.js file to the backup directory
2. Replace it with the new modular version

## Running the Server

```bash
node server.js
```

## Development

For development, set the environment variables in `.env`:

```
NODE_ENV=development
DEBUG_MODE=true
VERBOSE_LOGGING=true
``` 