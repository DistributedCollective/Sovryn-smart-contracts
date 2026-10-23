/**
 * Isolated regression for the QA rehearsal drivers' party binding.
 *
 * Every driver is supposed to assert the queue recorded the SAME originator,
 * owner and receiver the surface's own hook binds a request to — not just the
 * receiver. Before this fix, three of the four drivers left originator and/or
 * owner unchecked, and the surplus-claim driver checked none of the three and
 * silently accepted a `--receiver` override the underlying call cannot honor.
 *
 * Runs against Hardhat's own in-process network — no fork, no `--network` —
 * because `assertRequestParties` is pure, and the upfront receiver-override
 * refusals in `queueZeroCollWithdraw`/`queueSurplusClaim` throw before either
 * function touches the chain.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/driversRequestParties.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const drivers = require("./drivers");

describe("QA rehearsal drivers — request party binding", () => {
    // A deterministic, valid checksum address, distinct per tag.
    const actor = (tag) => ethers.utils.getAddress(ethers.utils.hexZeroPad("0x" + tag, 20));

    describe("assertRequestParties", () => {
        const request = {
            originator: actor("1"),
            owner: actor("2"),
            receiver: actor("3"),
        };

        it("passes silently when every role matches", () => {
            expect(() =>
                drivers.assertRequestParties("test", request, {
                    originator: request.originator,
                    owner: request.owner,
                    receiver: request.receiver,
                })
            ).to.not.throw();
        });

        it("fires when the queue recorded the wrong owner — the exact gap this closes", () => {
            // A defective hook that recorded some OTHER address as the owner:
            // the pre-fix drivers never checked this field at all, so a request
            // like this would have passed every existing assertion.
            const defective = { ...request, owner: request.receiver };
            expect(() =>
                drivers.assertRequestParties("test", defective, {
                    originator: request.originator,
                    owner: request.owner,
                    receiver: request.receiver,
                })
            ).to.throw(/recorded owner/);
        });

        it("fires when the queue recorded the wrong originator", () => {
            const defective = { ...request, originator: request.receiver };
            expect(() =>
                drivers.assertRequestParties("test", defective, {
                    originator: request.originator,
                    owner: request.owner,
                    receiver: request.receiver,
                })
            ).to.throw(/recorded originator/);
        });

        it("fires when the queue recorded the wrong receiver", () => {
            const defective = { ...request, receiver: request.owner };
            expect(() =>
                drivers.assertRequestParties("test", defective, {
                    originator: request.originator,
                    owner: request.owner,
                    receiver: request.receiver,
                })
            ).to.throw(/recorded receiver/);
        });
    });

    describe("receiver-override refusal on surfaces that cannot honor one", () => {
        // Distinct from the signer, used as the "someone tried to override the
        // receiver" case.
        const otherReceiver = actor("f00");
        const signerAddress = actor("f0");
        const signer = { address: signerAddress };

        it("queueZeroCollWithdraw refuses a --receiver different from the originator, before touching the chain", async () => {
            let raised = null;
            try {
                await drivers.queueZeroCollWithdraw({}, signer, { receiver: otherReceiver });
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected an upfront refusal").to.not.equal(null);
            expect(raised.message).to.match(/no receiver argument to override/);
        });

        it("queueZeroCollWithdraw does not treat a --receiver equal to the originator as an override", async () => {
            // Passing the signer's own address back is not a real override and
            // must not be refused here — it should proceed to the real
            // withdrawal logic (which then fails for an unrelated reason, since
            // this fake `s` carries no contracts; that failure proves the
            // refusal branch was not what stopped it).
            let raised = null;
            try {
                await drivers.queueZeroCollWithdraw({}, signer, { receiver: signerAddress });
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected SOME failure from the fake stack").to.not.equal(null);
            expect(raised.message).to.not.match(/no receiver argument to override/);
        });

        it("queueSurplusClaim refuses a --receiver different from the claimant, before touching the chain", async () => {
            let raised = null;
            try {
                await drivers.queueSurplusClaim({}, signer, { receiver: otherReceiver });
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected an upfront refusal").to.not.equal(null);
            expect(raised.message).to.match(/no receiver argument to override/);
        });

        it("queueSurplusClaim does not treat a --receiver equal to the claimant as an override", async () => {
            let raised = null;
            try {
                await drivers.queueSurplusClaim({}, signer, { receiver: signerAddress });
            } catch (error) {
                raised = error;
            }
            expect(raised, "expected SOME failure from the fake stack").to.not.equal(null);
            expect(raised.message).to.not.match(/no receiver argument to override/);
        });
    });
});
