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
const { winsTheVote } = require("./phase1Preflight");

const bn = (value) => ethers.BigNumber.from(value);

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
