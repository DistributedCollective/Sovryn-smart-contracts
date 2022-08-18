'''
Implements SOV distribution via vesting contracts
'''
from scripts.contractInteraction.contract_interaction_imports  import *
import csv

def createVestings(path, dryRun, multiplier):
    '''
    vested token sender script - takes addresses from the file by path
    dryRun - true to check that the data will be processed correctly, false - execute distribution
    multiplier - usually 10**16 considering the amount format should have 2 decimals
    '''

    vestingRegistry = Contract.from_abi("VestingRegistryLogic", address=conf.contracts['VestingRegistryProxy'], abi=VestingRegistryLogic.abi, owner=conf.acct)

    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=conf.Staking.abi, owner=conf.acct)
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    balanceBefore = conf.acct.balance()
    totalAmount = 0

    # amounts examples: "6,516.85", 912.92 - 2 decimals strictly!
    data = parseFile(path, multiplier)
    totalAmount += data["totalAmount"]

    for teamVesting in data["teamVestingList"]:
        tokenOwner = teamVesting[0]
        amount = int(teamVesting[1])
        cliff = int(teamVesting[2]) * FOUR_WEEKS
        duration = int(teamVesting[3]) * FOUR_WEEKS
        isTeam = bool(teamVesting[4])
        print("==============================================================================")
        print("Processing vesting creation for", tokenOwner,"...")
        # print('tokenOwner:', tokenOwner)
        print('isTeam', isTeam)
        print('amount', amount)
        print('cliff', cliff)
        print('duration', duration)
        print('(duration - cliff) / FOUR_WEEKS + 1', (duration - cliff) / FOUR_WEEKS + 1)

        if teamVesting[3] == 10:
            vestingCreationType = 3
        elif teamVesting[3] == 26:
            vestingCreationType = 1
        elif teamVesting[3] == 39:
            vestingCreationType = 4
            print("Make sure 4 year vesting is really expected!")
        else:
            vestingCreationType = 0
            print("ALERT!!!! ZERO VESTING CREATION TYPE FALLBACK!!!")

        if isTeam:
            vestingAddress = vestingRegistry.getTeamVesting(tokenOwner, cliff, duration, vestingCreationType)
        else:
            vestingAddress = vestingRegistry.getVestingAddr(tokenOwner, cliff, duration, vestingCreationType)
        if (vestingAddress != "0x0000000000000000000000000000000000000000"):
            vestingLogic = Contract.from_abi("VestingLogic", address=vestingAddress, abi=VestingLogic.abi, owner=conf.acct)
            if (cliff != vestingLogic.cliff() or duration != vestingLogic.duration()):
                raise Exception("Address already has team vesting contract with different schedule")
        if isTeam:
            if(not dryRun):
                print('Create or get Team Vesting...')
                vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration, vestingCreationType)
            vestingAddress = vestingRegistry.getTeamVesting(tokenOwner, cliff, duration, vestingCreationType)
            print("TeamVesting: ", vestingAddress)
        else:
            if(not dryRun):
                print('Create or get Vesting contract...')
                vestingRegistry.createVestingAddr(tokenOwner, amount, cliff, duration, vestingCreationType)
            vestingAddress = vestingRegistry.getVestingAddr(tokenOwner, cliff, duration, vestingCreationType)
            print("Vesting: ", vestingAddress)
        
        if(not dryRun):
            if(vestingAddress == ZERO_ADDRESS):
                raise Exception('Vesting address is zero!')
            if(SOVtoken.allowance(conf.acct, vestingAddress) < amount):
                print('Approving amount', amount, 'to Vesting contract', vestingAddress)
                SOVtoken.approve(vestingAddress, amount)
                print('Approved:', amount)
            print('Staking ...')
            vesting = Contract.from_abi("Vesting", address=vestingAddress, abi=VestingLogic.abi, owner=conf.acct)
            vesting.stakeTokens(amount)

        stakes = staking.getStakes(vestingAddress)
        print("Stakes:")
        print(stakes)

    print("=======================================")
    print("SOV amount:")
    print(totalAmount / 10**18)

    print("deployment cost:")
    print((balanceBefore - conf.acct.balance()) / 10**18)


def parseFile(fileName, multiplier):
    print(fileName)
    totalAmount = 0
    teamVestingList = []
    errorMsg = ''
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[3].replace(" ", "")
            decimals = row[0].split('.')
            if(len(decimals) != 2 or len(decimals[1]) != 2):
                errorMsg+="\n" + tokenOwner + ' amount: ' + row[0]
            amount = row[0].replace(",", "").replace(".", "")
            amount = int(amount) * multiplier
            cliff = int(row[5])
            duration = int(row[6])
            isTeam = True
            if (row[7] == "OwnerVesting"):
                isTeam = False
            totalAmount += amount

            teamVestingList.append([tokenOwner, amount, cliff, duration, isTeam])

            print("=======================================")
            print("'" + tokenOwner + "', ")
            print(amount)

    if(errorMsg != ''):
        raise Exception('Formatting error: ' + errorMsg)
    return {
               "totalAmount": totalAmount,
               "teamVestingList": teamVestingList,
            }
