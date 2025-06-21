# 🃏 Poker Equity Calculator Chrome Extension

A Chrome extension that calculates and displays real-time poker equity (win probability) for web-based poker games.

## Features

- **Real-time Equity Calculation**: Displays your estimated win probability against random opponents
- **DOM Card Recognition**: Automatically detects cards from poker game interfaces
- **Monte Carlo Simulation**: Uses 1000-trial simulations for accurate equity calculations
- **Overlay Display**: Shows equity information in a non-intrusive, draggable overlay
- **Auto-Play Functionality**: Automated decision making based on equity calculations
- **Pot Odds Integration**: Considers pot odds in decision making
- **Enable/Disable Toggle**: Easy on/off control for both calculator and auto-play via popup interface

## Installation

### Method 1: Load Unpacked Extension (Development)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select the `poker-equity-extension` folder
5. The extension icon should appear in your Chrome toolbar

### Method 2: Manual Installation

1. Download the extension files
2. Open Chrome Extensions page (`chrome://extensions/`)
3. Drag and drop the folder into the extensions page

## Usage

### Basic Usage

1. **Navigate to a Poker Site**: Open any web-based poker game
2. **Enable Calculator**: Click the extension icon and toggle "Enable/Disable Calculator"
3. **View Equity**: The overlay will appear in the bottom-right showing:
   - Current equity percentage
   - Your hole cards
   - Board cards (flop, turn, river)
   - Pot size
   - Turn indicator
   - Auto-play status

### Auto-Play Feature

⚠️ **WARNING**: Auto-play functionality automatically makes decisions for you. Use with extreme caution and only for educational purposes.

1. **Enable Auto-Play**: Click "Enable/Disable Auto-play" in the popup
2. **Monitor Decisions**: Watch the console logs for decision reasoning
3. **Auto-Actions**: The system will automatically:
   - Fold weak hands (< 40% equity)
   - Check/call marginal hands (40-60% equity)
   - Bet/raise strong hands (> 60% equity)
   - Consider pot odds for all decisions

### Decision Matrix

| Equity Range | Action Strategy | Reasoning |
|-------------|-----------------|-----------|
| 70%+ | Aggressive betting (pot-sized bets) | Very strong hands - maximize value |
| 60-70% | Value betting (3/4 pot) or calling | Strong hands - extract value |
| 50-60% | Check/call based on pot odds | Marginal hands - play cautiously |
| 40-50% | Check/fold | Weak hands - minimize losses |
| <40% | Fold | Very weak hands - cut losses |

### Supported Card Format

The extension recognizes cards in this DOM structure:
```html
<div class="card-container card-h card-s-9 flipped">
  <div class="value">9</div>
  <div class="suit">h</div>
</div>
```

**Card Classes:**
- Suits: `card-h` (hearts), `card-c` (clubs), `card-d` (diamonds), `card-s` (spades)
- Values: `card-s-2` through `card-s-14` (2-A), or text content in `.value` element

## How It Works

1. **Card Detection**: Scans the page for card containers with specific CSS classes
2. **Card Categorization**: Distinguishes between player hole cards and community board cards
3. **Equity Calculation**: Runs Monte Carlo simulation (1000 trials) against random opponent hands
4. **Display**: Shows results in a styled overlay with equity percentage and hand information

## Technical Details

### File Structure
```
poker-equity-extension/
├── manifest.json          # Extension configuration
├── content.js            # Main logic and card detection
├── background.js         # Service worker
├── popup.html           # Extension popup interface
├── popup.js             # Popup functionality
├── styles.css           # Overlay styling
├── lib/
│   └── poker-equity.js  # Equity calculation library
└── package.json         # Node.js dependencies
```

### Dependencies
- `poker-tools`: Poker hand evaluation and odds calculation

### Permissions
- `activeTab`: Access current tab content
- `scripting`: Inject content scripts
- `storage`: Save user preferences

## Limitations

1. **Site Compatibility**: Currently designed for sites using specific CSS class naming conventions
2. **Hand Evaluation**: Uses simplified poker hand ranking (can be enhanced)
3. **Opponent Modeling**: Assumes random opponent ranges (no player-specific adjustments)
4. **Performance**: Monte Carlo simulations may cause slight delays on slower devices

## Customization

### Adjusting Simulation Accuracy
In `content.js`, modify the `trials` variable:
```javascript
const trials = 1000; // Increase for more accuracy, decrease for speed
```

### Modifying Overlay Position
In `styles.css`, adjust the overlay position:
```css
#poker-equity-overlay {
  bottom: 20px;  /* Distance from bottom */
  right: 20px;   /* Distance from right */
}
```

## Legal and Ethical Considerations

⚠️ **CRITICAL WARNING**: 
- This tool is intended for **educational and learning purposes ONLY**
- **Auto-play functionality should NEVER be used in real money games**
- Many poker sites strictly prohibit the use of external assistance tools and automated play
- Using this extension may violate terms of service and could result in account suspension/banning
- Always check the terms of service before using on any poker platform
- Use responsibly and in accordance with applicable laws and regulations
- The developers are not responsible for any consequences of using this tool

### Recommended Usage
- **Practice games only**: Use on play money or training sites
- **Educational analysis**: Review hand histories and learn from equity calculations
- **Strategy development**: Understand mathematical concepts behind poker decisions
- **Never on real money games**: Avoid using auto-play in any competitive environment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Future Enhancements

- [ ] Support for multiple poker site layouts
- [ ] Advanced opponent range modeling
- [ ] Hand history tracking and analysis
- [ ] Customizable equity calculation parameters
- [ ] Support for different poker variants (Omaha, etc.)
- [ ] Real poker hand evaluation library integration

## Troubleshooting

### Extension Not Working
1. Check if developer mode is enabled
2. Refresh the poker site page
3. Click the extension icon to ensure it's enabled
4. Check browser console for errors

### Cards Not Detected
1. Verify the poker site uses compatible DOM structure
2. Check browser console for detection logs
3. The site may use different CSS classes (customization needed)

### Inaccurate Equity
1. Ensure all cards are properly detected
2. The calculation assumes heads-up play against random opponent
3. Complex scenarios may require algorithm improvements

## License

This project is for educational purposes. Please ensure compliance with local laws and platform terms of service.

---

**Disclaimer**: This tool provides estimated probabilities based on mathematical models. Poker involves skill, psychology, and chance. Use this tool responsibly and never rely solely on equity calculations for decision-making.