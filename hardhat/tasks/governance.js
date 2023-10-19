const csv = require("csv-parser");
const fs = require("fs");

const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const { delay } = require("../../deployment/helpers/helpers");

const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
    //await impersonateAccount(addressToImpersonate);
    //return await ethers.getSigner(addressToImpersonate);
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    console.log(
        "provider.getSigner(addressToImpersonate):",
        provider.getSigner(addressToImpersonate).address
    );
    return provider.getSigner(addressToImpersonate);
};

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

async function getVestingsOf(hre, address) {
    return await (await ethers.getContract("VestingRegistry")).getVestingsOf(address);
}

async function getCurrentVotingPower(hre, stakerAddress, governorDeploymentName, blockNumber) {
    const { ethers } = hre;
    const staking = await ethers.getContract("Staking");
    const governor = await ethers.getContract(governorDeploymentName);
    const sov = await ethers.getContract("SOV");
    let balance;
    let votingPower;
    let proposalThreshold;
    if (blockNumber == undefined) {
        balance = await sov.balanceOf(stakerAddress);
        votingPower = await staking.getCurrentVotes(stakerAddress);
        proposalThreshold = await governor.proposalThreshold();
    } else if (blockNumber) {
        const pastBlock = blockNumber * 1;
        balance = await sov.balanceOf(stakerAddress, { blockTag: pastBlock });
        votingPower = await staking.getCurrentVotes(stakerAddress, { blockTag: pastBlock });
        proposalThreshold = await governor.proposalThreshold({ blockTag: pastBlock });
    }

    return { stakerAddress, balance, votingPower, proposalThreshold };
}

