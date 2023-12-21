/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * No bottlenecks found. Tests don't need redeployments.
 *
 * Total time elapsed: 4.9s
 *
 * 2021-10-07: Added 2 tests to achieve a 100% of coverture.
 */

const { constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require("chai");
const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getSovryn,
    getPriceFeeds,
} = require("../Utils/initializer.js");

const Affiliates = artifacts.require("Affiliates");
const LoanSettings = artifacts.require("LoanSettings");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const SwapsExternal = artifacts.require("SwapsExternal");
const LoanClosingsLiquidation = artifacts.require("LoanClosingsLiquidation");
const LoanClosingsRollover = artifacts.require("LoanClosingsRollover");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");

contract("Protocol", (accounts) => {
    let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, swapsImplSovrynSwapLib;
    const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";

    before(async () => {
        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
    });

    describe("Protocol Tests", () => {
        it("Test targetSetup", async () => {
            const sig1 = "testFunction1(address,uint256,bytes)";
            const sig2 = "testFunction2(address[],uint256[],bytes[])";

            const sigs = [sig1, sig2];
            let targets = [ONE_ADDRESS, ONE_ADDRESS];
            await sovryn.setTargets(sigs, targets);

            expect((await sovryn.getTarget(sig1)) == ONE_ADDRESS).to.be.true;
            expect((await sovryn.getTarget(sig2)) == ONE_ADDRESS).to.be.true;

            targets = [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS];
            await sovryn.setTargets(sigs, targets);

            expect((await sovryn.getTarget(sig1)) == constants.ZERO_ADDRESS).to.be.true;
            expect((await sovryn.getTarget(sig2)) == constants.ZERO_ADDRESS).to.be.true;
        });

        it("should revert for count mismatch while setting targets", async () => {
            const sig1 = "testFunction1(address,uint256,bytes)";
            const sig2 = "testFunction2(address[],uint256[],bytes[])";
            const sigs = [sig1, sig2];
            let targets = [ONE_ADDRESS, ONE_ADDRESS, ONE_ADDRESS];

            await expectRevert(sovryn.setTargets(sigs, targets), "count mismatch");
        });

        it("Test replaceContract", async () => {
            const sig =
                "setupLoanParams((bytes32,bool,address,address,address,uint256,uint256,uint256)[])";
            const loanSettings = await LoanSettings.new();

            await sovryn.setTargets([sig], [constants.ZERO_ADDRESS]);
            expect((await sovryn.getTarget(sig)) == constants.ZERO_ADDRESS).to.be.true;

            await sovryn.replaceContract(loanSettings.address);
            expect((await sovryn.getTarget(sig)) == loanSettings.address).to.be.true;
        });

        it("Test receiveEther", async () => {
            expect((await web3.eth.getBalance(sovryn.address)) == 0).to.be.true;
            // gasleft() should be < 2300 in the Protocol.sol proxy contract, 21000 is the min gas for sending value
            await web3.eth.sendTransaction({
                from: accounts[0].toString(),
                to: sovryn.address,
                value: 10000,
                gas: 22000,
            });
            expect((await web3.eth.getBalance(sovryn.address)) == 10000).to.be.true;
        });
    });

    describe("Events - replaceContract", () => {
        it("should fail replaceContract w/ bad address", async () => {
            await expectRevert(sovryn.replaceContract(sovryn.address), "setup failed");
        });

        it("Test replaceContract - Affiliates", async () => {
            const selector = "getUserNotFirstTradeFlag(address)";
            let oldAffiliatesAddr = await sovryn.getTarget(selector);
            let newAffiliatesAddr = await Affiliates.new();
            let tx = await sovryn.replaceContract(newAffiliatesAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced", {
                prevModuleContractAddress: oldAffiliatesAddr,
                newModuleContractAddress: newAffiliatesAddr.address,
                module: ethers.utils.formatBytes32String("Affiliates"),
            });
        });

        it("Test replaceContract - LoanClosingsLiquidation", async () => {
            const selector = "liquidate(bytes32,address,uint256)";
            let oldLoanClosingsLiquidationAddr = await sovryn.getTarget(selector);
            let newLoanClosingsLiquidationAddr = await LoanClosingsLiquidation.new();
            let tx = await sovryn.replaceContract(newLoanClosingsLiquidationAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced", {
                prevModuleContractAddress: oldLoanClosingsLiquidationAddr,
                newModuleContractAddress: newLoanClosingsLiquidationAddr.address,
                module: ethers.utils.formatBytes32String("LoanClosingsLiquidation"),
            });
        });

        it("Test replaceContract - LoanClosingsRollover", async () => {
            const selector = "rollover(bytes32,bytes)";
            let oldLoanClosingsRolloverAddr = await sovryn.getTarget(selector);

            await LoanClosingsRollover.link(swapsImplSovrynSwapLib);
            let newLoanClosingsRolloverAddr = await LoanClosingsRollover.new();
            let tx = await sovryn.replaceContract(newLoanClosingsRolloverAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced", {
                prevModuleContractAddress: oldLoanClosingsRolloverAddr,
                newModuleContractAddress: newLoanClosingsRolloverAddr.address,
                module: ethers.utils.formatBytes32String("LoanClosingsRollover"),
            });
        });

        it("Test replaceContract - LoanClosingsWith", async () => {
            await LoanClosingsWith.link(swapsImplSovrynSwapLib);
            let newLoanClosingsWithAddr = await LoanClosingsWith.new();
            let tx = await sovryn.replaceContract(newLoanClosingsWithAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced");
        });

        it("Test replaceContract - LoanMaintenance", async () => {
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
            let newLoanMaintenanceAddr = await LoanMaintenance.new();
            let tx = await sovryn.replaceContract(newLoanMaintenanceAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced");
        });

        it("Test replaceContract - LoanOpenings", async () => {
            await LoanOpenings.link(swapsImplSovrynSwapLib);
            let newLoanOpeningsAddr = await LoanOpenings.new();
            let tx = await sovryn.replaceContract(newLoanOpeningsAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced");
        });

        it("Test replaceContract - LoanSettings", async () => {
            let newLoanSettingsAddr = await LoanSettings.new();
            let tx = await sovryn.replaceContract(newLoanSettingsAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced");
        });

        it("Test replaceContract - ProtocolSettings", async () => {
            const selector = "setSovrynProtocolAddress(address)";
            let oldProtocolSettingsAddr = await sovryn.getTarget(selector);
            let newProtocolSettingsAddr = await ProtocolSettings.new();
            let tx = await sovryn.replaceContract(newProtocolSettingsAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced", {
                prevModuleContractAddress: oldProtocolSettingsAddr,
                newModuleContractAddress: newProtocolSettingsAddr.address,
                module: ethers.utils.formatBytes32String("ProtocolSettings"),
            });
        });

        it("Test replaceContract - SwapsExternal", async () => {
            await SwapsExternal.link(swapsImplSovrynSwapLib);
            let newSwapsExternalAddr = await SwapsExternal.new();
            let tx = await sovryn.replaceContract(newSwapsExternalAddr.address);
            expectEvent(tx, "ProtocolModuleContractReplaced");
        });
    });
});
