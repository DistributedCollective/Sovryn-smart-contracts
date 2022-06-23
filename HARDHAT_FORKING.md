# Hardhat mainnet forking

Out of the box, Hardhat's [mainnet forking mode](https://hardhat.org/hardhat-network/guides/mainnet-forking) does
not work with RSK. This package uses [patch-package](https://www.npmjs.com/package/patch-package) to patch the installed version of Hardhat to enable support for
forking from RSK.

## Caveats and important tidbits
- **The patch needs to be updated every time the Hardhat version is updated.**
- Making changes to the patch requires some work -- see Updating the patch below.
- Forking seems to consume so much memory that creating tests that uses it causes Github CI to fail with
  `FATAL ERROR: MarkCompactCollector: young object promotion failed Allocation failed - JavaScript heap out of memory`
  **If tests that use the forking mode are created, these should be excluded from the default test suite.**
- The patch has **not** been tested extensively, though everything seems to work!

## Installation

The patch is applied automatically after installation (`npm i`).

To validate that the patch has been applied correctly, run `npx hardhat check-fork-patch`.

## Usage

To start a new node that forks from the latest block of RSK mainnet, run `npm run fork:rsk-mainnet`.
To fork from a specific node or a specific block number, run `npx hardhat node --fork RSK_RPC_URL --fork-block-number 123456`

### In tests

Forking can be used in tests like this:

```javascript
const { network } = require("hardhat");
const IERC20 = artifacts.require("IERC20");

contract('example forking tests', () => {
    before(async () => {
        // Before the tests of this suite start, reset the used hardhat node to a specific block number of RSK mainnet
        // Instead of before, it's also possible to use beforeEach if you prefer to start each test from a clean slate
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
        // After the whole test suite has finished, reset the hardhat node used in the tests
        // This is important, because otherwise other tests will also use the forked node
        await network.provider.request({
            method: "hardhat_reset",
            params: [],
        });
    });

    it("forks from mainnet correctly", async () => {
        // call contracts from the RSK mainnet without deploying them
        // transactions are also supported
        const xusd = await IERC20.at("0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F");
        const totalSupply = await xusd.totalSupply();
        expect(totalSupply.toString()).to.equal("12346114443582774719512874");
    });
});
```

**Tests that use forking should be excluded from the default CI pipeline!** This is because they consume enough memory
for the Github CI to die. See the caveat above.

## Updating the patch

To update the patch, after it has been already applied, **edit the files under node_modules/hardhat**, e.g.
`node_modules/hardhat/internal/hardhat-network/jsonrpc/client.js`, and then run `npx patch-package hardhat`.

This will update the patch in `patches/hardhat+xxx.patch`, where `xxx` is the hardhat version number. Commit it to git.

Read the patch-package docs for more info.

## Updating the patch after hardhat version upgrade

After a hardhat version upgrade, you should run `npx hardhat check-fork-patch` to see that forking indeed fails now.

After that, you should (manually) apply the changes from `patches/hardhat+xxx.patch` to the files inside `node_modules/hardhat`
(taking note that the line numbers are probably different and the code may have changed otherwise too).

After verifying that your changes work with `npx hardhat check-fork-patch`, run `npx patch-package hardhat` and commit
the patch that's generated in `patches/`.

## Undoing the patch

The simplest way to undo the patch is probably to remove `patch-package` from the `postinstall` script in `package.json`,
then uninstall hardhat and install it back again.

If you get permission errors when running `npx hardhat`, try `chmod +x node_modules/.bin/hardhat`

## Technical details

Without the patch, calling a forked node (`hardhat node --fork MY_RSK_NODE_RPC_URL`) failed with:

    eth_call
    Invalid JSON-RPC response's result.  Errors: Invalid value null supplied
    to: RpcBlockWithTransactions | null/transactions: RpcTransaction
    Array/0: RpcTransaction/v: QUANTITY, Invalid value null supplied to:
    RpcBlockWithTransactions | null/transactions: RpcTransaction Array/0:
    RpcTransaction/r: QUANTITY, Invalid value null supplied to:
    RpcBlockWithTransactions | null/transactions: RpcTransaction Array/0:
    RpcTransaction/s: QUANTITY

(It also sometimes failed with `eth_getStorageAt`, but the patch also fixes this).

This patch is based on https://gist.github.com/0x0scion/0422f9135bc37642ba36d55b59e8b424
but with heavy modifications.

The patch resides in `patches/hardhat+xxx.patch`, where `xxx` is the hardhat version number

## More reading

- https://github.com/NomicFoundation/hardhat/issues/2395
- https://github.com/NomicFoundation/hardhat/pull/2313/files
- https://github.com/NomicFoundation/hardhat/issues/2106
- https://github.com/DistributedCollective/Sovryn-smart-contracts/pull/433

