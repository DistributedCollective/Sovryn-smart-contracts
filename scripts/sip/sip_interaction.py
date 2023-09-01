
'''
This script serves the purpose of interacting with governance (SIP) on the testnet or mainnet.
'''

from curses import keyname
from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time
from scripts.utils import * 
#import scripts.contractInteraction.config as conf

def main():

    # Load the contracts and acct depending on the network.
    loadConfig()

    balanceBefore = acct.balance()

    # Shows the current voting power
    # currentVotingPower(acct)

    # Call the function you want here

    createProposalSIP0060()
    #createProposalSIP0050()

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
    elif thisNetwork == "testnet-pub":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet-dev":
        acct = accounts.load("rskdeployerdev")
        print("acct:", acct)
        configFile = open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("proposer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "rsk-mainnet-ws":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "rsk-mainnet-websocket":
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

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=interface.IStaking.abi, owner=acctAddress)
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
    tx = governor.propose(target, value, signature, data, description)
    tx.info()

def cancelProposal(type, proposalId): 
    # type == 'GovernorOwner' or 'GovernorAdmin'; proposalId - proposal ordered number
    governor = Contract.from_abi("GovernorAlpha", address=contracts[type], abi=GovernorAlpha.abi, owner=acct)
    data = governor.cancel.encode_input(proposalId)
    if governor.guardian() == contracts['multisig']:
        sendWithMultisig(contracts['multisig'], governor.address, data, acct)
    else:
        raise Exception("Guardian address is not multisig")

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
    stakingLogic = Contract.from_abi("StakingLogic3", address=contracts['StakingLogic3'], abi=interface.IStaking.abi, owner=acct)

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
    # TODO FeeSharingCollectorProxy2 should be deployed
    # TODO VestingRegistryProxy should be deployed

    stakingProxy = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)
    stakingImpl = Contract.from_abi("Staking", address=contracts['Staking'], abi=interface.IStaking.abi, owner=acct)

    # Action
    targets = [contracts['Staking'], contracts['Staking'], contracts['Staking']]
    values = [0, 0, 0]
    signatures = ["setImplementation(address)", "setFeeSharing(address)", "setVestingRegistry(address)"]
    data1 = stakingProxy.setImplementation.encode_input(contracts['StakingLogic4'])
    data2 = stakingImpl.setFeeSharing.encode_input(contracts['FeeSharingCollectorProxy'])
    data3 = stakingImpl.setVestingRegistry.encode_input(contracts['VestingRegistryProxy'])
    datas = ["0x" + data1[10:], "0x" + data2[10:], "0x" + data3[10:]]
    description = "SIP-30: Concentrating staking revenues, Details: https://github.com/DistributedCollective/SIPS/blob/12bdd48/SIP-30.md, sha256: 8f7f95545d968dc4d9a37b9cad4228b562c76b7617c2740b221b1f70eb367620"

    print(datas)
    print(description)

    # Create Proposal
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0035():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["name()"]
    data = ["0x"]
    description = "SIP-0035: Origins as a Subprotocol: https://github.com/DistributedCollective/SIPS/blob/04baceb/SIP-0035.md, sha256: 1f85180a76c58a2b382049e5f846c512a61b3459d193dc74c7eb3babf89bd1ba"

    # Create Proposal
    # createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0037():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0037: The Sovryn Mynt: https://github.com/DistributedCollective/SIPS/blob/8bd786c/SIP-0037.md, sha256: 35904333545f2df983173e5e95a31020fbc2e3922a70f23e5bae94ee94194a3e"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0038():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0038: Add Brazilian Real Stablecoin BRZ as Collateral: https://github.com/DistributedCollective/SIPS/blob/a216843/SIP-0038.md, sha256: d57ba8bea41e73ce00d9e25b2a6d1736db2f6bbba7ffa43c6ab3d23eae8bb15e"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0039():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0039: ZERO Token Sale via Origins: https://github.com/DistributedCollective/SIPS/blob/2c21291/SIP-0039.md, sha256: 558dc035b9915e5900b0367252ba88114ea8c821b21ec0aadc5dea8b73fcd506"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0031():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0031: Splitting AMM fees with stakers: https://github.com/DistributedCollective/SIPS/blob/344e4f1/SIP-31.md, sha256: 9a9058f6420842fffb25112c54634f950a16e119247e17550b25197e3fccc7fb"

    # Create Proposal
    # createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)


