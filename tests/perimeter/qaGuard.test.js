/**
 * Perimeter — the QA fork rail refuses everything that is not a local fork.
 *
 * The guard is what stands between a bootstrap that impersonates timelocks and
 * rewrites balances and a node that is not disposable. It is exercised here
 * against stubbed networks rather than a fork, so every refusal is reachable in
 * a plain unit run and none of them depends on a node being up.
 *
 * Run:
 *   npx hardhat test tests/perimeter/qaGuard.test.js
 */

const { expect } = require("chai");

const { assertLocalQaFork } = require("../../tests-onchain/perimeter/qa/guard");

const HARDHAT_CLIENT = "HardhatNetwork/2.22.5/@nomicfoundation/edr/0.3.7";

/** A stubbed hre that answers exactly the four things the guard asks about. */
const stubHre = ({
    url = "http://127.0.0.1:8547",
    chainId = 30,
    tags = { qa: true },
    clientVersion = HARDHAT_CLIENT,
} = {}) => ({
    network: { name: "rskForkedMainnetQa", config: { url }, tags },
    ethers: {
        provider: {
            getNetwork: async () => ({ chainId }),
            send: async (method) => {
                if (method !== "web3_clientVersion") {
                    throw new Error(`unexpected rpc call ${method}`);
                }
                if (clientVersion === null) throw new Error("method not supported");
                return clientVersion;
            },
        },
    },
});

/** chai's `rejectedWith` needs a plugin; this repo's chai carries none, so the
 *  rejection is caught by hand and the message asserted on directly. */
const rejection = async (promise) => {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    return null;
};

describe("perimeter QA fork guard", () => {
    it("refuses a url whose host is not loopback", async () => {
        const error = await rejection(
            assertLocalQaFork(stubHre({ url: "https://mainnet-dev.sovryn.app/rpc" }))
        );
        expect(error, "a remote url must be refused").to.not.equal(null);
        expect(error.message).to.contain("loopback");
    });

    it("refuses a network that carries no url at all", async () => {
        const error = await rejection(assertLocalQaFork(stubHre({ url: null })));
        expect(error, "an in-process network must be refused").to.not.equal(null);
        expect(error.message).to.contain("loopback");
    });

    it("refuses a chain that is not RSK mainnet", async () => {
        const error = await rejection(assertLocalQaFork(stubHre({ chainId: 31337 })));
        expect(error, "chain id 31337 must be refused").to.not.equal(null);
        expect(error.message).to.contain("chain id 31337");
    });

    it("refuses a network that is not tagged qa", async () => {
        const error = await rejection(assertLocalQaFork(stubHre({ tags: { mainnet: true } })));
        expect(error, "an untagged network must be refused").to.not.equal(null);
        expect(error.message).to.contain('tagged "qa"');
    });

    it("refuses a node that is neither hardhat nor anvil", async () => {
        const error = await rejection(
            assertLocalQaFork(stubHre({ clientVersion: "Tenderly/virtual-testnet" }))
        );
        expect(error, "a hosted client must be refused").to.not.equal(null);
        expect(error.message).to.contain("Tenderly/virtual-testnet");
    });

    it("refuses a node that will not say what it is", async () => {
        const error = await rejection(assertLocalQaFork(stubHre({ clientVersion: null })));
        expect(error, "an unanswered client version must be refused").to.not.equal(null);
        expect(error.message).to.contain("hardhat or anvil");
    });

    // The regression this guard was hardened for: the fork-kind helper the
    // bootstrap once called returns this variable verbatim, so exporting it was
    // enough to declare any node a hardhat one. The guard asks the node.
    it("ignores PERIMETER_FORK_KIND and asks the node itself", async () => {
        const previous = process.env.PERIMETER_FORK_KIND;
        process.env.PERIMETER_FORK_KIND = "hardhat";
        try {
            const error = await rejection(
                assertLocalQaFork(stubHre({ clientVersion: "Tenderly/virtual-testnet" }))
            );
            expect(error, "an exported fork kind must not vouch for a node").to.not.equal(null);
            expect(error.message).to.contain("Tenderly/virtual-testnet");
        } finally {
            if (previous === undefined) delete process.env.PERIMETER_FORK_KIND;
            else process.env.PERIMETER_FORK_KIND = previous;
        }
    });

    it("passes a loopback hardhat node on chain 30 tagged qa", async () => {
        expect(await rejection(assertLocalQaFork(stubHre()))).to.equal(null);
        expect(
            await rejection(assertLocalQaFork(stubHre({ url: "http://localhost:8547" })))
        ).to.equal(null);
        expect(await rejection(assertLocalQaFork(stubHre({ url: "http://[::1]:8547" })))).to.equal(
            null
        );
        expect(
            await rejection(assertLocalQaFork(stubHre({ clientVersion: "anvil/v0.2.0" })))
        ).to.equal(null);
    });
});
