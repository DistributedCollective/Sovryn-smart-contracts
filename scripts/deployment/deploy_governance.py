from brownie import *

def main():
    thisNetwork = network.show_active()
    
    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
        
    SOV = acct.deploy(TestToken, "SOV", "SOV", 18, 1e26)
    staking = acct.deploy(Staking, SOV.address)
    #params: admin, delay
    timelock = acct.deploy(Timelock, acct, 2*24*60*60)
    #params: timelock. staking, guardian
    governor = acct.deploy(GovernorAlpha, timelock.address, staking.address, acct)

