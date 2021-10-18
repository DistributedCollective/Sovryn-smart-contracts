
'''
This script serves the purpose of interacting with governance (SIP) on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time

def main():

    # Load the contracts and acct depending on the network.
    loadConfig()

    balanceBefore = acct.balance()

    # Call the function you want here
    currentVotingPower(acct)

    #createProposalSIP0020()
    #createProposalSIP0019()

    # createProposalSIP0024()

    createProposalSIP0030()

    balanceAfter = acct.balance()

    print("=============================================================")
    print("RSK Before Balance:  ", balanceBefore)
    print("RSK After Balance:   ", balanceAfter)
    print("Gas Used:            ", balanceBefore - balanceAfter)
    print("=============================================================")

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)

def hasApproval(tokenContractAddr, sender, receiver):
    tokenContract = Contract.from_abi("Token", address=tokenContractAddr, abi=TestToken.abi, owner=sender)
    allowance = tokenContract.allowance(sender, receiver)
    print("Allowance: ", allowance/1e18)
    
def checkIfUserHasToken(tokenAddr, user):
    tokenContract = Contract.from_abi("Token", address=tokenAddr, abi=TestToken.abi, owner=user)
    balance = tokenContract.balanceOf(user)
    print("Token Balance: ", balance)

def currentVotingPower(acctAddress):

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acctAddress)
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acctAddress)
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acctAddress)
    balance = SOVtoken.balanceOf(acctAddress)

    votingPower = staking.getCurrentVotes(acctAddress)
    proposalThreshold = governor.proposalThreshold()

    print('=============================================================')
    print('Your Address:        '+str(acctAddress))
    print('Your Token Balance:  '+str(balance))
    print('Your Voting Power:   '+str(votingPower))
    print('Proposal Threshold:  '+str(proposalThreshold))
    print('=============================================================')

def queueProposal(id):
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acct)
    tx = governor.queue(id)
    tx.info()

def executeProposal(id):
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acct)
    tx = governor.execute(id)
    tx.info()

def createProposal(governorAddr, target, value, signature, data, description):
    governor = Contract.from_abi("GovernorAlpha", address=governorAddr, abi=GovernorAlpha.abi, owner=acct)

    print('=============================================================')
    print('Governor Address:    '+governor.address)
    print('Target:              '+str(target))
    print('Values:              '+str(value))
    print('Signature:           '+str(signature))
    print('Data:                '+str(data))
    print('Description:         '+str(description))
    print('=============================================================')

    # Create Proposal
    # tx = governor.propose(target, value, signature, data, description)
    # tx.info()

def createProposalSIP0005():
    dummyAddress = contracts['GovernorOwner']
    dummyContract = Contract.from_abi("DummyContract", address=dummyAddress, abi=DummyContract.abi, owner=acct)

    # Action
    target = [contracts['VestingRegistry']]
    value = [0]
    signature = ["approveTokens(address,address,address)"]
    data = dummyContract.approveTokens.encode_input(contracts['CSOV1'], contracts['CSOV2'], contracts['SOV'])
    data = ["0x" + data[10:]]
    description = "SIP-0005: Redeeming cSOV for SOV. Details:  , sha256: "

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0006():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["name()"]
    data = ["0x"]
    description = "SIP-0006 (A1): Origin Pre-Sale: Amendment 1, Details: https://github.com/DistributedCollective/SIPS/blob/92036332c739d39e2df2fb15a21e8cbc05182ee7/SIP-0006(A1).md, sha256: 5f832f8e78b461d6d637410b55a66774925756489222f8aa13b37f1828a1aa4b"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0008():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0008: Sovryn Bug Bounty Program, Details: https://github.com/DistributedCollective/SIPS/blob/a8cf098d21e5d4b0357906687374a4320c4f00bd/SIP-0008.md, sha256: a201aa8d031e5c95d4a63cc86758adb1e4a65f6a0a915eb7499d0cac332e75ba"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0014():
    # 1,500,000 SOV
    amount = 1500000 * 10**18
    governorVault = Contract.from_abi("GovernorVault", address=contracts['GovernorVaultOwner'], abi=GovernorVault.abi, owner=acct)

    # Action
    target = [contracts['GovernorVaultOwner']]
    value = [0]
    signature = ["transferTokens(address,address,uint256)"]
    data = governorVault.transferTokens.encode_input(contracts['multisig'], contracts['SOV'], amount)
    data = ["0x" + data[10:]]
    description = "SIP-0014: Strategic Investment, Details: https://github.com/DistributedCollective/SIPS/blob/7b90ebcb4e135b931210b3cea22698084de9d641/SIP-0014.md, sha256: 780d4db45ae09e30516ad11b0332f68a101775ed418f68f1aaf1af93e37e519f"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0015():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0015: Sovryn Treasury Management, Details: https://github.com/DistributedCollective/SIPS/blob/977d1ebf73f954071ffd8a787c2660c41e069e0f/SIP-0015.md, sha256: c5cdd1557f9637816c2fb2ae4ac847ffba1eacd4599488bcda793b7945798ddf"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0016():

    staking = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)

    # Action
    target = [contracts['Staking']]
    value = [0]
    signature = ["setImplementation(address)"]
    data = staking.setImplementation.encode_input(contracts['StakingLogic2'])
    data = ["0x" + data[10:]]
    description = "SIP-0016: Proposal to upgrade Staking contract - apply fix to unlock Origin Vesting contracts, Details: https://github.com/DistributedCollective/SIPS/blob/128a524ec5a8aa533a3dbadcda115acc71c86182/SIP-0016.md, sha256: 666f8a71dae650ba9a3673bad82ae1524fe486c9e6702a75d9a566b743497d73"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0017():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["name()"]
    data = ["0x"]
    description = "SIP-0017: Money on Chain's MOC Listing and Incentivization Strategy, Details: https://github.com/DistributedCollective/SIPS/blob/6e577af/SIP-0017.md, sha256: 2bb188713390b56aced2209095843e2465328ab6ff97c0439d2c918d8386efc0"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0018():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0018: BabelFish Token Sale via Origins, Details: https://github.com/DistributedCollective/SIPS/blob/f8a726d/SIP-0018.md, sha256: 75df76b1e7b2a5c1cdf1192e817573f3794afbd47c19bf85abda04f222a12ecb"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0019():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["name()"]
    data = ["0x"]
    description = "SIP-0019: Exchequer Committee 2021 Budget, Details: https://github.com/DistributedCollective/SIPS/blob/2a3c5a7/SIP-0019.md, sha256: dfc958c3e84e7bbfb7d8f3e944fbd73ebc8f05dabd6fdd16b8c2884607c52b88"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0020():

    staking = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)
    stakingLogic = Contract.from_abi("StakingLogic3", address=contracts['StakingLogic3'], abi=Staking.abi, owner=acct)

    # Action
    targets = [contracts['Staking'], contracts['Staking']]
    values = [0, 0]
    signatures = ["setImplementation(address)", "addAdmin(address)"]
    data1 = staking.setImplementation.encode_input(contracts['StakingLogic3'])
    data2 = stakingLogic.addAdmin.encode_input(contracts['multisig'])
    datas = ["0x" + data1[10:], "0x" + data2[10:]]
    description = "SIP-0020: Staking contract updates, Details: https://github.com/DistributedCollective/SIPS/blob/91ea9de/SIP-0020.md, sha256: c1d39606ef53067d55b3e8a05a266918fa7bad09ecc2c1afcef7c68b2eac3cd0"

    # Create Proposal
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0024():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["name()"]
    data = ["0x"]
    description = "SIP-0024: Liquid SOV Incentive Rewards for Fully Vested Stakers: https://github.com/DistributedCollective/SIPS/blob/5fcbcac9e7/SIP-0024.md, sha256: 05065938663108381afc1d30d97a0144d83fe15e53b8be79f4c0cec088ec1321"

    # Create Proposal
    # createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0030():
    # TODO StakingLogic4 should be deployed
    # TODO FeeSharingProxy2 should be deployed
    # TODO VestingRegistryProxy should be deployed

    stakingProxy = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)
    stakingImpl = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)

    # Action
    targets = [contracts['Staking'], contracts['Staking'], contracts['Staking']]
    values = [0, 0, 0]
    signatures = ["setImplementation(address)", "setFeeSharing(address)", "setVestingRegistry(address)"]
    data1 = stakingProxy.setImplementation.encode_input(contracts['StakingLogic4'])
    data2 = stakingImpl.setFeeSharing.encode_input(contracts['FeeSharingProxy'])
    data3 = stakingImpl.setVestingRegistry.encode_input(contracts['VestingRegistryProxy'])
    datas = ["0x" + data1[10:], "0x" + data2[10:], "0x" + data3[10:]]
    description = "SIP-30: Concentrating staking revenues, Details: https://github.com/DistributedCollective/SIPS/blob/12bdd48/SIP-30.md, sha256: 8f7f95545d968dc4d9a37b9cad4228b562c76b7617c2740b221b1f70eb367620"

    print(datas)
    print(description)

    # Create Proposal
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)
