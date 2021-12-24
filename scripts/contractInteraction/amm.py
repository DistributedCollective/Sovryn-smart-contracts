from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

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

def addLiquidityV1UsingWrapper(wrapper, converter, tokens, amounts):
    abiFile =  open('./scripts/contractInteraction/ABIs/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=conf.acct)
    '''
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=conf.acct)
    token.approve(wrapperProxy.address, amounts[1])
    '''
    tx = wrapperProxy.addLiquidityToV1(converter, tokens, amounts, 1, {'value': amounts[0], 'allow_revert':True})
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
    print(data)

    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)
    
    # addLiquidityToV1
    data = wrapperProxy.addLiquidityToV1.encode_input(converter, tokens, amounts, minReturn)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], wrapperProxy.address, data, conf.acct)

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