const { expectRevert, expectEvent, BN, constants } = require("@openzeppelin/test-helpers");
const { artifacts } = require("hardhat");

const AirswapERC20Mockup = artifacts.require("AirswapERC20Mockup");
const AirswapFeeConnector = artifacts.require("AirswapFeeConnector");
const TestToken = artifacts.require("TestToken");

const { ZERO_ADDRESS } = constants;
const ONE = new BN("1000000000000000000");
const INITIAL_MINTED = 1000000;
const INITIAL_AMOUNT_BN = ONE.mul(new BN(INITIAL_MINTED));
const wei = web3.utils.toWei;
const hunEth = new BN(wei("100", "ether"));

function bnToComparableNumber(bn) {
    // round bn to 9 digits
    return bn.divRound(new BN("1000000000")).toNumber() / 10 ** 9;
}

contract("AirSwap Integration", (accounts) => {
    let deployerAddress, senderAddress, marketMakerAddress, recipientAddress, feeVaultAddress;
    let testToken1, testToken1Address, testToken2, testToken2Address;
    let airSwapERC20Mockup, airswapFeeConnector;
    let fakeAddress;

    describe.only("AirSwap Integration test", async () => {
        before(async () => {
            [
                deployerAddress,
                senderAddress,
                marketMakerAddress,
                recipientAddress,
                feeVaultAddress,
            ] = accounts;

            airSwapERC20Mockup = await AirswapERC20Mockup.new();
            airswapFeeConnector = await AirswapFeeConnector.new();

            testToken1 = await TestToken.new("TST1", "TST1", 18, INITIAL_AMOUNT_BN);
            testToken1Address = testToken1.address;
            testToken2 = await TestToken.new("TST2", "TST2", 18, INITIAL_AMOUNT_BN);
            testToken2Address = testToken2.address;

            await testToken2.transfer(airSwapERC20Mockup.address, INITIAL_AMOUNT_BN);
        });

        beforeEach(async () => {
            await airSwapERC20Mockup.reset();
            fakeAddress = (await TestToken.new("", "", 18, 0)).address; // just a random address
        });

        describe("inputFee", async () => {
            const fakeFee = new BN(Math.floor(10 ^ (18 * Math.random)));
            it("owner only", async () => {
                await expectRevert(
                    airswapFeeConnector.setInputFee(fakeFee, { from: senderAddress }),
                    "unauthorized"
                );
            });
            it("can be set", async () => {
                const { tx } = await airswapFeeConnector.setInputFee(fakeFee);
                const fee = await airswapFeeConnector.inputFeeInPoints();
                expect(fee.toString()).to.be.equal(fakeFee.toString());
                await expectEvent.inTransaction(tx, airswapFeeConnector, "InputFeeChangedEvent", {
                    sender: deployerAddress,
                    feeInPoints: fakeFee,
                });
            });
        });

        describe("outputFee", async () => {
            const fakeFee = new BN(Math.floor(10 ^ (18 * Math.random)));
            it("owner only", async () => {
                await expectRevert(
                    airswapFeeConnector.setOutputFee(fakeFee, { from: senderAddress }),
                    "unauthorized"
                );
            });
            it("can be set", async () => {
                const { tx } = await airswapFeeConnector.setOutputFee(fakeFee);
                const fee = await airswapFeeConnector.outputFeeInPoints();
                expect(fee.toString()).to.be.equal(fakeFee.toString());
                await expectEvent.inTransaction(tx, airswapFeeConnector, "OutputFeeChangedEvent", {
                    sender: deployerAddress,
                    feeInPoints: fakeFee,
                });
            });
        });

        describe("feeVaultAddress", async () => {
            it("owner only", async () => {
                await expectRevert(
                    airswapFeeConnector.setFeeVaultAddress(fakeAddress, { from: senderAddress }),
                    "unauthorized"
                );
            });
            it("can be set", async () => {
                const { tx } = await airswapFeeConnector.setFeeVaultAddress(fakeAddress);
                const address = await airswapFeeConnector.feeVaultAddress();
                expect(address).to.be.equal(fakeAddress);
                await expectEvent.inTransaction(
                    tx,
                    airswapFeeConnector,
                    "FeeVaultAddressChangedEvent",
                    {
                        sender: deployerAddress,
                        newAddress: fakeAddress,
                    }
                );
            });
        });

        describe("swapERC20Address", async () => {
            it("owner only", async () => {
                await expectRevert(
                    airswapFeeConnector.setSwapERC20Address(fakeAddress, { from: senderAddress }),
                    "unauthorized"
                );
            });
            it("can be set", async () => {
                const { tx } = await airswapFeeConnector.setSwapERC20Address(fakeAddress);
                const address = await airswapFeeConnector.swapERC20Address();
                expect(address).to.be.equal(fakeAddress);
                await expectEvent.inTransaction(
                    tx,
                    airswapFeeConnector,
                    "SwapERC20AddressChangedEvent",
                    {
                        sender: deployerAddress,
                        newAddress: fakeAddress,
                    }
                );
            });
        });

        describe("happy flow", async () => {
            it("swap is successful", async () => {
                const fakeNonce = 1;
                const fakeExpiry = 1000000000;
                const fakeV = 11;
                const fakeR = "0x0101010101010101010101010101010101010101010101010101010101010101";
                const fakeS = "0x0202020202020202020202020202020202020202020202020202020202020202";

                const POINTS = 1000;
                const inputFeePoints = 310; // 31%
                const outputFeePoints = 281; // 28.1%
                const totalInputAmount = 1473;
                const outputAmount = 871340;
                const expectedInputFee = (totalInputAmount * inputFeePoints) / POINTS;
                const inputAmountAfterFee = totalInputAmount - expectedInputFee;
                const expectedOutputFee = (outputAmount * outputFeePoints) / POINTS;
                const expectedOutputAmountAfterFee = outputAmount - expectedOutputFee;

                await airswapFeeConnector.setSwapERC20Address(airSwapERC20Mockup.address);
                await airswapFeeConnector.setFeeVaultAddress(feeVaultAddress);
                await airswapFeeConnector.setInputFee(inputFeePoints);
                await airswapFeeConnector.setOutputFee(outputFeePoints);
                await airSwapERC20Mockup.reset();

                function numberToBn(n) {
                    return new BN(wei(n.toString(), "ether"));
                }

                // first we need to approve
                await testToken1.approve(
                    airswapFeeConnector.address,
                    numberToBn(totalInputAmount)
                );

                // then we can convert
                const { tx } = await airswapFeeConnector.swap(
                    deployerAddress,
                    recipientAddress,
                    fakeNonce,
                    fakeExpiry,
                    marketMakerAddress,
                    testToken2Address,
                    numberToBn(outputAmount),
                    testToken1Address,
                    numberToBn(totalInputAmount),
                    fakeV,
                    fakeR,
                    fakeS
                );

                await expectEvent.inTransaction(tx, airswapFeeConnector, "SwapEvent", {
                    sender: deployerAddress,
                    recipient: recipientAddress,
                    sendToken: testToken1Address,
                    sendAmount: numberToBn(totalInputAmount),
                    inputFee: numberToBn(expectedInputFee),
                    receiveToken: testToken2Address,
                    receiveAmount: numberToBn(expectedOutputAmountAfterFee),
                    outputFee: numberToBn(expectedOutputFee),
                });

                const actualRecipientBalance = await testToken2.balanceOf(recipientAddress);
                expect(bnToComparableNumber(actualRecipientBalance)).to.equal(
                    expectedOutputAmountAfterFee
                );

                const actualInputFeeCollected = await testToken1.balanceOf(feeVaultAddress);
                expect(bnToComparableNumber(actualInputFeeCollected)).to.equal(expectedInputFee);

                const actualOutputFeeCollected = await testToken2.balanceOf(feeVaultAddress);
                expect(bnToComparableNumber(actualOutputFeeCollected)).to.equal(expectedOutputFee);

                const actualSenderBalance = await testToken1.balanceOf(deployerAddress);
                expect(bnToComparableNumber(actualSenderBalance)).to.equal(
                    INITIAL_MINTED - totalInputAmount
                );

                expect((await airSwapERC20Mockup.swapCalled()).toNumber()).is.equal(1);
                expect((await airSwapERC20Mockup.v()).toNumber()).is.equal(fakeV);
                expect((await airSwapERC20Mockup.r()).toString()).is.equal(fakeR);
                expect((await airSwapERC20Mockup.s()).toString()).is.equal(fakeS);
                expect((await airSwapERC20Mockup.nonce()).toNumber()).is.equal(fakeNonce);
                expect((await airSwapERC20Mockup.expiry()).toNumber()).is.equal(fakeExpiry);
            });
        });
    });
});
