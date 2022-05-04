/**
 * Boilerplate to build unit tests w/ waffle fixtures on the beforeEach hook.
 * Init deployment embedded on a fixture avoids to redeploy contracts when running every test.
 * So, this is a very significant speed optimization resource to apply on tests
 * that do not require to preserve the flow from one test to another.
 */

const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { BN, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanToken,
    getLoanTokenLogicWrbtc,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    decodeLogs,
    getSOV,
} = require("./Utils/initializer.js");

contract("ContractName", (accounts) => {
    let root, account1, account2, account3, account4;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, SOV;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // Protocol token
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
    }

    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("Boilerplate", () => {
        it("SOV total supply", async () => {
            let totalSupply = await SOV.totalSupply();
            // console.log("SOV totalSupply: ", totalSupply.toString());
            expect(totalSupply).to.be.bignumber.equal(new BN(10).pow(new BN(50)));
        });
    });
});
