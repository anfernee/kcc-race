// The garage. `speed` is how far the car travels per point scored —
// a Formula car covers ~2x the ground of a tractor for the same work.
export const CARS = {
  f1:        { label: "Formula",    speed: 2.00 },
  supercar:  { label: "Supercar",   speed: 2.00 },
  sports:    { label: "Sports",     speed: 2.00 },
  muscle:    { label: "Muscle",     speed: 1.00 },
  hatchback: { label: "Hot hatch",  speed: 1.00 },
  pickup:    { label: "Pickup",     speed: 1.00 },
  van:       { label: "Van",        speed: 1.00 },
  tractor:   { label: "Tractor",    speed: 1.00 },
};

export const DEFAULT_CAR = "muscle";

// Paint jobs handed out in list order to any racer without a `color`.
// Purely cosmetic — unlike the car, the colour has no effect on speed.
export const PALETTE = [
  "#ff3b6b", "#00e0ff", "#ffd23f", "#6bff8f", "#b06bff",
  "#ff9f1c", "#35d0a0", "#ff77c8", "#5b8cff", "#d4ff4d",
  "#ff6b4a", "#4ee1ff", "#c084fc", "#ffbf69", "#22d3a5",
  "#f472b6", "#a3e635", "#fb7185", "#38bdf8", "#fde047",
];

export const paint = (racer, i) => racer.color || PALETTE[i % PALETTE.length];

export function carSpeed(racer) {
  if (typeof racer.speed === "number") return racer.speed;      // explicit override wins
  return (CARS[racer.car] || CARS[DEFAULT_CAR]).speed;
}