async function createVestings(hre, path, multiplier, signerAcc) {
    /*
     * vested token sender script - takes addresses from the file by path
     * dryRun - true to check that the data will be processed correctly, false - execute distribution
     * multiplier - usually 10**16 considering the amount format should have 2 decimals
     */

    const { ethers } = hre;

    let signer;
    let signerAddress;
    if (ethers.utils.isAddress(signerAcc)) {
        signer = await getImpersonatedSignerFromJsonRpcProvider(signerAcc);
        signerAddress = signer._address;
    } else {
        signer = await ethers.getSigner((await hre.getNamedAccounts())[signerAcc]);
        signerAddress = signer.address;
    }

    const vestingRegistry = await ethers.getContract("VestingRegistry", signer);

    const staking = await ethers.getContract("Staking", signer);

    const SOVtoken = await ethers.getContract("SOV", signer);

    const DAY = 24 * 60 * 60;
    const FOUR_WEEKS = 4 * 7 * DAY;

    const balanceBefore = await ethers.provider.getBalance(signerAddress);
    let totalAmount = ethers.BigNumber.from(0);

    // amounts examples: "6,516.85", 1200.00, 912.92 - 2 decimals strictly!
    const data = await parseVestingsFile(ethers, path, multiplier);
    totalAmount = totalAmount.add(data.totalAmount);

    for (const teamVesting of data.teamVestingList) {
        const tokenOwner = teamVesting[0].toLowerCase();
        const amount = teamVesting[1];
        const cliff = parseInt(teamVesting[2]) * FOUR_WEEKS;
        const duration = parseInt(teamVesting[3]) * FOUR_WEEKS;
        const isTeam = Boolean(teamVesting[4]);
        console.log(
            "=============================================================================="
        );
        console.log("Processing vesting creation for", tokenOwner, "...");
        console.log("isTeam", isTeam);
        console.log("amount", amount.toString());
        console.log("cliff", cliff);
        console.log("duration", duration);
        console.log("(duration - cliff) / FOUR_WEEKS + 1", (duration - cliff) / FOUR_WEEKS + 1);

        let vestingCreationType = 0;
        if (teamVesting[3] === 10) {
            vestingCreationType = 3;
        } else if (teamVesting[3] === 26) {
            vestingCreationType = 1;
        } else if (teamVesting[3] === 39 || teamVesting[3] === 22) {
            vestingCreationType = 5;
            console.log("Make sure 3 year team 2 vesting split is really expected!");
        } else {
            console.log("ALERT!!!! ZERO VESTING CREATION TYPE FALLBACK!!!");
        }

        let vestingAddress;
        if (isTeam) {
            vestingAddress = await vestingRegistry.getTeamVesting(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
        } else {
            vestingAddress = await vestingRegistry.getVestingAddr(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
        }

        if (vestingAddress !== ethers.constants.AddressZero) {
            const vesting = await ethers.getContractAt("VestingLogic", vestingAddress);
            if (
                cliff.toString() !== (await vesting.cliff()).toString() ||
                duration.toString() !== (await vesting.duration()).toString()
            ) {
                throw new Error(
                    "Address already has team vesting contract with different schedule"
                );
            }
        }

        if (isTeam) {
            if (!dryRun) {
                console.log("Create or get Team Vesting...");
                await (
                    await vestingRegistry.createTeamVesting(
                        tokenOwner,
                        amount,
                        cliff,
                        duration,
                        vestingCreationType
                    )
                ).wait();
            }
            vestingAddress = await vestingRegistry.getTeamVesting(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
            console.log("TeamVesting: ", vestingAddress);
        } else {
            if (!dryRun) {
                console.log("Create or get Vesting contract...");
                await (
                    await vestingRegistry.createVestingAddr(
                        tokenOwner,
                        amount,
                        cliff,
                        duration,
                        vestingCreationType
                    )
                ).wait();
            }
            vestingAddress = await vestingRegistry.getVestingAddr(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
            console.log("Vesting: ", vestingAddress);
        }

        if (!dryRun) {
            if (vestingAddress === ethers.constants.AddressZero) {
                throw new Error("Vesting address is zero!");
            }
            if ((await SOVtoken.allowance(deployerAcc, vestingAddress)) < amount) {
                console.log(
                    "Approving amount",
                    amount.div(ethers.utils.parseEther("1")).toNumber(),
                    "to Vesting contract",
                    vestingAddress
                );
                await SOVtoken.approve(vestingAddress, amount);
                console.log("Approved:", amount.div(ethers.utils.parseEther("1")).toNumber());
            }

            console.log("Staking ...");
            const vesting = await ethers.getContractAt("VestingLogic", vestingAddress, signer);
            await (
                await vesting.stakeTokens(amount, {
                    gasLimit: 6800000,
                    gasPrice: 65e6,
                })
            ).wait();
        }

        const stakes = await staking.getStakes(vestingAddress);
        console.log("Stakes:");
        logger.warn(
            stakes.stakes.map((stake) => stake.div(ethers.constants.WeiPerEther).toString())
        );
        logger.warn(stakes.dates.map((date) => new Date(date.toNumber() * 1000)));
    }

    console.log("=======================================");
    console.log("SOV amount:");
    console.log(totalAmount / ethers.constants.WeiPerEther);

    const balanceAfter = await ethers.provider.getBalance(signerAddress);
    console.log("deployment cost:");
    console.log(balanceBefore.sub(balanceAfter) / ethers.constants.WeiPerEther);
}

async function parseVestingsFile(ethers, fileName, multiplier) {
    console.log(fileName);
    let totalAmount = ethers.BigNumber.from(0);
    const teamVestingList = [];
    let errorMsg = "";

    // Assuming you have the required CSV parsing library imported and set up
    // You may need to install a CSV parsing library like 'csv-parser' and import it accordingly
    return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(fileName)
            .pipe(csv({ headers: false }))
            .on("data", (row) => {
                data.push(row);
                console.log("reading row:", row[3]);
                const tokenOwner = row[3].replace(" ", "");
                const decimals = row[0].split(".");
                if (decimals.length !== 2 || decimals[1].length !== 2) {
                    errorMsg += "\n" + tokenOwner + " amount: " + row[0];
                }
                let amount = row[0].replace(",", "").replace(".", "");
                console.log("amount read:", amount);
                amount = ethers.BigNumber.from(amount).mul(ethers.BigNumber.from(multiplier));
                const cliff = parseInt(row[5]);
                const duration = parseInt(row[6]);
                const isTeam = row[7] === "OwnerVesting" ? false : true;
                totalAmount = totalAmount.add(amount);

                teamVestingList.push([tokenOwner, amount, cliff, duration, isTeam]);

                console.log("=======================================");
                console.log("'" + tokenOwner + "', ");
                console.log(amount);
            })
            .on("end", () => {
                if (errorMsg !== "") {
                    throw new Error("Formatting error: " + errorMsg);
                }
                resolve({
                    totalAmount: totalAmount,
                    teamVestingList: teamVestingList,
                });
            })
            .on("error", (error) => {
                reject(error);
            });
    });
}

task("governance:createVestings", "Create vestings")
    .addParam("path", "The file path")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ path, dryRun }, hre) => {
        const multiplier = (1e16).toString();
        await createVestings(hre, path, multiplier, signer);
    });

