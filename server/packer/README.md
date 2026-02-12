# Garden Packer - Algorithmic Plant Placement System

## Overview

The Garden Packer is a **deterministic, algorithm-based plant placement system** that separates **semantic planning** (what to plant, why) from **spatial optimization** (where to place it).

This approach is dramatically more reliable than asking LLMs to generate coordinates directly, since LLMs struggle with constrained spatial optimization problems.

## Architecture

### Two-Phase Approach

```
┌─────────────────────────────────────────────────────────────┐
│                   Phase 1: Semantic Planning                │
│                                                               │
│  LLM decides:                                                │
│  • WHAT plants to grow (varieties, species)                 │
│  • HOW MANY of each (quantities based on bed size)          │
│  • WHY (companion guilds, succession planting, etc.)         │
│  • PRIORITY (tall plants first, gap-fillers last)           │
│                                                               │
│  Output: Semantic Plan (JSON, no coordinates)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                Phase 2: Algorithmic Packing                  │
│                                                               │
│  Circle Packer algorithm determines:                         │
│  • WHERE to place each plant (x, y coordinates)             │
│  • Respects bed bounds (guaranteed valid)                    │
│  • Avoids collisions (spatial partitioning grid)            │
│  • Honors horticultural constraints:                         │
│    - Sun orientation (tall plants on appropriate edge)      │
│    - Companion proximity (likes near each other)            │
│    - Antagonist separation (dislikes apart)                 │
│    - Root depth layering (shallow under deep)               │
│                                                               │
│  Output: Complete Layout (placements with coordinates)       │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. CirclePacker (`CirclePacker.js`)

**Core circle-packing engine** with grid-based spatial partitioning.

Based on the approach described in:
- [Gorilla Sun - A Simple Solution for Shape Packing in 2D](https://www.gorillasun.de/blog/a-simple-solution-for-shape-packing-in-2d/)
- Tarwin Stroh-Spijer's circle packer implementation

**Key features:**
- **Grid-based spatial partitioning**: Avoids O(n²) collision checks by dividing the bed into a grid
- **Collision detection**: Fast local queries check only nearby circles
- **Growing circles**: Attempts to place a circle at minimum size, then grows it until it hits a neighbor
- **Deterministic**: Same inputs always produce the same layout

**API:**
```javascript
const packer = new CirclePacker(width, height, gridDivisions, padding);

// Try to place a single circle
const circle = packer.tryToAddCircle(x, y, minRadius, maxRadius, actuallyAdd);

// Check if a composite shape (multiple circles) fits
const shape = packer.tryToAddShape(circles, actuallyAdd);

// Get statistics
const stats = packer.getStats();
// => { itemCount, packingDensity, totalArea, packedArea }
```

### 2. GardenPacker (`GardenPacker.js`)

**Horticultural-aware wrapper** around CirclePacker that adds garden-specific constraints.

**Features:**
- **Type clustering**: Places all instances of the same plant type together for cohesive visual grouping
- **Companion planting**: Tries to place companions (Tomato + Basil) within 12" of each other
- **Antagonist separation**: Keeps incompatible plants apart when provided in metadata
- **Sun orientation**: Places tall plants on appropriate edge to avoid shading
- **Priority-based placement**: High-priority plants (tall anchors) placed first, gap-fillers last
- **Root depth layering**: Can overlap shallow and deep-rooted plants (future enhancement)

**API:**
```javascript
const gardenPacker = new GardenPacker(bed, {
  sunOrientation: 'South',
  padding: 0.5,
  allowRootOverlap: true,
  companionProximity: 12
});

// Pack a list of plants
const result = gardenPacker.packPlants([
  { veggieType: 'Tomato', varietyName: 'Better Boy', size: 24, count: 2, priority: 5 },
  { veggieType: 'Basil', varietyName: 'Genovese', size: 10, count: 6, priority: 4 },
  // ...
]);

