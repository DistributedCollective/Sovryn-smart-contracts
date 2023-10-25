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
const emptyBytes32 = ethers.utils.hexZeroPad('0x', 32);
const LoanOpenings = artifacts.require("LoanOpenings");

const testnetUrl = "https://testnet.sovryn.app/rpc";
const mainnetUrl = "https://mainnet-dev.sovryn.app/rpc";

testnetData = {
    url: testnetUrl,
    chainId: 31,
    atBlock: 4418245,
    tokens: [],
};
mainnetData = {
    url: mainnetUrl,
    chainId: 30,
    atBlock: 5749587,
    tokens: [],
};
const { url, chainId, atBlock, users, tokens } = network.tags.mainnet ? mainnetData : testnetData;

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
    let snapshot, multisigSigner;
    let feeSharingCollectorProxy, feeSharingCollectorDeployment, feeSharingCollector, protocol, priceFeeds, XUSD, wRBTC;

    before(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: url,
                        blockNumber: atBlock,
                    },
                },
            ],
        });
        snapshot = await takeSnapshot();

        deployerAddress = "0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E";
        deployerSigner = await getImpersonatedSignerFromJsonRpcProvider(
            deployerAddress.toLowerCase()
        );

        deployResult = await deploy("LoanOpenings", {
            contract: "LoanOpenings",
            from: (await ethers.getSigners())[0].address,
        });

        multisigSigner = await getImpersonatedSignerFromJsonRpcProvider((await get("MultiSigWallet")).address);

        protocol = await ethers.getContract("ISovryn", multisigSigner);
        (await protocol.replaceContract(deployResult.address)).wait();

        priceFeeds = await ethers.getContract("PriceFeeds", multisigSigner);
        wRBTC = await ethers.getContract("WRBTC");
        XUSD = await ethers.getContract("XUSD")

        await wRBTC.connect(multisigSigner).deposit({value: ethers.utils.parseEther("1")})
        
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
        // @todo
        // use deployments to get loan tokens
        // borrow from existing lending pools providing 2x collateral
        // move forward - use mine() like here https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/SOV-3161-increasing-borrowing-debt-bug/tests-onchain/sip0063.test.js#L132
        // get borrowAmountForMaxDrawdown and borrow this amount, log maxDrawdown and borrowAmountForMaxDrawdown divided by 1e18 to console and their ratio: borrowAmountForMaxDrawdown/maxDrawdown

        // prepare the test

        // determine borrowing parameter
        const withdrawAmount = oneEth.mul(100); //borrow 100 USD
        const loanToken = await ethers.getContract("LoanToken_iXUSD");

        // compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
        let collateralTokenSent = await protocol.getRequiredCollateral(
            XUSD.address,
            wRBTC.address,
            withdrawAmount,
            ethers.utils.parseEther("20"), // <- minInitialMargin // new BN(10).pow(new BN(18)).mul(new BN(50)), //
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

        console.log(
            `required RBTC collateral to borrow 100 USD using loanToken.getDepositAmountForBorrow for 10 days: ${collateralTokenSent}`
        );

        const { rate: exchange_rate, precision } = await priceFeeds.queryRate(
            wRBTC.address,
            XUSD.address
        );
        // console.log(`ex rate: ${exchange_rate}`);

        // approve the transfer of the collateral
        await wRBTC.connect(multisigSigner).approve(loanToken.address, collateralTokenSent.mul(2));
        const borrower = (await get("MultiSigWallet")).address;
        const receiver = (await get("MultiSigWallet")).address;

        console.log("sender wrbtc balance: ", (await wRBTC.balanceOf(borrower)).toString());
        console.log("collateral sent: ", (collateralTokenSent.mul(2).toString()));

        const borrowTx = await loanToken.connect(multisigSigner).borrow(
            emptyBytes32, // bytes32 loanId
            withdrawAmount, // uint256 withdrawAmount
            durationInSeconds, // uint256 initialLoanDuration
            collateralTokenSent.mul(2), // uint256 collateralTokenSent
            wRBTC.address, // address collateralTokenAddress
            borrower, // address borrower
            receiver, // address receiver
            emptyBytes32 // bytes memory loanDataBytes
        );
        const receipt = await borrowTx.wait();

        let decode = decodeLogs(receipt.events, LoanOpenings, "Borrow");
        const loanId = decode[0].args["loanId"];
        

        const maxDrawdown = await priceFeeds.getMaxDrawdown(
            XUSD.address,
            wRBTC.address,
            withdrawAmount,
            collateralTokenSent.mul(2),
            ethers.utils.parseEther("20")
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

        await expectRevert(
            loanToken.connect(multisigSigner).borrow(
                loanId, // bytes32 loanId
                borrowAmountForMaxDrawdown.mul(1009000).div(1000000), // uint256 withdrawAmount - less than 0.9% error tolerance
                durationInSeconds, // uint256 initialLoanDuration
                "0", // uint256 collateralTokenSent
                wRBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                receiver, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            ),
            "collateral insufficient"
        );

        const { receipt: receipt2 } = await loanToken.connect(multisigSigner).borrow(
            loanId, // bytes32 loanId
            borrowAmountForMaxDrawdown, // uint256 withdrawAmount
            durationInSeconds, // uint256 initialLoanDuration
            "0", // uint256 collateralTokenSent
            wRBTC.address, // address collateralTokenAddress
            borrower, // address borrower
            receiver, // address receiver
            emptyBytes32 // bytes memory loanDataBytes
        );

        decode = decodeLogs(receipt2.events, LoanOpenings, "Borrow");
        const currentMargin = decode[0].args["currentMargin"];
        expect(ethers.BigNumber.from(currentMargin).gte(ethers.utils.parseEther("15")), "Invalid margin"); // wei("15", "ether") - maintenance margin
    });

    it("Test increasing existing loan debt by borrowing collateral < required collateral", async () => {
        // prepare the test

        await lend_to_pool(loanToken, SUSD, owner);
        await set_demand_curve(loanToken);

        // determine borrowing parameter
        const withdrawAmount = oneEth.mul(new BN(100)); // I want to borrow 100 USD
        // compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
        let collateralTokenSent = await sovryn.getRequiredCollateral(
            SUSD.address,
            RBTC.address,
            withdrawAmount,
            wei("20", "ether"), // <- minInitialMargin // new BN(10).pow(new BN(18)).mul(new BN(50)), //
            true
        );
        // console.log(
        //     `required RBTC collateral to borrow 100 USD with 50% margin: ${collateralTokenSent}`
        // );

        const durationInSeconds = 60 * 60 * 24 * 10; //10 days
        collateralTokenSent = await loanToken.getDepositAmountForBorrow(
            withdrawAmount,
            durationInSeconds,
            RBTC.address
        );

        // console.log(
        //     `required RBTC collateral to borrow 100 USD using loanToken.getDepositAmountForBorrow for 10 days: ${collateralTokenSent}`
        // );

        const { rate: exchange_rate, precision } = await priceFeeds.queryRate(
            RBTC.address,
            SUSD.address
        );
        // console.log(`ex rate: ${exchange_rate}`);

        // approve the transfer of the collateral
        await RBTC.approve(loanToken.address, collateralTokenSent.mul(2));
        const borrower = accounts[0];

        const { receipt } = await loanToken.borrow(
            emptyBytes32, // bytes32 loanId
            withdrawAmount, // uint256 withdrawAmount
            durationInSeconds, // uint256 initialLoanDuration
            collateralTokenSent.mul(2), // uint256 collateralTokenSent
            RBTC.address, // address collateralTokenAddress
            borrower, // address borrower
            account1, // address receiver
            emptyBytes32 // bytes memory loanDataBytes
        );

        let decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Borrow");
        // console.log(decode);
        const loanId = decode[0].args["loanId"];

        const maxDrawdown = await priceFeeds.getMaxDrawdown(
            SUSD.address,
            RBTC.address,
            withdrawAmount,
            collateralTokenSent.mul(2),
            wei("20", "ether")
        );

        const borrowAmountForMaxDrawdown = await loanToken.getBorrowAmountForDeposit(
            maxDrawdown,
            durationInSeconds,
            RBTC.address
        );

        const requiredCollateral = await loanToken.getDepositAmountForBorrow(
            borrowAmountForMaxDrawdown,
            durationInSeconds,
            RBTC.address
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
        await expectRevert(
            loanToken.borrow(
                loanId, // bytes32 loanId
                borrowAmountForMaxDrawdown.mul(1.009), // uint256 withdrawAmount - less than 0.9% error tolerance
                durationInSeconds, // uint256 initialLoanDuration
                new BN(0), // uint256 collateralTokenSent
                RBTC.address, // address collateralTokenAddress
                borrower, // address borrower
                account1, // address receiver
                emptyBytes32 // bytes memory loanDataBytes
            ),
            "collateral insufficient"
        );

        await RBTC.approve(loanToken.address, requiredCollateral.divn(2));
        const { receipt: receipt2 } = await loanToken.borrow(
            loanId, // bytes32 loanId
            borrowAmountForMaxDrawdown, // uint256 withdrawAmount
            durationInSeconds, // uint256 initialLoanDuration
            requiredCollateral.divn(2), // uint256 collateralTokenSent
            RBTC.address, // address collateralTokenAddress
            borrower, // address borrower
            account1, // address receiver
            emptyBytes32 // bytes memory loanDataBytes
        );

        decode = decodeLogs(receipt2.rawLogs, LoanOpenings, "Borrow");
        const currentMargin = decode[0].args["currentMargin"];
        expect(ethers.BigNumber.from(currentMargin).gte(wei("15", "ether")), "Invalid margin"); // wei("15", "ether") - maintenance margin
        //console.log(decode);

        const postMaxDrawdown = await priceFeeds.getMaxDrawdown(
            SUSD.address,
            RBTC.address,
            withdrawAmount,
            collateralTokenSent.mul(2),
            wei("20", "ether")
        );
        //console.log(`postMaxDrawdown: ${postMaxDrawdown}`);
        expect(postMaxDrawdown.eq(maxDrawdown.divn(2)));
    });
});
