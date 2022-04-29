/*
 * Test hardhat forking with patched hardhat
 *
 * If you get this error:
 * InvalidResponseError: Invalid JSON-RPC response's result.
 * Errors: Invalid value null supplied to : RpcBlockWithTransactions | null/transactions: RpcTransaction Array/2:
 * RpcTransaction/v: QUANTITY, Invalid value null supplied to : RpcBlockWithTransactions | null/transactions:
 * RpcTransaction Array/2: RpcTransaction/r: QUANTITY, Invalid value null supplied to :
 * RpcBlockWithTransactions | null/transactions: RpcTransaction Array/2: RpcTransaction/s: QUANTITY
 *
 * Then the forking doesn't work correctly (ie. hardhat was not properly patched)
 */
const { network } = require("hardhat");
const IERC20 = artifacts.require("IERC20");

contract("hardhat forking tests", () => {
    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://mainnet.sovryn.app/rpc",
                        blockNumber: 4272658,
                    },
                },
            ],
        });
    });

    after(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [],
        });
    });

    it("forks from mainnet correctly", async () => {
        // test total XUSD supply in the specified block to see that the fork was successful
        const xusd = await IERC20.at("0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F");
        const totalSupply = await xusd.totalSupply();
        expect(totalSupply.toString()).to.equal("12346114443582774719512874");
    });
});
