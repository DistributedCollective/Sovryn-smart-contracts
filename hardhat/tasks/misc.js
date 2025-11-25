const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");

const parseEthersLog = (parsed) => {
    let parsedEvent = {};
    for (let i = 0; i < parsed.args.length; i++) {
        const input = parsed.eventFragment.inputs[i];
        const arg = parsed.args[i];
        const newObj = { ...input, ...{ value: arg } };
        parsedEvent[input["name"]] = newObj;
    }
    return parsedEvent;
};

const getEthersLog = async (contract, filter) => {
    if (contract === undefined || filter === undefined) return;
    const events = await contract.queryFilter(filter);
    if (events.length === 0) return;
    let parsedEvents = [];
    for (let event of events) {
        const ethersParsed = contract.interface.parseLog(event);
        const customParsed = parseEthersLog(ethersParsed);
        parsedEvents.push(customParsed);
    }
    return parsedEvents;
};

task("VestingStakeSet-event", "get transactions with VestingStakeSet event emitted").setAction(
    async (taskArgs, hre) => {
        const {
            deployments: { deploy, get, log },
            getNamedAccounts,
            ethers,
        } = hre;
        const staking = await ethers.getContractAt(
            "IStaking",
            "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e"
        );
        //const abi = (await deployments.getArtifact("Staking")).abi;
        const abi = ["event VestingStakeSet(uint256,uint96)"];
        //const abi = ["event TokensStaked(address,uint256,uint256,uint256)"];
        const iface = new ethers.utils.Interface(abi);
        //const filter = staking.filters.VestingStakeSet(null, null);
        //cblock = 3780053; // a block with the first vesting created
        cblock = 5190053; // a block with the first vesting created
        block = await ethers.provider.getBlockNumber();
        let index = 0;
        while (cblock != block) {
            cblock += 10000;
            if (cblock > block) cblock = block;
            const filter = {
                address: "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e",
                topics: [
                    //ethers.utils.id("TokensStaked(address,uint256,uint256,uint256)")
                    ethers.utils.id("VestingStakeSet(uint256,uint96)"),
                ],
                fromBlock: cblock - 10000,
                toBlock: cblock,
            };
            let cres = [];

            try {
                cres = await ethers.provider.getLogs(filter);
            } catch (e) {
                console.log(e);
                console.log("failure at block", cblock);
                return;
            }
            //console.log(await getEthersLog(staking, filter));
            if (cres[0]) {
                console.log("index: ", index++, "\n", cres);
                //break;
            }
            if (cblock % 500000 == 0) {
                console.log(cblock, "block reached");
            }
        }
    }
);

const getImpersonatedSigner = async (addressToImpersonate) => {
    await impersonateAccount(addressToImpersonate);
    return await ethers.getSigner(addressToImpersonate);
};

const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
    //await impersonateAccount(addressToImpersonate);
    //return await ethers.getSigner(addressToImpersonate);
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    return provider.getSigner(addressToImpersonate);
};

task("misc:forkedchain:fundAccount", "Fund an account for a forked chain")
    .addParam("account", "account to fund")
    .addParam("amount", "amount to fund in BTC")
    .addOptionalParam("token", "'RBTC' or token name, default: 'SOV'", "SOV")
    .setAction(async ({ account, amount, token }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        if (!hre.network.tags["forked"]) {
            logger.error("Can run only on a forked network");
        }
        const accountAddress = ethers.utils.isAddress(account)
            ? account
            : (await hre.getNamedAccounts())[account];

        if (!ethers.utils.isAddress(accountAddress)) {
            throw Error("Invalid account to fund!");
        }

        if (token === "RBTC") {
            await setBalance(accountAddress, ethers.utils.parseEther(amount));
            logger.success(`RBTC balance: ${await ethers.provider.getBalance(accountAddress)}`);
        } else {
            const tokenContract = ethers.utils.isAddress(token)
                ? await ethers.getContractAt("SOV", token)
                : await ethers.getContract(token);

            const signer = await getImpersonatedSignerFromJsonRpcProvider(
                await tokenContract.owner()
            );
            // console.log("signer:", signer);
            // console.log("await tokenContract.owner():", await tokenContract.owner());
            await setBalance(signer._address, ethers.utils.parseEther("1.0"));

            await tokenContract
                .connect(signer)
                .mint(accountAddress, ethers.utils.parseEther(amount));
            logger.success(
                `Token (${
                    tokenContract.address
                }) user's (${accountAddress}) balance: ${await tokenContract.balanceOf(
                    accountAddress
                )}`
            );
        }
    });

