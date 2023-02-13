from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time
import copy
from scripts.utils import *
import scripts.contractInteraction.config as conf


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
    loan = sovryn.getLoan(loanId).dict()
    print('--------------------------------')
    print('loan ID:', loan['loanId'])
    print('principal:', loan['principal'] /1e18)
    print('collateral:', loan['collateral']/1e18)
    print('currentMargin', loan['currentMargin']/1e18)
    print('complete object:')
    print(sovryn.getLoan(loanId).dict())
    print('--------------------------------')
    


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

    print('replacing loan closings liquidation')
    loanClosingsLiquidation = conf.acct.deploy(LoanClosingsLiquidation)
    data = sovryn.replaceContract.encode_input(loanClosingsLiquidation.address)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

    print('replacing loan closings rollover')
    loanClosingsRollover = conf.acct.deploy(LoanClosingsRollover)
    data = sovryn.replaceContract.encode_input(loanClosingsRollover.address)
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
    # LoanClosingsLiquidation
    # LoanClosingsRollover
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
    # LoanClosingsLiquidation
    # LoanClosingsRollover
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

# feesControllerAddress = new feeSharingCollectorProxy address


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


def withdrawFees():
    # Withdraw fees from protocol
    feesController = readFeesController()
    feeSharingCollectorProxy = Contract.from_abi(
        "FeeSharingCollector", address=feesController, abi=FeeSharingCollector.abi, owner=conf.acct)
    feeSharingCollectorProxy.withdrawFees([
        conf.contracts['USDT'],
        conf.contracts['DoC'],
        conf.contracts['ETHs'],
        conf.contracts['XUSD'],
        conf.contracts['FISH'],
        conf.contracts['BPro'],
        conf.contracts['SOV'],
        conf.contracts['WRBTC'],
    ])

    # Withdraw fees from AMM
    feeSharingCollectorProxy.withdrawFeesAMM([
        conf.contracts["ConverterSOV"],
        conf.contracts["ConverterXUSD"],
        conf.contracts["ConverterETHs"],
        conf.contracts["ConverterMOC"],
        conf.contracts["ConverterBNBs"],
        conf.contracts["ConverterFISH"],
        conf.contracts["ConverterRIF"],
        conf.contracts["ConverterMYNT"],
    ])

def setSupportedToken(tokenAddress):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setSupportedTokens.encode_input([tokenAddress], [True])
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)


def deployConversionFeeSharingToWRBTC():
    # For first time deployment of Upgradable FeeSharingCollectorProxy (v2), need to call deployFeeSharingCollectorProxy first to deploy the proxy
    # After deployFeeSharingCollectorProxyCalled, need to store the address to the testnet_contracts.json with variable name = FeeSharingCollectorProxy2

    print("Redeploy fee sharing collector")
    # Redeploy feeSharingCollector
    feeSharingCollector = conf.acct.deploy(FeeSharingCollector)
    print("Fee sharing collector redeployed at: ", feeSharingCollector.address)

    print("Set implementation for FeeSharingCollectorProxy")
    feeSharingCollectorProxy = Contract.from_abi(
        "FeeSharingCollectorProxy", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollectorProxy.abi, owner=conf.acct)
    data = feeSharingCollectorProxy.setImplementation.encode_input(feeSharingCollector.address)
    sendWithMultisig(conf.contracts['multisig'],
                     feeSharingCollectorProxy.address, data, conf.acct)

    # Redeploy protocol settings
    replaceProtocolSettings()

    # Redeploy swaps external
    redeploySwapsExternal()

    # Set Fees Controller
    setFeesController(feeSharingCollectorProxy.address)


def deployFeeSharingCollectorProxy():
    print("Deploy fee sharing proxy")
    feeSharingCollectorProxy = conf.acct.deploy(
        FeeSharingCollectorProxy, conf.contracts['sovrynProtocol'], conf.contracts['Staking'])
    print(feeSharingCollectorProxy.address)
    print('Proxy owner: ', feeSharingCollectorProxy.getProxyOwner())
    print('FeeSharingCollectorProxy ownership: ', feeSharingCollectorProxy.owner())
    feeSharingCollectorProxy.setProxyOwner(conf.contracts['multisig'])
    feeSharingCollectorProxy.transferOwnership(conf.contracts['multisig'])
    print('New proxy owner: ', feeSharingCollectorProxy.getProxyOwner())
    print('New FeeSharingCollectorProxy ownership: ', feeSharingCollectorProxy.owner())


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
    # LoanClosingsLiquidation
    # LoanClosingsRollover
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

