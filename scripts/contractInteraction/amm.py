from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf
from web3 import Web3
from scripts.contractInteraction.token import *

def swapTokens(amount, minReturn, swapNetworkAddress, sourceTokenAddress, destTokenAddress):
    abiFile =  open('./scripts/contractInteraction/ABIs/SovrynSwapNetwork.json')
    abi = json.load(abiFile)
    swapNetwork = Contract.from_abi("SovrynSwapNetwork", address=swapNetworkAddress, abi=abi, owner=conf.acct)
    sourceToken = Contract.from_abi("Token", address=sourceTokenAddress, abi=TestToken.abi, owner=conf.acct)

    if(sourceTokenAddress == conf.contracts["WRBTC"]):
        contract = Contract.from_abi("WRBTC", address=conf.contracts["WRBTC"], abi=WRBTC.abi, owner=conf.acct)
        tx = contract.deposit({'value':amount})

    if(sourceToken.allowance(conf.acct, swapNetworkAddress) < amount):
        sourceToken.approve(swapNetworkAddress,amount*10)
    path = swapNetwork.conversionPath(sourceTokenAddress,destTokenAddress)
    print("path", path)
    expectedReturn = swapNetwork.getReturnByPath(path, amount)
    print("expected return ", expectedReturn)
    
    if(expectedReturn[0] > minReturn):
        tx = swapNetwork.convertByPath(
            path,
            amount,
            minReturn,
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            0
        )
        tx.info()
    else:
        print('retrun too low')

#can be used to swap any token, rbtc will be swapped as rbtc using the wrapper proxy
#but if wrbtc is the destination token, the multisig will end up with wrbtc  - no automatic unwrapping
def swapTokensWithMultisig(amount, minReturn, sourceTokenAddress, destTokenAddress):
    abiFile =  open('./scripts/contractInteraction/ABIs/SovrynSwapNetwork.json')
    abi = json.load(abiFile)
    swapNetwork = Contract.from_abi("SovrynSwapNetwork", address=conf.contracts['swapNetwork'], abi=abi, owner=conf.acct)
    sourceToken = Contract.from_abi("Token", address=sourceTokenAddress, abi=TestToken.abi, owner=conf.acct)

    if(sourceTokenAddress != conf.contracts["WRBTC"] and sourceToken.allowance(conf.contracts['multisig'], swapNetwork.address) < amount):
        data = sourceToken.approve.encode_input(swapNetwork.address,amount)
        sendWithMultisig(conf.contracts['multisig'], sourceToken.address, data, conf.acct)

    path = swapNetwork.conversionPath(sourceTokenAddress,destTokenAddress)
    print("path", path)
    expectedReturn = swapNetwork.getReturnByPath(path, amount)
    print("expected return ", expectedReturn)
    
    if(expectedReturn[0] > minReturn):
        if(sourceTokenAddress != conf.contracts["WRBTC"]):
            data = swapNetwork.convertByPath.encode_input(
                path,
                amount,
                minReturn,
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                0
            )
            sendWithMultisig(conf.contracts['multisig'], swapNetwork.address, data, conf.acct)
        else:
            abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
            abi = json.load(abiFile)
            wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=conf.contracts['RBTCWrapperProxy'], abi=abi, owner=conf.acct)
            data = wrapperProxy.convertByPath.encode_input(
                path,
                amount,
                minReturn
            )
            sendWithMultisig(conf.contracts['multisig'], wrapperProxy.address, data, conf.acct, amount)
    else:
        print('retrun too low')
    
def addLiquidity(converter, reserve, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=converter, abi=abi, owner=conf.acct)
    print("is active? ", converter.isActive())
    print("price oracle", converter.priceOracle())
    tx = converter.addLiquidity(reserve, amount, 1)
    print(tx)

def addLiquidityWithMS(converter, reserve, amount):
    # approve
    token = Contract.from_abi("ERC20", address=reserve, abi=ERC20.abi, owner=conf.acct)
    data = token.approve.encode_input(converter, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

    #add liquidity
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=converter, abi=abi, owner=conf.acct)
    data = converter.addLiquidity.encode_input(reserve, amount, 1)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], converter.address, data, conf.acct)

