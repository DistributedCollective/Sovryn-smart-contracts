
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.loan_tokens import *
from scripts.contractInteraction.protocol import *
from scripts.contractInteraction.staking_vesting import *
from scripts.contractInteraction.multisig import *
from scripts.contractInteraction.governance import *
from scripts.contractInteraction.liquidity_mining import *
from scripts.contractInteraction.amm import *
from scripts.contractInteraction.token import *
from scripts.contractInteraction.ownership import *
from scripts.contractInteraction.misc import *
from scripts.contractInteraction.prices import *

def main():
    
    #load the contracts and acct depending on the network
    conf.loadConfig()

    def stakeTokens(sovAmount, stakeTime, acctAddress, delegateeAddress):
        SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=acctAddress)
        staking = Contract.from_abi("StakingTN", address=conf.contracts['StakingTN'], abi=StakingTN.abi, owner=acctAddress)

        until = int(time.time()) + int(stakeTime)
        amount = int(sovAmount) * (10 ** 18)

        SOVtoken.approve(staking.address, amount)
        tx = staking.stake(amount, until, acctAddress, delegateeAddress)

    def getDetails(acctAddress):
        staking = Contract.from_abi("StakingTN", address=conf.contracts['StakingTN'], abi=StakingTN.abi, owner=acctAddress)
        print(staking.kickoffTS())
        print(staking.getStakes(acctAddress))
        print(staking.timestampToLockDate(time.time()))
        #print(int(len(chain) - 2 - (((time.time()- 1632148108)/32))));
        #print(int(len(chain) - 2 - (((time.time()- 1632148108)/32))))
        #print(staking.getPriorWeightedStake(acctAddress, int(len(chain) - 2 - (((time.time()- 1632148108)/33))), 1632148108))
        #print(staking.getPriorWeightedStake(acctAddress, int(len(chain) - 2 - (((time.time()- 1632234508)/33))), 1632234508))
        #print(staking.getPriorWeightedStake(acctAddress, len(chain) - 2, 1632320908))
        #tx = staking.extendStakingDuration(1634351308, 1634437708, {"allow_revert": True})
        # tx = staking.withdraw(1000000000000000000000, 1634437708, acctAddress)

    def getRewards(acctAddress):
        stakingRewards = Contract.from_abi("StakingRewardsTN", address=conf.contracts['StakingRewardsProxyTN'], abi=StakingRewardsTN.abi, owner=acctAddress)
        print(stakingRewards.getStakerCurrentReward(True, {'from': acctAddress}))
        print(stakingRewards.staking())
        print(stakingRewards.deploymentBlock())
        print(stakingRewards.maxDuration())
        print(stakingRewards.stopBlock())
        print(stakingRewards.startTime())
        print(stakingRewards.averageBlockTime())
        print(stakingRewards.withdrawals(acctAddress))
        print(stakingRewards.checkpointBlockDetails(1639996306))
        print(stakingRewards.checkpointBlockDetails(1640082706))
        print(stakingRewards.checkpointBlockDetails(1640169106))
        print(stakingRewards.checkpointBlockDetails(1640255506))
        print(stakingRewards.checkpointBlockDetails(1640341906))
        print(stakingRewards.checkpointBlockDetails(1640428306))
        print(stakingRewards.checkpointBlockDetails(1640514706))
        print(stakingRewards.checkpointBlockDetails(1640601106))
        print(stakingRewards.checkpointBlockDetails(1640687506))
        # a = stakingRewards.getClaimableReward(True, {'from': acctAddress})
        # b = stakingRewards.accumulatedRewards(acctAddress)
        # print(a-b)
        # print(stakingRewards.withdrawals(acctAddress))
        # print(stakingRewards.stakingActivity(acctAddress))

    def getImplementation():        
        # Get the proxy contract instance
        stakingProxy = Contract.from_abi("StakingProxyTN", address=conf.contracts['StakingTN'], abi=StakingProxyTN.abi, owner=conf.acct)

        # Register logic in Proxy
        data = stakingProxy.getImplementation()
        print(data)

        # Get the proxy contract instance
        stakingRewardsProxy = Contract.from_abi("StakingRewardsProxyTN", address=conf.contracts['StakingRewardsProxyTN'], abi=StakingRewardsProxyTN.abi, owner=conf.acct)

        # Register logic in Proxy
        data = stakingRewardsProxy.getImplementation()
        print(data)

        #data = stakingProxy.getOwner()
        #print(data)

    def setMaxDuration():
        stakingRewards = Contract.from_abi("StakingRewardsTN", address=conf.contracts['StakingRewardsProxyTN'], abi=StakingRewardsTN.abi, owner=conf.acct)
        #stakingRewards.setMaxDuration(2592000)
        print(stakingRewards.maxDuration())

    #call the functions you want here
    # stakeTokens(1000, 2246400, "0x511893483DCc1A9A98f153ec8298b63BE010A99f", "0x511893483DCc1A9A98f153ec8298b63BE010A99f")
    # stakeTokens(1000, 4492800, "0x511893483DCc1A9A98f153ec8298b63BE010A99f", "0x511893483DCc1A9A98f153ec8298b63BE010A99f")
    # stakeTokens(1000, 6739200, "0x511893483DCc1A9A98f153ec8298b63BE010A99f", "0x511893483DCc1A9A98f153ec8298b63BE010A99f")
    #readStakingKickOff()
    # getRewards("0x8517ECce55f6D11e4A60eddbB7f4090dd2aC19E7")
    # getRewards("0xC6138eC6c65e3280e720d4E6da0FD91A061351c4")
    # getRewards("0x49d99a6821B7569f8D409728eD1D3EF5bF1befa9")
    # getRewards("0xBf151ed43445a093E991211d46A34f60F02a9E09")
    # getRewards("0xC4fc1021aAFa8Dfdb02C544D264638b18673aC94")
    # getImplementation()
    # getDetails("0x511893483DCc1A9A98f153ec8298b63BE010A99f")

    getRewards("0x511893483DCc1A9A98f153ec8298b63BE010A99f")

    #Bundle Deployment
    #upgradeStaking()
    #deployFeeSharingProxy()
    #deployConversionFeeSharingToWRBTC()
    #updateAddresses()
    # setMaxDuration()

    #kickOff: Monday, 20 December 2021 16:01:46  - 1639996306
    #Upgrade: Wednesday, 22 September 2021 19:50:08 - 1632320408
    #deploymentBlock: 2433452
    #startTime: Monday, 20 December 2021 16:01:46  - 1639996306

    # Latest Deployment
    # upgradeStakingRewards()
    # setAverageBlockTime(32)
    # setBlockForStakingRewards()
    # setHistoricalBlockForStakingRewards(1640428306)
    # setHistoricalBlockForStakingRewards(1640082706)