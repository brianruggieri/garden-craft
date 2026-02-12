/**
 * Tests for request validation middleware
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { validateOptimizeRequest } from "../../middleware/validation";

describe("Validation Middleware", () => {
  describe("validateOptimizeRequest", () => {
    it("should accept valid request", () => {
      const validRequest = {
        provider: "local",
        beds: [
          {
            id: "bed1",
            name: "Main Bed",
            width: 48,
            height: 96,
            x: 0,
            y: 0,
          },
        ],
        seeds: [
          {
            id: "seed1",
            name: "Cherry Tomato",
            type: "Tomato",
            quantity: 3,
          },
        ],
        sunOrientation: "south",
        optimizationGoals: ["maximize yield", "companion planting"],
      };

      const valid = validateOptimizeRequest(validRequest);
      assert.equal(valid, true, "Valid request should pass validation");
    });

    it("should reject request missing required beds field", () => {
      const invalidRequest = {
        provider: "local",
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Request without beds should fail");
      assert.ok(validateOptimizeRequest.errors, "Should have errors");
    });

    it("should reject request missing required seeds field", () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Request without seeds should fail");
    });

    it("should reject request missing required sunOrientation field", () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Request without sunOrientation should fail");
    });

    it("should reject invalid provider value", () => {
      const invalidRequest = {
        provider: "invalid-provider",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Invalid provider should fail");
    });

    it("should reject invalid sunOrientation value", () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "northwest",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Invalid sunOrientation should fail");
    });

    it("should reject beds with invalid dimensions", () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: -10, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Negative bed dimensions should fail");
    });

    it("should reject beds with missing required fields", () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ name: "Bed without dimensions" }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Bed missing id, width, height should fail");
    });

    it("should reject empty beds array", () => {
      const invalidRequest = {
        provider: "local",
        beds: [],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Empty beds array should fail");
    });

    it("should reject empty seeds array", () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(invalidRequest);
      assert.equal(valid, false, "Empty seeds array should fail");
    });

    it("should accept optional fields", () => {
      const validRequest = {
        provider: "openai",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
        style: { theme: "modern" },
        optimizationGoals: ["maximize yield"],
        auth: { apiKey: "test-key" },
        model: "gpt-4",
      };

      const valid = validateOptimizeRequest(validRequest);
      assert.equal(valid, true, "Request with optional fields should pass");
    });

    it("should accept beds with additional properties", () => {
      const validRequest = {
        provider: "local",
        beds: [
          {
            id: "bed1",
            name: "Main Bed",
            width: 48,
            height: 96,
            x: 10,
            y: 20,
            shape: "rectangle",
            color: "#00ff00",
          },
        ],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(validRequest);
      assert.equal(valid, true, "Beds with extra properties should be allowed");
    });

    it("should accept seeds with additional properties", () => {
      const validRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [
          {
            id: "seed1",
            name: "Heirloom Tomato",
            type: "Tomato",
            veggieType: "Tomato",
            quantity: 3,
            variety: "Cherokee Purple",
            spacing: 24,
            daysToHarvest: 80,
          },
        ],
        sunOrientation: "south",
      };

      const valid = validateOptimizeRequest(validRequest);
      assert.equal(
        valid,
        true,
        "Seeds with extra properties should be allowed",
      );
    });
  });
});
