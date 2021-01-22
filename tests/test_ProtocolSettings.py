#!/usr/bin/python3

import pytest
from brownie import reverts

'''
    Deploys the multisig wallet contract setting 3 owners and 2 required confirmations
'''
@pytest.fixture(scope="module", autouse=True) 
def multisig(accounts, MultiSigWallet):
    requiredConf=2
    owners = [accounts[0], accounts[1], accounts[2]]
    return accounts[0].deploy(MultiSigWallet, owners, requiredConf)
    
"""
    Change Sovryn contract owner to multisig
"""
@pytest.fixture(scope="module", autouse=True)
def set_owner_to_multisig(sovryn, multisig):
    sovryn.transferOwnership(multisig.address)    


def test_setCoreParams(Constants, sovryn, multisig, accounts):
    dest = sovryn.address
    val = 0
    data = sovryn.setPriceFeedContract.encode_input(Constants["ONE_ADDRESS"])
    
    tx = multisig.submitTransaction(dest, val, data, {"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    data = sovryn.setSwapsImplContract.encode_input(Constants["ONE_ADDRESS"])
    tx = multisig.submitTransaction(dest, val, data, {"from": accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})
    
    assert sovryn.priceFeeds() == Constants["ONE_ADDRESS"]
    assert sovryn.swapsImpl() == Constants["ONE_ADDRESS"]



def test_setLoanPool(Constants, sovryn, multisig, accounts):

    assert(sovryn.loanPoolToUnderlying(accounts[6]) == Constants["ZERO_ADDRESS"])
    assert(sovryn.underlyingToLoanPool(accounts[7]) == Constants["ZERO_ADDRESS"])

    assert(not sovryn.isLoanPool(accounts[6]))
    assert(not sovryn.isLoanPool(accounts[8]))



    dest = sovryn.address
    val = 0
    data = sovryn.setLoanPool.encode_input(
        [
            accounts[6],
            accounts[8]
        ],
        [
            accounts[7],
            accounts[9]
        ]
    )
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    assert(sovryn.loanPoolToUnderlying(accounts[6]) == accounts[7])
    assert(sovryn.underlyingToLoanPool(accounts[7]) == accounts[6])

    assert(sovryn.loanPoolToUnderlying(accounts[8]) == accounts[9])
    assert(sovryn.underlyingToLoanPool(accounts[9]) == accounts[8])

    assert(sovryn.isLoanPool(accounts[6]))
    assert(sovryn.isLoanPool(accounts[8]))

    #print(sovryn.getloanPoolsList(0, 100))

    data = sovryn.setLoanPool.encode_input(
        [
            accounts[6]
        ],
        [
            Constants["ZERO_ADDRESS"]
        ]
    )
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})


    assert(sovryn.loanPoolToUnderlying(accounts[6]) == Constants["ZERO_ADDRESS"])
    assert(sovryn.underlyingToLoanPool(accounts[7]) == Constants["ZERO_ADDRESS"])

    assert(not sovryn.isLoanPool(accounts[6]))

    #print(sovryn.getloanPoolsList(0, 100))

    #assert(False)


'''
@pytest.mark.parametrize('idx', [0, 1, 2])
def test_transferFrom_reverts(token, accounts, idx):
    with brownie.reverts("Insufficient allowance"):
        token.transferFrom(accounts[0], accounts[2], 1e18, {'from': accounts[idx]})
'''


def test_set_wrbtc_token(sovryn, Constants, WRBTC, multisig, accounts):
    assert(sovryn.owner() == multisig.address)
    
    dest = sovryn.address
    val = 0
    data =  sovryn.setWrbtcToken.encode_input(WRBTC.address)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    assert(sovryn.wrbtcToken() == WRBTC.address)

    with reverts("unauthorized"):
        sovryn.setWrbtcToken(WRBTC.address, {'from': accounts[0]})


def test_set_protocol_token_address(sovryn, Constants, multisig, accounts):
    assert(sovryn.owner() == multisig.address)
    assert(sovryn.protocolTokenAddress() == Constants["ZERO_ADDRESS"])
    
    dest = sovryn.address
    val = 0
    data = sovryn.setProtocolTokenAddress.encode_input(sovryn.address)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    assert(sovryn.protocolTokenAddress() == sovryn.address)

    with reverts("unauthorized"):
        sovryn.setProtocolTokenAddress(sovryn.address, {'from': accounts[1]})


'''
    Should set and deposit the protocol token
    1. deploy erc20
    2. set address
    3. approve token transfer
    4. deposit tokens
    5. verify balance
'''
def test_deposit_protocol_token(sovryn, accounts, multisig, TestToken):
    dest = sovryn.address
    val = 0
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    
    sov.transfer(multisig.address, 1e50, {'from': accounts[0]})
    
    
    data = sov.approve.encode_input(sovryn.address, 1e20)
    
    tx = multisig.submitTransaction(sov.address,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    data = sovryn.setProtocolTokenAddress.encode_input(sov.address)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})


    data = sovryn.depositProtocolToken.encode_input(1e20)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    tx2 = multisig.confirmTransaction(txId, {"from": accounts[1]})

    assert(sovryn.protocolTokenHeld() == 1e20)

    
