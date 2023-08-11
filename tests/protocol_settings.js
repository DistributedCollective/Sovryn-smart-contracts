/** Speed optimized on branch hardhatTestRefactor, 2021-09-29
 * Bottlenecks found at beforeEach hook, redeploying protocol on every test.
 *
 * Total time elapsed: 4.8s
 * After optimization: 4.2s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *  Updated to use only the initializer.js functions for protocol deployment.
 */

const { assert, expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { BN, constants, expectRevert } = require("@openzeppelin/test-helpers");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getSOV,
    getLoanTokenLogic,
    getLoanTokenLogicWrbtc,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    getPriceFeeds,
    getSovryn,
    lend_to_pool,
    set_demand_curve,
    open_margin_trade_position,
} = require("./Utils/initializer.js");

const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettingsMockup");

const TestToken = artifacts.require("TestToken");
const { etherMantissa } = require("./Utils/Ethereum");
const LockedSOV = artifacts.require("LockedSOVMockup");
const { set_fee_tokens_held } = require("./loan-token/helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants.js");
const TOTAL_SUPPLY = etherMantissa(1000000000);
const wei = web3.utils.toWei;

contract("Affliates", (accounts) => {
    let sovryn;

    async function deploymentAndInitFixture(_wallets, _provider) {
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        await sovryn.setSovrynProtocolAddress(sovryn.address);
    }

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    it("Saves Sovryn Proxy Address correctly", async () => {
        assert.equal(await sovryn.getProtocolAddress(), sovryn.address);
        // assert.equal(loanTokenAddress, doc.address, "Doc address not set yet");
    });

    // Should successfully set the sov token address
    it("Test set sov token address", async () => {
        const sov = await TestToken.new("Sovryn", "SOV", 18, new BN(10).pow(new BN(50)));

        // Should revert if set with non owner
        await expectRevert(
            sovryn.setSOVTokenAddress(constants.ZERO_ADDRESS, { from: accounts[1] }),
            "unauthorized"
        );
        await expectRevert(
            sovryn.setSOVTokenAddress(constants.ZERO_ADDRESS),
            "newSovTokenAddress not a contract"
        );

        await sovryn.setSOVTokenAddress(sov.address);
        expect((await sovryn.getSovTokenAddress()) == sov.address).to.be.true;
    });

    // Should successfully set the locked SOV address
    it("Test set sov token address", async () => {
        const sov = await TestToken.new("Sovryn", "SOV", 18, new BN(10).pow(new BN(50)));
        const lockedSOV = await LockedSOV.new(sov.address, [accounts[0]]);

        // Should revert if set with non owner
        await expectRevert(
            sovryn.setLockedSOVAddress(constants.ZERO_ADDRESS, { from: accounts[1] }),
            "unauthorized"
        );
        await expectRevert(
            sovryn.setLockedSOVAddress(constants.ZERO_ADDRESS),
            "newLockSOVAddress not a contract"
        );

        await sovryn.setLockedSOVAddress(lockedSOV.address);
        expect((await sovryn.getLockedSOVAddress()) == lockedSOV.address).to.be.true;
    });

    // Should successfully set the Affiliate Fee Percent
    it("Test set affiliate fee percent", async () => {
        const affiliateFeePercent = web3.utils.toWei("20", "ether");
        const invalidAffiliateFeePercent = web3.utils.toWei("101", "ether");
        // Should revert if set with non owner
        await expectRevert(
            sovryn.setAffiliateFeePercent(affiliateFeePercent, { from: accounts[1] }),
            "unauthorized"
        );
        // Should revert if value too high
        await expectRevert(
            sovryn.setAffiliateFeePercent(invalidAffiliateFeePercent),
            "value too high"
        );

        await sovryn.setAffiliateFeePercent(affiliateFeePercent);
        expect((await sovryn.affiliateFeePercent()).toString() == affiliateFeePercent).to.be.true;
    });

    // Should successfully set the Affiliate Trading Token Fee Percent
    it("Test set affiliate fee percent", async () => {
        // Should revert if set with non owner
        const affiliateTradingTokenFeePercent = web3.utils.toWei("20", "ether");
        const invalidAffiliateTradingTokenFeePercent = web3.utils.toWei("101", "ether");
        // Should revert if set with non owner
        await expectRevert(
            sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent, {
                from: accounts[1],
            }),
            "unauthorized"
        );
        // Should revert if value too high
        await expectRevert(
            sovryn.setAffiliateTradingTokenFeePercent(invalidAffiliateTradingTokenFeePercent),
            "value too high"
        );

        await sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent);
        expect(
            (await sovryn.affiliateTradingTokenFeePercent()).toString() ==
                affiliateTradingTokenFeePercent
        ).to.be.true;
    });

    it("Test set trading rebate rewards basis point with invalid value", async () => {
        // Should revert if set with invalid value (more than the max basis point value 9999)
        await expectRevert(sovryn.setTradingRebateRewardsBasisPoint(10000), "value too high");
    });

    it("Test set trading rebate rewards basis point with max value", async () => {
        const maxBasisPoint = 9999;
        await sovryn.setTradingRebateRewardsBasisPoint(maxBasisPoint);
        expect((await sovryn.getTradingRebateRewardsBasisPoint()).toString()).to.be.equal(
            new BN(maxBasisPoint).toString()
        );
    });

    it("Check dedicated SOV calculation", async () => {
        let protocol = await sovrynProtocol.new();
        const protocolSettings = await ProtocolSettings.new();
        const dedicatedSOVAmount = new BN(wei("1", "wei"));
        const SOVToken = await TestToken.new("SOV", "SOV", 18, TOTAL_SUPPLY);

        await protocol.replaceContract(protocolSettings.address);
        protocol = await ProtocolSettings.at(protocol.address);
        await protocol.setSOVTokenAddress(SOVToken.address);

        await set_fee_tokens_held(protocol, SOVToken, new BN(100), new BN(200), new BN(300));

        expect((await protocol.getDedicatedSOVRebate()).toString()).to.equal(new BN(0).toString());

        await SOVToken.transfer(protocol.address, new BN(0));

        expect((await protocol.getDedicatedSOVRebate()).toString()).to.equal(new BN(0).toString());

        await SOVToken.transfer(protocol.address, dedicatedSOVAmount);

        expect((await protocol.getDedicatedSOVRebate()).toString()).to.equal(new BN(1).toString());
    });

    // Should successfully set the RolloverFlex Fee Percent
    it("Test set RolloverFlexFeePercent", async () => {
        const newRolloverFlexFeePercent = web3.utils.toWei("1", "ether");
        const invalidRolloverFlexFeePercent = web3.utils.toWei("2", "ether");
        // Should revert if set with non owner
        await expectRevert(
            sovryn.setRolloverFlexFeePercent(newRolloverFlexFeePercent, { from: accounts[1] }),
            "unauthorized"
        );
        // Should revert if value too high
        await expectRevert(
            sovryn.setRolloverFlexFeePercent(invalidRolloverFlexFeePercent),
            "value too high"
        );

        await sovryn.setRolloverFlexFeePercent(newRolloverFlexFeePercent);
        expect((await sovryn.rolloverFlexFeePercent()).toString()).to.equal(
            newRolloverFlexFeePercent
        );
    });

    it("Test set defaultConversionPath by owner", async () => {
        const owner = accounts[0];
        let defaultConversionPath = [accounts[0], SUSD.address, WRBTC.address];

        // Should revert if set with non owner
        await expectRevert(
            sovryn.setDefaultPathConversion(defaultConversionPath, { from: accounts[1] }),
            "unauthorized"
        );

        // Should revert if path is not contract address
        await expectRevert(
            sovryn.setDefaultPathConversion(defaultConversionPath, { from: owner }),
            "ERR_PATH_NON_CONTRACT_ADDR"
        );

        // Should revert if path contains <= 1 address
        await expectRevert(
            sovryn.setDefaultPathConversion([WRBTC.address], { from: owner }),
            "ERR_PATH_LENGTH"
        );

        // Set the default path
        defaultConversionPath = [WRBTC.address, SUSD.address, BZRX.address];

        let sourceTokenAddress = defaultConversionPath[0];
        let destTokenAddress = defaultConversionPath[defaultConversionPath.length - 1];

        await sovryn.setDefaultPathConversion(defaultConversionPath, { from: owner });

        expect(
            await sovryn.getDefaultPathConversion(sourceTokenAddress, destTokenAddress)
        ).to.deep.equal(defaultConversionPath);
    });

    it("Test set defaultConversionPath by admin role", async () => {
        const owner = accounts[0];
        const admin = accounts[2];
        expect(await sovryn.getAdmin()).to.equal(ZERO_ADDRESS);

        await sovryn.setAdmin(admin, { from: owner });

        expect(await sovryn.getAdmin()).to.equal(admin);
        let defaultConversionPath = [accounts[0], SUSD.address, WRBTC.address];

        // Should revert if set with non owner
        await expectRevert(
            sovryn.setDefaultPathConversion(defaultConversionPath, { from: accounts[1] }),
            "unauthorized"
        );

        // Should revert if path is not contract address
        await expectRevert(
            sovryn.setDefaultPathConversion(defaultConversionPath, { from: admin }),
            "ERR_PATH_NON_CONTRACT_ADDR"
        );

        // Should revert if path contains <= 1 address
        await expectRevert(
            sovryn.setDefaultPathConversion([WRBTC.address], { from: admin }),
            "ERR_PATH_LENGTH"
        );

        // Set the default path
        defaultConversionPath = [WRBTC.address, SUSD.address, BZRX.address];

        let sourceTokenAddress = defaultConversionPath[0];
        let destTokenAddress = defaultConversionPath[defaultConversionPath.length - 1];

        await sovryn.setDefaultPathConversion(defaultConversionPath, { from: admin });

        expect(
            await sovryn.getDefaultPathConversion(sourceTokenAddress, destTokenAddress)
        ).to.deep.equal(defaultConversionPath);
    });

    it("Remove defaultConversionPath", async () => {
        let defaultConversionPath = [WRBTC.address, SUSD.address, BZRX.address];

        let sourceTokenAddress = defaultConversionPath[0];
        let destTokenAddress = defaultConversionPath[defaultConversionPath.length - 1];

        await expectRevert(
            sovryn.removeDefaultPathConversion(sourceTokenAddress, destTokenAddress),
            "DEFAULT_PATH_EMPTY"
        );

        await sovryn.setDefaultPathConversion(defaultConversionPath);

        expect(
            await sovryn.getDefaultPathConversion(sourceTokenAddress, destTokenAddress)
        ).to.deep.equal(defaultConversionPath);

        await expectRevert(
            sovryn.removeDefaultPathConversion(sourceTokenAddress, destTokenAddress, {
                from: accounts[1],
            }),
            "unauthorized"
        );

        await sovryn.removeDefaultPathConversion(sourceTokenAddress, destTokenAddress);

        expect(
            await sovryn.getDefaultPathConversion(sourceTokenAddress, destTokenAddress)
        ).to.deep.equal([]);
    });
});