const VestingType = {
    TeamVesting: 5,
    Vesting: 1,
};

function calculateUid(tokenOwner, vestingCreationType, cliff, duration) {
    /*const uid = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint256", "uint256"],
            [tokenOwner.toLowerCase(), VestingType.Vesting, cliff, duration, vestingCreationType]
        )
    );*/

    const encodedData = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "uint256"],
        [tokenOwner, VestingType.Vesting, cliff, duration, vestingCreationType]
    );

    return ethers.BigNumber.from(encodedData);
}

async function createFourYearVestings(hre, path, signerAcc) {
    const {
        ethers,
        deployments: { get },
    } = hre;
    console.log(signerAcc);
    console.log(ethers.utils.isAddress(signerAcc));

    let signer;
    let signerAddress;
    if (ethers.utils.isAddress(signerAcc)) {
        signer = await getImpersonatedSignerFromJsonRpcProvider(signerAcc);
        signerAddress = signer._address;
    } else {
        signer = await ethers.getSigner((await hre.getNamedAccounts())[signerAcc]);
        signerAddress = signer.address;
    }

    const SOVtoken = await ethers.getContract("SOV", signer);

    const staking = await ethers.getContract("Staking", signer);

    const fourYearVestingFactory = await ethers.getContract("FourYearVestingFactory", signer);

    const MULTIPLIER = ethers.BigNumber.from(10).pow(16);
    const DAY = 24 * 60 * 60;
    const FOUR_WEEKS = 4 * 7 * DAY;
    const cliff = FOUR_WEEKS;
    const duration = 39 * FOUR_WEEKS;
    const vestingCreationType = 4;

    const balanceBefore = await ethers.provider.getBalance(signerAddress);
    console.log("SOV Balance Before:");
    console.log(
        (await SOVtoken.balanceOf(signerAddress)).div(ethers.constants.WeiPerEther).toString()
    );

    const data = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(path)
            .pipe(csv({ headers: false }))
            .on("data", (row) => {
                data.push(row);
            })
            .on("end", () => {
                resolve();
            })
            .on("error", (error) => {
                reject(error);
            });
    });

    const fourYearVestingLogicAddress = (await get("FourYearVestingLogic")).address;
    const vestingRegistry = await ethers.getContract("VestingRegistry", signer);
    const feeSharingAddress = (await get("FeeSharingCollector")).address;
    const multisigAddress = (await get("MultiSigWallet")).address;

    logger.warn(`SOVtoken.address: ${SOVtoken.address},`);
    logger.warn(`staking.address: ${staking.address},`);
    logger.warn(`feeSharingAddress: ${feeSharingAddress}`);
    logger.warn(`multisigAddress: ${multisigAddress}`);
    logger.warn(`fourYearVestingLogicAddress: ${fourYearVestingLogicAddress}`);
    console.log("=======================================");

    //const vestingsToRegister = [];
    //const tokenOwnersToRegister = [];

    const vestingsToRegister = {};
    const amounts = {};

    for (const row of data) {
        const tokenOwner = row[0].replace(" ", "");
        let amount = row[1].replace(",", "").replace(".", "");
        amount = ethers.BigNumber.from(amount).mul(MULTIPLIER);
        const extendDurationFor = row[2].replace(" ", "");

        const uid = calculateUid(
            tokenOwner.toLowerCase(),
            vestingCreationType.toString(),
            cliff,
            duration
        );
        let vestingAddress = (await vestingRegistry.vestings(uid)).vestingAddress;

        logger.warn(`vestingAddress: ${vestingAddress}`);
        logger.warn(`tokenOwner: ${tokenOwner}`);
        logger.warn(`extendDurationFor: ${extendDurationFor}`);

        if (vestingAddress === ethers.constants.AddressZero) {
            const tx = await fourYearVestingFactory.deployFourYearVesting(
                SOVtoken.address,
                staking.address,
                tokenOwner.toLowerCase(),
                feeSharingAddress,
                multisigAddress,
                fourYearVestingLogicAddress,
                extendDurationFor
            );
            const receipt = await tx.wait();
            vestingAddress = receipt.events.find(
                (event) => event.event === "FourYearVestingCreated"
            ).args.vestingAddress;
            logger.warning(`New 4 year vesting created: ${vestingAddress}`);
            vestingsToRegister[tokenOwner.toLowerCase()] = vestingAddress.toLowerCase();
            //tokenOwnersToRegister.push(tokenOwner);
        } else {
            logger.info(`Reusing 4 year vesting: ${vestingAddress}`);
        }
        amounts[vestingAddress.toLowerCase()] = amount;

        console.log("=======================================");
        console.log("Token Owner: ", tokenOwner);
        console.log("Vesting Contract Address: ", vestingAddress);
        console.log("Amount to stake: ", amount.toString());
    }

    if (Object.keys(vestingsToRegister).length > 0) {
        logger.info("Registering new vestings...");
        logger.warn(Object.keys(vestingsToRegister));
        logger.warn(Object.values(vestingsToRegister));
        await (
            await vestingRegistry.addFourYearVestings(
                Object.keys(vestingsToRegister),
                Object.values(vestingsToRegister)
            )
        ).wait();
        logger.info("New vestings registered");
    }

    for (const [vestingAddress, amount] of Object.entries(amounts)) {
        const fourYearVesting = await ethers.getContractAt(
            (
                await get("FourYearVestingLogic")
            ).abi,
            vestingAddress,
            signer
        );
        logger.info(
            `Approving amount ${amount
                .div(ethers.utils.parseEther("1"))
                .toNumber()} for vesting ${vestingAddress}`
        );
        await SOVtoken.approve(vestingAddress, amount);
        logger.info("Approved");

        let remainingAmount = amount;
        let lastSchedule = ethers.BigNumber.from(0);
        while (remainingAmount.gt(0)) {
            console.log("remainingAmount before:", remainingAmount.toString());

            await (
                await fourYearVesting.stakeTokens(remainingAmount, lastSchedule, {
                    gasLimit: 6800000,
                    gasPrice: 65e6,
                })
            ).wait();
            lastSchedule = await fourYearVesting.lastStakingSchedule();
            console.log("lastSchedule:", lastSchedule.toString());
            remainingAmount = await fourYearVesting.remainingStakeAmount();
            console.log("remainingAmount after:", remainingAmount.toString());
        }

        const stakes = await staking.getStakes(vestingAddress);
        console.log("Stakes:");
        logger.warn(
            stakes.stakes.map((stake) => stake.div(ethers.constants.WeiPerEther).toString())
        );
        logger.warn(stakes.dates.map((date) => new Date(date.toNumber() * 1000)));
    }

    console.log("SOV Balance After:");
    console.log((await SOVtoken.balanceOf(signerAddress)) / ethers.constants.WeiPerEther);

    const balanceAfter = await ethers.provider.getBalance(signerAddress);
    console.log("deployment cost:");
    console.log(balanceBefore.sub(balanceAfter) / ethers.constants.WeiPerEther);
}

