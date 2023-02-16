from scripts.contractInteraction.contract_interaction_imports  import *
import csv

def main():
    '''
    Register vesting addresses vestingCreationAndTypes storage
    brownie run scripts/contractInteraction/tasks/register_vesting_creation_and_types.py --network testnet
    brownie run scripts/contractInteraction/tasks/register_vesting_creation_and_types.py --network rsk-mainnet
    '''

    vestingRegistry = Contract.from_abi("VestingRegistryLogic", address=conf.contracts['VestingRegistryProxy'], abi=VestingRegistryLogic.abi, owner=conf.acct)

    data = parseFile('./scripts/deployment/distribution/team_vesting_list.csv')
    limitChunk = 50

    vestings = data['vestingAddresses']
    durations = data['durations']
    
    finalVestings = []
    finalCreationAndTypeDetails = []
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    for idx, vesting in enumerate(vestings):
        if(vestingRegistry.isVesting(vesting) == True):
            print("Registering vesting: ", vesting)
            finalVestings.append(vesting)
            if (durations[idx] / FOUR_WEEKS == 10):
                vestingCreationType = 3
            elif (durations[idx] / FOUR_WEEKS == 26):
                vestingCreationType = 1
            elif (durations[idx] / FOUR_WEEKS == 39):
                vestingCreationType = 4
            else:
                vestingCreationType = 0
            finalCreationAndTypeDetails.append([True, 0, vestingCreationType])

    chunkedVestings = list(divide_chunks(finalVestings, limitChunk))
    chunkedCreationAndTypeDetails = list(divide_chunks(finalCreationAndTypeDetails, limitChunk))

    for idx, chunkedVesting in enumerate(chunkedVestings):
        registerVestingToVestingCreationAndTypes(chunkedVesting, chunkedCreationAndTypeDetails[idx])

def parseFile(fileName):
    print(fileName)
    vestingAddresses = []
    durations = []
    errorMsg = ''
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            vestingAddresses.append(row[0])
            durations.append(int(row[4]))

    if(errorMsg != ''):
        raise Exception('Formatting error: ' + errorMsg)
    
    return {
        "vestingAddresses": vestingAddresses,
        "durations": durations,
    }


def divide_chunks(l, n):
    # looping till length l
    for i in range(0, len(l), n):
        yield l[i:i + n]