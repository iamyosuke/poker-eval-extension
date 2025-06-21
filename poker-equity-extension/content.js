class PokerEquityCalculator {
  constructor() {
    this.enabled = true;
    this.autoPlayEnabled = false;
    this.overlay = null;
    this.lastCards = '';
    this.observer = null;
    this.gameStateObserver = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentEquity = null;
    this.lastActionTime = 0;
    this.actionCooldown = 2000; // 2 seconds cooldown between actions
    this.lastTurnState = false;
    this.gameState = {
      potSize: 0,
      totalPot: 0,
      myTurn: false,
      availableActions: []
    };
    
    this.init();
  }
  
  async init() {
    console.log('Poker Equity Calculator initialized');
    
    // Check if enabled in storage
    const result = await chrome.storage.local.get(['equityEnabled', 'autoPlayEnabled']);
    this.enabled = result.equityEnabled !== false;
    this.autoPlayEnabled = result.autoPlayEnabled === true;
    
    console.log('Initial settings:', { 
      enabled: this.enabled, 
      autoPlay: this.autoPlayEnabled 
    });
    
    if (this.enabled) {
      this.createOverlay();
      this.startMonitoring();
    }
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request) => {
      console.log('Message received:', request);
      
      if (request.action === 'toggleEquity') {
        this.enabled = request.enabled;
        console.log('Equity calculator:', this.enabled ? 'ENABLED' : 'DISABLED');
        if (this.enabled) {
          this.createOverlay();
          this.startMonitoring();
        } else {
          this.stopMonitoring();
          this.removeOverlay();
        }
      } else if (request.action === 'toggleAutoPlay') {
        this.autoPlayEnabled = request.enabled;
        console.log('🤖 Auto-play toggled via message:', this.autoPlayEnabled ? 'ENABLED' : 'DISABLED');
        
        // Also update storage to ensure persistence
        chrome.storage.local.set({autoPlayEnabled: this.autoPlayEnabled});
        
        // Update overlay immediately to reflect the change
        if (this.overlay) {
          this.updateOverlayStatus();
        }
      }
    });
    
    // Also listen for storage changes directly
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.autoPlayEnabled) {
          this.autoPlayEnabled = changes.autoPlayEnabled.newValue;
          console.log('🤖 Auto-play changed via storage:', this.autoPlayEnabled ? 'ENABLED' : 'DISABLED');
          if (this.overlay) {
            this.updateOverlayStatus();
          }
        }
        if (changes.equityEnabled) {
          this.enabled = changes.equityEnabled.newValue;
          console.log('Calculator changed via storage:', this.enabled ? 'ENABLED' : 'DISABLED');
        }
      }
    });
  }
  
  extractCards() {
    const cards = [];
    const cardContainers = document.querySelectorAll('.card-container.flipped');
    
    cardContainers.forEach(container => {
      // Extract suit from class
      let suit = '';
      if (container.classList.contains('card-h')) suit = 'h';
      else if (container.classList.contains('card-c')) suit = 'c';
      else if (container.classList.contains('card-d')) suit = 'd';
      else if (container.classList.contains('card-s')) suit = 's';
      
      // Extract value from class or text content
      let value = '';
      const classList = Array.from(container.classList);
      const valueClass = classList.find(cls => cls.startsWith('card-s-'));
      if (valueClass) {
        value = valueClass.replace('card-s-', '');
        // Convert numeric values to standard format
        if (value === '11') value = 'J';
        else if (value === '12') value = 'Q';
        else if (value === '13') value = 'K';
        else if (value === '14') value = 'A';
        else if (value === '10') value = 'T';
      } else {
        // Fallback: get from text content
        const valueSpan = container.querySelector('.value');
        if (valueSpan) {
          value = valueSpan.textContent.trim();
          if (value === '10') value = 'T';
        }
      }
      
      if (suit && value) {
        cards.push(value + suit);
      }
    });
    
    return cards;
  }
  
  categorizeCards(cards) {
    // Try to determine player cards vs board cards based on container classes
    
    const playerCards = [];
    const boardCards = [];
    
    // Look for different card container patterns
    const playerCardContainers = document.querySelectorAll('.table-player-cards .card-container.flipped, .player-cards .card-container.flipped');
    const boardCardContainers = document.querySelectorAll('.table-board .card-container.flipped, .board .card-container.flipped, .community .card-container.flipped, .table-cards .card-container.flipped');
    
    // Extract player cards (typically 2 cards)
    playerCardContainers.forEach(container => {
      const card = this.extractSingleCard(container);
      if (card) playerCards.push(card);
    });
    
    // Extract board cards (flop, turn, river)
    boardCardContainers.forEach(container => {
      const card = this.extractSingleCard(container);
      if (card) boardCards.push(card);
    });
    
    // If we found board cards but no player cards, try to differentiate
    if (playerCards.length === 0 && boardCards.length > 0) {
      // Check if there are multiple card groups
      const tableCardsContainers = document.querySelectorAll('.table-cards');
      
      if (tableCardsContainers.length > 1) {
        // Multiple table-cards groups - first might be player cards
        const firstGroupCards = tableCardsContainers[0].querySelectorAll('.card-container.flipped');
        const restGroupCards = [];
        
        for (let i = 1; i < tableCardsContainers.length; i++) {
          const groupCards = tableCardsContainers[i].querySelectorAll('.card-container.flipped');
          restGroupCards.push(...groupCards);
        }
        
        // Clear and re-categorize
        playerCards.length = 0;
        boardCards.length = 0;
        
        firstGroupCards.forEach(container => {
          const card = this.extractSingleCard(container);
          if (card) playerCards.push(card);
        });
        
        restGroupCards.forEach(container => {
          const card = this.extractSingleCard(container);
          if (card) boardCards.push(card);
        });
      }
    }
    
    // Final fallback: if no specific categorization, assume first 2 are player cards
    if (playerCards.length === 0 && boardCards.length === 0 && cards.length > 0) {
      for (let i = 0; i < cards.length; i++) {
        if (i < 2) {
          playerCards.push(cards[i]);
        } else {
          boardCards.push(cards[i]);
        }
      }
    }
    
    return { playerCards, boardCards };
  }
  
  extractSingleCard(container) {
    if (!container.classList.contains('flipped')) return null;
    
    let suit = '';
    if (container.classList.contains('card-h')) suit = 'h';
    else if (container.classList.contains('card-c')) suit = 'c';
    else if (container.classList.contains('card-d')) suit = 'd';
    else if (container.classList.contains('card-s')) suit = 's';
    
    let value = '';
    const classList = Array.from(container.classList);
    const valueClass = classList.find(cls => cls.startsWith('card-s-'));
    if (valueClass) {
      value = valueClass.replace('card-s-', '');
      // Convert numeric values to standard format
      if (value === '11') value = 'J';
      else if (value === '12') value = 'Q';
      else if (value === '13') value = 'K';
      else if (value === '14') value = 'A';
      else if (value === '10') value = 'T';
    } else {
      // Fallback: get from text content
      const valueSpan = container.querySelector('.value');
      if (valueSpan) {
        value = valueSpan.textContent.trim();
        if (value === '10') value = 'T';
      }
    }
    
    return (suit && value) ? value + suit : null;
  }
  
  async calculateEquity(playerCards, boardCards) {
    if (playerCards.length < 2) return null;
    
    try {
      // Use simple Monte Carlo simulation for equity calculation
      const trials = 1000;
      let wins = 0;
      
      for (let i = 0; i < trials; i++) {
        const result = this.simulateHand(playerCards, boardCards);
        wins += result;
      }
      
      return wins / trials;
      
    } catch (error) {
      console.error('Equity calculation error:', error);
      // Fallback to simplified calculation
      return this.calculateSimpleEquity(playerCards, boardCards);
    }
  }
  
  simulateHand(playerCards, boardCards) {
    // Create deck and remove known cards
    const deck = this.createDeck();
    const usedCards = [...playerCards, ...boardCards];
    
    // Remove used cards from deck
    const availableDeck = deck.filter(card => !usedCards.includes(card));
    
    // Deal random opponent hand
    const shuffled = this.shuffleArray([...availableDeck]);
    const opponentCards = shuffled.slice(0, 2);
    let remainingDeck = shuffled.slice(2);
    
    // Complete the board if needed (5 cards total)
    const currentBoardSize = boardCards.length;
    const neededCards = 5 - currentBoardSize;
    const additionalBoard = remainingDeck.slice(0, neededCards);
    const fullBoard = [...boardCards, ...additionalBoard];
    
    // Evaluate hands (simplified)
    const playerScore = this.evaluateHand([...playerCards, ...fullBoard]);
    const opponentScore = this.evaluateHand([...opponentCards, ...fullBoard]);
    
    if (playerScore > opponentScore) return 1;
    if (playerScore === opponentScore) return 0.5;
    return 0;
  }
  
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
  
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  evaluateHand(cards) {
    if (cards.length < 5) return 0;
    
    // Take best 5 cards from 7
    const bestFive = cards.slice(0, 5); // Simplified - should find actual best 5
    
    const ranks = bestFive.map(card => card[0]);
    const suits = bestFive.map(card => card[1]);
    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    
    // Count occurrences
    const rankCounts = {};
    ranks.forEach(rank => {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    const suitCounts = {};
    suits.forEach(suit => {
      suitCounts[suit] = (suitCounts[suit] || 0) + 1;
    });
    
    // Check hand types (simplified)
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const isFlush = Object.values(suitCounts).some(count => count >= 5);
    
    let score = 0;
    
    if (isFlush) score += 500;
    if (counts[0] === 4) score += 700; // Four of a kind
    else if (counts[0] === 3 && counts[1] === 2) score += 600; // Full house
    else if (counts[0] === 3) score += 300; // Three of a kind
    else if (counts[0] === 2 && counts[1] === 2) score += 200; // Two pair
    else if (counts[0] === 2) score += 100; // Pair
    
    // Add high card
    const highCard = Math.max(...ranks.map(rank => rankValues[rank]));
    score += highCard;
    
    return score;
  }
  
  calculateSimpleEquity(playerCards, boardCards) {
    // Fallback simple calculation
    let equity = 0.5; // Default 50%
    
    const isPair = playerCards[0][0] === playerCards[1][0];
    const isSuited = playerCards[0][1] === playerCards[1][1];
    const hasAce = playerCards.some(card => card[0] === 'A');
    const hasKing = playerCards.some(card => card[0] === 'K');
    
    if (isPair) {
      equity += 0.2;
      if (playerCards[0][0] === 'A') equity += 0.15;
      else if (playerCards[0][0] === 'K') equity += 0.12;
    }
    
    if (isSuited) equity += 0.05;
    if (hasAce && hasKing) equity += 0.1;
    else if (hasAce) equity += 0.05;
    
    if (boardCards.length > 0) {
      const boardValues = boardCards.map(card => card[0]);
      const playerValues = playerCards.map(card => card[0]);
      const pairs = playerValues.filter(val => boardValues.includes(val)).length;
      equity += pairs * 0.1;
    }
    
    return Math.min(0.95, Math.max(0.05, equity));
  }
  
  createOverlay() {
    if (this.overlay) return;
    
    this.overlay = document.createElement('div');
    this.overlay.id = 'poker-equity-overlay';
    this.overlay.innerHTML = `
      <div class="equity-header">🃏 Equity Calculator</div>
      <div class="equity-content">
        <div class="equity-value">Analyzing...</div>
        <div class="equity-details"></div>
      </div>
    `;
    
    // Add drag functionality
    this.setupDragFunctionality();
    
    document.body.appendChild(this.overlay);
  }
  
  setupDragFunctionality() {
    if (!this.overlay) return;
    
    this.overlay.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.overlay.classList.add('dragging');
      
      const rect = this.overlay.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.overlay) return;
      
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      
      // Keep overlay within viewport bounds
      const maxX = window.innerWidth - this.overlay.offsetWidth;
      const maxY = window.innerHeight - this.overlay.offsetHeight;
      
      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));
      
      this.overlay.style.left = boundedX + 'px';
      this.overlay.style.top = boundedY + 'px';
      this.overlay.style.right = 'auto';
      this.overlay.style.bottom = 'auto';
      
      e.preventDefault();
    });
    
    document.addEventListener('mouseup', () => {
      if (this.isDragging && this.overlay) {
        this.isDragging = false;
        this.overlay.classList.remove('dragging');
      }
    });
    
    // Touch events for mobile support
    this.overlay.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      this.overlay.classList.add('dragging');
      
      const rect = this.overlay.getBoundingClientRect();
      const touch = e.touches[0];
      this.dragOffset.x = touch.clientX - rect.left;
      this.dragOffset.y = touch.clientY - rect.top;
      
      e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!this.isDragging || !this.overlay) return;
      
      const touch = e.touches[0];
      const x = touch.clientX - this.dragOffset.x;
      const y = touch.clientY - this.dragOffset.y;
      
      const maxX = window.innerWidth - this.overlay.offsetWidth;
      const maxY = window.innerHeight - this.overlay.offsetHeight;
      
      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));
      
      this.overlay.style.left = boundedX + 'px';
      this.overlay.style.top = boundedY + 'px';
      this.overlay.style.right = 'auto';
      this.overlay.style.bottom = 'auto';
      
      e.preventDefault();
    });
    
    document.addEventListener('touchend', () => {
      if (this.isDragging && this.overlay) {
        this.isDragging = false;
        this.overlay.classList.remove('dragging');
      }
    });
  }
  
  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
  
  updateOverlay(playerCards, boardCards, equity) {
    if (!this.overlay) return;
    
    const equityPercent = equity ? (equity * 100).toFixed(1) : 'N/A';
    const playerHand = playerCards.join(' ');
    const board = boardCards.length > 0 ? boardCards.join(' ') : 'Pre-flop';
    
    const equityValue = this.overlay.querySelector('.equity-value');
    const equityDetails = this.overlay.querySelector('.equity-details');
    
    if (equityValue) {
      equityValue.textContent = `Equity: ${equityPercent}%`;
      
      // Add color coding based on equity
      if (equity) {
        if (equity >= 0.7) equityValue.className = 'equity-value equity-high';
        else if (equity >= 0.5) equityValue.className = 'equity-value equity-medium';
        else equityValue.className = 'equity-value equity-low';
      }
    }
    
    if (equityDetails) {
      this.updateOverlayDetails(playerHand, board, equityDetails);
    }
  }
  
  updateOverlayStatus() {
    if (!this.overlay) return;
    
    const equityDetails = this.overlay.querySelector('.equity-details');
    if (equityDetails) {
      // Get current hand and board info from the existing display
      const handDiv = equityDetails.querySelector('div');
      const playerHand = handDiv ? handDiv.textContent.replace('Hand: ', '') : '';
      const boardDiv = equityDetails.querySelectorAll('div')[1];
      const board = boardDiv ? boardDiv.textContent.replace('Board: ', '') : '';
      
      this.updateOverlayDetails(playerHand, board, equityDetails);
    }
  }
  
  updateOverlayDetails(playerHand, board, equityDetails) {
    const autoPlayStatus = this.autoPlayEnabled ? 
      `<div style="color: #4CAF50; font-weight: bold;">🤖 Auto-play: ON</div>` : 
      `<div style="color: #888;">🤖 Auto-play: OFF</div>`;
    
    const gameStateInfo = this.gameState.myTurn ? 
      `<div style="color: #FFD700;">⏰ Your Turn</div>` : 
      `<div style="color: #888;">⏳ Waiting</div>`;
    
    const potInfo = this.gameState.totalPot > 0 ? 
      `<div>💰 Pot: ${this.gameState.totalPot}</div>` : '';
    
    equityDetails.innerHTML = `
      <div>Hand: ${playerHand}</div>
      <div>Board: ${board}</div>
      ${potInfo}
      ${gameStateInfo}
      ${autoPlayStatus}
    `;
  }
  
  async checkForCards() {
    if (!this.enabled) return;
    
    const allCards = this.extractCards();
    const cardsString = allCards.join(',');
    
    // Update game state
    this.updateGameState();
    
    // Only update if cards changed
    if (cardsString === this.lastCards) return;
    this.lastCards = cardsString;
    
    console.log('All cards detected:', allCards);
    
    if (allCards.length === 0) {
      if (this.overlay) {
        this.updateOverlay([], [], null);
      }
      return;
    }
    
    const { playerCards, boardCards } = this.categorizeCards(allCards);
    
    console.log('Categorized cards:', { playerCards, boardCards, allCards });
    
    if (playerCards.length >= 2) {
      const equity = await this.calculateEquity(playerCards, boardCards);
      this.currentEquity = equity;
      this.updateOverlay(playerCards, boardCards, equity);
    } else {
      // If we can't find player cards specifically, show all detected cards
      this.updateOverlay(allCards.slice(0, 2), allCards.slice(2), null);
    }
  }
  
  checkAutoPlayConditions() {
    if (!this.autoPlayEnabled || !this.enabled) return;
    
    // Check cooldown to prevent rapid-fire actions
    const now = Date.now();
    if (now - this.lastActionTime < this.actionCooldown) {
      return;
    }
    
    // Update game state to get latest turn information
    this.updateGameState();
    
    // Check if it's our turn and we have available actions
    if (this.gameState.myTurn && this.gameState.availableActions.length > 0) {
      console.log('🤖 AUTO-PLAY CONDITIONS MET: My turn with available actions');
      
      // Get current cards for decision making
      const allCards = this.extractCards();
      if (allCards.length >= 2) {
        const { playerCards, boardCards } = this.categorizeCards(allCards);
        
        if (playerCards.length >= 2) {
          // If we don't have equity yet, calculate it quickly
          if (this.currentEquity === null) {
            console.log('🤖 Calculating equity for immediate decision...');
            this.calculateEquity(playerCards, boardCards).then(equity => {
              this.currentEquity = equity;
              console.log('🤖 Equity calculated:', equity);
              this.makeAutoPlayDecision(playerCards, boardCards, equity);
            });
          } else {
            console.log('🤖 AUTO-PLAY: Making decision - Equity:', this.currentEquity, 'Available actions:', this.gameState.availableActions.map(a => a.action));
            this.makeAutoPlayDecision(playerCards, boardCards, this.currentEquity);
          }
        }
      } else {
        // No cards detected, use simple strategy
        console.log('🤖 No cards detected, using conservative strategy');
        const simpleDecision = { action: 'check', reason: 'No cards detected - conservative play' };
        if (this.gameState.availableActions.find(a => a.action === 'check')) {
          this.executeAction(simpleDecision);
        } else if (this.gameState.availableActions.find(a => a.action === 'fold')) {
          this.executeAction({ action: 'fold', reason: 'No cards detected - fold' });
        }
      }
    }
  }
  
  updateGameState() {
    // Extract pot size
    const potElement = document.querySelector('.table-pot-size .normal-value');
    const totalPotElement = document.querySelector('.table-pot-size .add-on .normal-value');
    
    if (potElement) {
      this.gameState.potSize = parseInt(potElement.textContent) || 0;
    }
    
    if (totalPotElement) {
      this.gameState.totalPot = parseInt(totalPotElement.textContent) || 0;
    }
    
    // Check if it's my turn
    const yourTurnElement = document.querySelector('.action-signal');
    this.gameState.myTurn = yourTurnElement && yourTurnElement.textContent.includes('Your Turn');
    
    // Extract available actions
    const actionButtons = document.querySelectorAll('.action-button:not(.back)');
    this.gameState.availableActions = Array.from(actionButtons).map(btn => ({
      action: this.getActionType(btn),
      element: btn,
      text: btn.textContent.trim(),
      amount: this.extractBetAmount(btn.textContent)
    }));
    
    // Log auto-play status for debugging
    if (this.gameState.myTurn && this.autoPlayEnabled) {
      console.log('🤖 AUTO-PLAY ACTIVE - Your turn detected');
    }
    
    console.log('Game state updated:', {
      ...this.gameState,
      autoPlayEnabled: this.autoPlayEnabled
    });
  }
  
  getActionType(button) {
    const classes = button.className;
    if (classes.includes('fold')) return 'fold';
    if (classes.includes('check')) return 'check';
    if (classes.includes('call')) return 'call';
    if (classes.includes('raise') || classes.includes('bet')) return 'bet';
    return 'unknown';
  }
  
  extractBetAmount(text) {
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  async makeAutoPlayDecision(playerCards, boardCards, equity) {
    if (!this.autoPlayEnabled || !this.gameState.myTurn) return;
    
    // Update last action time to start cooldown
    this.lastActionTime = Date.now();
    
    console.log('🤖 Making auto-play decision with equity:', equity);
    
    const decision = this.calculateOptimalAction(equity, boardCards.length);
    console.log('🤖 Decision:', decision);
    
    if (decision.action && decision.action !== 'wait') {
      this.executeAction(decision);
    }
  }
  
  calculateOptimalAction(equity, boardStage) {
    if (!equity) return { action: 'check' };
    
    const equityPercent = equity * 100;
    const potOdds = this.calculatePotOdds();
    
    // Decision matrix based on equity and board stage
    if (equityPercent >= 70) {
      // Very strong hand - bet for value
      return { action: 'bet', size: 'pot', reason: 'Strong hand - value bet' };
    } else if (equityPercent >= 60) {
      // Strong hand - bet or call
      if (this.gameState.availableActions.find(a => a.action === 'check')) {
        return { action: 'bet', size: '3/4 pot', reason: 'Good hand - value bet' };
      } else {
        return { action: 'call', reason: 'Good hand - call' };
      }
    } else if (equityPercent >= 50) {
      // Marginal hand - depends on position and pot odds
      if (this.gameState.availableActions.find(a => a.action === 'check')) {
        return { action: 'check', reason: 'Marginal hand - check' };
      } else if (equityPercent > potOdds) {
        return { action: 'call', reason: 'Pot odds favorable' };
      } else {
        return { action: 'fold', reason: 'Poor pot odds' };
      }
    } else if (equityPercent >= 40) {
      // Weak hand - usually check/fold
      if (this.gameState.availableActions.find(a => a.action === 'check')) {
        return { action: 'check', reason: 'Weak hand - check' };
      } else {
        return { action: 'fold', reason: 'Weak hand - fold' };
      }
    } else {
      // Very weak hand - fold
      return { action: 'fold', reason: 'Very weak hand' };
    }
  }
  
  calculatePotOdds() {
    const callAmount = this.gameState.availableActions.find(a => a.action === 'call')?.amount || 0;
    if (callAmount === 0) return 0;
    
    const totalPot = this.gameState.totalPot + callAmount;
    return (callAmount / totalPot) * 100;
  }
  
  executeAction(decision) {
    console.log('🤖 Executing action:', decision);
    
    const availableActions = this.gameState.availableActions;
    let targetButton = null;
    
    switch (decision.action) {
      case 'fold':
        targetButton = availableActions.find(a => a.action === 'fold')?.element;
        break;
      case 'check':
        targetButton = availableActions.find(a => a.action === 'check')?.element;
        break;
      case 'call':
        targetButton = availableActions.find(a => a.action === 'call')?.element;
        break;
      case 'bet':
        targetButton = availableActions.find(a => a.action === 'bet')?.element;
        if (targetButton && decision.size) {
          // Click bet button first, then select size
          console.log('🤖 Clicking bet button:', targetButton.textContent);
          targetButton.click();
          setTimeout(() => this.selectBetSize(decision.size), 500);
          return;
        }
        break;
    }
    
    if (targetButton) {
      console.log('🤖 Clicking button:', targetButton.textContent, 'Reason:', decision.reason);
      targetButton.click();
    } else {
      console.log('🤖 No button found for action:', decision.action);
    }
  }
  
  selectBetSize(size) {
    const betButtons = document.querySelectorAll('.default-bet-button');
    let targetButton = null;
    
    switch (size) {
      case '1/2 pot':
        targetButton = Array.from(betButtons).find(btn => btn.textContent.includes('1/2'));
        break;
      case '3/4 pot':
        targetButton = Array.from(betButtons).find(btn => btn.textContent.includes('3/4'));
        break;
      case 'pot':
        targetButton = Array.from(betButtons).find(btn => btn.textContent.includes('Pot') && !btn.textContent.includes('/'));
        break;
      case 'all-in':
        targetButton = Array.from(betButtons).find(btn => btn.textContent.includes('All In'));
        break;
    }
    
    if (targetButton) {
      console.log('🤖 Selecting bet size:', targetButton.textContent);
      targetButton.click();
      
      // Submit the bet
      setTimeout(() => {
        const submitButton = document.querySelector('.action-button.bet[type="submit"]');
        if (submitButton) {
          console.log('🤖 Submitting bet');
          submitButton.click();
        }
      }, 300);
    } else {
      console.log('🤖 No bet size button found for:', size);
    }
  }
  
  startMonitoring() {
    if (this.observer) return;
    
    // Initial check
    this.checkForCards();
    
    // Set up mutation observer for dynamic updates
    this.observer = new MutationObserver(() => {
      setTimeout(() => this.checkForCards(), 100);
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Set up dedicated game state observer for turn detection
    this.setupGameStateObserver();
    
    // Check for cards periodically
    this.intervalId = setInterval(() => this.checkForCards(), 2000);
    
    // More frequent auto-play monitoring
    this.autoPlayIntervalId = setInterval(() => this.checkAutoPlayConditions(), 200);
    
    // Very frequent turn detection
    this.turnDetectionIntervalId = setInterval(() => this.detectTurnChange(), 100);
  }
  
  setupGameStateObserver() {
    // Observe the game decisions container for changes
    const gameDecisionsContainer = document.querySelector('.game-decisions-ctn');
    if (gameDecisionsContainer) {
      this.gameStateObserver = new MutationObserver(() => {
        console.log('🎮 Game decisions container changed');
        setTimeout(() => this.handleGameStateChange(), 50);
      });
      
      this.gameStateObserver.observe(gameDecisionsContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }
    
    // Also observe action signal changes
    const actionSignal = document.querySelector('.action-signal');
    if (actionSignal) {
      const signalObserver = new MutationObserver(() => {
        console.log('🚨 Action signal changed');
        setTimeout(() => this.handleGameStateChange(), 50);
      });
      
      signalObserver.observe(actionSignal, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }
  
  handleGameStateChange() {
    this.updateGameState();
    
    // If it's now our turn and auto-play is enabled, make decision immediately
    if (this.gameState.myTurn && !this.lastTurnState && this.autoPlayEnabled) {
      console.log('🎯 TURN DETECTED! Triggering immediate auto-play');
      setTimeout(() => this.checkAutoPlayConditions(), 100);
    }
    
    this.lastTurnState = this.gameState.myTurn;
  }
  
  detectTurnChange() {
    const previousTurnState = this.gameState.myTurn;
    this.updateGameState();
    
    // If turn state changed to our turn
    if (this.gameState.myTurn && !previousTurnState && this.autoPlayEnabled) {
      console.log('🔥 TURN CHANGE DETECTED! Auto-play activating...');
      setTimeout(() => this.checkAutoPlayConditions(), 200);
    }
  }
  
  stopMonitoring() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.gameStateObserver) {
      this.gameStateObserver.disconnect();
      this.gameStateObserver = null;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.autoPlayIntervalId) {
      clearInterval(this.autoPlayIntervalId);
      this.autoPlayIntervalId = null;
    }
    
    if (this.turnDetectionIntervalId) {
      clearInterval(this.turnDetectionIntervalId);
      this.turnDetectionIntervalId = null;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PokerEquityCalculator();
  });
} else {
  new PokerEquityCalculator();
}
