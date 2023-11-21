const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, ZERO_BYTES32 } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const MultiSigWallet = artifacts.require("MultiSigWallet");
const TestToken = artifacts.require("TestToken");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getPriceFeeds,
    decodeLogs,
    getSovryn,
    getLoanToken,
    getLoanTokenLogicWrbtc,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

// Deploys the multisig wallet contract setting 3 owners and 2 required confirmations

const getMultisig = async (accounts) => {
    const requiredConf = 2;
    const owners = [accounts[0], accounts[1], accounts[2]];
    const multisig = await MultiSigWallet.new(owners, requiredConf);
    return multisig;
};

contract("SwapsImplSovrynSwapModule", (accounts) => {
    let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, multisig, sov;
    const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
    let lender, loanToken, loanTokenAddress;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        multisig = await getMultisig(accounts);
        await sovryn.transferOwnership(multisig.address);

        /// @dev A SOV mint useful for every test
        sov = await TestToken.new("Sovryn", "SOV", 18, new BN(10).pow(new BN(50)));
        await sov.transfer(multisig.address, new BN(10).pow(new BN(50)), { from: accounts[0] });

        /// @dev a loanToken required to test setting loan pools on the protocol
        loanToken = await getLoanToken(lender, sovryn, WRBTC, SUSD);
        loanTokenAddress = await loanToken.loanTokenAddress();
    }

    before(async () => {
        [lender] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("SwapsImplSovrynSwapModule Tests", () => {
        it("should able to call getSovrynSwapNetworkContract", async () => {
            const sovrynSwapContractRegistry = await sovryn.sovrynSwapContractRegistryAddress();
            const sovrynSwapNetwork = await sovryn.getSovrynSwapNetworkContract(
                sovrynSwapContractRegistry
            );
            expect(sovrynSwapNetwork).not.equal(ZERO_ADDRESS);
        });

        it("should able to call getContractHexName", async () => {
            const sovrynSwapNetwork = await sovryn.getContractHexName("SovrynSwapNetwork");
            expect(sovrynSwapNetwork).not.equal(ZERO_BYTES32);
        });

        it("should able to call swapsImplInternalExpectedRate", async () => {
            const sovrynSwapContractRegistry = await sovryn.sovrynSwapContractRegistryAddress();
            const expectedRate = await sovryn.swapsImplInternalExpectedRate(
                WRBTC.address,
                SUSD.address,
                wei("1", "ether"),
                sovrynSwapContractRegistry
            );
            const priceFeedRate = await priceFeeds.rates(WRBTC.address, SUSD.address);
            expect(expectedRate.toString()).to.equal(priceFeedRate.toString());
        });

        it("should able to call swapsImplInternalExpectedReturn", async () => {
            const sovrynSwapContractRegistry = await sovryn.sovrynSwapContractRegistryAddress();
            const expectedRate = await sovryn.swapsImplInternalExpectedReturn(
                WRBTC.address,
                SUSD.address,
                wei("1", "ether"),
                sovrynSwapContractRegistry
            );
            const priceFeedRate = await priceFeeds.rates(WRBTC.address, SUSD.address);
            expect(expectedRate.toString()).to.equal(priceFeedRate.toString());
        });
    });
});