task(
    "misc:roles:check-authorities",
    "Reports owner/admin roles for Sovryn, PriceFeeds and the configured loan tokens"
)
    .addOptionalParam("sovryn", "Sovryn protocol address or deployment name", "SovrynProtocol")
    .addOptionalParam("priceFeeds", "PriceFeeds address or deployment name", "PriceFeeds")
    .addOptionalParam(
        "loanTokens",
        "Comma-separated loan token deployment names or addresses",
        "LoanToken_iXUSD,LoanToken_iRBTC,LoanToken_iBPRO,LoanToken_iDOC,LoanToken_iDLLR,LoanToken_iUSDT"
    )
    .setAction(async ({ sovryn, priceFeeds, loanTokens }, hre) => {
        const { ethers, deployments } = hre;

        const resolveAddress = async (value) => {
            if (ethers.utils.isAddress(value)) {
                return ethers.utils.getAddress(value);
            }
            const deployment = await deployments.get(value);
            return deployment.address;
        };

        const prettyLog = (label, entries) => {
            console.log(`\n${label}`);
            for (const [k, v] of Object.entries(entries)) {
                console.log(`- ${k}: ${v}`);
            }
        };

        const sovrynAddress = await resolveAddress(sovryn);
        const sovrynContract = await ethers.getContractAt("ISovryn", sovrynAddress);
        const sovrynOwner = await sovrynContract.owner();
        let sovrynAdmin = "<unavailable>";
        try {
            sovrynAdmin = await sovrynContract.getAdmin();
        } catch (e) {
            logger &&
                logger.warn &&
                logger.warn("getAdmin() call failed on Sovryn, leaving admin as unavailable");
        }
        prettyLog("Sovryn protocol", {
            address: sovrynAddress,
            owner: sovrynOwner,
            admin: sovrynAdmin,
        });

        const priceFeedsAddress = await resolveAddress(priceFeeds);
        const priceFeedsContract = await ethers.getContractAt("PriceFeeds", priceFeedsAddress);
        const priceFeedsOwner = await priceFeedsContract.owner();
        prettyLog("PriceFeeds", {
            address: priceFeedsAddress,
            owner: priceFeedsOwner,
        });

        const loanTokenEntries = loanTokens.split(",");
        for (const entry of loanTokenEntries) {
            const loanTokenAddress = await resolveAddress(entry.trim());
            const loan = await ethers.getContractAt("LoanTokenLogicStandard", loanTokenAddress);
            const owner = await loan.owner();
            const admin = await loan.admin();
            prettyLog(`Loan token ${entry.trim()}`, {
                address: loanTokenAddress,
                owner,
                admin,
            });
        }
    });

task("misc:forkedchain:addVestingRegistryAdmin", "Adds VR admin")
    .addParam("account", "account to fund")
    .setAction(async ({ account }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        if (!hre.network.tags["forked"]) {
            logger.error("Can run only on a forked network");
        }
        const accountAddress = ethers.utils.isAddress(account)
            ? account
            : (await hre.getNamedAccounts())[account];

        if (!ethers.utils.isAddress(accountAddress)) {
            throw Error("Invalid account to add as admin!");
        }

        const multisigDeployment = await get("MultiSigWallet");
        const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(
            await multisigDeployment.address
        );

        const vestingRegistry = await ethers.getContract("VestingRegistry", multisigSigner);
        await vestingRegistry.addAdmin(accountAddress);
        const isAdmin = await vestingRegistry.admins(accountAddress);
        if (isAdmin) {
            logger.success(`Account (${accountAddress}) is VestingRegistry admin`);
        } else {
            logger.error(`Failed to add account (${accountAddress}) to VestingRegistry admins`);
        }
    });

task("misc:forkedchain:vestingStake", "Stakes from vesting contract")
    .addParam("vesting", "Vesting contract address")
    .addParam("account", "Vesting contract receiver account")
    .addParam("amount", "Amount to stake from vesting")
    .setAction(async ({ vesting, account, amount }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        if (!hre.network.tags["forked"]) {
            logger.error("Can run only on a forked network");
        }
        const accountAddress = ethers.utils.isAddress(account)
            ? account
            : (await hre.getNamedAccounts())[account];

        const accountSigner = await getImpersonatedSignerFromJsonRpcProvider(accountAddress);

        if (!ethers.utils.isAddress(accountAddress)) {
            throw Error("Invalid account to add as admin!");
        }

        logger.info("Staking...");
        const vestingContract = await ethers.getContractAt("VestingLogic", vesting, accountSigner);
        await vestingContract.stakeTokens(ethers.utils.parseEther(amount));
        logger.info("Staking completed");
        const staking = await ethers.getContractAt(
            "IStaking",
            "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e"
        );
        logger.warning(await staking.getStakes(vesting));
    });

