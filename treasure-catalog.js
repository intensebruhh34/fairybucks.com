export const catalog=[
{id:1,name:'Little Scientist Kit',price:15,emoji:'🔬',category:'Learning'},
{id:2,name:'Magical Art Studio',price:12,emoji:'🎨',category:'Creativity'},
{id:3,name:'Dinosaur Adventure Book',price:8,emoji:'🦕',category:'Learning'},
{id:4,name:'Fairy Garden Starter',price:18,emoji:'🌱',category:'Learning'},
{id:5,name:'Puzzle Quest',price:10,emoji:'🧩',category:'Learning'},
{id:6,name:'Cuddly Star Friend',price:20,emoji:'🧸',category:'Treasure'},
{id:7,name:'Space Explorer Kit',price:25,emoji:'🚀',category:'Learning'},
{id:8,name:'Wonderland Storybook',price:7,emoji:'📚',category:'Learning'},
{id:9,name:'Treasure Dig Kit',price:14,emoji:'💎',category:'Treasure'},
{id:10,name:'Make Your Own Jewelry',price:16,emoji:'📿',category:'Creativity'},
{id:11,name:'Outdoor Explorer Kit',price:23,emoji:'🔭',category:'Learning'},
{id:12,name:'Colorful Clay Set',price:9,emoji:'🌈',category:'Creativity'}];

export const treasureIcon = key => catalog.find(treasure => treasure.id === key)?.emoji ?? "✨";