task("governance:createFourYearVestings", "Create vestings")
    .addParam("path", "The file path")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    //.addOptionalParam("dryRun", "Dry run flag (default: true)", true, types.boolean)
    .setAction(async ({ path, signer }, hre) => {
        await createFourYearVestings(hre, path, signer);
    });

task("governance:getVestingsOf", "Get vesting contracts of an address")
    .addParam("address", "The address to get vestings of")
    .setAction(async ({ address }, hre) => {
        logger.warn(await getVestingsOf(hre, address));
    });

/*// Usage
    create4YUVestings().catch((error) => {
        console.error("Error:", error);
    });
    */
task("governance:currentVotingPower", "Get current voting power of a staker's address")
    .addParam("address", "The staker's address to get current voting power for")
    .addParam("governor", "GovernorOwner or GovernorAdmin", "GovernorOwner", types.string)
    .setAction(async ({ address, governor: governorDeploymentName }, hre) => {
        /*
    
        staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=interface.IStaking.abi, owner=acctAddress)
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acctAddress)
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acctAddress)
    balance = SOVtoken.balanceOf(acctAddress)

    votingPower = staking.getCurrentVotes(acctAddress)
    proposalThreshold = governor.proposalThreshold()

    print('=============================================================')
    print('Staker address:        '+str(acctAddress))
    print('Staker's SOV Balance:  '+str(balance))
    print('Staker's Voting Power:   '+str(votingPower))
    print('Proposal Threshold:  '+str(proposalThreshold))
    print('=============================================================')
    */
        //return { stakerAddress, balance, votingPower, proposalThreshold };
        const data = await getCurrentVotingPower(hre, address, governorDeploymentName);
        logger.warn(
            `
        Staker address: ${data.stakerAddress} 
        Balance: ${data.balance} 
        Voting power: ${data.votingPower} 
        Proposal threshold of ${governorDeploymentName}: ${data.proposalThreshold}
        ${
            data.proposalThreshold.gt(data.votingPower)
                ? `Staker VP lacks ${
                      data.proposalThreshold.sub(data.votingPower) / 1e18
                  } to create proposals`
                : "Staker has enough VP to create proposals"
        }
        VP/threshold: ${data.votingPower
            .mul(ethers.utils.parseEther("1"))
            .div(data.proposalThreshold)
            .div(ethers.utils.parseEther("0.01"))}%
        `
        );
    });