def readBalanceFromAMM():

    tokenContract = Contract.from_abi("Token", address=conf.contracts['USDT'], abi=TestToken.abi, owner=conf.acct)
    bal = tokenContract.balanceOf(conf.contracts['ConverterUSDT'])
    print("supply of USDT on swap", bal/1e18)

    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=conf.contracts['ConverterUSDT'], abi=abi, owner=conf.acct)

    reserve = converter.reserves(conf.contracts['USDT'])

    print("registered upply of USDT on swap", reserve[0]/1e18)
    print(reserve)

def testV1Converter(converterAddress, reserve1, reserve2):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV1Converter", address=converterAddress, abi=abi, owner=conf.acct)

    print(converter.reserveRatio())
    print(converter.reserves(reserve1))
    print(converter.reserves(reserve2))
    bal1 = converter.reserves(reserve1)[0]
    bal2 = converter.reserves(reserve2)[0]

    tokenContract1 = Contract.from_abi("Token", address=reserve1, abi=TestToken.abi, owner=conf.acct)
    tokenContract1.approve(converter.address, bal1/100)

    tokenContract2 = Contract.from_abi("Token", address=reserve2, abi=TestToken.abi, owner=conf.acct)
    tokenContract2.approve(converter.address, bal2/50)
    accountBalance = tokenContract2.balanceOf(conf.acct)

    converter.addLiquidity([reserve1, reserve2],[bal1/100, bal2/50],1)

    newAccountBalance = tokenContract2.balanceOf(conf.acct)

    print('oldBalance: ', accountBalance)
    print('newBalance: ', newAccountBalance)
    print('difference:', accountBalance - newAccountBalance)
    print('expected differnce:', bal2/100)

    addLiquidityV1UsingWrapper(converterAddress, [reserve1, reserve2], [bal1/100, bal2/50])

    newerAccountBalance = tokenContract2.balanceOf(conf.acct)
    print('difference:', newAccountBalance - newerAccountBalance)
    print('expected differnce:', bal2/100)

    balanceOnProxy = tokenContract2.balanceOf(conf.contracts['RBTCWrapperProxy'])
    print('balance on proxy contract after the interaction: ', balanceOnProxy)


def addLiquidityV1(converter, tokens, amounts):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV1Converter", address=converter, abi=abi, owner=conf.acct)

    print("is active? ", converter.isActive())

    token = Contract.from_abi("ERC20", address=tokens[0], abi=ERC20.abi, owner=conf.acct)
    token.approve(converter.address, amounts[0])
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=conf.acct)
    token.approve(converter.address, amounts[1])

    tx = converter.addLiquidity(tokens, amounts, 1)
    print(tx)

def addLiquidityV1FromMS(converter, tokens, amounts):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV1Converter", address=converter, abi=abi, owner=conf.acct)

    print("is active? ", converter.isActive())

    token = Contract.from_abi("ERC20", address=tokens[0], abi=ERC20.abi, owner=conf.acct)
    data = token.approve.encode_input(converter.address, amounts[0])
    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=conf.acct)
    data = token.approve.encode_input(converter.address, amounts[1])
    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

    data = converter.addLiquidity.encode_input(tokens, amounts, 1)
    sendWithMultisig(conf.contracts['multisig'], converter.address, data, conf.acct)
    

def addLiquidityV1UsingWrapper(wrapper, converter, tokens, amounts):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=conf.acct)
    
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=conf.acct)
    token.approve(wrapperProxy.address, amounts[1])
    
    tx = wrapperProxy.addLiquidityToV1(converter, tokens, amounts, 1, {'value': amounts[0]})
    print(tx)

def addLiquidityV2UsingWrapper(converter, tokenAddress, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=conf.contracts['RBTCWrapperProxy'], abi=abi, owner=conf.acct)
    
    token = Contract.from_abi("ERC20", address=tokenAddress, abi=ERC20.abi, owner=conf.acct)
    token.approve(wrapperProxy.address, amount)
    
    tx = wrapperProxy.addLiquidityToV2(converter, tokenAddress, amount, 1, {'allow_revert':True})
    print(tx)