task(
    "misc:pricefeed:get-oracle",
    "Prints the feed address registered for a token in PriceFeeds and tries to read its underlying oracle"
)
    .addParam("token", "Token address or deployment name")
    .addOptionalParam("priceFeeds", "PriceFeeds address or deployment name", "PriceFeeds")
    .setAction(async ({ token, priceFeeds }, hre) => {
        const { ethers, deployments } = hre;

        const resolveAddress = async (value) => {
            if (ethers.utils.isAddress(value)) {
                return ethers.utils.getAddress(value);
            }
            const deployment = await deployments.get(value);
            return deployment.address;
        };

        const tokenAddress = await resolveAddress(token);
        const priceFeedsAddress = await resolveAddress(priceFeeds);
        const pf = await ethers.getContractAt("PriceFeeds", priceFeedsAddress);
        const feed = await pf.pricesFeeds(tokenAddress);

        console.log("PriceFeeds:", priceFeedsAddress);
        console.log("Token:", tokenAddress);
        console.log("Feed:", feed);

        if (feed === ethers.constants.AddressZero) {
            console.log("Result: no feed set for this token.");
            return;
        }

        const tryRead = async (label, getter) => {
            try {
                const v = await getter();
                console.log(`- ${label}: ${v}`);
            } catch (e) {
                // ignore failures for non-matching ABIs
            }
        };

        await tryRead("rskOracleAddress", async () =>
            (await ethers.getContractAt("PriceFeedRSKOracle", feed)).rskOracleAddress()
        );
        await tryRead("mocOracleAddress", async () =>
            (await ethers.getContractAt("PriceFeedsMoC", feed)).mocOracleAddress()
        );
        await tryRead("v1PoolOracleAddress", async () =>
            (await ethers.getContractAt("PriceFeedV1PoolOracle", feed)).v1PoolOracleAddress()
        );
        await tryRead("oracle", async () => (await ethers.getContractAt("Oracle", feed)).oracle());
        await tryRead("priceProvider", async () =>
            (await ethers.getContractAt("Medianizer", feed)).priceProvider()
        );
        await tryRead("aggregator", async () =>
            (await ethers.getContractAt("AggregatorV3Interface", feed)).aggregator()
        );
    });

task(
    "misc:loan:check-collateral",
    "Checks if a collateral token is enabled on a loan token (Torque or margin) and prints the loan params"
)
    .addParam("loanToken", "Loan token address or deployment name")
    .addParam("collateral", "Collateral token address")
    .addOptionalParam(
        "sovryn",
        "Sovryn protocol address (defaults to loanToken.sovrynContractAddress())"
    )
    .addOptionalParam(
        "isTorque",
        "true to check borrow/Torque params, false to check margin params",
        true,
        boolean
    )
    .setAction(async ({ loanToken, collateral, sovryn, isTorque }, hre) => {
        const { ethers, deployments } = hre;

        const resolveAddress = async (value) => {
            if (ethers.utils.isAddress(value)) {
                return ethers.utils.getAddress(value);
            }
            const deployment = await deployments.get(value);
            return deployment.address;
        };

        const loanTokenAddress = await resolveAddress(loanToken);
        const collateralAddress = ethers.utils.getAddress(collateral);

        const loan = await ethers.getContractAt("LoanTokenLogicStandard", loanTokenAddress);
        const key = ethers.utils.solidityKeccak256(
            ["address", "bool"],
            [collateralAddress, isTorque]
        );

        const loanParamsId = await loan.loanParamsIds(key);
        console.log("loanToken:", loanTokenAddress);
        console.log("collateral:", collateralAddress);
        console.log("isTorque:", isTorque);
        console.log("loanParamsId:", loanParamsId);

        if (loanParamsId === ethers.constants.HashZero) {
            console.log("Result: collateral is NOT enabled for this loan token and mode.");
            return;
        }

        const sovrynAddress = sovryn
            ? await resolveAddress(sovryn)
            : await loan.sovrynContractAddress();
        const sovrynProtocol = await ethers.getContractAt("ISovryn", sovrynAddress);
        const params = await sovrynProtocol.getLoanParams([loanParamsId]);
        const p = params[0];

        console.log("Result: collateral is ENABLED. LoanParams:");
        console.log({
            id: p.id,
            active: p.active,
            owner: p.owner,
            loanToken: p.loanToken,
            collateralToken: p.collateralToken,
            minInitialMargin: p.minInitialMargin.toString(),
            maintenanceMargin: p.maintenanceMargin.toString(),
            maxLoanTerm: p.maxLoanTerm.toString(),
        });
    });

