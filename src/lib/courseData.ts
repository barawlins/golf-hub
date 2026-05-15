export type HoleInfo = {
  par: number;
  yardage: number;
};

export type TeeBox = {
  id: string;
  name: string;
  color: string;     // CSS color for display
  holes: Record<number, HoleInfo>;
  totalYardage: number;
};

export type Course = {
  id: string;
  name: string;
  par: number;
  tees: TeeBox[];
  // Legacy accessor — returns holes for the first tee by default
  holes: Record<number, HoleInfo>;
};

function buildCourse(id: string, name: string, par: number, tees: Omit<TeeBox, 'totalYardage'>[]): Course {
  const fullTees: TeeBox[] = tees.map(t => ({
    ...t,
    totalYardage: Object.values(t.holes).reduce((sum, h) => sum + h.yardage, 0)
  }));
  return { id, name, par, tees: fullTees, holes: fullTees[0].holes };
}

export const COURSES: Course[] = [
  buildCourse("The Bear", "The Bear", 72, [
    {
      id: "blue", name: "Blue", color: "#3b82f6",
      holes: {
        1: { par: 4, yardage: 364 },
        2: { par: 4, yardage: 407 },
        3: { par: 5, yardage: 528 },
        4: { par: 3, yardage: 151 },
        5: { par: 4, yardage: 376 },
        6: { par: 5, yardage: 532 },
        7: { par: 4, yardage: 364 },
        8: { par: 4, yardage: 386 },
        9: { par: 3, yardage: 168 },
        10: { par: 5, yardage: 505 },
        11: { par: 4, yardage: 364 },
        12: { par: 4, yardage: 367 },
        13: { par: 3, yardage: 150 },
        14: { par: 4, yardage: 390 },
        15: { par: 5, yardage: 543 },
        16: { par: 4, yardage: 391 },
        17: { par: 3, yardage: 188 },
        18: { par: 4, yardage: 427 },
      }
    },
    {
      id: "white", name: "White", color: "#e2e8f0",
      holes: {
        1: { par: 4, yardage: 340 },
        2: { par: 4, yardage: 390 },
        3: { par: 5, yardage: 472 },
        4: { par: 3, yardage: 135 },
        5: { par: 4, yardage: 376 },
        6: { par: 5, yardage: 471 },
        7: { par: 4, yardage: 364 },
        8: { par: 4, yardage: 351 },
        9: { par: 3, yardage: 142 },
        10: { par: 5, yardage: 446 },
        11: { par: 4, yardage: 364 },
        12: { par: 4, yardage: 355 },
        13: { par: 3, yardage: 134 },
        14: { par: 4, yardage: 347 },
        15: { par: 5, yardage: 494 },
        16: { par: 4, yardage: 367 },
        17: { par: 3, yardage: 188 },
        18: { par: 4, yardage: 386 },
      }
    },
    {
      id: "yellow", name: "Yellow", color: "#eab308",
      holes: {
        1: { par: 4, yardage: 301 },
        2: { par: 4, yardage: 346 },
        3: { par: 5, yardage: 425 },
        4: { par: 3, yardage: 98 },
        5: { par: 4, yardage: 336 },
        6: { par: 5, yardage: 435 },
        7: { par: 4, yardage: 328 },
        8: { par: 4, yardage: 271 },
        9: { par: 3, yardage: 117 },
        10: { par: 5, yardage: 375 },
        11: { par: 4, yardage: 304 },
        12: { par: 4, yardage: 301 },
        13: { par: 3, yardage: 93 },
        14: { par: 4, yardage: 291 },
        15: { par: 5, yardage: 427 },
        16: { par: 4, yardage: 324 },
        17: { par: 3, yardage: 155 },
        18: { par: 4, yardage: 354 },
      }
    }
  ]),

  buildCourse("The Wolverine", "The Wolverine", 72, [
    {
      id: "black", name: "Black", color: "#1e293b",
      holes: {
        1: { par: 4, yardage: 406 },
        2: { par: 4, yardage: 421 },
        3: { par: 5, yardage: 491 },
        4: { par: 4, yardage: 427 },
        5: { par: 3, yardage: 216 },
        6: { par: 4, yardage: 395 },
        7: { par: 4, yardage: 389 },
        8: { par: 5, yardage: 509 },
        9: { par: 3, yardage: 196 },
        10: { par: 4, yardage: 435 },
        11: { par: 5, yardage: 547 },
        12: { par: 3, yardage: 200 },
        13: { par: 4, yardage: 414 },
        14: { par: 3, yardage: 181 },
        15: { par: 4, yardage: 387 },
        16: { par: 4, yardage: 479 },
        17: { par: 4, yardage: 391 },
        18: { par: 5, yardage: 561 },
      }
    },
    {
      id: "blue", name: "Blue", color: "#3b82f6",
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
      id: "white", name: "White", color: "#e2e8f0",
      holes: {
        1: { par: 4, yardage: 328 },
        2: { par: 4, yardage: 354 },
        3: { par: 5, yardage: 444 },
        4: { par: 4, yardage: 334 },
        5: { par: 3, yardage: 147 },
        6: { par: 4, yardage: 332 },
        7: { par: 4, yardage: 357 },
        8: { par: 5, yardage: 452 },
        9: { par: 3, yardage: 128 },
        10: { par: 4, yardage: 363 },
        11: { par: 5, yardage: 477 },
        12: { par: 3, yardage: 154 },
        13: { par: 4, yardage: 318 },
        14: { par: 3, yardage: 146 },
        15: { par: 4, yardage: 308 },
        16: { par: 4, yardage: 417 },
        17: { par: 4, yardage: 336 },
        18: { par: 5, yardage: 467 },
      }
    },
    {
      id: "yellow", name: "Yellow", color: "#eab308",
      holes: {
        1: { par: 4, yardage: 294 },
        2: { par: 4, yardage: 314 },
        3: { par: 5, yardage: 431 },
        4: { par: 4, yardage: 230 },
        5: { par: 3, yardage: 128 },
        6: { par: 4, yardage: 256 },
        7: { par: 4, yardage: 244 },
        8: { par: 5, yardage: 372 },
        9: { par: 3, yardage: 107 },
        10: { par: 4, yardage: 330 },
        11: { par: 5, yardage: 388 },
        12: { par: 3, yardage: 138 },
        13: { par: 4, yardage: 266 },
        14: { par: 3, yardage: 146 },
        15: { par: 4, yardage: 232 },
        16: { par: 4, yardage: 350 },
        17: { par: 4, yardage: 285 },
        18: { par: 5, yardage: 439 },
      }
    }
  ]),

  buildCourse("Spruce Run", "Spruce Run", 70, [
    {
      id: "blue", name: "Blue", color: "#3b82f6",
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
    },
    {
      id: "blue-white", name: "Blue/White", color: "#60a5fa",
      holes: {
        1: { par: 4, yardage: 345 },
        2: { par: 5, yardage: 485 },
        3: { par: 4, yardage: 368 },
        4: { par: 4, yardage: 418 },
        5: { par: 4, yardage: 387 },
        6: { par: 3, yardage: 150 },
        7: { par: 4, yardage: 383 },
        8: { par: 3, yardage: 155 },
        9: { par: 5, yardage: 501 },
        10: { par: 3, yardage: 169 },
        11: { par: 4, yardage: 362 },
        12: { par: 4, yardage: 306 },
        13: { par: 4, yardage: 332 },
        14: { par: 4, yardage: 370 },
        15: { par: 4, yardage: 370 },
        16: { par: 3, yardage: 161 },
        17: { par: 4, yardage: 326 },
        18: { par: 4, yardage: 356 },
      }
    },
    {
      id: "white", name: "White", color: "#e2e8f0",
      holes: {
        1: { par: 4, yardage: 345 },
        2: { par: 5, yardage: 443 },
        3: { par: 4, yardage: 368 },
        4: { par: 4, yardage: 418 },
        5: { par: 4, yardage: 387 },
        6: { par: 3, yardage: 124 },
        7: { par: 4, yardage: 359 },
        8: { par: 3, yardage: 155 },
        9: { par: 5, yardage: 472 },
        10: { par: 3, yardage: 169 },
        11: { par: 4, yardage: 325 },
        12: { par: 4, yardage: 275 },
        13: { par: 4, yardage: 279 },
        14: { par: 4, yardage: 333 },
        15: { par: 4, yardage: 370 },
        16: { par: 3, yardage: 139 },
        17: { par: 4, yardage: 289 },
        18: { par: 4, yardage: 356 },
      }
    },
    {
      id: "white-yellow", name: "White/Yellow", color: "#fbbf24",
      holes: {
        1: { par: 4, yardage: 345 },
        2: { par: 5, yardage: 443 },
        3: { par: 4, yardage: 337 },
        4: { par: 4, yardage: 271 },
        5: { par: 4, yardage: 353 },
        6: { par: 3, yardage: 124 },
        7: { par: 4, yardage: 359 },
        8: { par: 3, yardage: 105 },
        9: { par: 5, yardage: 472 },
        10: { par: 3, yardage: 141 },
        11: { par: 4, yardage: 325 },
        12: { par: 4, yardage: 275 },
        13: { par: 4, yardage: 279 },
        14: { par: 4, yardage: 333 },
        15: { par: 4, yardage: 343 },
        16: { par: 3, yardage: 139 },
        17: { par: 4, yardage: 289 },
        18: { par: 4, yardage: 321 },
      }
    },
    {
      id: "yellow", name: "Yellow", color: "#eab308",
      holes: {
        1: { par: 4, yardage: 263 },
        2: { par: 5, yardage: 398 },
        3: { par: 4, yardage: 337 },
        4: { par: 4, yardage: 271 },
        5: { par: 4, yardage: 353 },
        6: { par: 3, yardage: 106 },
        7: { par: 4, yardage: 271 },
        8: { par: 3, yardage: 105 },
        9: { par: 5, yardage: 403 },
        10: { par: 3, yardage: 141 },
        11: { par: 4, yardage: 265 },
        12: { par: 4, yardage: 239 },
        13: { par: 4, yardage: 231 },
        14: { par: 4, yardage: 276 },
        15: { par: 4, yardage: 343 },
        16: { par: 3, yardage: 104 },
        17: { par: 4, yardage: 237 },
        18: { par: 4, yardage: 321 },
      }
    }
  ])
];

// Helper to get holes for a specific tee
export function getHolesForTee(courseId: string, teeId: string): Record<number, HoleInfo> {
  const course = COURSES.find(c => c.id === courseId);
  if (!course) return COURSES[0].holes;
  const tee = course.tees.find(t => t.id === teeId);
  return tee ? tee.holes : course.holes;
}
