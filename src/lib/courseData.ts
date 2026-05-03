export type HoleInfo = {
  par: number;
  yardage: number;
};

export type Course = {
  id: string;
  name: string;
  holes: Record<number, HoleInfo>;
};

// I've seeded this with a placeholder course. 
// We will replace this with your actual courses!
export const COURSES: Course[] = [
  {
    id: "The Bear",
    name: "The Bear",
    holes: {
      1: { par: 4, yardage: 364 },
      2: { par: 4, yardage: 390 },
      3: { par: 5, yardage: 472 },
      4: { par: 3, yardage: 151 },
      5: { par: 4, yardage: 376 },
      6: { par: 5, yardage: 471 },
      7: { par: 4, yardage: 364 },
      8: { par: 4, yardage: 386 },
      9: { par: 3, yardage: 168 },
      10: { par: 5, yardage: 505 },
      11: { par: 4, yardage: 364 },
      12: { par: 4, yardage: 355 },
      13: { par: 3, yardage: 150 },
      14: { par: 4, yardage: 347 },
      15: { par: 5, yardage: 543 },
      16: { par: 4, yardage: 367 },
      17: { par: 3, yardage: 188 },
      18: { par: 4, yardage: 386 },
    }
  },
  {
    id: "The Wolverine",
    name: "The Wolverine",
    holes: {
      1: { par: 4, yardage: 362 },
      2: { par: 4, yardage: 380 },
      3: { par: 5, yardage: 478 },
      4: { par: 4, yardage: 409 },
      5: { par: 3, yardage: 189 },
      6: { par: 4, yardage: 370 },
      7: { par: 4, yardage: 375 },
      8: { par: 5, yardage: 490 },
      9: { par: 3, yardage: 163 },
      10: { par: 4, yardage: 392 },
      11: { par: 5, yardage: 506 },
      12: { par: 3, yardage: 185 },
      13: { par: 4, yardage: 364 },
      14: { par: 3, yardage: 163 },
      15: { par: 4, yardage: 345 },
      16: { par: 4, yardage: 439 },
      17: { par: 4, yardage: 357 },
      18: { par: 5, yardage: 531 },
    }
  },
  {
    id: "Spruce Run",
    name: "Spruce Run",
    holes: {
      1: { par: 4, yardage: 362 },
      2: { par: 5, yardage: 485 },
      3: { par: 4, yardage: 400 },
      4: { par: 4, yardage: 452 },
      5: { par: 4, yardage: 409 },
      6: { par: 3, yardage: 150 },
      7: { par: 4, yardage: 383 },
      8: { par: 3, yardage: 190 },
      9: { par: 5, yardage: 501 },
      10: { par: 3, yardage: 215 },
      11: { par: 4, yardage: 362 },
      12: { par: 4, yardage: 306 },
      13: { par: 4, yardage: 332 },
      14: { par: 4, yardage: 370 },
      15: { par: 4, yardage: 396 },
      16: { par: 3, yardage: 161 },
      17: { par: 4, yardage: 326 },
      18: { par: 4, yardage: 404 },
    }
  }
];
