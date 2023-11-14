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

task("getBalanceOf", "Get ERC20 or native token balance of an account or address")
    .addParam(
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
                let accountAddress = ethers.utils.isAddress(account)
                    ? account
                    : (await hre.getNamedAccounts())[account];
                accountAddress = ethers.utils.isAddress(accountAddress)
                    ? accountAddress
                    : (await ethers.getContract(account)).address;

                if (!ethers.utils.isAddress(accountAddress)) {
                    throw Error("Invalid account to get balance of!");
                }

                if (token === "RBTC") {
                    const balance = await ethers.provider.getBalance(accountAddress);
                    logger.success(
                        `RBTC balance of the account ${account} (${accountAddress}): 
                        ${balance / (decimals ? 1e18 : 1)}`
                    );
                } else {
                    const tokenContract = ethers.utils.isAddress(token)
                        ? await ethers.getContractAt("IERC20", token)
                        : await ethers.getContract(token);
                    const tokenSymbol = await tokenContract.symbol();
                    const decimalsDivider = ethers.BigNumber.from(decimals ? 10 : 1).pow(
                        await tokenContract.decimals()
                    );
                    const balance = await tokenContract.balanceOf(accountAddress);
                    logger.success(
                        `${tokenSymbol} (${
                            tokenContract.address
                        }) balance of the user ${account} (${accountAddress}): 
                        ${balance / decimalsDivider}`
                    );
                }
            }
        }
    });
