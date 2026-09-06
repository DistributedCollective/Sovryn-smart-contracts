/**
 * The action-shape predicates that find the SIP-0094 proposals on a fork.
 *
 * A part is recognised by the actions it carries, so each predicate has to
 * accept the genuine action list and reject the look-alikes: a later release
 * that touches the same beacons and proxy, a decoy that spreads the telling
 * signature and target across two actions, a proposal that only does half the
 * work. No network: the predicates are pure.
 *
 *     npx hardhat test tests-onchain/perimeter/phase1Proposals.unit.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { hasAction, rewiresLendingAndZero, retiresTheSubsidy } = require("./phase1Proposals");

const BO_PROXY = "0x5B9dB4B8bdeF3e57323187a9AC2639C5DEe5FD39";
const COMMUNITY_ISSUANCE = "0x9b38044A276fED8bC1703bd4a2DA1b17F2c61d16";
const BEACONS = [
    "0x5b155ECcC1dC31Ea59F2c12d2F168C956Ac0FFAa",
    "0x845eF7Be59664899398282Ef42239634aBDd752C",
];
const SOMEWHERE_ELSE = "0x00000000000000000000000000000000000000a1";

const uint256 = (value) => new ethers.utils.AbiCoder().encode(["uint256"], [value]);
const address = (value) => new ethers.utils.AbiCoder().encode(["address"], [value]);

/** Build the tuple shape `GovernorAlpha.getActions` returns. */
const actionsOf = (entries) => ({
    targets: entries.map((entry) => entry.target),
    values: entries.map(() => 0),
    signatures: entries.map((entry) => entry.signature),
    datas: entries.map((entry) => entry.data),
});

/** The action list SIP-0094 Part 1 actually carries, in order. */
const genuinePart1 = actionsOf([
    {
        target: BEACONS[0],
        signature: "registerLoanTokenModule(address)",
        data: address(SOMEWHERE_ELSE),
    },
    {
        target: BEACONS[1],
        signature: "registerLoanTokenModule(address)",
        data: address(SOMEWHERE_ELSE),
    },
    {
        target: SOMEWHERE_ELSE,
        signature: "setBorrowerExitPerimeterOps(address)",
        data: address(SOMEWHERE_ELSE),
    },
    {
        target: SOMEWHERE_ELSE,
        signature: "setImplementation(address)",
        data: address(SOMEWHERE_ELSE),
    },
    { target: BO_PROXY, signature: "setImplementation(address)", data: address(SOMEWHERE_ELSE) },
    {
        target: BO_PROXY,
        signature: "setExitFeeController(address)",
        data: address(SOMEWHERE_ELSE),
    },
]);