def addWhitelistConverterFeeSharingCollectorProxy(converterAddress):
    feeSharingCollectorProxy = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    data = feeSharingCollectorProxy.addWhitelistedConverterAddress.encode_input(converterAddress)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], feeSharingCollectorProxy.address, data, conf.acct)

def removeWhitelistConverterFeeSharingCollectorProxy(converterAddress):
    feeSharingCollectorProxy = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    data = feeSharingCollectorProxy.removeWhitelistedConverterAddress.encode_input(converterAddress)

    print(data)
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollectorProxy.address, data, conf.acct)

def readRolloverReward():
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    print(sovryn.rolloverBaseReward())

def withdrawWRBTCFromFeeSharingCollectorProxyToProtocol(amount):
    receiver = conf.contracts['sovrynProtocol']
    feeSharingCollectorProxy = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    wrbtc = Contract.from_abi("WRBTC", address=conf.contracts['WRBTC'], abi=ERC20.abi, owner=conf.acct)
    print("=============================================================")
    print('withdrawWRBTCFromFeeSharingCollectorProxyToProtocol')
    print("FeeSharingCollectorProxy WRBTC balance:  ", wrbtc.balanceOf(conf.contracts['FeeSharingCollectorProxy']))
    print("receiver:                       ", receiver)
    print("amount to withdraw:             ", amount)
    print("=============================================================")
    withdrawWRBTCFromFeeSharingCollectorProxy(receiver, amount)

def withdrawWRBTCFromFeeSharingCollectorProxy(receiver, amount):
    feeSharingCollectorProxy = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    data = feeSharingCollectorProxy.withdrawWRBTC.encode_input(receiver, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollectorProxy.address, data, conf.acct)

def setRolloverFlexFeePercent(rolloverFlexFeePercentage):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setRolloverFlexFeePercent.encode_input(rolloverFlexFeePercentage)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

def setRolloverBaseReward(baseReward):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setRolloverBaseReward.encode_input(baseReward)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

def depositCollateral(loanId,depositAmount, tokenAddress):
    token = Contract.from_abi("TestToken", address = tokenAddress, abi = TestToken.abi, owner = conf.acct)
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    if(token.allowance(conf.acct, sovryn.address) < depositAmount):
        token.approve(sovryn.address, depositAmount)
    sovryn.depositCollateral(loanId,depositAmount)

def setDefaultPathConversion(sourceTokenAddress, destTokenAddress, defaultPath):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.setDefaultPathConversion.encode_input(defaultPath)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

def removeDefaultPathConversion(sourceTokenAddress, destTokenAddress):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.removeDefaultPathConversion.encode_input(sourceTokenAddress, destTokenAddress)
    sendWithMultisig(conf.contracts['multisig'],
                     sovryn.address, data, conf.acct)

def readDefaultPathConversion(sourceTokenAddress, destTokenAddress):
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    defaultPathConversion = sovryn.getDefaultPathConversion(sourceTokenAddress, destTokenAddress)
    print(defaultPathConversion)
    return defaultPathConversion

# Transferring Ownership to GOV
def transferProtocolOwnershipToGovernance():
    print("Transferring sovryn protocol ownserhip to: ", conf.contracts['TimelockOwner'])
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], sovryn.address, data, conf.acct)

def readFeesController():
    sovryn = Contract.from_abi(
        "sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    feesController = sovryn.feesController()
    print(feesController)
    return feesController

def testA():
    # before deployment
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=interface.IStaking.abi, owner=conf.acct)
    checkDate = staking.timestampToLockDate(web3.eth.getBlock('latest').timestamp)
    print(staking.MAX_VOTING_WEIGHT())
    print(staking.WEIGHT_FACTOR())
    print(staking.MAX_DURATION())
    print(staking.kickoffTS())
    print(staking.SOVToken())
    print(staking.delegates(conf.contracts['sovrynProtocol'], 0))
    print(staking.allUnlocked())
    print(staking.DOMAIN_TYPEHASH())
    print(staking.DELEGATION_TYPEHASH())
    print(staking.newStakingContract())
    print(staking.totalStakingCheckpoints(checkDate,1))
    print(staking.numTotalStakingCheckpoints(1))
    print(staking.delegateStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate, 1))
    print(staking.numDelegateStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate))
    print(staking.userStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate,1 ))
    print(staking.numUserStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate))
    print(staking.nonces(conf.contracts['sovrynProtocol']))
    print(staking.feeSharing())
    print(staking.weightScaling())
    print(staking.vestingWhitelist(conf.contracts['sovrynProtocol']))
    print(staking.admins(conf.contracts['sovrynProtocol']))
    print(staking.vestingCheckpoints(checkDate,1))
    print(staking.numVestingCheckpoints(checkDate))
    print(staking.vestingRegistryLogic())
    print(staking.pausers(conf.contracts['sovrynProtocol']))
    print(staking.paused())
    print(staking.frozen())
    print(staking.owner())


