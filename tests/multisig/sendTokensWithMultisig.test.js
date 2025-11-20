/**
 * Test for sendTokensWithMultisig helper function
 * Tests the multisig token transfer functionality
 */

const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;
const wei = web3.utils.toWei;

const MultiSigWallet = artifacts.require("MultiSigWallet");
const TestToken = artifacts.require("TestToken");

contract("sendTokensWithMultisig:", (accounts) => {
    let root, account1, account2, account3, account4, recipient;
    let multiSig;
    let testToken;

    async function deploymentAndInitFixture(_wallets, _provider) {
        multiSig = await MultiSigWallet.new([account1, account2, account3], 2);
        testToken = await TestToken.new("TestToken", "TST", 18, wei("1000000", "ether"));
        
        // Transfer some tokens to the multisig wallet
        await testToken.transfer(multiSig.address, wei("100000", "ether"));
        
        // Send some ETH to the multisig wallet
        await multiSig.send(wei("10", "ether"));
    }

    before(async () => {
        [root, account1, account2, account3, account4, recipient, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("ERC20 Token Transfer via Multisig", () => {
        it("Should submit ERC20 token transfer transaction when sender is owner", async () => {
            const transferAmount = wei("1000", "ether");
            const recipientBalanceBefore = await testToken.balanceOf(recipient);
            
            // Encode ERC20 transfer function call
            const erc20Interface = new web3.eth.Contract(
                [{ "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }],
                ZERO_ADDRESS
            );
            const data = erc20Interface.methods.transfer(recipient, transferAmount).encodeABI();
            
            // Submit transaction as owner
            const tx = await multiSig.submitTransaction(testToken.address, 0, data, { from: account1 });
            expectEvent(tx, "Submission");
            
            // Get transaction ID from event
            const txId = tx.logs.find(log => log.event === "Submission").args.transactionId;
            
            // Confirm transaction by second owner
            await multiSig.confirmTransaction(txId, { from: account2 });
            
            // Verify transfer was executed
            const recipientBalanceAfter = await testToken.balanceOf(recipient);
            expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.be.bignumber.equal(new BN(transferAmount));
        });

        it("Should encode correct data for ERC20 token transfer", async () => {
            const transferAmount = wei("1000", "ether");
            
            // Encode ERC20 transfer function call
            const erc20Interface = new web3.eth.Contract(
                [{ "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }],
                ZERO_ADDRESS
            );
            const data = erc20Interface.methods.transfer(recipient, transferAmount).encodeABI();
            
            // Submit transaction
            const tx = await multiSig.submitTransaction(testToken.address, 0, data, { from: account1 });
            const txId = tx.logs.find(log => log.event === "Submission").args.transactionId;
            
            // Check transaction details
            const txDetails = await multiSig.transactions(txId);
            expect(txDetails.destination).to.equal(testToken.address);
            expect(txDetails.value).to.be.bignumber.equal(new BN(0));
            expect(txDetails.data).to.equal(data);
        });
    });

    describe("Native Token (Gas Token) Transfer via Multisig", () => {
        it("Should submit native token transfer transaction when sender is owner", async () => {
            const transferAmount = wei("1", "ether");
            const recipientBalanceBefore = new BN(await web3.eth.getBalance(recipient));
            
            // Submit transaction for native token transfer
            const tx = await multiSig.submitTransaction(recipient, transferAmount, "0x", { from: account1 });
            expectEvent(tx, "Submission");
            
            // Get transaction ID from event
            const txId = tx.logs.find(log => log.event === "Submission").args.transactionId;
            
            // Confirm transaction by second owner
            await multiSig.confirmTransaction(txId, { from: account2 });
            
            // Verify transfer was executed
            const recipientBalanceAfter = new BN(await web3.eth.getBalance(recipient));
            expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.be.bignumber.equal(new BN(transferAmount));
        });

        it("Should encode correct data for native token transfer", async () => {
            const transferAmount = wei("1", "ether");
            
            // Submit transaction
            const tx = await multiSig.submitTransaction(recipient, transferAmount, "0x", { from: account1 });
            const txId = tx.logs.find(log => log.event === "Submission").args.transactionId;
            
            // Check transaction details
            const txDetails = await multiSig.transactions(txId);
            expect(txDetails.destination).to.equal(recipient);
            expect(txDetails.value).to.be.bignumber.equal(new BN(transferAmount));
            expect(txDetails.data).to.equal("0x");
        });
    });

    describe("Owner Check", () => {
        it("Should correctly identify if an address is an owner", async () => {
            expect(await multiSig.isOwner(account1)).to.be.true;
            expect(await multiSig.isOwner(account2)).to.be.true;
            expect(await multiSig.isOwner(account3)).to.be.true;
            expect(await multiSig.isOwner(account4)).to.be.false;
            expect(await multiSig.isOwner(recipient)).to.be.false;
        });
    });

    describe("Multiple Token Transfers", () => {
        it("Should handle multiple token transfers in sequence", async () => {
            const transferAmount1 = wei("100", "ether");
            const transferAmount2 = wei("200", "ether");
            
            // First transfer
            const erc20Interface = new web3.eth.Contract(
                [{ "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }],
                ZERO_ADDRESS
            );
            const data1 = erc20Interface.methods.transfer(recipient, transferAmount1).encodeABI();
            
            const tx1 = await multiSig.submitTransaction(testToken.address, 0, data1, { from: account1 });
            const txId1 = tx1.logs.find(log => log.event === "Submission").args.transactionId;
            await multiSig.confirmTransaction(txId1, { from: account2 });
            
            // Second transfer
            const data2 = erc20Interface.methods.transfer(account4, transferAmount2).encodeABI();
            
            const tx2 = await multiSig.submitTransaction(testToken.address, 0, data2, { from: account1 });
            const txId2 = tx2.logs.find(log => log.event === "Submission").args.transactionId;
            await multiSig.confirmTransaction(txId2, { from: account2 });
            
            // Verify both transfers
            const recipientBalance = await testToken.balanceOf(recipient);
            const account4Balance = await testToken.balanceOf(account4);
            
            expect(recipientBalance).to.be.bignumber.equal(new BN(transferAmount1));
            expect(account4Balance).to.be.bignumber.equal(new BN(transferAmount2));
        });
    });
});
