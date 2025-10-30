const { ethers } = require("hardhat");
const { expect } = require("chai");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

describe("LoanIdMutex", function () {
    describe("special deploy utilities", function () {
        it("getOrDeployLoanIdMutex", async () => {
            let loanIdMutex = await mutexUtils.getOrDeployLoanIdMutex();
            expect(loanIdMutex.address).to.be.properAddress;

            // Test that we can call it again, and it's basically a no-op
            const loanIdMutex2 = await mutexUtils.getOrDeployLoanIdMutex();
            expect(loanIdMutex2.address).to.equal(loanIdMutex.address);
        });

        it("createLoanIdMutexDeployTransaction", async () => {
            // Test that it doesn't fail. We could test something else too, but the data returned by
            // mutexUtils.createLoanIdMutexDeployTransaction will change if *anything* in LoanIdMutex.sol changes,
            // including comments and whitespace
            const deployData = await mutexUtils.createLoanIdMutexDeployTransaction();

            // Verify the structure of returned data
            expect(deployData).to.have.property("serializedDeployTx");
            expect(deployData).to.have.property("deployerAddress");
            expect(deployData).to.have.property("contractAddress");
            expect(deployData).to.have.property("transactionCostWei");

            // Verify the deployer and contract addresses are valid
            expect(deployData.deployerAddress).to.be.properAddress;
            expect(deployData.contractAddress).to.be.properAddress;
        });
    });

    describe("LoanIdMutex contract", function () {
        let loanIdMutex;
        let loanIdMutexTester;
        let owner;
        let anotherUser;

        beforeEach(async () => {
            const LoanIdMutex = await ethers.getContractFactory("LoanIdMutex");
            loanIdMutex = await LoanIdMutex.deploy();

            const LoanIdMutexTester = await ethers.getContractFactory("LoanIdMutexTester");
            loanIdMutexTester = await LoanIdMutexTester.deploy(loanIdMutex.address);

            [owner, anotherUser] = await ethers.getSigners();
        });

        describe("loanIdToBlockNumber mapping", function () {
            it("should return 0 for a new loan ID", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(0);
            });

            it("should be publicly accessible", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");

                // Initial value should be 0
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(0);

                // After checkAndToggle, should be set to current block number
                await loanIdMutex.checkAndToggle(loanId);
                const currentBlock = await ethers.provider.getBlockNumber();
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(currentBlock);
            });
        });

        describe("checkAndToggle", function () {
            it("should set block number for a new loan ID", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");

                await loanIdMutex.checkAndToggle(loanId);
                const currentBlock = await ethers.provider.getBlockNumber();
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(currentBlock);
            });

            it("should revert when called twice in the same block", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");

                // Use helper contract to call checkAndToggle twice in a single transaction
                // The second call should revert because it's in the same block
                await expect(loanIdMutexTester.doubleCheckAndToggle(loanId)).to.be.revertedWith(
                    "loan ID already used in this block"
                );
            });

            it("should allow operation in the next block", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");

                // First call
                await loanIdMutex.checkAndToggle(loanId);
                const firstBlock = await ethers.provider.getBlockNumber();

                // Mine a new block by making another transaction
                await ethers.provider.send("evm_mine");

                // Second call in a different block should succeed
                await loanIdMutex.checkAndToggle(loanId);
                const secondBlock = await ethers.provider.getBlockNumber();

                expect(secondBlock).to.be.greaterThan(firstBlock);
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(secondBlock);
            });

            it("should handle multiple loan IDs independently", async () => {
                const loanId1 = ethers.utils.formatBytes32String("loan1");
                const loanId2 = ethers.utils.formatBytes32String("loan2");
                const loanId3 = ethers.utils.formatBytes32String("loan3");

                // Toggle loan1
                await loanIdMutex.checkAndToggle(loanId1);
                const block1 = await ethers.provider.getBlockNumber();

                // Toggle loan2
                await loanIdMutex.checkAndToggle(loanId2);
                const block2 = await ethers.provider.getBlockNumber();

                // loan3 not touched

                // Verify each has independent block tracking
                expect(await loanIdMutex.loanIdToBlockNumber(loanId1)).to.equal(block1);
                expect(await loanIdMutex.loanIdToBlockNumber(loanId2)).to.equal(block2);
                expect(await loanIdMutex.loanIdToBlockNumber(loanId3)).to.equal(0);
            });

            it("should work when called by different accounts", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");

                // Owner calls it
                await loanIdMutex.checkAndToggle(loanId);
                const block1 = await ethers.provider.getBlockNumber();
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(block1);

                // Mine a new block
                await ethers.provider.send("evm_mine");

                // Another user calls it (should succeed in new block)
                await loanIdMutex.connect(anotherUser).checkAndToggle(loanId);
                const block2 = await ethers.provider.getBlockNumber();
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(block2);
                expect(block2).to.be.greaterThan(block1);
            });
        });

        describe("stress test", function () {
            it("should handle many different loan IDs", async () => {
                const numLoans = 10;
                const loanIds = [];

                for (let i = 0; i < numLoans; i++) {
                    const loanId = ethers.utils.formatBytes32String(`loan${i}`);
                    loanIds.push(loanId);
                    await loanIdMutex.checkAndToggle(loanId);
                }

                // Verify all have non-zero block numbers
                for (const loanId of loanIds) {
                    const blockNum = await loanIdMutex.loanIdToBlockNumber(loanId);
                    expect(blockNum).to.be.greaterThan(0);
                }
            });

            it("should handle sequential operations across multiple blocks", async () => {
                const loanId = ethers.utils.formatBytes32String("loan1");
                const iterations = 5;
                const blockNumbers = [];

                for (let i = 0; i < iterations; i++) {
                    await loanIdMutex.checkAndToggle(loanId);
                    const blockNum = await ethers.provider.getBlockNumber();
                    blockNumbers.push(blockNum);

                    // Mine a new block before next iteration
                    await ethers.provider.send("evm_mine");
                }

                // Verify block numbers are increasing
                for (let i = 1; i < blockNumbers.length; i++) {
                    expect(blockNumbers[i]).to.be.greaterThan(blockNumbers[i - 1]);
                }
            });
        });

        describe("real-world loan ID format", function () {
            it("should work with realistic loan IDs", async () => {
                // Generate a realistic loan ID (keccak256 hash)
                const loanId = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["address", "address", "uint256"],
                        [owner.address, anotherUser.address, 12345]
                    )
                );

                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(0);
                await loanIdMutex.checkAndToggle(loanId);
                const currentBlock = await ethers.provider.getBlockNumber();
                expect(await loanIdMutex.loanIdToBlockNumber(loanId)).to.equal(currentBlock);
            });
        });
    });
});