def testB():
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=interface.IStaking.abi, owner=conf.acct)
    checkDate = staking.timestampToLockDate(web3.eth.getBlock('latest').timestamp)

    # After deployment
    print(staking.getStorageMaxVotingWeight())
    print(staking.getStorageWeightFactor())
    print(staking.getStorageMaxDurationToStakeTokens())
    print(staking.kickoffTS())
    print(staking.SOVToken())
    print(staking.delegates(conf.contracts['sovrynProtocol'], 0))
    print(staking.allUnlocked())
    print(staking.getStorageDomainTypehash())
    print(staking.getStorageDelegationTypehash())
    print(staking.newStakingContract())
    print(staking.totalStakingCheckpoints(checkDate,1))
    print(staking.numTotalStakingCheckpoints(checkDate))
    print(staking.delegateStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate, 1))
    print(staking.numDelegateStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate))
    print(staking.userStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate, 1 ))
    print(staking.numUserStakingCheckpoints(conf.contracts['sovrynProtocol'], checkDate))
    print(staking.nonces(conf.contracts['sovrynProtocol']))
    print(staking.feeSharing())
    print(staking.weightScaling())
    print(staking.vestingWhitelist(conf.contracts['sovrynProtocol']))
    print(staking.admins(conf.contracts['sovrynProtocol']))
    print(staking.vestingCheckpoints(checkDate,1))
    print(staking.numVestingCheckpoints(checkDate))
    print(staking.vestingRegistryLogic())
    print(staking.pausers(conf.contracts['sovrynProtocol']))
    print(staking.paused())
    print(staking.frozen())
    print(staking.owner())
    # print(staking.getPriorTotalVotingPower())

def testSetVestingStakes():
    # vestingRegistry = Contract.from_abi("VestingRegistryLogic", address=conf.contracts['VestingRegistryProxy'], abi=VestingRegistryLogic.abi, owner=conf.acct)
    # firstVesting = vestingRegistry.vestings(1);
    # print(firstVesting)

    # send multisig (sender) some rbtc
    # accounts[0].transfer(conf.acct, "10 ether")

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    vestingAddress = "0xB0A9a94f41A0113AF99Ce6adcf5376A924BA9544" # avaialble on testnet
    fourYearVestingLogic = Contract.from_abi("FourYearVestingLogic", address="0xB0A9a94f41A0113AF99Ce6adcf5376A924BA9544", abi=FourYearVestingLogic.abi, owner=conf.acct)
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=interface.IStaking.abi, owner=conf.acct)


    startDate = fourYearVestingLogic.startDate()
    endDate = fourYearVestingLogic.endDate()
    totalStakeByLockDates = {}

    for lockDate in range(startDate, endDate+1, FOUR_WEEKS):
        numVestingStakeCheckpoints = staking.numUserStakingCheckpoints(vestingAddress,lockDate)
        if numVestingStakeCheckpoints > 0:
            vestingStakeCheckpoints = staking.userStakingCheckpoints(vestingAddress,lockDate,0)
            totalStake = vestingStakeCheckpoints[1]

            if lockDate not in totalStakeByLockDates:
                totalStakeByLockDates[lockDate] = totalStake
            else:
                totalStakeByLockDates[lockDate] += totalStake
    
    print('list total stake by lock dates')
    print(json.dumps(totalStakeByLockDates, indent=2))

    for lockDate in totalStakeByLockDates:
        currentTotalVestingStake = 0;
        print(lockDate, ' -> ', totalStakeByLockDates[lockDate])
        print('set to vesting stake...')
        currentNumVestingStakeCheckpoints = staking.numVestingCheckpoints(lockDate)

        # If vesting stake for this lock date exist, we need to add it.
        if currentNumVestingStakeCheckpoints > 0:
            currentVestingStakeCheckpoints = staking.vestingCheckpoints(lockDate, currentNumVestingStakeCheckpoints-1)
            currentTotalVestingStake = currentVestingStakeCheckpoints[1]

        print('current total vesting stake for date: ', lockDate, ':', currentTotalVestingStake)

        previousNCheckpoint = staking.numVestingCheckpoints(lockDate)
        previousVestingCheckpoint = staking.vestingCheckpoints(lockDate, previousNCheckpoint)

        print("previous nCheckpoint: ", previousNCheckpoint)
        print("previous vestingCheckpoint: ", previousVestingCheckpoint)

        # if currentTotalVestingStake == 0:
        #     # if no vesting stake, just manipulate it for test purpose
        #     currentTotalVestingStake = totalStakeByLockDates[lockDate];
        vestingStakeAmount = totalStakeByLockDates[lockDate]+currentTotalVestingStake
        print('new vesting stake amount: ', vestingStakeAmount)

        maxDuration = staking.getStorageMaxDurationToStakeTokens()
        latestBlockTs = web3.eth.getBlock('latest').timestamp

        if(lockDate < latestBlockTs):
            continue

        staking.setVestingStakes([lockDate], [vestingStakeAmount])

        latestNCheckpoint = staking.numVestingCheckpoints(lockDate)
        latestVestingCheckpoint = staking.vestingCheckpoints(lockDate, previousNCheckpoint)

        print("latest nCheckpoint: ", latestNCheckpoint)
        print("latest vestingCheckpoint: ", latestVestingCheckpoint)

        assert previousNCheckpoint + 1 == latestNCheckpoint, "Invalid nCheckpoint condition"
        assert previousVestingCheckpoint[1] + vestingStakeAmount == latestVestingCheckpoint[1], "Invalid vesting stake amount condition"

    # # setVestingStakes

