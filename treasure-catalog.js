export const catalog = [
  {
    "id": 1,
    "name": "Little Scientist Kit",
    "price": 15,
    "emoji": "🔬",
    "category": "Learning",
    "description": "Explore hands-on experiments with a 40+ or 50+ experiment science kit."
  },
  {
    "id": 2,
    "name": "Magical Art Studio",
    "price": 14,
    "emoji": "🎨",
    "category": "Creativity",
    "description": "Create colorful, glowing ocean-themed foam artwork."
  },
  {
    "id": 3,
    "name": "Paint Your Own Dino Racers",
    "price": 14,
    "emoji": "🦕",
    "category": "Creativity",
    "description": "Paint and race six dinosaur pull-back cars."
  },
  {
    "id": 4,
    "name": "Fairy Garden Starter",
    "price": 19,
    "emoji": "🌱",
    "category": "Treasure",
    "description": "Arrange a tiny fairy world with 48 miniature garden decorations. Planter, soil and seeds are not included."
  },
  {
    "id": 5,
    "name": "Puzzle Quest",
    "price": 14,
    "emoji": "🧩",
    "category": "Learning",
    "description": "Solve 100+ mazes, word searches and brain teasers. Listed for ages 8–12."
  },
  {
    "id": 6,
    "name": "Cuddly Star Friend",
    "price": 25,
    "emoji": "⭐",
    "category": "Treasure",
    "description": "Meet a soft purple star friend that glows with colorful lights. 13-inch version."
  },
  {
    "id": 7,
    "name": "Space Gem Discovery Kit",
    "price": 23,
    "emoji": "🪐",
    "category": "Learning",
    "description": "Dig into planet-shaped blocks to discover 15 gemstones. Listed for ages 6+."
  },
  {
    "id": 8,
    "name": "I Spy Picture Quest",
    "price": 17,
    "emoji": "📚",
    "category": "Learning",
    "description": "Search detailed pictures and solve riddles in I Spy A to Z. Hardcover book."
  },
  {
    "id": 9,
    "name": "Pirate Treasure Dig Kit",
    "price": 20,
    "emoji": "💎",
    "category": "Treasure",
    "description": "Uncover pirate-themed treasures in a five-in-one digging adventure. Listed for ages 6+."
  },
  {
    "id": 10,
    "name": "Make Your Own Jewelry",
    "price": 19,
    "emoji": "📿",
    "category": "Creativity",
    "description": "Design charm bracelets and necklaces with an aqua-themed 95-piece kit. Listed for ages 5–12."
  },
  {
    "id": 11,
    "name": "Outdoor Explorer Kit",
    "price": 24,
    "emoji": "🔎",
    "category": "Learning",
    "description": "Explore nature with binoculars, bug-catching tools and a blue explorer bag. Listed for ages 4–8."
  },
  {
    "id": 12,
    "name": "Colorful Clay Set",
    "price": 12,
    "emoji": "🌈",
    "category": "Creativity",
    "description": "Shape your own creations with 32 colors of air-dry clay and three sculpting tools."
  }
];

export const treasureIcon = key => catalog.find(treasure => treasure.id === key)?.emoji ?? "✨";
export const treasureDescription = key => catalog.find(treasure => treasure.id === key)?.description ?? "";