// Usage:
// hh misc:loan:check-collateral-all --collateral <tokenAddress> --network rskSovrynMainnet
// Loops through iXUSD, iRBTC, iBPro, iDOC and prints if the collateral is enabled for Torque and margin.
task(
    "misc:loan:check-collateral-all",
    "Checks if a collateral token is enabled on all mainnet loan tokens (Torque and margin)"
)
    .addParam("collateral", "Collateral token address")
    .setAction(async ({ collateral }, hre) => {
        const { ethers, deployments } = hre;

        const loanTokenDeployments = [
            "LoanToken_iXUSD",
            "LoanToken_iRBTC",
            "LoanToken_iBPRO",
            "LoanToken_iDOC",
            "LoanToken_iDLLR",
        ];

        const collateralAddress = ethers.utils.getAddress(collateral);

        const resolveAddress = async (nameOrAddress) => {
            if (ethers.utils.isAddress(nameOrAddress)) {
                return ethers.utils.getAddress(nameOrAddress);
            }
            const deployment = await deployments.get(nameOrAddress);
            return deployment.address;
        };

        for (const depName of loanTokenDeployments) {
            const loanTokenAddress = await resolveAddress(depName);
            const loan = await ethers.getContractAt("LoanTokenLogicStandard", loanTokenAddress);
            const sovryn = await ethers.getContractAt(
                "ISovryn",
                await loan.sovrynContractAddress()
            );

            console.log(`\nLoan token: ${depName} (${loanTokenAddress})`);
            for (const isTorque of [true, false]) {
                const key = ethers.utils.solidityKeccak256(
                    ["address", "bool"],
                    [collateralAddress, isTorque]
                );
                const loanParamsId = await loan.loanParamsIds(key);

                const modeLabel = isTorque ? "Torque (borrow)" : "Margin";
                if (loanParamsId === ethers.constants.HashZero) {
                    console.log(`- ${modeLabel}: NOT enabled`);
                    continue;
                }

                const params = await sovryn.getLoanParams([loanParamsId]);
                const p = params[0];
                console.log(`- ${modeLabel}: ENABLED ->`, {
                    id: p.id,
                    active: p.active,
                    owner: p.owner,
                    loanToken: p.loanToken,
                    collateralToken: p.collateralToken,
                    minInitialMargin: p.minInitialMargin.toString(),
                    maintenanceMargin: p.maintenanceMargin.toString(),
                    maxLoanTerm: p.maxLoanTerm.toString(),
                });
            }
        }
    });

task("getBalanceOfAccounts", "Get ERC20 or native token balance of account or address")
    .addPositionalParam(
        "accounts",
        "Address(es) or named account(s) contract name(s) to get balance of: 'deployer' or 'MultiSigWallet,deployer,0x542fda317318ebf1d3deaf76e0b632741a7e677d'"
    )
    .addOptionalParam(
        "tokens",
        "'RBTC' or ERC20 token name(s) or address(es) e.g. 'SOV' or 'SOV,RBTC,0x542fda317318ebf1d3deaf76e0b632741a7e677d', default: 'RBTC'",
        "RBTC"
    )
    .addOptionalParam("decimals", "Return decimal or int amount?", true, types.boolean)
    .setAction(async ({ accounts, decimals, tokens }, hre) => {
        const { ethers } = hre;

        const tokensArray = tokens.split(",");
        for (let token of tokensArray) {
            const accountsArray = accounts.split(",");
            for (let account of accountsArray) {
                const accountAddressLowerCase = account.toLowerCase();
                let accountAddress = ethers.utils.isAddress(accountAddressLowerCase)
                    ? accountAddressLowerCase
                    : (await hre.getNamedAccounts())[account];

                accountAddress = ethers.utils.isAddress(accountAddress)
                    ? accountAddress
                    : (await ethers.getContract(account)).address;

                if (!ethers.utils.isAddress(accountAddress)) {
                    throw Error("Invalid account to get balance of!");
                }

                if (token === "RBTC" || token === "ETH") {
                    const balance = await ethers.provider.getBalance(accountAddress);
                    logger.success(
                        `${token} balance of the account ${account} (${accountAddress}): 
                        ${balance / (decimals ? 1e18 : 1)} ${decimals ? "(" + balance + ")" : ""}`
                    );
                } else {
                    const tokenContract = ethers.utils.isAddress(token)
                        ? await ethers.getContractAt(
                              "contracts/interfaces/IERC20.sol:IERC20",
                              token
                          )
                        : await ethers.getContract(token);
                    const tokenSymbol = await tokenContract.symbol();
                    const decimalsDivider = ethers.BigNumber.from(decimals ? 10 : 1).pow(
                        await tokenContract.decimals()
                    );
                    const balance = await tokenContract.balanceOf(accountAddress);
                    logger.success(
                        `${tokenSymbol} (${
                            tokenContract.address
                        }) balance of the account ${account} (${accountAddress}): 
                        ${balance / decimalsDivider} (${balance})`
                    );
                }
            }
        }
    });
