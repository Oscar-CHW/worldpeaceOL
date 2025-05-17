/**
 * ELO Rating System Utilities
 * Functions for calculating and updating player ELO ratings
 */
const { log } = require('../config/logging');
const prisma = require('../prisma/client');

// ELO constants
const K_FACTOR = 32; // How much ratings change
const DEFAULT_RATING = 1200; // Starting rating for new players
const MIN_RATING = 100; // Minimum possible rating
const WIN_BONUS = 5; // Small fixed bonus for winning

/**
 * Calculate the expected score based on player ratings
 * @param {number} playerRating - Rating of the player
 * @param {number} opponentRating - Rating of the opponent
 * @returns {number} Expected score (between 0 and 1)
 */
function calculateExpectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate new ELO rating
 * @param {number} currentRating - Current rating
 * @param {number} expectedScore - Expected score
 * @param {number} actualScore - Actual score (1 for win, 0 for loss)
 * @returns {number} New rating
 */
function calculateNewRating(currentRating, expectedScore, actualScore) {
    // Calculate basic ELO change
    let newRating = Math.round(currentRating + K_FACTOR * (actualScore - expectedScore));
    
    // Add a small bonus for winning to encourage aggressive play
    if (actualScore > 0) {
        newRating += WIN_BONUS;
    }
    
    // Ensure rating doesn't go below minimum
    return Math.max(MIN_RATING, newRating);
}

/**
 * Update ELO ratings for players in a match
 * @param {number} matchId - ID of the match
 * @param {string} winnerId - ID of the winning player
 * @returns {Promise<Object>} Updated ratings
 */
async function updateEloRatings(matchId, winnerId) {
    try {
        // Get match data
        const match = await prisma.match.findUnique({
            where: { id: matchId }
        });
        
        if (!match) {
            throw new Error(`Match ${matchId} not found`);
        }
        
        // Verify winner is in the match
        if (!match.playerIds.includes(winnerId)) {
            throw new Error(`Winner ${winnerId} not in match ${matchId}`);
        }
        
        // Get player data
        const players = await prisma.user.findMany({
            where: {
                id: {
                    in: match.playerIds
                }
            },
            select: {
                id: true,
                username: true,
                eloRating: true
            }
        });
        
        if (players.length !== 2) {
            throw new Error(`Expected 2 players in match ${matchId}, found ${players.length}`);
        }
        
        // Identify winner and loser
        const winner = players.find(p => p.id === winnerId);
        const loser = players.find(p => p.id !== winnerId);
        
        if (!winner || !loser) {
            throw new Error('Could not identify winner and loser');
        }
        
        // Calculate expected scores
        const winnerExpectedScore = calculateExpectedScore(winner.eloRating, loser.eloRating);
        const loserExpectedScore = calculateExpectedScore(loser.eloRating, winner.eloRating);
        
        // Calculate new ratings
        const winnerNewRating = calculateNewRating(winner.eloRating, winnerExpectedScore, 1);
        const loserNewRating = calculateNewRating(loser.eloRating, loserExpectedScore, 0);
        
        // Calculate changes
        const winnerRatingChange = winnerNewRating - winner.eloRating;
        const loserRatingChange = loserNewRating - loser.eloRating;
        
        // Update match record with ELO changes
        await prisma.match.update({
            where: { id: matchId },
            data: {
                winnerId,
                eloChanges: {
                    [winner.id]: winnerRatingChange,
                    [loser.id]: loserRatingChange
                },
                status: 'completed'
            }
        });
        
        // Update player ratings
        await Promise.all([
            prisma.user.update({
                where: { id: winner.id },
                data: {
                    eloRating: winnerNewRating,
                    wins: { increment: 1 }
                }
            }),
            prisma.user.update({
                where: { id: loser.id },
                data: {
                    eloRating: loserNewRating,
                    losses: { increment: 1 }
                }
            })
        ]);
        
        log(`Updated ELO ratings for match ${matchId}. ${winner.username}: ${winner.eloRating} -> ${winnerNewRating} (${winnerRatingChange >= 0 ? '+' : ''}${winnerRatingChange}), ${loser.username}: ${loser.eloRating} -> ${loserNewRating} (${loserRatingChange >= 0 ? '+' : ''}${loserRatingChange})`, 'info');
        
        return {
            matchId,
            winner: {
                id: winner.id,
                username: winner.username,
                oldRating: winner.eloRating,
                newRating: winnerNewRating,
                change: winnerRatingChange
            },
            loser: {
                id: loser.id,
                username: loser.username,
                oldRating: loser.eloRating,
                newRating: loserNewRating,
                change: loserRatingChange
            }
        };
    } catch (error) {
        log(`Error updating ELO ratings: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Get and calculate player rankings
 * @param {number} limit - Maximum number of players to return
 * @returns {Promise<Array>} Top players with rankings
 */
async function getPlayerRankings(limit = 10) {
    try {
        const players = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                eloRating: true,
                wins: true,
                losses: true,
                createdAt: true
            },
            orderBy: {
                eloRating: 'desc'
            },
            take: limit
        });
        
        return players.map((player, index) => ({
            rank: index + 1,
            ...player,
            matches: player.wins + player.losses,
            winRate: player.wins + player.losses > 0 
                ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                : 0
        }));
    } catch (error) {
        log(`Error getting player rankings: ${error.message}`, 'error');
        return [];
    }
}

module.exports = {
    DEFAULT_RATING,
    calculateExpectedScore,
    calculateNewRating,
    updateEloRatings,
    getPlayerRankings
}; 