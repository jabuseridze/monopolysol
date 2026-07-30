import { describe, it, expect } from "vitest";
import { walkPoint, NUM_TILES } from "./ringPath";
import { placeTile } from "./layout";

describe("ringPath", () => {
  describe("walkPoint", () => {
    it("should return start tile position at t=0", () => {
      const startTile = 0;
      const steps = 5;
      const point = walkPoint(startTile, steps, 0);

      const expectedPos = placeTile(startTile);
      expect(point.x).toBeCloseTo(expectedPos.x);
      expect(point.z).toBeCloseTo(expectedPos.z);
    });

    it("should return destination tile position at t=steps (boundary case fix)", () => {
      const startTile = 0;
      const steps = 3;
      const point = walkPoint(startTile, steps, steps);

      // The destination tile is startTile + steps
      const destinationTile = (startTile + steps) % NUM_TILES;
      const expectedPos = placeTile(destinationTile);

      expect(point.x).toBeCloseTo(expectedPos.x, 5);
      expect(point.z).toBeCloseTo(expectedPos.z, 5);
    });

    it("should interpolate correctly at mid-step", () => {
      const startTile = 0;
      const steps = 2;
      const t = 0.5; // Halfway through first step

      const point = walkPoint(startTile, steps, t);

      const fromPos = placeTile(startTile);
      const toPos = placeTile((startTile + 1) % NUM_TILES);

      // Should be approximately halfway between the two tiles
      expect(point.x).toBeCloseTo((fromPos.x + toPos.x) / 2, 1);
      expect(point.z).toBeCloseTo((fromPos.z + toPos.z) / 2, 1);
    });

    it("should handle wraparound at end of board", () => {
      const startTile = 38; // Near the end
      const steps = 5; // Will wrap to tiles 39, 0, 1, 2, 3
      const point = walkPoint(startTile, steps, steps);

      const destinationTile = (startTile + steps) % NUM_TILES; // Should be tile 3
      const expectedPos = placeTile(destinationTile);

      expect(point.x).toBeCloseTo(expectedPos.x, 5);
      expect(point.z).toBeCloseTo(expectedPos.z, 5);
    });

    it("should produce a valid heading (radians)", () => {
      const point = walkPoint(0, 3, 1.5);
      // Heading should be a valid radian value
      expect(typeof point.heading).toBe("number");
      expect(Number.isFinite(point.heading)).toBe(true);
      expect(point.heading).toBeGreaterThanOrEqual(-Math.PI);
      expect(point.heading).toBeLessThanOrEqual(Math.PI);
    });

    it("should clamp t outside valid range", () => {
      const startTile = 0;
      const steps = 5;

      // t < 0 should clamp to 0 (start)
      const pointNegative = walkPoint(startTile, steps, -5);
      const startPos = placeTile(startTile);
      expect(pointNegative.x).toBeCloseTo(startPos.x, 5);
      expect(pointNegative.z).toBeCloseTo(startPos.z, 5);

      // t > steps should clamp to steps (destination)
      const pointTooLarge = walkPoint(startTile, steps, 10);
      const destTile = (startTile + steps) % NUM_TILES;
      const destPos = placeTile(destTile);
      expect(pointTooLarge.x).toBeCloseTo(destPos.x, 5);
      expect(pointTooLarge.z).toBeCloseTo(destPos.z, 5);
    });

    it("should handle zero steps (stay at start)", () => {
      const startTile = 5;
      const steps = 0;
      const point = walkPoint(startTile, steps, 0);

      const expectedPos = placeTile(startTile);
      expect(point.x).toBeCloseTo(expectedPos.x, 5);
      expect(point.z).toBeCloseTo(expectedPos.z, 5);
    });

    it("should progress monotonically in time", () => {
      const startTile = 10;
      const steps = 4;

      // Sample at several time points
      const times = [0, 1, 2, 3, 4];
      const points = times.map(t => walkPoint(startTile, steps, t));

      // Each subsequent point should move toward the destination
      // (distance to destination should decrease)
      const destTile = (startTile + steps) % NUM_TILES;
      const destPos = placeTile(destTile);

      let prevDist = Infinity;
      for (const point of points) {
        const dx = destPos.x - point.x;
        const dz = destPos.z - point.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        expect(dist).toBeLessThanOrEqual(prevDist + 0.001); // Small epsilon for floating point
        prevDist = dist;
      }
    });
  });

  describe("arc mode (escape hatch)", () => {
    it("should support arc mode at boundary", () => {
      const startTile = 0;
      const steps = 3;
      const point = walkPoint(startTile, steps, steps, "arc");

      // Arc mode should also reach the destination at t=steps
      const destinationTile = (startTile + steps) % NUM_TILES;
      const expectedPos = placeTile(destinationTile);

      expect(point.x).toBeCloseTo(expectedPos.x, 5);
      expect(point.z).toBeCloseTo(expectedPos.z, 5);
    });
  });
});