def createProposalSIP0041():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0041: Designation of Exchequer Committee Multisig, Details: https://github.com/DistributedCollective/SIPS/blob/34a23a4fcecb54d19325adc2c56e6471a60caea3/SIP-0041.md, sha256: 934fc32850ac7096e88fbe2b981250527d6ddba78b01f5e191202c8043b840cb"

    # Create Proposal
    # createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0042():

    staking = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)
    stakingLogic = Contract.from_abi("StakingLogic5", address=contracts['StakingLogic5'], abi=interface.IStaking.abi, owner=acct)

    # Action
    targets = [contracts['Staking'], contracts['Staking']]
    values = [0, 0]
    signatures = ["setImplementation(address)", "addPauser(address)"]
    data1 = staking.setImplementation.encode_input(contracts['StakingLogic5'])
    data2 = stakingLogic.addPauser.encode_input(contracts['multisig'])
    datas = ["0x" + data1[10:], "0x" + data2[10:]]
    description = "SIP-0042: Staking Security Update, Details: https://github.com/DistributedCollective/SIPS/blob/7c1a44b/SIP-0042.md, sha256: 522e1e65c49ec028d81c3a1f94a47354c2f6287c2d90c6eec8f06dcc17a1ebcc"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0043():

    staking = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)

    # Action
    targets = [contracts['Staking']]
    values = [0]
    signatures = ["setImplementation(address)"]
    data = staking.setImplementation.encode_input(contracts['StakingLogic6'])
    datas = ["0x" + data[10:]]
    description = "SIP-0043 : Critical governance bug fix, Details: https://github.com/DistributedCollective/SIPS/blob/bdd346e/SIP-0043.md, sha256: 7a99f0862208d77e54f30f3c3759ca1d7efe9d1d1ec7df1ef1f83c649aa651a4"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0044():

    staking = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)

    # Action
    targets = [contracts['Staking']]
    values = [0]
    signatures = ["setImplementation(address)"]
    data = staking.setImplementation.encode_input(contracts['StakingLogic7'])
    datas = ["0x" + data[10:]]
    description = "SIP-0044 : Staking contract hardening against multiple attack vectors, Details: https://github.com/DistributedCollective/SIPS/blob/f883810/SIP-0044.md, sha256: 6d18d5438480e269d88c4021a2b6e1ed92e5447cc0a7198c3d6d0c98e7772246"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0048():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0048: Sovryn Strategic Investment Proposal : https://github.com/DistributedCollective/SIPS/blob/5a9b213/SIP-0048.md, sha256: 0d159814e12132caf36391ab3faa24e90174bbeeaf84449909a8b716e964267f"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

def createProposalSIP0049():

    stakingProxy = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)
    stakingModulesProxy = Contract.from_abi("StakingModulesProxy", address=contracts['Staking'], abi=ModulesProxy.abi, owner=acct)

    #TODO: set modules addresses in the addresses .json
    moduleAddresses = { 
        'StakingAdminModule': contracts['StakingAdminModule'],
        'StakingGovernanceModule': contracts['StakingGovernanceModule'],
        'StakingStakeModule': contracts['StakingStakeModule'],
        'StakingStorageModule': contracts['StakingStorageModule'],
        'StakingVestingModule': contracts['StakingVestingModule'],
        'StakingWithdrawModule': contracts['StakingWithdrawModule'],
        'WeightedStakingModule': contracts['WeightedStakingModule']
    }

    moduleAddresses = [ 
        contracts['StakingAdminModule'],
        contracts['StakingGovernanceModule'],
        contracts['StakingStakeModule'],
        contracts['StakingStorageModule'],
        contracts['StakingVestingModule'],
        contracts['StakingWithdrawModule'],
        contracts['WeightedStakingModule']
    ]
    
    '''
    invalidModules = {}
    for module in moduleAddresses:
        if not stakingModulesProxy.canAddModule(moduleAddresses[module]):
            invalidModules.append({module: moduleAddresses[module]})
    
    if invalidModules != {}:
         raise Exception('Invalid modules:: ' + invalidModules)
    '''

    # Action
    targets = [contracts['Staking'], contracts['Staking']]
    values = [0, 0]
    signatures = ["setImplementation(address)", "addModules(address[])"]
    data1 = stakingProxy.setImplementation.encode_input(contracts['StakingModulesProxy'])
    #TODO: moduleAddresses should be array of addresses, not object
    data2 = stakingModulesProxy.addModules.encode_input(moduleAddresses) 
    datas = ["0x" + data1[10:], "0x" + data2[10:]]

    description = "SIP-0049: Staking contract refactoring to resolve EIP-170 size limit, Details: <TODO: commit link>, sha256: <TODO: SIP file sha256>"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)


