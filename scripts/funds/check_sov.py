from brownie import *

import calendar
import time
import json

def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)

    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    adoptionFund = Contract.from_abi("DevelopmentFund", address=contracts['AdoptionFund'], abi=DevelopmentFund.abi, owner=acct)
    developmentFund = Contract.from_abi("DevelopmentFund", address=contracts['DevelopmentFund'], abi=DevelopmentFund.abi, owner=acct)
    governorVaultOwner = Contract.from_abi("GovernorVault", address=contracts['GovernorVaultOwner'], abi=GovernorVault.abi, owner=acct)
    governorVaultAdmin = Contract.from_abi("GovernorVault", address=contracts['GovernorVaultAdmin'], abi=GovernorVault.abi, owner=acct)

    DECIMALS = 10**18

    print("TimelockOwner:", contracts['TimelockOwner'])
    print("TimelockAdmin:", contracts['TimelockAdmin'])
    print("adoptionFund.unlockedTokenOwner:", adoptionFund.unlockedTokenOwner())
    print("developmentFund.unlockedTokenOwner:", developmentFund.unlockedTokenOwner())
    print("governorVaultOwner.owner:", governorVaultOwner.owner())
    print("governorVaultAdmin.owner:", governorVaultAdmin.owner())
    print("===============================================")
    print("governorVaultOwner:", SOVtoken.balanceOf(governorVaultOwner.address) / DECIMALS)
    print("governorVaultAdmin:", SOVtoken.balanceOf(governorVaultAdmin.address) / DECIMALS)

    now = calendar.timegm(time.gmtime())
    # print(now)

    adoptionLastReleaseTime = adoptionFund.lastReleaseTime()
    adoptionReleaseDuration = adoptionFund.getReleaseDuration()[::-1]
    adoptionReleaseTokenAmount = adoptionFund.getReleaseTokenAmount()[::-1]
    adoptionAmount = 0
    for i in range(len(adoptionReleaseDuration)):
        releaseTime = adoptionReleaseDuration[i]
        releaseValue = adoptionReleaseTokenAmount[i]
        if (now >= adoptionLastReleaseTime + releaseTime):
            adoptionLastReleaseTime += releaseTime
            adoptionAmount += releaseValue
    print("adoptionFund:", adoptionAmount / DECIMALS)

    developmentLastReleaseTime = developmentFund.lastReleaseTime()
    developmentReleaseDuration = developmentFund.getReleaseDuration()[::-1]
    developmentReleaseTokenAmount = developmentFund.getReleaseTokenAmount()[::-1]
    developmentAmount = 0
    for i in range(len(developmentReleaseDuration)):
        releaseTime = developmentReleaseDuration[i]
        releaseValue = developmentReleaseTokenAmount[i]
        if (now >= developmentLastReleaseTime + releaseTime):
            developmentLastReleaseTime += releaseTime
            developmentAmount += releaseValue
    print("developmentFund:", developmentAmount / DECIMALS)


# function withdrawTokensByUnlockedTokenOwner(uint256 _amount) public onlyUnlockedTokenOwner checkStatus(Status.Active) {
# TimelockOwner -> multisig: SOV.transfer(multisig, amount)

# 2082.84375 × 32 = 66651
# 6250 * 32 = 200000
# 12.799423076923076923 * 22 = 281.587307692 | 67.287692307692307692 * 22 = 1480.329230769 | 39.890769230769230769 = 1801.807307692
# total revoked: 268452.807307692