def testStake():
    sov = Contract.from_abi("TestToken", address=conf.contracts['SOV'], abi=TestToken.abi, owner=conf.acct)
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=interface.IStaking.abi, owner=conf.acct)

    stakeAmount = 100000000000000000000
    until = web3.eth.getBlock('latest').timestamp + 15552000 # 6 months
    stakeFor = conf.acct
    delegatee = "0x0000000000000000000000000000000000000000"

    lockDateFromUntil = staking.timestampToLockDate(until)

    previousNCheckpoints = staking.numTotalStakingCheckpoints(lockDateFromUntil)
    previousNCheckpoints = int(str(previousNCheckpoints), 16)
    tempPreviousNCheckpoints = previousNCheckpoints
    print("previous nCheckpoints: ", previousNCheckpoints)

    previousNumUserStakingCheckpoints = staking.numUserStakingCheckpoints(conf.acct, lockDateFromUntil)
    previousNumUserStakingCheckpoints = int(str(previousNumUserStakingCheckpoints), 16)
    tempPreviousNumUserStakingCheckpoints = previousNumUserStakingCheckpoints
    print("previous nUserCheckpoints: ", previousNumUserStakingCheckpoints)
    
    if previousNCheckpoints > 0:
        previousNCheckpoints = previousNCheckpoints - 1;

    if previousNumUserStakingCheckpoints > 0:
        previousNumUserStakingCheckpoints = previousNumUserStakingCheckpoints - 1;

    previousTotalStakingCheckpoints = staking.totalStakingCheckpoints(lockDateFromUntil, previousNCheckpoints)
    previousUserStakingCheckpoints = staking.userStakingCheckpoints(conf.acct, lockDateFromUntil, previousNumUserStakingCheckpoints)
    previousPriorWeightedStake = staking.getPriorWeightedStake(conf.acct, web3.eth.getBlock('latest').number-1, lockDateFromUntil)
    previousSOVBalance = sov.balanceOf(conf.acct)

    # governance
    previousPriorTotalVotingPower = staking.getPriorTotalVotingPower(web3.eth.getBlock('latest').number-1, lockDateFromUntil)
    previousCurrentVotes = staking.getCurrentVotes(conf.acct)
    previousPriorVotes = staking.getPriorVotes(conf.acct, web3.eth.getBlock('latest').number-1, lockDateFromUntil)
    
    print("previous stakingCheckpoints: ", previousTotalStakingCheckpoints[1])
    print("previous userStakingCheckpoints: ", previousUserStakingCheckpoints[1])
    print("previous PriorWeightedStake: ", previousPriorWeightedStake)
    print("previous sovBalance: ", previousSOVBalance)

    print("previous PriorTotalVotingPower: ", previousPriorTotalVotingPower)
    print("previous CurrentVotes: ", previousCurrentVotes)
    print("previous PriorVotes: ", previousPriorVotes)

    sov.approve(staking.address, stakeAmount)
    staking.stake(stakeAmount, until, stakeFor, delegatee)

    latestNCheckpoints = staking.numTotalStakingCheckpoints(lockDateFromUntil)
    latestNCheckpoints = int(str(latestNCheckpoints), 16)
    tempLatestNCheckpoints = latestNCheckpoints
    print("latest nCheckpoints: ", latestNCheckpoints)

    latestNumUserStakingCheckpoints = staking.numUserStakingCheckpoints(conf.acct, lockDateFromUntil)
    latestNumUserStakingCheckpoints = int(str(latestNumUserStakingCheckpoints), 16)
    tempLatestNumUserStakingCheckpoints = latestNumUserStakingCheckpoints
    print("latest nUserCheckpoints: ", latestNumUserStakingCheckpoints)

    if latestNCheckpoints > 0:
        latestNCheckpoints = latestNCheckpoints - 1;
    
    if latestNumUserStakingCheckpoints > 0:
        latestNumUserStakingCheckpoints = latestNumUserStakingCheckpoints - 1;

    latestTotalStakingCheckpoints = staking.totalStakingCheckpoints(lockDateFromUntil, latestNCheckpoints)
    latestUserStakingCheckpoints = staking.userStakingCheckpoints(conf.acct, lockDateFromUntil, latestNumUserStakingCheckpoints)
    latestPriorWeightedStake = staking.getPriorWeightedStake(conf.acct, web3.eth.getBlock('latest').number-1, lockDateFromUntil)
    latestSOVBalance = sov.balanceOf(conf.acct)

    # governance
    latestPriorTotalVotingPower = staking.getPriorTotalVotingPower(web3.eth.getBlock('latest').number-1, lockDateFromUntil)
    latestCurrentVotes = staking.getCurrentVotes(conf.acct)
    latestPriorVotes = staking.getPriorVotes(conf.acct, web3.eth.getBlock('latest').number-1, lockDateFromUntil)

    print("latest stakingCheckpoints: ", latestTotalStakingCheckpoints[1])
    print("latest userStakingCheckpoints: ", latestUserStakingCheckpoints[1])
    print("latest PriorWeightedStake: ", latestPriorWeightedStake)
    print("latest sovBalance: ", latestSOVBalance)

    print("latest latestPriorTotalVotingPower: ", latestPriorTotalVotingPower)
    print("latest latestCurrentVotes: ", latestCurrentVotes)
    print("latest latestPriorVotes: ", latestPriorVotes)

    assert(previousTotalStakingCheckpoints[1] + stakeAmount == latestTotalStakingCheckpoints[1])
    assert(previousUserStakingCheckpoints[1] + stakeAmount == latestUserStakingCheckpoints[1])
    assert(previousSOVBalance - stakeAmount == latestSOVBalance)

    assert(tempPreviousNCheckpoints + 1 == tempLatestNCheckpoints)
    assert(tempPreviousNumUserStakingCheckpoints + 1 == tempLatestNumUserStakingCheckpoints)

    if(latestPriorWeightedStake != 0):
        assert(previousPriorWeightedStake + stakeAmount == latestPriorWeightedStake)

    # governance check
    if(latestPriorTotalVotingPower - previousPriorTotalVotingPower != 0):
        assert(previousPriorTotalVotingPower + stakeAmount == latestPriorTotalVotingPower)

    if(latestPriorVotes != 0):
        assert(previousPriorVotes + stakeAmount == latestPriorVotes)

    if(previousCurrentVotes != 0):
        assert(latestCurrentVotes > previousCurrentVotes)

def testStakingAdmin():
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=interface.IStaking.abi, owner=conf.acct)
    newAdmin = accounts[0]
    newPauser = accounts[1]

    staking.addAdmin(newAdmin)
    assert(staking.admins(newAdmin) == True)

    staking.removeAdmin(newAdmin)
    assert(staking.admins(newAdmin) == False)

    staking.addPauser(newPauser)
    assert(staking.pausers(newPauser) == True)

    staking.removePauser(newPauser)
    assert(staking.pausers(newPauser) == False)

    staking.pauseUnpause(True)
    assert(staking.paused() == True)

    staking.pauseUnpause(False)
    assert(staking.paused() == False)

    staking.freezeUnfreeze(True)
    assert(staking.frozen() == True)
    
    staking.freezeUnfreeze(False)
    assert(staking.frozen() == False)
