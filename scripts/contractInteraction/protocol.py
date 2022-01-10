from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time
import copy
from scripts.utils import *
import scripts.contractInteraction.config as conf

conf.loadConfig()


def isProtocolPaused():
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    print("isProtocolPaused: ", sovryn.isProtocolPaused())


def readLendingFee():
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    lfp = sovryn.lendingFeePercent()
    print(lfp/1e18)
    return lfp


def readLoan(loanId):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    print(sovryn.getLoan(loanId).dict())


def liquidate(protocolAddress, loanId):
    sovryn = Contract.from_abi(
        "sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    loan = sovryn.getLoan(loanId).dict()
    print(loan)
    if(loan['maintenanceMargin'] > loan['currentMargin']):
        value = 0
        if(loan['loanToken'] == conf.contracts['WRBTC']):
            value = loan['maxLiquidatable']
        else:
            testToken = Contract.from_abi(
                "TestToken", address=loan['loanToken'], abi=TestToken.abi, owner=conf.acct)
            testToken.approve(sovryn, loan['maxLiquidatable'])
        sovryn.liquidate(loanId, conf.acct,
                         loan['maxLiquidatable'], {'value': value})
    else:
        print("can't liquidate because the loan is healthy")


def rollover(loanId):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    tx = sovryn.rollover(loanId, b'')
    print(tx.info())


def replaceLoanClosings():
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)

    print('replacing loan closings base')
    loanClosingsBase = conf.acct.deploy(LoanClosingsBase)
    data = sovryn.replaceContract.encode_input(loanClosingsBase.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

    print('replacing loan closings with')
    loanClosingsWith = conf.acct.deploy(LoanClosingsWith)
    data = sovryn.replaceContract.encode_input(loanClosingsWith.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceSwapsExternal():
    swapsExternal = conf.acct.deploy(SwapsExternal)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(swapsExternal.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceLoanOpenings():
    print("replacing loan openings")
    loanOpenings = conf.acct.deploy(LoanOpenings)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(loanOpenings.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceLoanSettings():
    print("replacing loan settigns")
    loanSettings = conf.acct.deploy(LoanSettings)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(loanSettings.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceSwapsImplSovrynSwap():
    print("replacing swaps")
    swaps = conf.acct.deploy(SwapsImplSovrynSwap)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setSwapsImplContract.encode_input(swaps.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setLendingFee(fee):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setLendingFeePercent.encode_input(fee)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setTradingFee(fee):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setTradingFeePercent.encode_input(fee)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setBorrowingFee(fee):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setBorrowingFeePercent.encode_input(fee)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setSwapExternalFee(fee):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setSwapExternalFeePercent.encode_input(fee)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setAffiliateFeePercent(fee):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setAffiliateFeePercent.encode_input(fee)
    print('sovryn.setAffiliateFeePercent for', fee, ' tx:')
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setAffiliateTradingTokenFeePercent(percentFee):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setAffiliateTradingTokenFeePercent.encode_input(percentFee)
    print('sovryn.setAffiliateTradingTokenFeePercent for ', percentFee, ' tx:')
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def setMinReferralsToPayout(minReferrals):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setMinReferralsToPayoutAffiliates.encode_input(minReferrals)
    print('setMinReferralsToPayoutAffiliates set to ', minReferrals, ' tx:')
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceProtocolSettings():
    print("Deploying ProtocolSettings.")
    settings = conf.acct.deploy(ProtocolSettings)

    print("Calling replaceContract.")
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(settings.address)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceLoanSettings():
    print("Deploying LoanSettings.")
    settings = conf.acct.deploy(LoanSettings)

    print("Calling replaceContract.")
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(settings.address)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def deployAffiliate():
    # loadConfig() - called from main()
    # -------------------------------- 1. Replace the protocol settings contract ------------------------------
    # replaceProtocolSettings() - called from main()

    # -------------------------------- 2. Deploy the affiliates -----------------------------------------------
    affiliates = conf.acct.deploy(Affiliates)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(affiliates.address)
    print('affiliates deployed. data:')
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

    # Set protocolAddress
    data = sovryn.setSovrynProtocolAddress.encode_input(sovryn.address)
    print("Set Protocol Address in protocol settings")
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
    # , sovryn.getProtocolAddress()) - not executed yet
    print("protocol address loaded")

    # Set SOVTokenAddress
    # sovToken = Contract.from_abi("SOV", address=conf.contracts["SOV"], abi=SOV.abi, owner=conf.acct)
    # data = sovryn.setSOVTokenAddress.encode_input(sovToken.address)
    data = sovryn.setSOVTokenAddress.encode_input(conf.contracts["SOV"])
    print("Set SOV Token address in protocol settings")
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
    # , sovryn.getSovTokenAddress()) - not executed yet
    print("sovToken address loaded")

    # Set LockedSOVAddress
    # lockedSOV = Contract.from_abi("LockedSOV", address=conf.contracts["LockedSOV"], abi=LockedSOV.abi, owner=conf.acct)
    # data = sovryn.setLockedSOVAddress.encode_input(lockedSOV.address)
    data = sovryn.setLockedSOVAddress.encode_input(conf.contracts["LockedSOV"])
    print("Set Locked SOV address in protocol settings")
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
    print("lockedSOV address loaded:", lockedSOV.address)

    # Set minReferralsToPayout
    setMinReferralsToPayout(3)

    # Set affiliateTradingTokenFeePercent
    setAffiliateTradingTokenFeePercent(20 * 10**18)

    # Set affiliateFeePercent
    setAffiliateFeePercent(5 * 10**18)

    # ---------------------------- 3. Redeploy modules which implement InterestUser and SwapsUser -----------------------
    # LoanClosingsBase
    # LoanClosingsWith
    replaceLoanClosings()
    # LoanOpenings
    replaceLoanOpenings()
    # LoanMaintenance
    replaceLoanMaintenance()
    # SwapsExternal
    redeploySwapsExternal()
    # LoanSettings()
    replaceLoanSettings()

    # -------------------------------- 4. Replace Token Logic Standard ----------------------------------------
    replaceLoanTokenLogicOnAllContracts()


def deployAffiliateWithZeroFeesPercent():
    # loadConfig() - called from main()
    # -------------------------------- 1. Replace the protocol settings contract ------------------------------
    # replaceProtocolSettings() - called from main()

    # -------------------------------- 2. Deploy the affiliates -----------------------------------------------

    affiliates = conf.acct.deploy(Affiliates)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(affiliates.address)
    print('affiliates deployed. data:')
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

    # Set protocolAddress
    data = sovryn.setSovrynProtocolAddress.encode_input(sovryn.address)
    print("Set Protocol Address in protocol settings")
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
    # , sovryn.getProtocolAddress()) - not executed yet
    print("protocol address loaded")

    # Set SOVTokenAddress
    # sovToken = Contract.from_abi("SOV", address=conf.contracts["SOV"], abi=SOV.abi, owner=conf.acct)
    # data = sovryn.setSOVTokenAddress.encode_input(sovToken.address)
    data = sovryn.setSOVTokenAddress.encode_input(conf.contracts["SOV"])
    print("Set SOV Token address in protocol settings")
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
    # , sovryn.getSovTokenAddress()) - not executed yet
    print("sovToken address loaded")

    # Set LockedSOVAddress
    # lockedSOV = Contract.from_abi("LockedSOV", address=conf.contracts["LockedSOV"], abi=LockedSOV.abi, owner=conf.acct)
    # data = sovryn.setLockedSOVAddress.encode_input(lockedSOV.address)
    data = sovryn.setLockedSOVAddress.encode_input(conf.contracts["LockedSOV"])
    print("Set Locked SOV address in protocol settings")
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)
    print("lockedSOV address loaded:", conf.contracts["LockedSOV"])

    # Set minReferralsToPayout
    setMinReferralsToPayout(3)

    # Set affiliateTradingTokenFeePercent
    setAffiliateTradingTokenFeePercent(0)

    # Set affiliateFeePercent
    setAffiliateFeePercent(0)

    # ---------------------------- 3. Redeploy modules which implement InterestUser and SwapsUser -----------------------
    # LoanClosingsBase
    # LoanClosingsWith
    replaceLoanClosings()
    # LoanOpenings
    replaceLoanOpenings()
    # LoanMaintenance
    replaceLoanMaintenance()
    # SwapsExternal
    redeploySwapsExternal()
    # LoanSettings()
    replaceLoanSettings()

    # -------------------------------- 4. Replace Token Logic Standard ----------------------------------------
    replaceLoanTokenLogicOnAllContracts()


def replaceAffiliates():
    print("replacing Affiliates")
    affiliates = conf.acct.deploy(Affiliates)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(affiliates.address)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def replaceLoanMaintenance():
    print("replacing loan maintenance")
    loanMaintenance = conf.acct.deploy(LoanMaintenance)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(loanMaintenance.address)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def redeploySwapsExternal():
    print('replacing swaps external')
    swapsExternal = conf.acct.deploy(SwapsExternal)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(swapsExternal.address)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

# feesControllerAddress = new feeSharingProxy address


def setFeesController(feesControllerAddress):
    print("Set up new fees controller")
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setFeesController.encode_input(feesControllerAddress)
    print(data)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def readMaxAffiliateFee():
    abiFile = open('./scripts/contractInteraction/ABIs/SovrynSwapNetwork.json')
    abi = json.load(abiFile)
    swapNetwork = Contract.from_abi(
        "SovrynSwapNetwork", address=conf.contracts['swapNetwork'], abi=abi, owner=conf.acct)
    print(swapNetwork.maxAffiliateFee())

#todo: extend with SOV and RBTC
def withdrawFees():
    feeSharingProxy = Contract.from_abi(
        "FeeSharingLogic", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingLogic.abi, owner=conf.acct)
    feeSharingProxy.withdrawFees([
        conf.contracts['USDT'],
        conf.contracts['DoC'],
        conf.contracts['ETHs'],
        conf.contracts['XUSD'],
        conf.contracts['FISH'],
        conf.contracts['BPro'],
    ], {"allow_revert": True})


def setSupportedToken(tokenAddress):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setSupportedTokens.encode_input([tokenAddress], [True])
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def deployConversionFeeSharingToWRBTC():
    # For first time deployment of Upgradable FeeSharingProxy (v2), need to call deployFeeSharingProxy first to deploy the proxy
    # After deployFeeSharingProxyCalled, need to store the address to the testnet_contracts.json with variable name = FeeSharingProxy2

    print("Redeploy fee sharing logic")
    # Redeploy feeSharingLogic
    feeSharing = conf.acct.deploy(FeeSharingLogic)
    print("Fee sharing logic redeployed at: ", feeSharing.address)

    print("Set implementation for FeeSharingProxy")
    feeSharingProxy = Contract.from_abi(
        "FeeSharingProxy", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingProxy.abi, owner=conf.acct)
    data = feeSharingProxy.setImplementation.encode_input(feeSharing.address)
    sendWithMultisig(conf.contracts['multisig'],
                     feeSharingProxy.address, data, conf.acct)

    # Redeploy protocol settings
    replaceProtocolSettings()

    # Redeploy swaps external
    redeploySwapsExternal()

    # Set Fees Controller
    setFeesController(feeSharingProxy.address)


def deployFeeSharingProxy():
    print("Deploy fee sharing proxy")
    feeSharingProxy = conf.acct.deploy(
        FeeSharingProxy, conf.contracts['sovrynProtocol'], conf.contracts['Staking'])
    print(feeSharingProxy.address)
    print('Proxy owner: ', feeSharingProxy.getProxyOwner())
    print('FeeSharingProxy ownership: ', feeSharingProxy.owner())
    feeSharingProxy.setProxyOwner(conf.contracts['multisig'])
    feeSharingProxy.transferOwnership(conf.contracts['multisig'])
    print('New proxy owner: ', feeSharingProxy.getProxyOwner())
    print('New FeeSharingProxy ownership: ', feeSharingProxy.owner())


def setSupportedTokens(tokenAddresses, supported):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setSupportedTokens.encode_input(tokenAddresses, supported)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def tokenIsSupported(tokenAddress):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.supportedTokens(tokenAddress)
    print(data)


def deployTradingRebatesUsingLockedSOV():
    # loadConfig()

    sovryn = Contract.from_abi(
        "sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)

    # ----------------------------- 1. Replace Protocol Settings ------------------------------
    # replaceProtocolSettings()

    # ----------------------------- 2. Set protocol token address using SOV address ------------------------------
    # sovToken = Contract.from_abi("SOV", address=contracts["SOV"], abi=SOV.abi, owner=acct)
    # data = sovryn.setProtocolTokenAddress.encode_input(sovToken.address)
    # print("Set Protocol Token address in protocol settings")
    # print(data)

    # multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    # tx = multisig.submitTransaction(sovryn.address,0,data)
    # txId = tx.events["Submission"]["transactionId"]
    # print(txId)
    # print("protocol token address loaded:", sovryn.sovTokenAddress())

    # ----------------------------- 3. Set LockedSOV address -------------------------------------------
    # lockedSOV = Contract.from_abi("LockedSOV", address=contracts["LockedSOV"], abi=LockedSOV.abi, owner=acct)
    # data = sovryn.setLockedSOVAddress.encode_input(lockedSOV.address)
    # print("Set Locked SOV address in protocol settings")
    # print(data)

    # multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    # tx = multisig.submitTransaction(sovryn.address,0,data)
    # txId = tx.events["Submission"]["transactionId"]
    # print(txId)
    # print("lockedSOV address loaded:", sovryn.sovTokenAddress())

    # ----------------------------- 4. Set default feeRebatePercent -------------------------------------------
    setDefaultRebatesPercentage(10 * 10**18)

    # TODO
    # setSpecialRebates("sourceTokenAddress", "destTokenAddress", 10 * 10**18)

    # ---------------------------- 5. Redeploy modules which implement InterestUser and SwapsUser -----------------------
    # LoanClosingsBase
    # LoanClosingsWith
    replaceLoanClosings()
    # LoanOpenings
    replaceLoanOpenings()
    # LoanMaintenance
    replaceLoanMaintenance()
    # SwapsExternal
    redeploySwapsExternal()
    # LoanSettings
    replaceLoanSettings()

    # ---------------------------- 5. Set the basis point of SOV Rewards (Ratio between vested & the liquid one for the LockedSOV) -----------------------
    # 90% liquid, 10% vested
    setTradingRebateRewardsBasisPoint(9000)


def setDefaultRebatesPercentage(rebatePercent):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setRebatePercent.encode_input(rebatePercent)
    multisig = Contract.from_abi(
        "MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    tx = multisig.submitTransaction(sovryn.address, 0, data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)


def setTradingRebateRewardsBasisPoint(basisPoint):
    # Max basis point is 9999
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setTradingRebateRewardsBasisPoint.encode_input(basisPoint)
    multisig = Contract.from_abi(
        "MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    tx = multisig.submitTransaction(sovryn.address, 0, data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)


def upgradeStaking():
    print('Deploying account:', conf.acct.address)
    print("Upgrading staking")


def pauseProtocolModules():
    print("Pause Protocol Modules")
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.togglePaused.encode_input(True)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def unpauseProtocolModules():
    print("Unpause Protocol Modules")
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.togglePaused.encode_input(False)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def minInitialMargin(loanParamsId):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    print(sovryn.minInitialMargin(loanParamsId))

def addWhitelistConverterFeeSharingProxy(converterAddress):
    feeSharingProxy = Contract.from_abi("FeeSharingLogic", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingLogic.abi, owner=conf.acct)
    data = feeSharingProxy.addWhitelistedConverterAddress.encode_input(converterAddress)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], feeSharingProxy.address, data, conf.acct)

def removeWhitelistConverterFeeSharingProxy(converterAddress):
    feeSharingProxy = Contract.from_abi("FeeSharingLogic", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingLogic.abi, owner=conf.acct)
    data = feeSharingProxy.removeWhitelistedConverterAddress.encode_input(converterAddress)

    print(data)
    sendWithMultisig(conf.contracts['multisig'], feeSharingProxy.address, data, conf.acct)

def readRolloverReward():
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    print(sovryn.rolloverBaseReward())

def withdrawWRBTCFromFeeSharingProxy(receiver, amount):
    feeSharingProxy = Contract.from_abi("FeeSharingLogic", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingLogic.abi, owner=conf.acct)
    data = feeSharingProxy.withdrawWRBTC.encode_input(receiver, amount)

    print(data)
    sendWithMultisig(conf.contracts['multisig'], feeSharingProxy.address, data, conf.acct)
