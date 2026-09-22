/**
 * Isolated regression for `withdraw`'s two new surface guards:
 *   --setup-only only means something on the surplus surface;
 *   --through only drives the lender surface today.
 * Both refuse before `withdraw` ever resolves a signer or touches a driver,
 * so no fake `s` or chain interaction is needed at all — no fork, no
 * `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineWithdrawGapGuards.test.js
 */
const { expect } = require("chai");

const engine = require("./engine");

const expectRefusal = async (promise, pattern) => {
    let raised = null;
    try {
        await promise;
    } catch (error) {
        raised = error;
    }
    expect(raised, "expected an upfront refusal").to.not.equal(null);
    expect(raised.message).to.match(pattern);
};

describe("QA scenario engine — withdraw's --setup-only / --through surface guards", () => {
    it("--setup-only refuses on a surface other than surplus", async () => {
        await expectRefusal(
            engine.withdraw(undefined, { surface: "lender", setupOnly: true }),
            /--setup-only only applies to --surface surplus/
        );
    });

    it("--setup-only refuses on the borrower surface too", async () => {
        await expectRefusal(
            engine.withdraw(undefined, { surface: "borrower", setupOnly: true }),
            /--setup-only only applies to --surface surplus/
        );
    });

    it("--through refuses on a surface other than lender", async () => {
        await expectRefusal(
            engine.withdraw(undefined, {
                surface: "surplus",
                through: "0x1111111111111111111111111111111111111111",
            }),
            /--through only drives the lender surface today/
        );
    });

    it("--through refuses on the zero surface too", async () => {
        await expectRefusal(
            engine.withdraw(undefined, {
                surface: "zero",
                through: "0x1111111111111111111111111111111111111111",
            }),
            /--through only drives the lender surface today/
        );
    });

    it("an unknown surface is still refused before either new guard runs", async () => {
        await expectRefusal(
            engine.withdraw(undefined, { surface: "nonsense", setupOnly: true }),
            /unknown surface 'nonsense'/
        );
    });
});
