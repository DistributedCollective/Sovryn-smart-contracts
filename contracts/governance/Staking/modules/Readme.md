## TODOs
[X] Update IStakingModules interface
[ ] Create a deployment boilerplate for modules - use deploy plugin for deployment and for testing
[ ] Verify ApprovalReceiver - functionality & tests
[ ] Docs: 
    - when extending Storage, DO NOT create public storage variables but add getters to StakingStorageModule 
    - now access to ALL storage variables
    - a showcase explanation - how to reuse
    - modules: add contract, `function getFunctionList() external pure returns (bytes4[] memory)`- list all functions, add functions signatures to IStakingModules.sol to be accessible from the scripts 
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