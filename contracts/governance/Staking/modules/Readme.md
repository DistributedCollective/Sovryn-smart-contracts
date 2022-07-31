## TODOs
[x] Update IStakingModules interface
[x] Create a deployment boilerplate for modules - use deploy plugin for deployment and for testing
[x] Verify ApprovalReceiver - functionality & tests
[x] Add modules batch processing
[ ] Docs: 
    - when extending Storage, DO NOT create public storage variables but add getters to StakingStorageModule 
    - now access to ALL storage variables
    - a showcase explanation - how to use ModulesProxy and modules
    - modules: how to add contract, `function getFunctionList() external pure returns (bytes4[] memory)`- list all functions, add functions signatures to the generic IStaking.sol to be accessible from the scripts 


## Pre- and Deployment flow  
[x] Replace all logics usage over the proxy address with modules where applicable
[x] Use hh deploy plugin for deployment
    - add deployment scripts 
    - add scripts to interact with the contract as experiment (postponed, all scripts in py should work)
[x] Fix all relevant python scripts

[x] Create draft SIP to deploy refactored modularized Staking 
[ ] Redeploy VestingRegistryLogic to use isVestingAddress(address _vestingAddress) function instead of the one with wrong name spelling isVestingAdress(address _vestingAddress)  
[ ] Deploy Modules and ModulesProxy
[ ] Update addresses in SIP send SIP for voting
[ ] Execute proposal if approved which will: 
- Replace StakingProxy logic with the StakingModulesProxy
- Run addModules func to add modules/register functions
[ ] Verify Modules, Shared contracts and ModulesProxy