def getTargetAmountFromAMM(_sourceReserveBalance, _sourceReserveWeight, _targetReserveBalance, _targetReserveWeight, _amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/SovrynSwapFormula.json')
    abi = json.load(abiFile)

    sovrynSwapFormula = Contract.from_abi("SovrynSwapFormula", address=conf.contracts['SovrynSwapFormula'], abi=abi, owner=conf.acct)

    targetAmount = sovrynSwapFormula.crossReserveTargetAmount(_sourceReserveBalance, _sourceReserveWeight, _targetReserveBalance, _targetReserveWeight, _amount)

    print(targetAmount)

#expects the first token to be wrbtc
#example: addLiquidityV1FromMultisigUsingWrapper(conf.contracts['RBTCWrapperProxyWithoutLM'], conf.contracts['ConverterMYNT'], [conf.contracts['WRBTC'], conf.contracts['MYNT']], [5e18,2500000e18] , 1)
def addLiquidityV1FromMultisigUsingWrapper(wrapper, converter, tokens, amounts, minReturn):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=conf.acct)

    # approve
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=conf.acct)
    data = token.approve.encode_input(wrapperProxy.address, amounts[1])
    #print(data)

    #sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)
    
    # addLiquidityToV1
    data = wrapperProxy.addLiquidityToV1.encode_input(converter, tokens, amounts, minReturn)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], wrapperProxy.address, data, conf.acct, amounts[0])

#expects the first token to be wrbtc
#example: removeLiquidityV1toMultisigUsingWrapper(conf.contracts['RBTCWrapperProxyWithoutLM'], conf.contracts['ConverterMYNT'], 100e18, [conf.contracts['WRBTC'], conf.contracts['MYNT']], [5e18,2500000e18])
def removeLiquidityV1toMultisigUsingWrapper(wrapper, converter, amount, tokens, minReturn):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address= wrapper, abi=abi, owner=conf.acct)

    converterAbiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    converterAbi = json.load(converterAbiFile)
    converterContract = Contract.from_abi("LiquidityPoolV1Converter", address=converter, abi=converterAbi, owner=conf.acct)
    poolToken = converterContract.anchor()

    # approve
    token = Contract.from_abi("ERC20", address=poolToken, abi=ERC20.abi, owner=conf.acct)
    data = token.approve.encode_input(wrapperProxy.address, amount)
    print(data)
    
    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

    # removeLiquidityFromV1
    data = wrapperProxy.removeLiquidityFromV1.encode_input(converter, amount, tokens, minReturn)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], wrapperProxy.address, data, conf.acct)


def readWRBTCAddressFromWrapper(wrapper):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=conf.acct)
    print(wrapperProxy.wrbtcTokenAddress())

def setOracleOnV1Converter(converterAddress, oracleAddress):
    converterAbiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    converterAbi = json.load(converterAbiFile)
    converterContract = Contract.from_abi("LiquidityPoolV1Converter", address=converterAddress, abi=converterAbi, owner=conf.acct)

    data = converterContract.setOracle.encode_input(oracleAddress)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], converterContract.address, data, conf.acct)

def printV1ConverterData(converterAddress): #, reserve1, reserve2
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    abiLPv1Converter = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV1Converter", address=converterAddress, abi=abiLPv1Converter, owner=conf.acct)
    anchor = converter.anchor()
    poolToken = Contract.from_abi("Token", address=anchor, abi=TestToken.abi, owner=conf.acct)
    print("")
    converterType = converter.converterType()
    print('converter',poolToken.symbol(),"type", converterType,":", converterAddress)
    if(converterType == 1):
        try:
            print('oracle:', converter.oracle())
        except:
            print('NO ORACLE!')
    print('converter.conversionFee():', converter.conversionFee()) 
    print('converter.reserveRatio():', converter.reserveRatio())
    print('amm converter pool token (anchor):', anchor)
    print('reserve token: (balance, weight, deprecated1, deprecated2, isSet)')
    for i in range(0, 2):
        reserveTokenAddress = converter.reserveTokens(i)
        try:
            reserveToken = Contract.from_abi("Token", address=reserveTokenAddress, abi=TestToken.abi, owner=conf.acct)
            print('reserve token ',i,': ',reserveToken.symbol(),', address:', reserveTokenAddress, converter.reserves(reserveTokenAddress))
        except:
            print("Error when printing reserve token",i,reserveTokenAddress)

def printConverterRegistryData():
    abiFile =  open('./scripts/contractInteraction/ABIs/ConverterRegistry.json')
    abi = json.load(abiFile)
    converterRegistry = Contract.from_abi("ConverterRegistry", address=conf.contracts["ConverterRegistry"], abi=abi, owner=conf.acct)
    anchors = converterRegistry.getAnchors()
    converters = converterRegistry.getConvertersByAnchors(anchors)
    print("\n", "======= ALL CONVERTERS DATA =======", "\n")
    print("converters:", converters)
    print("")
    print("anchors (pool tokens):", anchors)
    print("")
    print("converters qty:", len(converters))
    for i in range (0, len(converters)):
        printV1ConverterData(converters[i])

