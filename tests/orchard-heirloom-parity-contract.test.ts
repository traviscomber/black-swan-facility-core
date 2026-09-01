import assert from "node:assert/strict"
import test from "node:test"
import {
  HEIRLOOM_ONBOARDING_STEPS,
  HEIRLOOM_REFERENCE_PEAK_BED_METERS,
  HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS,
  HEIRLOOM_REFERENCE_PLANTINGS,
  HEIRLOOM_REFERENCE_SETUP,
  HEIRLOOM_REFERENCE_TOTAL_BED_METERS,
} from "../lib/orchard/heirloom-parity.ts"

test("Heirloom parity captures the eight-step journey", () => {
  assert.equal(HEIRLOOM_ONBOARDING_STEPS.length, 8)
  assert.deepEqual(HEIRLOOM_ONBOARDING_STEPS.map((step) => step.order), [1,2,3,4,5,6,7,8])
})

test("Heirloom field study keeps the observed physical block", () => {
  assert.equal(HEIRLOOM_REFERENCE_SETUP.fieldBlockName, "Orchard BlackSwan Campo")
  assert.equal(HEIRLOOM_REFERENCE_SETUP.fieldBlockBeds, 18)
  assert.equal(HEIRLOOM_REFERENCE_SETUP.fieldBlockBedLengthM, 30)
  assert.equal(HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS, 540)
})

test("Heirloom reference queue remains complete", () => {
  assert.equal(HEIRLOOM_REFERENCE_PLANTINGS.length, 32)
  assert.equal(HEIRLOOM_REFERENCE_TOTAL_BED_METERS, 744)
  assert.equal(HEIRLOOM_REFERENCE_PEAK_BED_METERS, 678)
  assert.ok(HEIRLOOM_REFERENCE_PEAK_BED_METERS > HEIRLOOM_REFERENCE_PHYSICAL_CAPACITY_BED_METERS)
})
