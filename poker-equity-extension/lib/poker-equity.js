// Poker equity calculation using poker-tools library
// This module handles equity calculations for the Chrome extension

class PokerEquity {
  constructor() {
    // Import poker-tools functionality
    this.pokerTools = require('poker-tools');
  }
  
  /**
   * Calculate equity for given hands and board
   * @param {string[]} playerCards - Player's hole cards (e.g., ['Ah', 'Ks'])
   * @param {string[]} boardCards - Board cards (e.g., ['2d', '7s', 'Tc'])
   * @param {string|string[]} opponentRange - Opponent range (default: 'random')
   * @returns {Promise<number>} Equity as decimal (0.0 to 1.0)
   */
  async calculateEquity(playerCards, boardCards = [], opponentRange = 'random') {
    try {
      if (!playerCards || playerCards.length < 2) {
        throw new Error('Player must have at least 2 cards');
      }
      
      // Format cards for poker-tools
      const playerHand = playerCards.join('');
      const board = boardCards.join('');
      
      let equity;
      
      if (opponentRange === 'random') {
        // Calculate against random opponent hand
        equity = this.calculateAgainstRandom(playerHand, board);
      } else if (Array.isArray(opponentRange)) {
        // Calculate against specific opponent cards
        const opponentHand = opponentRange.join('');
        equity = this.calculateHeadsUp(playerHand, opponentHand, board);
      } else {
        // For now, treat any other range as random
        equity = this.calculateAgainstRandom(playerHand, board);
      }
      
      return equity;
      
    } catch (error) {
      console.error('Equity calculation error:', error);
      return 0.5; // Return neutral equity on error
    }
  }
  
  /**
   * Calculate equity against random opponent
   * Uses Monte Carlo simulation
   */
  calculateAgainstRandom(playerHand, board) {
    const trials = 10000; // Number of simulations
    let wins = 0;
    
    for (let i = 0; i < trials; i++) {
      const deck = this.createDeck();
      
      // Remove known cards
      this.removeCards(deck, playerHand);
      this.removeCards(deck, board);
      
      // Deal random opponent hand
      const opponentHand = this.dealRandomHand(deck, 2);
      
      // Complete the board if needed
      const fullBoard = this.completeBoard(deck, board);
      
      // Evaluate hands
      const playerResult = this.evaluateHand(playerHand + fullBoard);
      const opponentResult = this.evaluateHand(opponentHand + fullBoard);
      
      if (playerResult.score > opponentResult.score) {
        wins++;
      } else if (playerResult.score === opponentResult.score) {
        wins += 0.5; // Split pot
      }
    }
    
    return wins / trials;
  }
  
  /**
   * Calculate heads-up equity between two specific hands
   */
  calculateHeadsUp(playerHand, opponentHand, board) {
    try {
      const deck = this.createDeck();
      
      // Remove known cards
      this.removeCards(deck, playerHand);
      this.removeCards(deck, opponentHand);
      this.removeCards(deck, board);
      
      const boardLength = board.length / 2; // Each card is 2 characters
      const trials = Math.min(1000, this.calculatePossibleBoards(deck, 5 - boardLength));
      
      let wins = 0;
      
      for (let i = 0; i < trials; i++) {
        const shuffledDeck = [...deck];
        this.shuffle(shuffledDeck);
        
        const fullBoard = this.completeBoard(shuffledDeck, board);
        
        const playerResult = this.evaluateHand(playerHand + fullBoard);
        const opponentResult = this.evaluateHand(opponentHand + fullBoard);
        
        if (playerResult.score > opponentResult.score) {
          wins++;
        } else if (playerResult.score === opponentResult.score) {
          wins += 0.5;
        }
      }
      
      return wins / trials;
      
    } catch (error) {
      console.error('Heads-up calculation error:', error);
      return 0.5;
    }
  }
  
  /**
   * Create a standard 52-card deck
   */
  createDeck() {
    const suits = ['h', 'd', 'c', 's'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    
    return deck;
  }
  
  /**
   * Remove cards from deck
   */
  removeCards(deck, cards) {
    if (!cards) return;
    
    for (let i = 0; i < cards.length; i += 2) {
      const card = cards.substring(i, i + 2);
      const index = deck.indexOf(card);
      if (index > -1) {
        deck.splice(index, 1);
      }
    }
  }
  
  /**
   * Deal random cards from deck
   */
  dealRandomHand(deck, count) {
    const hand = [];
    const deckCopy = [...deck];
    
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * deckCopy.length);
      hand.push(deckCopy.splice(randomIndex, 1)[0]);
    }
    
    return hand.join('');
  }
  
  /**
   * Complete the board to 5 cards
   */
  completeBoard(deck, currentBoard) {
    const currentLength = currentBoard.length / 2;
    const needed = 5 - currentLength;
    
    if (needed <= 0) return currentBoard;
    
    const deckCopy = [...deck];
    this.shuffle(deckCopy);
    
    let additionalCards = '';
    for (let i = 0; i < needed; i++) {
      additionalCards += deckCopy[i];
    }
    
    return currentBoard + additionalCards;
  }
  
  /**
   * Shuffle array in place
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * Calculate number of possible board combinations
   */
  calculatePossibleBoards(deck, cardsNeeded) {
    if (cardsNeeded === 0) return 1;
    if (cardsNeeded > deck.length) return 0;
    
    // Calculate combinations C(n,k)
    let result = 1;
    for (let i = 0; i < cardsNeeded; i++) {
      result *= (deck.length - i);
      result /= (i + 1);
    }
    
    return Math.floor(result);
  }
  
  /**
   * Evaluate a 7-card hand (2 hole + 5 board)
   * Simplified evaluation - could be enhanced with proper hand ranking
   */
  evaluateHand(sevenCards) {
    // For now, return a simplified score
    // In a full implementation, this would use proper hand ranking
    
    const cards = [];
    for (let i = 0; i < sevenCards.length; i += 2) {
      cards.push(sevenCards.substring(i, i + 2));
    }
    
    // Simple scoring based on high cards and pairs
    let score = 0;
    const ranks = cards.map(card => card[0]);
    const suits = cards.map(card => card[1]);
    
    // Count ranks
    const rankCounts = {};
    ranks.forEach(rank => {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    // Count suits
    const suitCounts = {};
    suits.forEach(suit => {
      suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    });
    
    // Check for flush
    const hasFlush = Object.values(suitCounts).some(count => count >= 5);
    if (hasFlush) score += 500;
    
    // Check for pairs, trips, quads
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    if (counts[0] === 4) score += 700; // Quads
    else if (counts[0] === 3 && counts[1] === 2) score += 600; // Full house
    else if (counts[0] === 3) score += 300; // Three of a kind
    else if (counts[0] === 2 && counts[1] === 2) score += 200; // Two pair
    else if (counts[0] === 2) score += 100; // Pair
    
    // Add high card value
    const highCardValue = this.getHighCardValue(ranks);
    score += highCardValue;
    
    return { score, description: this.getHandDescription(score) };
  }
  
  /**
   * Get numeric value for high card
   */
  getHighCardValue(ranks) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return Math.max(...ranks.map(rank => values[rank] || 0));
  }
  
  /**
   * Get hand description from score
   */
  getHandDescription(score) {
    if (score >= 700) return 'Four of a Kind';
    if (score >= 600) return 'Full House';
    if (score >= 500) return 'Flush';
    if (score >= 300) return 'Three of a Kind';
    if (score >= 200) return 'Two Pair';
    if (score >= 100) return 'Pair';
    return 'High Card';
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PokerEquity;
} else if (typeof window !== 'undefined') {
  window.PokerEquity = PokerEquity;
}