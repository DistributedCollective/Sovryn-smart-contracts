## SOV-3191 QA Test:  

In the core protocol repo, create QA tests for all pause/unpause and freeze/unfreeze hh tasks:
pausing:*  

### List of tasks:  

```
  pausing:freeze-fastbtc                        Freeze BiDi FastBTC
  pausing:is-fastbtc-frozen                     Log FastBTCBiDi is frozen or not frozen
  pausing:unfreeze-fastbtc                      Unfreeze BiDi FastBTC

  pausing:pause-fastbtc                         Pause BiDi FastBTC
  pausing:is-fastbtc-paused                     Log FastBTCBiDi is paused or not paused
  pausing:unpause-fastbtc                       Unpause BiDi FastBTC

  pausing:pause-staking                         Pause Staking Modules Contracts
  pausing:is-staking-paused                     Log Staking paused or unpaused
  pausing:unpause-staking                       Pause Staking Modules Contracts
  
  pausing:freeze-staking-withdrawal             Freeze Staking Withdrawal
  pausing:is-staking-frozen                     Log Staking frozen or not frozen
  pausing:unfreeze-staking-withdrawal           Unfreeze Staking Withdrawal
  
  pausing:pause-lp-beacons                      Pause Lending Pools Beacons
  pausing:print-lp-beacons-paused               Log Lending Pools Beacons paused/unpaused
  pausing:unpause-lp-beacon(s)                  Unpause Lending Pools Beacons
  
  pausing:pause-protocol                        Pause Sovryn protocol modules
  pausing:is-protocol-paused                    Pause Sovryn protocol modules
  pausing:unpause-protocol                      Lift pause from Sovryn protocol modules

  pausing:pause-unpause-lending-pool-functions  Pause/unpause Lending Pools functions
  pausing:is-lending-pool-functions-paused      Log Lending Pools functions paused/unpaused
```

These tasks must be tested on chain.  