def removeLiquidityV2toMultisig(converter, poolToken, amount, minReturn):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=converter, abi=abi, owner=conf.acct)
    print("is active? ", converter.isActive())
    print("price oracle", converter.priceOracle())
    data = converter.removeLiquidity.encode_input(poolToken, amount, minReturn)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], converter.address, data, conf.acct)

def getReturnForV2PoolToken(converter, poolToken, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=converter, abi=abi, owner=conf.acct)
    return converter.removeLiquidityReturnAndFee(poolToken, amount)

def withdrawFromRBTCWrapperProxy(tokenAddress, to, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=conf.contracts['RBTCWrapperProxy'], abi=abi, owner=conf.acct)
    wrapperProxy.withdraw(tokenAddress, to, amount)

def transferOwnershipAMMContractsToGovernance(contractAddress, newOwnerAddress, contractName=''):
    abiFile =  open('./scripts/contractInteraction/ABIs/Owned.json')
    abi = json.load(abiFile)
    ammContract = Contract.from_abi("AMMContract", address=contractAddress, abi=abi, owner=conf.acct)

    if(contractName):
        # # verify the contract address
        contractRegistry = Contract.from_abi("sovryn", address=conf.contracts['ammContractRegistry'], abi=interface.IContractRegistry.abi, owner=conf.acct)
        _contractAddress = contractRegistry.addressOf(web3.toHex(contractName.encode('utf-8')).ljust(66, '0'))

        if(_contractAddress != contractAddress):
            raise Exception("Unmatched contract address with the on-chain")

    currentOwner = ammContract.owner()
    if(currentOwner != conf.contracts['multisig']):
        raise Exception("Multisig is not the owner")

    print("Transferring ownership of {0} to {1}".format(contractAddress, newOwnerAddress))
    data = ammContract.transferOwnership.encode_input(newOwnerAddress)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], ammContract.address, data, conf.acct)

def getExchequerBalances():
    usdtPool = getBalance(conf.contracts['(WR)BTC/USDT2'], conf.contracts['multisig'])
    balanceAndFee = getReturnForV2PoolToken(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], usdtPool)
    usdtBalance = balanceAndFee[0]

    bnbPool = getBalance(conf.contracts['(WR)BTC/BNB'], conf.contracts['multisig'])
    bnbPoolTotal = getTotalSupply(conf.contracts['(WR)BTC/BNB'])
    bnbBalanceInPool = getBalance(conf.contracts['BNBs'], conf.contracts['ConverterBNBs'])
    rbtcBalanceInPool = getBalance(conf.contracts['WRBTC'], conf.contracts['ConverterBNBs'])

    print('----------------')
    bnbBalance = bnbPool / bnbPoolTotal * bnbBalanceInPool
    wrbtcBalance = bnbPool / bnbPoolTotal * rbtcBalanceInPool

    print("USDT balance: ", usdtBalance/1e18)
    print("BNB balance: ", bnbBalance/1e18)
    print("WRBTC balance: ", wrbtcBalance/1e18)

def getConversionFee(converterAddress):
    converter = getV1Converter(converterAddress)
    print(converter.conversionFee())

def setConversionFee(converterAddress, conversionFee):
    converter = getV1Converter(converterAddress)
    data = converter.setConversionFee.encode_input(conversionFee)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], converter.address, data, conf.acct)

def getProtocolFee():
    swapSettings = getSwapSettings()
    print(swapSettings.protocolFee())


def setProtocolFee(protocolFee):
    swapSettings = getSwapSettings()
    data = swapSettings.setProtocolFee.encode_input(protocolFee)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], swapSettings.address, data, conf.acct)


def getSwapSettings():
    abiFile =  open('./scripts/contractInteraction/ABIs/SwapSettings.json')
    abi = json.load(abiFile)
    return Contract.from_abi("SwapSettings", address=conf.contracts['SwapSettings'], abi=abi, owner=conf.acct)

def getV1Converter(converterAddress):
    abiFile =  open('./scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    return Contract.from_abi("LiquidityPoolV1Converter", address=converterAddress, abi=abi, owner=conf.acct)

def getReturnForFirstLiquidityProvisionOnV1(reserveAmounts):
    converter = getV1Converter(conf.contracts['ConverterSOV'])
    poolTokens = converter.geometricMean(reserveAmounts)
    print(poolTokens/1e18)
    return poolTokens