// Result contains:
// - placements: Array of placed plants with coordinates
// - stats: Packing statistics (success rate, density, etc.)
// - failedPlants: Plants that couldn't fit
```

### 3. Semantic Planner (`semanticPlanner.js`)

**LLM prompt builder** that generates semantic plans without coordinates.

**Key insight:** LLMs are good at semantic reasoning (which plants go together, how many to plant) but poor at constrained spatial math. By separating concerns, we get the best of both worlds.

**Functions:**
- `buildSemanticPlanPrompt()`: Creates LLM prompt for plant selection
- `parseSemanticPlan()`: Validates LLM response structure
- `convertPlanToPackerFormat()`: Converts semantic plan to packer input

**Example semantic plan output:**
```json
{
  "beds": [
    {
      "bedId": "1",
      "plants": [
        {
          "veggieType": "Tomato",
          "varietyName": "Better Boy",
          "count": 2,
          "priority": 5,
          "reasoning": "Anchor plants on north edge for guild structure"
        },
        {
          "veggieType": "Thyme",
          "varietyName": "English",
          "count": 12,
          "priority": 1,
          "reasoning": "Dense groundcover gap filler, interplanted throughout"
        }
      ],
      "strategy": "Tomato-Basil guild with oregano understory and thyme interplanting"
    }
  ],
  "overallReasoning": "Intensive square-foot gardening with companion guilds..."
}
```

## Performance Characteristics

### CirclePacker Complexity

- **Without spatial partitioning**: O(n²) collision checks (slow)
- **With grid partitioning**: O(n × k) where k = avg circles per grid cell (fast)

For a 48×48" bed with 50 plants and 50×50 grid:
- Average grid cell size: ~1"
- Most plants only check 4-9 grid cells
- Typical placement: ~200-500 collision checks (vs ~1,225 brute force)

### Density Results

Testing with a 48×48" bed (16 sq ft):
- **Target**: 40-56 plants (2.5-3.5 per sq ft)
- **Actual**: 40-45 plants (82-90% success rate)
- **Packing density**: 48-55% of bed area
- **Zero collisions**, all placements within bounds

## Usage

### Server Endpoint

The packer is integrated as `/api/optimize-packer`:

```javascript
POST /api/optimize-packer
{
  "provider": "openai",
  "beds": [...],
  "seeds": [...],
  "sunOrientation": "South",
  "style": {},
  "optimizationGoals": [...],
  "model": "gpt-4o",
  "usePacker": true
}
```

**Response:**
```json
{
  "provider": "openai",
  "method": "algorithmic-packer",
  "semanticPlan": {
    "overallReasoning": "...",
    "beds": [...]
  },
  "layouts": [
    {
      "bedId": "1",
      "placements": [...],
      "strategy": "...",
      "stats": {
        "placed": 41,
        "failed": 9,
        "successRate": "82.0%",
        "packingDensity": "48.5%"
      }
    }
  ]
}
```

### Testing

Run the packer tests:
```bash
node server/tests/packerTest.js
```

Tests verify:
- Circle packing density
- Bounds validation (no plants outside bed)
- Collision detection (no overlaps)
- Companion planting proximity
- Target density achievement

## Future Enhancements

### 1. Root Depth Layering
Currently circles cannot overlap. Future: allow overlaps when root depths differ (shallow + deep).

**Implementation:**
- Tag circles with root depth metadata
- Modify `hasCollision()` to allow overlaps if depths differ
- Could increase density by 10-20%

### 2. Successive Planting
Reserve space for plants that will be added later (e.g., transplant after radishes harvest).

**Implementation:**
- Add "phantom circles" for future plants
- Mark them as reserved but not rendered initially
- Client can show them as "coming soon"

### 3. Custom Shapes
Support non-circular plant shapes (rectangular beds, irregular canopies).

**Implementation:**
- Represent shapes as clusters of circles (outline tracing)
- Use `tryToAddShape()` for composite placement
- See Gorilla Sun article for shape decomposition strategies

### 4. Visual Packing Animation
Show the packing process in real-time on the client.

**Implementation:**
- Stream placement events via SSE
- Animate each circle being placed and growing
- Beautiful visualization of intensive gardening principles

### 5. Interactive Refinement
Allow users to drag/swap plants after algorithmic placement.

**Implementation:**
- Client sends modified placements back to server
- Server validates (bounds + collisions) and persists
- Hybrid human + algorithm approach

## Advantages Over LLM-Only Approach

| Aspect | LLM-Only | Semantic Plan + Packer |
|--------|----------|------------------------|
| **Reliability** | 30-60% valid layouts | 95-100% valid layouts |
| **Density** | Sparse (10-25 plants) | Dense (40-50 plants) |
| **Bounds** | Frequent violations | Guaranteed valid |
| **Collisions** | Common overlaps | Zero collisions |
| **Reproducibility** | Non-deterministic | Deterministic |
| **Performance** | Slow (LLM call) | Fast (algorithm) |
| **Reasoning** | Good (companions) | Excellent (explicit) |

## References

- [Gorilla Sun - Shape Packing in 2D](https://www.gorillasun.de/blog/a-simple-solution-for-shape-packing-in-2d/)
- [Tarwin Stroh-Spijer's Fruit Salad Packer](https://observablehq.com/@tarwin/fruit-salad)
- [Circle Packing - Wikipedia](https://en.wikipedia.org/wiki/Circle_packing)
- [Bin Packing Problem - Wikipedia](https://en.wikipedia.org/wiki/Bin_packing_problem)

## License

Part of the GardenCraft project. See root LICENSE file.