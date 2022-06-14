from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    Removes historically set lending pools limits  
    brownie run scripts/contractInteraction/tasks/remove_lending_pools_tx_limits.py --network testnet
    brownie run scripts/contractInteraction/tasks/remove_lending_pools_tx_limits.py --network rsk-mainnet
    '''
    print('iRBTC')
    readTransactionLimits(conf.contracts['iRBTC'], conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro'], conf.contracts['XUSD'])
    print('iBPro')
    readTransactionLimits(conf.contracts['iBPro'], conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro'], conf.contracts['XUSD'])
    print('iDOC')
    readTransactionLimits(conf.contracts['iDOC'], conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro'], conf.contracts['XUSD'])
    print('iUSDT')
    readTransactionLimits(conf.contracts['iUSDT'], conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro'], conf.contracts['XUSD'])
    print('iXUSD')
    readTransactionLimits(conf.contracts['iXUSD'], conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro'], conf.contracts['XUSD'])

    '''
    setTransactionLimits(conf.contracts['iRBTC'], [conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro']],[0,0,0,0])
    setTransactionLimits(conf.contracts['iBPro'], [conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro']],[0,0,0,0])
    setTransactionLimits(conf.contracts['iDOC'], [conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro']],[0,0,0,0])
    '''
    # DO NOT RUN for iUSDT - it is excluded from margine trading and we leave it as is just in case 
    # setTransactionLimits(conf.contracts['iUSDT'], [conf.contracts['DoC'], conf.contracts['WRBTC'], conf.contracts['USDT'], conf.contracts['BPro']],[0,0,0,0])
    