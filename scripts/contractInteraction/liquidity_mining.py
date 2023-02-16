from brownie import *
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def setLiquidityMiningAddressOnAllContracts():
    print("setting LM address")
    setLiquidityMiningAddress(conf.contracts['iDOC'])
    setLiquidityMiningAddress(conf.contracts['iUSDT'])
    setLiquidityMiningAddress(conf.contracts['iBPro'])
    setLiquidityMiningAddress(conf.contracts['iXUSD'])
    setLiquidityMiningAddress(conf.contracts['iRBTC'])

def getLiquidityMiningAddress(loanTokenAddress, loanTokenName = ''):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicLM.abi, owner=conf.acct)
    if loanTokenName != '':
        print(loanTokenName, ":", loanToken.getLiquidityMiningAddress()," - ",loanToken.target_())
    else:
        print(loanToken.getLiquidityMiningAddress()," - ",loanToken.target_())

def setLiquidityMiningAddress(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicLM.abi, owner=conf.acct)
    data = loanToken.setLiquidityMiningAddress.encode_input(conf.contracts['LiquidityMiningProxy'])

    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def getLiquidityMiningAddressOnAllContracts():
    print("getting LM addresses")
    print("loan token : LM address - loan token proxy address")
    getLiquidityMiningAddress(conf.contracts['iDOC'], 'iDOC')
    getLiquidityMiningAddress(conf.contracts['iUSDT'], 'iUSDT')
    getLiquidityMiningAddress(conf.contracts['iBPro'], 'iBPro')
    getLiquidityMiningAddress(conf.contracts['iXUSD'], 'iXUSD')
    getLiquidityMiningAddress(conf.contracts['iRBTC'], 'iRBTC')

def setWrapperOnLM():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    data = lm.setWrapper.encode_input(conf.contracts['RBTCWrapperProxy'])
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)


def getPoolId(poolToken):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    print(lm.getPoolId(poolToken))


def getLMInfo():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    print('getPoolLength():\n', lm.getPoolLength())
    print('getPoolInfoList():\n', lm.getPoolInfoList())
    print('wrapper():\n', lm.wrapper())

def setLockedSOV(newLockedSOV):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    data = lm.setLockedSOV.encode_input(newLockedSOV)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def addPoolsToLM():
    liquidityMining = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    # TODO prepare pool tokens list
    poolTokens = [conf.contracts['(WR)BTC/USDT1'], conf.contracts['(WR)BTC/USDT2'], conf.contracts['(WR)BTC/DOC1'], conf.contracts['(WR)BTC/DOC2'], conf.contracts['(WR)BTC/BPRO1'], conf.contracts['(WR)BTC/BPRO2']]
    allocationPoints = [1, 1, 1, 1, 1, 1]
    # token weight = allocationPoint / SUM of allocationPoints for all pool tokens
    withUpdate = False # can be False if we adding pool tokens before mining started
    for i in range(0,len(poolTokens)):
        print('adding pool', i)
        data = liquidityMining.add.encode_input(poolTokens[i], allocationPoints[i], withUpdate)
        print(data)
        sendWithMultisig(conf.contracts['multisig'], liquidityMining.address, data, conf.acct)
    data = liquidityMining.updateAllPools.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], liquidityMining.address, data, conf.acct)

def addMOCPoolToken():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    ALLOCATION_POINT_BTC_SOV = 30000 # (WR)BTC/SOV
    ALLOCATION_POINT_BTC_ETH = 35000 # or 30000 (WR)BTC/ETH
    ALLOCATION_POINT_DEFAULT = 1 # (WR)BTC/USDT1 | (WR)BTC/USDT2 | (WR)BTC/DOC1 | (WR)BTC/DOC2 | (WR)BTC/BPRO1 | (WR)BTC/BPRO2 | (WR)BTC/MOC
    ALLOCATION_POINT_CONFIG_TOKEN = MAX_ALLOCATION_POINT - ALLOCATION_POINT_BTC_SOV - ALLOCATION_POINT_BTC_ETH - ALLOCATION_POINT_DEFAULT * 7
    print("ALLOCATION_POINT_CONFIG_TOKEN: ", ALLOCATION_POINT_CONFIG_TOKEN)
    data = lm.add.encode_input(conf.contracts['(WR)BTC/MOC'],1,False)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)
    data = lm.update.encode_input(conf.contracts['LiquidityMiningConfigToken'],ALLOCATION_POINT_CONFIG_TOKEN,True)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def transferSOVtoLM(amount):
    liquidityMining = conf.contracts['LiquidityMiningProxy']
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(liquidityMining, amount)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], SOVtoken.address, data, conf.acct)
 
def addAmmPoolTokenToLM(ptName):
    # ptName - pool token name from testnet_contracts.json e.g.:
    # "XUSD/BRZ"
    # "(WR)BTC/MYNT"
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)

    data = lm.add.encode_input(conf.contracts[ptName],1,False)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def getPoolIdByName(ptName):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    print(lm.getPoolId(conf.contracts[ptName]))
    #0xB12FA09a50c56e9a0C826b98e76DA7645017AB4D

def getPoolTokenUserInfo(poolToken, user):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)

    res = lm.getUserInfo(poolToken, user)

    print('pool tokens: ', res[0]/1e18)
    print('debt: ', res[1]/1e18)
    print('accumulated reward: ', res[2]/1e18)

def getMissedBalance():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    res = lm.getMissedBalance()
    print(res/1e18)
    return res

def transferLiquidityMiningOwnershipToGovernance():
    print("Transferring LiquidityMining ownership to: ", conf.contracts['TimelockOwner'])
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    data = lm.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def upgradeLiquidityMiningLogic():
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    liquidityMiningProxy = Contract.from_abi("LiquidityMiningProxy", address = conf.contracts['LiquidityMiningProxy'], abi = UpgradableProxy.abi, owner = conf.acct)

    liquidityMiningLogic = conf.acct.deploy(LiquidityMining)
    print("new liquidityMiningLogic: ", liquidityMiningLogic.address)

    data = liquidityMiningProxy.setImplementation.encode_input(liquidityMiningLogic.address)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], liquidityMiningProxy.address, data, conf.acct)
