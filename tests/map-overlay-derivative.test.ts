import assert from "node:assert/strict"
import test from "node:test"
import { needsDerivative } from "../lib/map/server/derive-overlay.mjs"

test("derivative generation skips matching source versions", () => {
  assert.equal(needsDerivative({ sourceVersion: "v1", derivedSourceVersion: "v1" }), false)
  assert.equal(needsDerivative({ sourceVersion: "v2", derivedSourceVersion: "v1" }), true)
  assert.equal(needsDerivative({ sourceVersion: "v1", derivedSourceVersion: null }), true)
})
