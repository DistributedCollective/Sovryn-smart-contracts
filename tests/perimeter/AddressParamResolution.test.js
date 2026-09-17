/**
 * `resolveOptionalAddress` is the shared helper every `--controller`/
 * `--multisig` resolution site now goes through (`perimeter.js`'s
 * `verify-arming`/`submit-block`/`check-block`, and `policyTasks.js`'s
 * `resolveControllerAddress`/`resolveMultisigAddress`). Before this fix, each
 * site guarded its fallback with `if (value)` — plain truthiness — which
 * reads an explicitly-supplied EMPTY string exactly the same as an omitted
 * flag and falls back to the saved deployment silently. Only an OMITTED
 * value (`undefined`) may defer to the fallback; anything the caller
 * actually typed, including `""`, must be validated and used as-is.
 *
 * Pure apart from `ethers.utils.isAddress`/`getAddress`, so this runs
 * without a hardhat runtime or a chain.
 *
 * Run:
 *   npx hardhat test tests/perimeter/AddressParamResolution.test.js
 */
const { expect } = require("chai");
const { ethers } = require("ethers");

const { resolveOptionalAddress } = require("../../hardhat/tasks/perimeter/addressParam");

const FALLBACK = "0x115cAF168c51eD15ec535727F64684D33B7b08D1";
const GIVEN = "0x2BEe6167f91D10db23252e03de039Da6b9047D49";

describe("Perimeter tasks — resolveOptionalAddress", () => {
    const fallback = async () => ethers.utils.getAddress(FALLBACK);

    it("defers to the fallback when the value is omitted (undefined)", async () => {
        const resolved = await resolveOptionalAddress(ethers, undefined, fallback);
        expect(resolved).to.equal(ethers.utils.getAddress(FALLBACK));
    });

    it("uses an explicitly-supplied valid address, checksummed, instead of the fallback", async () => {
        const resolved = await resolveOptionalAddress(ethers, GIVEN, fallback);
        expect(resolved).to.equal(ethers.utils.getAddress(GIVEN));
    });

    it("refuses an explicitly-supplied EMPTY string rather than falling back — the RV-1 gap", async () => {
        let raised = null;
        try {
            await resolveOptionalAddress(ethers, "", fallback);
        } catch (error) {
            raised = error;
        }
        expect(raised, "an empty string must refuse, not silently fall back").to.not.equal(null);
        expect(raised.message).to.match(/not a valid address/);
    });

    it("refuses a malformed non-empty string", async () => {
        let raised = null;
        try {
            await resolveOptionalAddress(ethers, "not-an-address", fallback);
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/not a valid address/);
    });

    it("never calls the fallback for an explicitly-supplied value, valid or not", async () => {
        let fallbackCalled = false;
        const trackedFallback = async () => {
            fallbackCalled = true;
            return FALLBACK;
        };
        await resolveOptionalAddress(ethers, GIVEN, trackedFallback);
        expect(fallbackCalled, "the fallback must not run when a value was given").to.equal(false);

        try {
            await resolveOptionalAddress(ethers, "", trackedFallback);
        } catch (error) {
            // expected — the assertion below is what matters here
        }
        expect(
            fallbackCalled,
            "the fallback must not run for an empty explicit value either"
        ).to.equal(false);
    });
});