'''
    Should fail to deposit the protocl token
'''
def test_fail_deposit_protocol_token(sovryn, accounts, multisig, TestToken):
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    sov.transfer(multisig.address, 1e50, {'from': accounts[0]})
    
    dest = sovryn.address
    val = 0
    
    data = sov.approve.encode_input(sovryn.address, 1e20)
    tx = multisig.submitTransaction(sov.address,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})


    data = sovryn.setProtocolTokenAddress.encode_input(sov.address)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    with reverts("unauthorized"):
        sovryn.depositProtocolToken(sov.address, {"from":accounts[0]})
    
'''
    Should successfully withdraw all deposited protocol tokens
'''
def test_withdraw_protocol_token(sovryn, accounts, multisig, TestToken):
    dest = sovryn.address
    val = 0
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    
    sov.transfer(multisig.address, 1e50, {'from': accounts[0]})
    
    
    data = sov.approve.encode_input(sovryn.address, 1e20)
    
    tx = multisig.submitTransaction(sov.address,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    data = sovryn.setProtocolTokenAddress.encode_input(sov.address)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})


    data = sovryn.depositProtocolToken.encode_input(1e20)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    tx2 = multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    balanceBefore = sov.balanceOf(accounts[1])
    
    
    data = sovryn.withdrawProtocolToken.encode_input(accounts[1], 1e20)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    balanceAfter = sov.balanceOf(accounts[1])
    assert(sovryn.protocolTokenHeld() == 0)
    assert(balanceAfter==balanceBefore+1e20)
    
'''
    Should fail to withdraw 1e30 protocol tokens but withdraw 1e20
'''
def test_fail_withdraw_protocol_token(sovryn, multisig, accounts, TestToken):
    dest = sovryn.address
    val = 0
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    
    sov.transfer(multisig.address, 1e50, {'from': accounts[0]})
    
    
    data = sov.approve.encode_input(sovryn.address, 1e20)
    
    tx = multisig.submitTransaction(sov.address,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    data = sovryn.setProtocolTokenAddress.encode_input(sov.address)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})


    data = sovryn.depositProtocolToken.encode_input(1e20)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    tx2 = multisig.confirmTransaction(txId, {"from": accounts[1]})

    
    balanceBefore = sov.balanceOf(accounts[1])
    
    
    data = sovryn.withdrawProtocolToken.encode_input(accounts[1], 1e30)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    multisig.confirmTransaction(txId, {"from": accounts[1]})


    balanceAfter = sov.balanceOf(accounts[1])
    assert(sovryn.protocolTokenHeld() == 0)
    assert(balanceAfter==balanceBefore+1e20)



'''
    Should successfully change rollover base reward
'''
def test_set_rollover_base_reward(sovryn, multisig, accounts):
    new_reward = 1e15
    old_reward = sovryn.rolloverBaseReward()
    
    
    dest = sovryn.address
    val = 0
    data = sovryn.setRolloverBaseReward.encode_input(new_reward)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    tx2 = multisig.confirmTransaction(txId, {"from": accounts[1]})

    event = tx2.events['SetRolloverBaseReward']
    assert(event['sender'] == multisig.address)
    assert(event['oldValue'] == old_reward)
    assert(event['newValue'] == new_reward)
    assert(sovryn.rolloverBaseReward() == new_reward)


'''
    Should fail to change rollover base reward by unauthorized user 
'''
def test_set_rollover_base_reward_by_unauthorized_user(sovryn, multisig, accounts):
    with reverts("unauthorized"):
        sovryn.setRolloverBaseReward(1e15, {'from': accounts[0]})


'''
    Should successfully change rebate percent 
'''
def test_set_rebate_percent(sovryn, multisig, accounts):
    new_percent = 20e18
    old_percent = sovryn.feeRebatePercent()
    
    
    dest = sovryn.address
    val = 0
    data = sovryn.setRebatePercent.encode_input(new_percent)
    print(data)
    
    tx = multisig.submitTransaction(dest,val,data,{"from":accounts[0]})
    txId = tx.events["Submission"]["transactionId"]
    tx2 = multisig.confirmTransaction(txId, {"from": accounts[1]})

    event = tx2.events['SetRebatePercent']
    assert(event['sender'] == multisig.address)
    assert(event['oldRebatePercent'] == old_percent)
    assert(event['newRebatePercent'] == new_percent)
    assert(sovryn.feeRebatePercent() == new_percent)


'''
    Should fail to change rebate percent by unauthorized user 
'''
def test_set_rebate_percent_by_unauthorized_user(sovryn, multisig, accounts):
    with reverts("unauthorized"):
        sovryn.setRebatePercent(20e18, {'from': accounts[0]})