describe("Phase 1 preflight — the action-shape predicates", () => {
    describe("hasAction", () => {
        const twoActions = actionsOf([
            { target: BO_PROXY, signature: "setImplementation(address)", data: uint256(1) },
            {
                target: SOMEWHERE_ELSE,
                signature: "setExitFeeController(address)",
                data: uint256(0),
            },
        ]);

        it("matches a signature and target that share an action", () => {
            expect(hasAction(twoActions, "setImplementation(address)", BO_PROXY)).to.equal(true);
        });

        it("rejects a signature and target that merely both appear", () => {
            // Both the signature and the address are in this list, just never
            // on the same action. That is the whole point of the pairing.
            expect(hasAction(twoActions, "setExitFeeController(address)", BO_PROXY)).to.equal(
                false
            );
        });

        it("is case-insensitive about the target", () => {
            expect(
                hasAction(twoActions, "setImplementation(address)", BO_PROXY.toLowerCase())
            ).to.equal(true);
        });

        it("judges calldata on the same action as the signature and target", () => {
            const zero = (data) => ethers.BigNumber.from(data).isZero();
            expect(hasAction(twoActions, "setImplementation(address)", BO_PROXY, zero)).to.equal(
                false
            );
            expect(
                hasAction(twoActions, "setExitFeeController(address)", SOMEWHERE_ELSE, zero)
            ).to.equal(true);
        });
    });

    describe("Part 1's shape", () => {
        it("matches the genuine action list", () => {
            expect(rewiresLendingAndZero(genuinePart1, BEACONS)).to.equal(true);
        });

        it("rejects a proposal that only re-registers the beacons", () => {
            // The Phase 2 release emits exactly these two registrations and no
            // controller pin, so the registrations cannot identify Part 1.
            const beaconsOnly = actionsOf([
                {
                    target: BEACONS[0],
                    signature: "registerLoanTokenModule(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: BEACONS[1],
                    signature: "registerLoanTokenModule(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: SOMEWHERE_ELSE,
                    signature: "setExitDelayQueue(address)",
                    data: address(SOMEWHERE_ELSE),
                },
            ]);
            expect(rewiresLendingAndZero(beaconsOnly, BEACONS)).to.equal(false);
        });

        it("rejects a later release that rewires the same beacons and proxy", () => {
            // The Phase 2 Part 1 shape: same two beacon registrations, same
            // proxy touched, but it pins a queue rather than the controller.
            // Without the controller pin in the required shape, a newest-first
            // scan would pick this up as Part 1 and execute it.
            const laterRelease = actionsOf([
                {
                    target: BEACONS[0],
                    signature: "registerLoanTokenModule(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: BEACONS[1],
                    signature: "registerLoanTokenModule(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: BO_PROXY,
                    signature: "setImplementation(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: BO_PROXY,
                    signature: "setExitDelayQueue(address)",
                    data: address(SOMEWHERE_ELSE),
                },
            ]);
            expect(rewiresLendingAndZero(laterRelease, BEACONS)).to.equal(false);
        });

        it("rejects an unrelated proposal that swaps the same proxy", () => {
            const swapOnly = actionsOf([
                {
                    target: BO_PROXY,
                    signature: "setImplementation(address)",
                    data: address(SOMEWHERE_ELSE),
                },
            ]);
            expect(rewiresLendingAndZero(swapOnly, BEACONS)).to.equal(false);
        });

        it("rejects a proposal that registers only one of the two beacons", () => {
            const oneBeacon = actionsOf([
                {
                    target: BEACONS[0],
                    signature: "registerLoanTokenModule(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: BO_PROXY,
                    signature: "setImplementation(address)",
                    data: address(SOMEWHERE_ELSE),
                },
                {
                    target: BO_PROXY,
                    signature: "setExitFeeController(address)",
                    data: address(SOMEWHERE_ELSE),
                },
            ]);
            expect(rewiresLendingAndZero(oneBeacon, BEACONS)).to.equal(false);
        });
    });

    describe("Part 3's shape", () => {
        it("matches the genuine single zeroing action", () => {
            const genuine = actionsOf([
                { target: COMMUNITY_ISSUANCE, signature: "setAPR(uint256)", data: uint256(0) },
            ]);
            expect(retiresTheSubsidy(genuine, COMMUNITY_ISSUANCE)).to.equal(true);
        });

        it("rejects the decoy that splits the target and the zero across two actions", () => {
            // Right address with a nonzero rate, plus a zero somewhere else.
            // Judged clause by clause this passes; judged per action it does
            // not, and per action is what the chain would do.
            const decoy = actionsOf([
                { target: COMMUNITY_ISSUANCE, signature: "setAPR(uint256)", data: uint256(500) },
                { target: SOMEWHERE_ELSE, signature: "setAPR(uint256)", data: uint256(0) },
            ]);
            expect(retiresTheSubsidy(decoy, COMMUNITY_ISSUANCE)).to.equal(false);
        });

        it("rejects a nonzero rate on the right contract", () => {
            const raise = actionsOf([
                { target: COMMUNITY_ISSUANCE, signature: "setAPR(uint256)", data: uint256(500) },
            ]);
            expect(retiresTheSubsidy(raise, COMMUNITY_ISSUANCE)).to.equal(false);
        });

        it("rejects a zero rate on some other contract", () => {
            const elsewhere = actionsOf([
                { target: SOMEWHERE_ELSE, signature: "setAPR(uint256)", data: uint256(0) },
            ]);
            expect(retiresTheSubsidy(elsewhere, COMMUNITY_ISSUANCE)).to.equal(false);
        });
    });
});
