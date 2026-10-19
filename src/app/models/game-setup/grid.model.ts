export interface GridPosition {
  row: number;
  col: number;
}
 
export interface GridSize {
  rows: number;
  cols: number;
}
 
export const positionKey = (p: GridPosition): string => `${p.row},${p.col}`;
 
export const samePosition = (a: GridPosition, b: GridPosition): boolean =>
  a.row === b.row && a.col === b.col;

export const sameRow = (a: GridPosition, b: GridPosition): boolean =>
  a.row === b.row;

export const sameColumn = (a: GridPosition, b: GridPosition): boolean =>
  a.col === b.col;

const rowDiff = (a: GridPosition, b: GridPosition) => Math.abs(a.row - b.row);
const colDiff = (a: GridPosition, b: GridPosition) => Math.abs(a.col - b.col);
 
/** N, E, S or W of each other. */
export const isAdjacent = (a: GridPosition, b: GridPosition): boolean =>
  rowDiff(a, b) + colDiff(a, b) === 1;
 
/** NE, SE, SW or NW of each other (diagonal only). */
export const isCorner = (a: GridPosition, b: GridPosition): boolean =>
  rowDiff(a, b) === 1 && colDiff(a, b) === 1;
 
/** Any of the eight surrounding cells. */
export const isClose = (a: GridPosition, b: GridPosition): boolean =>
  !samePosition(a, b) && rowDiff(a, b) <= 1 && colDiff(a, b) <= 1;

export enum Proximity {
  /** Shares an edge: N, E, S or W. */
  Adjacent = 'Adjacent',
  /** Touches at a corner only: NE, SE, SW or NW. */
  Corner = 'Corner',
  /** Any of the eight surrounding cells (Adjacent or Corner). */
  Close = 'Close',
}

export function isNear(a: GridPosition, b: GridPosition, proximity: Proximity): boolean {
  switch (proximity) {
    case Proximity.Adjacent:
      return isAdjacent(a, b);
    case Proximity.Corner:
      return isCorner(a, b);
    case Proximity.Close:
      return isClose(a, b);
  }
}

export const isInBounds = (p: GridPosition, size: GridSize): boolean =>
  Number.isInteger(p.row) &&
  Number.isInteger(p.col) &&
  p.row >= 0 &&
  p.col >= 0 &&
  p.row < size.rows &&
  p.col < size.cols;

  export const slotNumber = (p: GridPosition, size: GridSize): number =>
  p.row * size.cols + p.col + 1;
 
/** The position of a slot number, or undefined if it isn't on the grid. */
export function positionOfSlot(slot: number, size: GridSize): GridPosition | undefined {
  if (!Number.isInteger(slot) || slot < 1 || slot > size.rows * size.cols) return undefined;
  const index = slot - 1;
  return { row: Math.floor(index / size.cols), col: index % size.cols };
}
 