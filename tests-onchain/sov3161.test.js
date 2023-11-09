// @todo run on a local forked rsk testnet or mainnet nodes
//  npx hardhat node --fork https://testnet.sovryn.app/rpc --no-deploy
//  npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
const Logs = require("node-logs");
const log = console.log;
const { expect } = require("chai");
const {
    loadFixture,
    impersonateAccount,
    stopImpersonatingAccount,
    mine,
    time,
    setBalance,
    setCode,
    takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const logger = new Logs().showInConsole(true);
const { decodeLogs } = require("../tests/Utils/initializer.js");

const {
    ethers,
    deployments,
    deployments: { createFixture, get, deploy },
    getNamedAccounts,
    network,
} = hre;

const oneEth = ethers.utils.parseEther("1.0");
const { AddressZero } = ethers.constants;
const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const emptyBytes32 = ethers.utils.hexZeroPad("0x", 32);
const LoanOpenings = artifacts.require("LoanOpenings");

const testnetUrl = "https://testnet.sovryn.app/rpc";
const mainnetUrl = "https://mainnet-dev.sovryn.app/rpc";

testnetData = {
    protocolOwner: "MultiSigWallet",
    url: testnetUrl,
    chainId: 31,
    //atBlock: 4418245,
    tokens: [],
};
mainnetData = {
    protocolOwner: "TimelockOwner",
    url: mainnetUrl,
    chainId: 30,
    //atBlock: 5749587, //5692524
    tokens: [],
};
const { url, chainId, atBlock, users, tokens, protocolOwner } = network.tags.mainnet
    ? mainnetData
    : testnetData;

// we need this if using named accounts in config
const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    return provider.getSigner(addressToImpersonate);
};

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