def createProposalSIP0050():    
    staking = Contract.from_abi("StakingProxy", address=contracts['Staking'], abi=StakingProxy.abi, owner=acct)

    # Action
    targets = [contracts['Staking']]
    values = [0]
    signatures = ["setImplementation(address)"]
    if(contracts['StakingLogic8'] == '' or bytes.hex(web3.eth.getCode(contracts['StakingLogic8'])) == ''):
        raise Exception("check the new Staking contract implementation address")
    data = staking.setImplementation.encode_input(contracts['StakingLogic8'])
    datas = ["0x" + data[10:]]
    description = "SIP-0050: Critical staking vulnerability fix, Details: https://github.com/DistributedCollective/SIPS/blob/c787752/SIP-0050.md, sha256: 75b0dd906e4b9f4fbf28c6b1c500f7390a9496cba07172ff962cb2fd0d9c098f"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    #createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0056():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0056: Sunsetting the MYNT Token : https://github.com/DistributedCollective/SIPS/blob/59dca4f/SIP-0056.md, sha256: 8648026a41a96f50bc6cfb8a678ac58ab70f98ebfbc3186a7e015ddcedaf0b25"

    # Create Proposal
    createProposal(contracts['GovernorOwner'], target, value, signature, data, description)

def createProposalSIP0060():
    # Action
    target = [contracts['SOV']]
    value = [0]
    signature = ["symbol()"]
    data = ["0x"]
    description = "SIP-0060: Add DLLR as collateral for borrowing : https://github.com/DistributedCollective/SIPS/blob/2443b3c/SIP-0060.md, sha256: 532151b945263f0a4725980d2358c12143e8a8cfb59017df2592baf994f6059d"

    # Create Proposal
    createProposal(contracts['GovernorAdmin'], target, value, signature, data, description)

# === Accepting Ownership of AMM Contracts ===
# === Governor Admin ===
def createProposalSIP0067():
    # total = 10
    # Action
    targets = [
        contracts['swapNetwork'],
        contracts['ammSwapSettings'],
        contracts['BProOracle'],
        contracts['MOCPoolOracle'],
        contracts['SOVPoolOracle'],
        contracts['ETHPoolOracle'],
        contracts['BNBPoolOracle'],
        contracts['XUSDPoolOracle'],
        contracts['FishPoolOracle'],
        contracts['RIFPoolOracle'],
    ]
    values = []
    signatures = []
    datas = []

    for target in targets:
        values.append(0)
        signatures.append("acceptOwnership()")
        datas.append("0x")

    description = "SIP-0067 : Accepting ownership of AMM contracts Part 1"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    print(targets)
    #createProposal(contracts['GovernorAdmin'], targets, values, signatures, datas, description)

def createProposalSIP0068():
    # total = 6
    # Action
    targets = [
        contracts['MYNTPoolOracle'],
        contracts['DLLRPoolOracle'],
        contracts['ConversionPathFinder'],
        contracts['ConverterUpgrader'],
        contracts['ConverterRegistryData'],
        contracts['ammOracleWhitelist'],
        contracts['RBTCWrapperProxy']
    ]
    values = []
    signatures = []
    datas = []

    for target in targets:
        values.append(0)
        signatures.append("acceptOwnership()")
        datas.append("0x")

    description = "SIP-0068 : Accepting ownership of AMM contracts Part 2"

    # Create Proposal
    print(signatures)
    print(datas)
    print(description)
    print(targets)
    #createProposal(contracts['GovernorAdmin'], targets, values, signatures, datas, description)

# === Governor Owner ===
def createProposalSIP0069():
    # total = 10
    # Action
    targets = [
        contracts['ConverterDOC'],
        contracts['ConverterUSDT'],
        contracts['ConverterBPRO'],
        contracts['ConverterBNBs'],
        contracts['ConverterMOC'],
        contracts['ConverterXUSD'],
        contracts['ConverterSOV'],
        contracts['ConverterETHs'],
        contracts['ConverterFISH'],
        contracts['ConverterMYNT'],
    ]
    values = []
    signatures = []
    datas = []

    for target in targets:
        values.append(0)
        signatures.append("acceptOwnership()")
        datas.append("0x")

    description = "SIP-0069 : Accepting ownership of AMM contracts Part 1"
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)

def createProposalSIP0070():
    # total = 3
    # Action
    targets = [
        contracts['ConverterRIF'],
        contracts['ConverterDLLR'],
        contracts['ammContractRegistry'],
        contracts['ConverterFactory']
    ]
    values = []
    signatures = []
    datas = []

    for target in targets:
        values.append(0)
        signatures.append("acceptOwnership()")
        datas.append("0x")

    description = "SIP-0070 : Accepting ownership of AMM contracts Part 2"
    print(signatures)
    print(datas)
    print(description)
    # createProposal(contracts['GovernorOwner'], targets, values, signatures, datas, description)