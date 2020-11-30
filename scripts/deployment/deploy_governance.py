from brownie import *

import time;

def main():
    thisNetwork = network.show_active()
    
    if thisNetwork == "development":
        acct = accounts[0]
        guardian = acct
        SOV = acct.deploy(TestToken, "SOV", "SOV", 18, 1e26).address
        delay = 2*24*60*60
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        guardian = '0x189ecD23E9e34CFC07bFC3b7f5711A23F43F8a57'
        SOV = '0x04fa98E97A376a086e3BcAB99c076CB249e5740D'
        delay = 3*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        delay = 2*24*60*60
        raise Exception("set guardian and SOV token!")
    else:
        raise Exception("network not supported")
    
    
    #deploy the staking contracts
    stakingLogic = acct.deploy(Staking)
    staking = acct.deploy(StakingProxy, SOV)
    staking.setImplementation(stakingLogic.address)
    #params: admin, delay
    timelock = acct.deploy(Timelock, acct, delay)
    #params: timelock. staking, guardian
    governor = acct.deploy(GovernorAlpha, timelock.address, staking.address, guardian)

    dataString = timelock.setPendingAdmin.encode_input(governor.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + 3*60*60 + 300
    print("schedule ownership transfer for ", eta)
    timelock.queueTransaction(timelock.address, 0, "setPendingAdmin(address)", dataString[10:], eta)
    
    
    #todo: set sovryn owner to timelock
    