/**
 * The preflight's vote predicate, pinned against GovernorAlpha.state.
 *
 * `winsTheVote` decides whether the preflight still has to buy votes, so it has
 * to agree with the chain exactly — not approximately. GovernorAlpha marks a
 * proposal Defeated when
 *
 *     forVotes <= (forVotes + againstVotes) / 100 * majorityPercentageVotes
 *     || forVotes + againstVotes < proposal.quorum
 *
 * with the division taken FIRST, in integer arithmetic, and with the quorum
 * read from the proposal's own snapshot. Every case below fixes one of those
 * details. No network: the predicate is pure.
 *
 *     npx hardhat test tests-onchain/perimeter/phase1Preflight.unit.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
    winsTheVote,
    hasAction,
    rewiresLendingAndZero,
    retiresTheSubsidy,
} = require("./phase1Preflight");

const bn = (value) => ethers.BigNumber.from(value);

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

describe("Phase 1 preflight — the vote predicate", () => {
    for (const majority of [70, 50]) {
        describe(`at a ${majority}% majority`, () => {
            it("fails below quorum however lopsided the support", () => {
                // Unanimous, and still not enough people showed up.
                expect(winsTheVote(bn(100), bn(0), bn(101), bn(majority))).to.equal(false);
            });

            it("fails at exactly the majority threshold", () => {
                // 100 votes cast, threshold = 100 / 100 * majority = majority.
                // The contract defeats on `<=`, so landing on the line loses.
                const forVotes = bn(majority);
                const againstVotes = bn(100 - majority);
                expect(winsTheVote(forVotes, againstVotes, bn(100), bn(majority))).to.equal(false);
            });

            it("passes one vote above the majority threshold", () => {
                const forVotes = bn(majority + 1);
                const againstVotes = bn(100 - majority - 1);
                expect(winsTheVote(forVotes, againstVotes, bn(100), bn(majority))).to.equal(true);
            });

            it("divides before it multiplies, as the contract does", () => {
                // total = 1e18 + 99. Truncating first gives a threshold of
                // 1e16 * majority; multiplying first would give
                // (1e18 + 99) * majority / 100, which is up to 99 higher.
                // A tally inside that gap separates the two orders, and the
                // contract's order is the one that must win here.
                const total = bn(10).pow(18).add(99);
                const truncatedFirst = total.div(100).mul(majority);
                const multipliedFirst = total.mul(majority).div(100);
                expect(
                    multipliedFirst.gt(truncatedFirst),
                    "the two orders must actually disagree for this case to prove anything"
                ).to.equal(true);

                const forVotes = truncatedFirst.add(1);
                expect(forVotes.lte(multipliedFirst), "tally sits inside the gap").to.equal(true);
                expect(winsTheVote(forVotes, total.sub(forVotes), total, bn(majority))).to.equal(
                    true
                );
            });
        });
    }

    it("reads quorum from the proposal snapshot it is handed", () => {
        // Same tally, two quorums: only the snapshot decides.
        const forVotes = bn(10).pow(25);
        expect(winsTheVote(forVotes, bn(0), forVotes, bn(70))).to.equal(true);
        expect(winsTheVote(forVotes, bn(0), forVotes.add(1), bn(70))).to.equal(false);
    });
});

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
