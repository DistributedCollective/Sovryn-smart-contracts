## TODOs
[ ] Create a deployment boilerplate for modules - use deploy plugin for deployment and for testing
[ ] Update IStakingModules interface
[ ] Verify ApprovalReceiver - functionality & tests
[ ] Docs: 
    - when extending Storage, DO NOT create public storage variables but add getters to StakingStorageModule 
    - now access to ALL storage variables
[ ]


## Pre- and Deployment flow  
[ ] Replace all logics usage over the proxy address with modules where applicable
[ ] Use hh deploy plugin for deployment
    - add deployment scripts 
    - add scripts to interact with the contract as experiment
[ ] Fix all relevant python scripts

[ ] Create SIP to deploy refactored modularized Staking 
[ ] Redeploy VestingRegistryLogic to use isVestingAddress(address _vestingAddress) function instead of the one with wrong name spelling isVestingAdress(address _vestingAddress)  
[ ] Deploy Modules  
[ ] Replace StakingProxy logic with the StakingModulesProxy & StakingLogic with refactored
[ ] Verify Modules, Shared contracts and ModulesProxy