task("governance:getVotingPower", "Get current voting power of a staker's address")
    .addParam("address", "The staker's address to get current voting power for")
    .addParam("governor", "GovernorOwner or GovernorAdmin", "GovernorOwner", types.string)
    .addOptionalParam("pastBlock", "time travel to the given block number stage")
    .setAction(async ({ address, governor: governorDeploymentName, pastBlock }, hre) => {
        /*
    
        staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=interface.IStaking.abi, owner=acctAddress)
        governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acctAddress)
        SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acctAddress)
        balance = SOVtoken.balanceOf(acctAddress)

        votingPower = staking.getCurrentVotes(acctAddress)
        proposalThreshold = governor.proposalThreshold()

        print('=============================================================')
        print('Staker address:        '+str(acctAddress))
        print('Staker's SOV Balance:  '+str(balance))
        print('Staker's Voting Power:   '+str(votingPower))
        print('Proposal Threshold:  '+str(proposalThreshold))
        print('=============================================================')
        */
        //return { stakerAddress, balance, votingPower, proposalThreshold };
        const data = await getCurrentVotingPower(hre, address, governorDeploymentName, pastBlock);
        logger.warn(
            `
            Staker address: ${data.stakerAddress} 
            Balance: ${data.balance} 
            Voting power: ${data.votingPower} 
            Proposal threshold of ${governorDeploymentName}: ${data.proposalThreshold}
            ${
                data.proposalThreshold.gt(data.votingPower)
                    ? `Staker VP lacks ${
                          data.proposalThreshold.sub(data.votingPower) / 1e18
                      } to create proposals`
                    : "Staker has enough VP to create proposals"
            }
            VP/threshold: ${data.votingPower
                .mul(ethers.utils.parseEther("1"))
                .div(data.proposalThreshold)
                .div(ethers.utils.parseEther("0.01"))}%
            `
        );
    });
