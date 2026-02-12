/**
 * Integration tests for request validation middleware
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config();

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8787";

describe("Validation Integration Tests", () => {
  describe("POST /api/optimize validation", () => {
    it("should reject request with missing beds field", async () => {
      const invalidRequest = {
        provider: "local",
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for missing beds",
      );

      const body = await response.json();
      assert.ok(body.error, "Response should contain error");
      assert.equal(body.error, "Validation failed");
      assert.ok(Array.isArray(body.details), "Should have error details");
    });

    it("should reject request with missing seeds field", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        sunOrientation: "south",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for missing seeds",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });

    it("should reject request with missing sunOrientation field", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for missing sunOrientation",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });

    it("should reject request with invalid provider", async () => {
      const invalidRequest = {
        provider: "invalid-provider",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for invalid provider",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
      assert.ok(
        body.details.some((d) => d.includes("provider")),
        "Error should mention provider",
      );
    });

    it("should reject request with invalid sunOrientation", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "northwest",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for invalid sunOrientation",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });

    it("should reject request with negative bed dimensions", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: -10, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for negative dimensions",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });

    it("should reject request with empty beds array", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for empty beds array",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });

    it("should reject request with empty seeds array", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [],
        sunOrientation: "south",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for empty seeds array",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });

    it("should accept valid request and return 200", async () => {
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
            quantity: 2,
          },
          {
            id: "seed2",
            name: "Sweet Basil",
            type: "Basil",
            quantity: 3,
          },
        ],
        sunOrientation: "south",
        optimizationGoals: ["maximize yield", "companion planting"],
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequest),
      });

      assert.equal(response.status, 200, "Should return 200 for valid request");

      const body = await response.json();
      assert.ok(body.provider, "Response should have provider");
      assert.ok(Array.isArray(body.layouts), "Response should have layouts array");
    });

    it("should accept request with optional fields", async () => {
      const validRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
        style: { theme: "modern", colorScheme: "earth-tones" },
        optimizationGoals: ["maximize yield"],
        model: "local-packer-v1",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequest),
      });

      assert.equal(
        response.status,
        200,
        "Should return 200 for valid request with optional fields",
      );

      const body = await response.json();
      assert.ok(body.layouts, "Response should have layouts");
    });

    it("should reject request with extra top-level properties", async () => {
      const invalidRequest = {
        provider: "local",
        beds: [{ id: "bed1", width: 48, height: 96 }],
        seeds: [{ id: "seed1", type: "Tomato", quantity: 1 }],
        sunOrientation: "south",
        unknownField: "this should not be allowed",
      };

      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequest),
      });

      assert.equal(
        response.status,
        400,
        "Should return 400 for extra top-level properties",
      );

      const body = await response.json();
      assert.equal(body.error, "Validation failed");
    });
  });
});