// QA Tests
describe("Check if Borrowing from existing loan using excessive collateral of the loan works", async () => {
    let snapshot, accounts, borrower, borrowerSigner, receiver, receiverSigner;
    let feeSharingCollectorProxy,
        feeSharingCollectorDeployment,
        feeSharingCollector,
        protocol,
        priceFeeds,
        XUSD,
        wRBTC;

    before(async () => {
        /*await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: url,
                        blockNumber: atBlock,
                    },
                },
            ],
        });*/
        accounts = await ethers.getSigners();
        borrowerSigner = accounts[1]; //(await get("MultiSigWallet")).address;
        borrower = borrowerSigner.address; //accounts[1]; //(await get("MultiSigWallet")).address;
        receiverSigner = accounts[1]; // (await get("MultiSigWallet")).address;
        receiver = receiverSigner.address; //accounts[1]; // (await get("MultiSigWallet")).address;

        deployResult = await deploy("LoanOpenings", {
            contract: "LoanOpenings",
            from: (await ethers.getSigners())[0].address,
        });

        snapshot = await takeSnapshot();
        const protocolOwnerAddress = (await get(protocolOwner)).address;
        ownerSigner = await getImpersonatedSignerFromJsonRpcProvider(protocolOwnerAddress);

        await setBalance(protocolOwnerAddress, ethers.utils.parseEther("5"));

        protocol = await ethers.getContract("ISovryn", ownerSigner);
        (await protocol.replaceContract(deployResult.address)).wait();

        priceFeeds = await ethers.getContract("PriceFeeds", ownerSigner);
        wRBTC = await ethers.getContract("WRBTC");
        XUSD = await ethers.getContract("XUSD");

        await wRBTC.connect(accounts[1]).deposit({ value: ethers.utils.parseEther("1") });

        // await deployments.fixture(["FeeSharingCollector"], {
        //     keepExistingDeployments: true,
        // });

        // await deployments.save("FeeSharingCollector", {
        //     address: feeSharingCollectorProxy.address,
        //     implementation: deployResult.address,
        //     abi: deployResult.abi,
        //     bytecode: deployResult.bytecode,
        //     deployedBytecode: deployResult.deployedBytecode,
        //     devdoc: deployResult.devdoc,
        //     userdoc: deployResult.userdoc,
        //     storageLayout: deployResult.storageLayout,
        // });

        // feeSharingCollector = await ethers.getContract("FeeSharingCollector");
    });

    after(async () => {
        await snapshot.restore();
    });

    it("Test increasing existing loan debt by borrowing with 0 collateral", async () => {
        // determine borrowing parameter
        const withdrawAmount = oneEth.mul(100); //borrow 100 USD
        const loanToken = await ethers.getContract("LoanToken_iXUSD");

        // compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
        let collateralTokenSent = await protocol.getRequiredCollateral(
            XUSD.address,
            wRBTC.address,
            withdrawAmount,
            ethers.utils.parseEther("50"), // <- minInitialMargin // new BN(10).pow(new BN(18)).mul(new BN(50)), //
            true
        );
        // console.log(
        //     `collateralTokenSent: required RBTC collateral to borrow 100 USD with 50% margin: ${collateralTokenSent}`
        // );

        const durationInSeconds = 60 * 60 * 24 * 10; //10 days
        // getDepositAmountForBorrow uses getRequiredCollateral, but adds borrowing fee first to calculate total principal amout for loan token
        collateralTokenSent = await loanToken.getDepositAmountForBorrow(
            withdrawAmount,
            durationInSeconds,
            wRBTC.address
        );

        // console.log(
        //     `getDepositAmountForBorrow: required RBTC collateral to borrow 100 USD with 50% margin: ${collateralTokenSent}`
        // );

        // console.log(
        //     `required RBTC collateral to borrow 100 USD using loanToken.getDepositAmountForBorrow for 10 days: ${collateralTokenSent}`
        // );

        const { rate: exchange_rate, precision } = await priceFeeds.queryRate(
            wRBTC.address,
            XUSD.address
        );
        // console.log(`ex rate: ${exchange_rate}`);

        // approve the transfer of the collateral
        await wRBTC.connect(borrowerSigner).approve(loanToken.address, collateralTokenSent.mul(2));

        // console.log("sender wrbtc balance: ", (await wRBTC.balanceOf(borrower)).toString());
        // console.log("collateral sent: ", collateralTokenSent.mul(2).toString());

        const receipt = await (
            await loanToken.connect(borrowerSigner).borrow(
                emptyBytes32, // bytes32 loanId
                withdrawAmount, // uint256 withdrawAmount
                durationInSeconds, // uint256 initialLoanDuration
                collateralTokenSent.mul(2), // uint256 collateralTokenSent
                wRBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                receiver, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            )
        ).wait();

        let decode = decodeLogs(receipt.events, LoanOpenings, "Borrow");
        const loanId = decode[0].args["loanId"];

        // console.log("loanId: ", loanId);
        // console.log("decode[0].args: ", decode[0].args);

        const maxDrawdown = await priceFeeds.getMaxDrawdown(
            XUSD.address,
            wRBTC.address,
            withdrawAmount, // decode[0].args["newPrincipal"],
            collateralTokenSent.mul(2), // decode[0].args["newCollateral"],
            ethers.utils.parseEther("50")
        );

        const borrowAmountForMaxDrawdown = await loanToken.getBorrowAmountForDeposit(
            maxDrawdown,
            durationInSeconds,
            wRBTC.address
        );

        const requiredCollateral = await loanToken.getDepositAmountForBorrow(
            borrowAmountForMaxDrawdown,
            durationInSeconds,
            wRBTC.address
        );

        const coef = requiredCollateral.mul(oneEth).div(maxDrawdown);
        const adjustedBorrowAmount = borrowAmountForMaxDrawdown.div(coef).mul(oneEth);

        // console.log(`maxDrawdown: ${maxDrawdown}`);
        // console.log(`borrowAmount for maxDrawdown: ${borrowAmountForMaxDrawdown}`);
        // console.log(`requiredCollateral for borrowAmount for maxDrawdown: ${requiredCollateral}`);
        // console.log(`coef = requiredCollateral.mul(oneEth).div(maxDrawdown): ${coef}`);
        // console.log(`adjustedBorrowAmount: ${adjustedBorrowAmount}`);

        // console.log(`
        //     borrowAmountForMaxDrawdown.mul(1012).div(1000): ${borrowAmountForMaxDrawdown
        //         .mul(1012)
        //         .div(1000)}`);

        await expectRevert(
            loanToken.connect(borrowerSigner).borrow(
                loanId, // bytes32 loanId
                borrowAmountForMaxDrawdown.mul(10115).div(10000), // uint256 withdrawAmount - less than 1.15% error tolerance
                durationInSeconds, // uint256 initialLoanDuration
                "0", // uint256 collateralTokenSent
                wRBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                receiver, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            ),
            "collateral insufficient"
        );

        const receipt2 = await (
            await loanToken.connect(borrowerSigner).borrow(
                loanId, // bytes32 loanId
                borrowAmountForMaxDrawdown, // uint256 withdrawAmount
                durationInSeconds, // uint256 initialLoanDuration
                "0", // uint256 collateralTokenSent
                wRBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                receiver, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            )
        ).wait();

        decode = decodeLogs(receipt2.events, LoanOpenings, "Borrow");
        const currentMargin = decode[0].args["currentMargin"];
        expect(
            ethers.BigNumber.from(currentMargin).gte(ethers.utils.parseEther("15")),
            "Invalid margin"
        ); // wei("15", "ether") - maintenance margin
    });

    it("Test increasing existing loan debt by borrowing collateral < required collateral", async () => {
        // determine borrowing parameter
        const withdrawAmount = oneEth.mul(100); //borrow 100 USD
        const loanToken = await ethers.getContract("LoanToken_iXUSD");

        let collateralTokenSent = await protocol.getRequiredCollateral(
            XUSD.address,
            wRBTC.address,
            withdrawAmount,
            ethers.utils.parseEther("50"), // <- minInitialMargin // new BN(10).pow(new BN(18)).mul(new BN(50)), //
            true
        );
        // console.log(
        //     `required RBTC collateral to borrow 100 USD with 50% margin: ${collateralTokenSent}`
        // );

        const durationInSeconds = 60 * 60 * 24 * 10; //10 days
        collateralTokenSent = await loanToken.getDepositAmountForBorrow(
            withdrawAmount,
            durationInSeconds,
            wRBTC.address
        );

        // console.log(
        //     `required RBTC collateral to borrow 100 USD using loanToken.getDepositAmountForBorrow for 10 days: ${collateralTokenSent}`
        // );

        const { rate: exchange_rate, precision } = await priceFeeds.queryRate(
            wRBTC.address,
            XUSD.address
        );
        // console.log(`ex rate: ${exchange_rate}`);

        // approve the transfer of the collateral
        await wRBTC.connect(borrowerSigner).approve(loanToken.address, collateralTokenSent.mul(5));

        // console.log("borrower balance:", await ethers.provider.getBalance(borrower));
        await setBalance(borrower, ethers.utils.parseEther("5"));
        // console.log("sender wrbtc balance: ", (await wRBTC.balanceOf(borrower)).toString());
        // console.log("collateral sent: ", collateralTokenSent.mul(2).toString());

        const receipt = await (
            await loanToken.connect(borrowerSigner).borrow(
                emptyBytes32, // bytes32 loanId
                withdrawAmount, // uint256 withdrawAmount
                durationInSeconds, // uint256 initialLoanDuration
                collateralTokenSent.mul(2), // uint256 collateralTokenSent
                wRBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                receiver, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            )
        ).wait();

        let decode = decodeLogs(receipt.events, LoanOpenings, "Borrow");
        const loanId = decode[0].args["loanId"];

        // console.log("loanId: ", loanId);
        // console.log("decode[0].args: ", decode[0].args);

        const newPrincipal = decode[0].args["newPrincipal"];
        const newCollateral = decode[0].args["newCollateral"];
        const maxDrawdown = await priceFeeds.getMaxDrawdown(
            XUSD.address,
            wRBTC.address,
            newPrincipal, //withdrawAmount,
            newCollateral, //collateralTokenSent.mul(2),
            ethers.utils.parseEther("50")
        );

        const borrowAmountForMaxDrawdown = await loanToken.getBorrowAmountForDeposit(
            maxDrawdown,
            durationInSeconds,
            wRBTC.address
        );

        const requiredCollateral = await loanToken.getDepositAmountForBorrow(
            borrowAmountForMaxDrawdown,
            durationInSeconds,
            wRBTC.address
        );

        // const coef = requiredCollateral.mul(oneEth).div(maxDrawdown);
        // const adjustedBorrowAmount = borrowAmountForMaxDrawdown.div(coef).mul(oneEth);

        // console.log(`maxDrawdown: ${maxDrawdown}`);
        // console.log(`borrowAmount for maxDrawdown: ${borrowAmountForMaxDrawdown}`);
        // console.log(
        //     `requiredCollateral for borrowAmount for maxDrawdown: ${requiredCollateral}`
        // );
        // console.log(`coef = requiredCollateral.mul(oneEth).div(maxDrawdown): ${coef}`);
        // console.log(`adjustedBorrowAmount: ${adjustedBorrowAmount}`);

        // approve the transfer of the collateral

        const receipt2 = await (
            await loanToken.connect(borrowerSigner).borrow(
                loanId, // bytes32 loanId
                borrowAmountForMaxDrawdown, // uint256 withdrawAmount
                durationInSeconds, // uint256 initialLoanDuration
                requiredCollateral.div(2), // uint256 collateralTokenSent
                wRBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                receiver, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            )
        ).wait();

        decode = decodeLogs(receipt2.events, LoanOpenings, "Borrow");
        const currentMargin = decode[0].args["currentMargin"];
        expect(
            ethers.BigNumber.from(currentMargin).gte(ethers.utils.parseEther("15")),
            "Invalid margin"
        ); // wei("15", "ether") - maintenance margin

        const postMaxDrawdown = await priceFeeds.getMaxDrawdown(
            XUSD.address,
            wRBTC.address,
            newPrincipal,
            newCollateral,
            ethers.utils.parseEther("50")
        );
        //console.log(`postMaxDrawdown: ${postMaxDrawdown}`);
        expect(postMaxDrawdown.eq(maxDrawdown.div(2)));
    });
});
