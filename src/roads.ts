/** Integer line interpolation keeps fast pointer drags connected across chunks. */
export function roadLine(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): [number, number][] {
  const tiles: [number, number][] = [];
  let x = x0,
    z = z0;
  tiles.push([x, z]);
  while (x !== x1 || z !== z1) {
    if (x !== x1) x += Math.sign(x1 - x);
    else z += Math.sign(z1 - z);
    tiles.push([x, z]);
  }
  return tiles;
}
